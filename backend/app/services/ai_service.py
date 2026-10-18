"""Dedicated AI integration service for the Karnataka travel planner.

Provides configurable AI provider abstraction (OpenAI-compatible, Gemini, Mock),
strict prompt construction with curated catalog data only, structured Pydantic
output validation, sensitive credential redaction, request timeouts, and robust
error handling for rate limits, network errors, and provider failures.

Deterministic scoring, routing, cost totals, and constraint validation remain
in deterministic application modules.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
import json
import logging
import re
from typing import NamedTuple, Optional, Sequence

import httpx
from pydantic import BaseModel, Field, ValidationError

from app.config import Settings, get_settings
from app.data.loader import get_destination
from app.schemas import (
    ActivityKind,
    DayActivity,
    DayPlan,
    DestinationRecord,
    DestinationSuitability,
    Place,
    PlanRequest,
    SuggestedSubstitution,
)

logger = logging.getLogger("karnataka.ai_service")


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class AIGenerationError(RuntimeError):
    """Base error raised when the AI cannot produce a valid plan."""


class AITimeoutError(AIGenerationError):
    """Raised when the AI provider request times out."""


class AIRateLimitError(AIGenerationError):
    """Raised when the AI provider returns HTTP 429 Rate Limit."""


class AIAuthenticationError(AIGenerationError):
    """Raised when authentication with the AI provider fails (HTTP 401/403)."""


class AIProviderError(AIGenerationError):
    """Raised when the AI provider fails with a 5xx error."""


class AINetworkError(AIGenerationError):
    """Raised when network connectivity fails (DNS, connection reset, etc.)."""


class AIValidationError(AIGenerationError):
    """Raised when the AI output fails validation (schema, IDs, duplicates, constraints)."""


# ---------------------------------------------------------------------------
# Sensitive Data Sanitization
# ---------------------------------------------------------------------------


def sanitize_sensitive_text(text: str, sensitive_values: Optional[Sequence[str]] = None) -> str:
    """Mask API keys, bearer tokens, and sensitive values in logs and exception messages."""
    if not text:
        return ""
    # Mask Bearer tokens
    sanitized = re.sub(r"(?i)bearer\s+[\w\-\.]{6,}", "Bearer [REDACTED]", text)
    # Mask common auth/key patterns
    sanitized = re.sub(
        r"(?i)(api[_-]?key|secret|token|password|auth)[:=]\s*['\"]?[\w\-\.]{6,}['\"]?",
        r"\1=[REDACTED]",
        sanitized,
    )
    # Mask specific passed secrets
    if sensitive_values:
        for val in sensitive_values:
            if val and len(val) >= 4:
                sanitized = sanitized.replace(val, "[REDACTED]")
    return sanitized


# ---------------------------------------------------------------------------
# Structured LLM Output Schema (Pydantic)
# ---------------------------------------------------------------------------


class AIActivityDraft(BaseModel):
    time: str = Field(default="09:00", description="24h time in HH:MM format")
    title: str = Field(min_length=1, description="Concise activity title")
    description: str = Field(min_length=1, description="Specific description with local context")
    kind: ActivityKind = Field(default=ActivityKind.sightseeing)


class AIDayDraft(BaseModel):
    day: int = Field(ge=1, description="1-indexed day number")
    destination_id: str = Field(description="Must match an approved catalog destination ID")
    day_title: str = Field(default="", description="Readable thematic day title")
    narrative: Optional[str] = Field(default=None, description="Short narrative theme for this day")
    activities: list[AIActivityDraft] = Field(min_length=1)
    travel_tips: list[str] = Field(default_factory=list, description="Practical travel tips for this day")


class AIDestinationExplanationDraft(BaseModel):
    destination_id: str
    explanation: str = Field(description="Why this destination suits the traveller's interests and pace")


class AISuggestedSubstitutionDraft(BaseModel):
    current_destination_id: str
    suggested_destination_id: str = Field(description="Must exist in the approved catalog")
    reason: str = Field(description="Why this substitution could be an attractive alternative")


class AIPlanDraft(BaseModel):
    summary: str = Field(min_length=1, description="Personalized itinerary narrative summary")
    days: list[AIDayDraft] = Field(min_length=1)
    destination_explanations: list[AIDestinationExplanationDraft] = Field(default_factory=list)
    practical_tips: list[str] = Field(default_factory=list)
    suggested_substitutions: list[AISuggestedSubstitutionDraft] = Field(default_factory=list)


class AIPersonalizationResult(NamedTuple):
    summary: str
    itinerary: list[DayPlan]
    destination_explanations: list[DestinationSuitability]
    practical_tips: list[str]
    suggested_substitutions: list[SuggestedSubstitution]
    ai_provider: str


# ---------------------------------------------------------------------------
# Prompt Construction
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are an expert Karnataka travel planning AI assistant.
Your task is to personalize the itinerary narrative, explain why selected destinations suit the traveller, suggest regional experiences supported by available data, create readable day titles and practical travel tips, and suggest substitutions from the approved catalog.

CRITICAL CONSTRAINTS:
1. You MUST reply ONLY with valid JSON conforming to the requested schema. No surrounding prose.
2. You MUST ONLY use destination IDs from the provided catalog. NEVER invent, hallucinate, or alter any destination ID.
3. Keep times in 24-hour HH:MM format (e.g. '09:00', '14:30').
4. Every day must have at least one usable activity.
5. Do NOT compute budgets or costs. Keep day schedules aligned with the given day allocation.

JSON Schema:
{
  "summary": "engaging personalized narrative overview of the trip",
  "destination_explanations": [
    {"destination_id": "string", "explanation": "why this destination suits the traveller"}
  ],
  "practical_tips": ["practical tip 1", "practical tip 2"],
  "suggested_substitutions": [
    {"current_destination_id": "string", "suggested_destination_id": "string", "reason": "string"}
  ],
  "days": [
    {
      "day": 1,
      "destination_id": "string",
      "day_title": "Readable Day Title",
      "narrative": "theme or short narrative for the day",
      "activities": [
        {"time": "09:00", "title": "Activity Title", "description": "Activity details", "kind": "arrival|sightseeing|food|travel|leisure|departure"}
      ],
      "travel_tips": ["day tip 1"]
    }
  ]
}"""


def _clean_destination_for_prompt(d: DestinationRecord) -> dict:
    """Pass only relevant fields needed for narrative generation (no internal coords or raw IDs)."""
    return {
        "id": d.id,
        "name": d.name,
        "region": d.region,
        "categories": list(d.categories),
        "highlights": list(d.highlights),
        "description": d.description,
        "best_months": list(d.best_months),
        "typical_nights": d.typical_nights,
        "family_friendly": d.family_friendly,
        "accessibility_notes": d.accessibility_notes,
    }


def build_user_prompt(
    request: PlanRequest,
    stops: list[DestinationRecord],
    nightly: list[tuple[int, DestinationRecord]],
    candidate_catalog: list[DestinationRecord],
) -> str:
    """Constructs prompt containing validated preferences and relevant catalog entries."""
    stop_summaries = []
    for d in stops:
        item = _clean_destination_for_prompt(d)
        stop_summaries.append(
            f"- ID: {item['id']} | Name: {item['name']} ({item['region']}) | "
            f"Categories: {', '.join(item['categories'])} | "
            f"Highlights: {'; '.join(item['highlights'])} | "
            f"Description: {item['description']}"
        )

    candidate_summaries = []
    for d in candidate_catalog:
        if d.id not in {s.id for s in stops}:
            item = _clean_destination_for_prompt(d)
            candidate_summaries.append(
                f"- ID: {item['id']} | Name: {item['name']} ({item['region']}) | "
                f"Categories: {', '.join(item['categories'])} | "
                f"Highlights: {'; '.join(item['highlights'][:3])}"
            )

    day_allocations = [f"Day {day}: destination_id='{d.id}' ({d.name})" for day, d in nightly]
    total_budget = getattr(request, "total_budget_inr", None)

    return (
        "Create a personalized day-by-day Karnataka itinerary narrative.\n\n"
        "--- TRAVELLER PREFERENCES ---\n"
        f"- Interests: {', '.join(i.value for i in request.interests)}\n"
        f"- Duration: {request.days} days; Travellers: {request.travellers}\n"
        f"- Budget Tier: {request.budget_tier.value}; Pace: {request.pace.value}\n"
        f"- Transport Preference: {request.transport_preference.value}\n"
        f"- Dietary Preference: {request.dietary_preference.value}\n"
        f"- Family Consideration: {request.family_preference.value if request.family_preference else 'standard'}\n"
        f"- Accessibility Requirements: {request.accessibility_requirements or 'none'}\n"
        f"- Total Budget Note: {f'INR {total_budget}' if total_budget else 'flexible'} "
        "(Costs are computed deterministically; focus on experiences and regional flavor)\n\n"
        "--- SELECTED CIRCUIT DESTINATIONS (Must be used in itinerary) ---\n"
        + "\n".join(stop_summaries)
        + "\n\n"
        "--- APPROVED CATALOG ALTERNATIVES (Use ONLY for suggested substitutions) ---\n"
        + ("\n".join(candidate_summaries) if candidate_summaries else "None")
        + "\n\n"
        "--- REQUIRED DAY ALLOCATION (You must respect this exact sequence) ---\n"
        + "\n".join(day_allocations)
        + "\n\n"
        "INSTRUCTIONS:\n"
        "1. Write an evocative 'summary' personalizing the journey.\n"
        "2. Provide 'destination_explanations' for each stop explaining why it matches the traveller's interests.\n"
        "3. Provide practical, authentic 'travel_tips' for Karnataka travel.\n"
        "4. Suggest 1 or 2 'suggested_substitutions' from the approved alternatives with reasoning.\n"
        "5. For each day, create a catchy 'day_title', 'narrative', and rich 'activities' with regional cuisine, sightseeing and leisure.\n"
        "Output ONLY the JSON object conforming to the schema."
    )


# ---------------------------------------------------------------------------
# Provider Abstraction
# ---------------------------------------------------------------------------


class AIProvider(ABC):
    """Abstract interface for AI completions."""

    @abstractmethod
    def generate(self, system_prompt: str, user_prompt: str) -> str:
        """Execute completion and return raw JSON string."""


class OpenAIProvider(AIProvider):
    """Calls OpenAI-compatible Chat Completions API."""

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://api.openai.com/v1",
        model: str = "gpt-4o-mini",
        timeout_seconds: float = 30.0,
        client: Optional[httpx.Client] = None,
    ) -> None:
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout_seconds = timeout_seconds
        self._external_client = client

    def generate(self, system_prompt: str, user_prompt: str) -> str:
        if not self.api_key.strip():
            raise AIAuthenticationError("LLM_API_KEY is not configured")

        payload = {
            "model": self.model,
            "temperature": 0.4,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }

        owned_client = self._external_client is None
        timeout = httpx.Timeout(self.timeout_seconds, connect=5.0)
        client = self._external_client or httpx.Client(timeout=timeout)

        endpoint = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        try:
            response = client.post(endpoint, headers=headers, json=payload)
            if response.status_code == 429:
                raise AIRateLimitError("LLM request failed: AI provider rate limit exceeded (HTTP 429)")
            if response.status_code in (401, 403):
                raise AIAuthenticationError(f"LLM request failed: AI provider authentication failed (HTTP {response.status_code})")
            if response.status_code >= 500:
                raise AIProviderError(f"LLM request failed: AI provider server error (HTTP {response.status_code})")
            response.raise_for_status()
            data = response.json()
        except httpx.ConnectTimeout as exc:
            msg = sanitize_sensitive_text(f"LLM request failed: Connection timeout after {self.timeout_seconds}s: {exc}", [self.api_key])
            raise AITimeoutError(msg) from exc
        except httpx.ReadTimeout as exc:
            msg = sanitize_sensitive_text(f"LLM request failed: Read timeout after {self.timeout_seconds}s: {exc}", [self.api_key])
            raise AITimeoutError(msg) from exc
        except httpx.TimeoutException as exc:
            msg = sanitize_sensitive_text(f"LLM request failed: Request timeout after {self.timeout_seconds}s: {exc}", [self.api_key])
            raise AITimeoutError(msg) from exc
        except httpx.NetworkError as exc:
            msg = sanitize_sensitive_text(f"LLM request failed: Network error communicating with AI provider: {exc}", [self.api_key])
            raise AINetworkError(msg) from exc
        except httpx.HTTPStatusError as exc:
            msg = sanitize_sensitive_text(f"LLM request failed: AI provider returned HTTP error: {exc}", [self.api_key])
            raise AIGenerationError(msg) from exc
        except (ValueError, KeyError) as exc:
            msg = sanitize_sensitive_text(f"LLM request failed: Failed to parse AI provider response: {exc}", [self.api_key])
            raise AIGenerationError(msg) from exc
        finally:
            if owned_client:
                client.close()

        try:
            return data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise AIValidationError("LLM request failed: unexpected LLM response shape") from exc


class GeminiProvider(AIProvider):
    """Google Gemini provider using OpenAI-compatible or direct endpoint."""

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://generativelanguage.googleapis.com/v1beta/openai",
        model: str = "gemini-1.5-flash",
        timeout_seconds: float = 30.0,
        client: Optional[httpx.Client] = None,
    ) -> None:
        self.delegate = OpenAIProvider(
            api_key=api_key,
            base_url=base_url,
            model=model,
            timeout_seconds=timeout_seconds,
            client=client,
        )

    def generate(self, system_prompt: str, user_prompt: str) -> str:
        return self.delegate.generate(system_prompt, user_prompt)


class MockAIProvider(AIProvider):
    """Configurable mock AI provider for offline testing and development without API keys."""

    def __init__(self, canned_response: Optional[str] = None) -> None:
        self.canned_response = canned_response

    def generate(self, system_prompt: str, user_prompt: str) -> str:
        if self.canned_response is not None:
            return self.canned_response

        # Parse basic allocation from prompt to return a fully compliant mock plan
        days_matches = re.findall(r"Day\s+(\d+):\s+destination_id='([^']+)'\s+\(([^)]+)\)", user_prompt)
        days = []
        dest_explanations = []
        seen_dests = set()

        for day_str, dest_id, dest_name in days_matches:
            day_num = int(day_str)
            if dest_id not in seen_dests:
                seen_dests.add(dest_id)
                dest_explanations.append(
                    {
                        "destination_id": dest_id,
                        "explanation": f"{dest_name} aligns perfectly with your interests and pace.",
                    }
                )

            days.append(
                {
                    "day": day_num,
                    "destination_id": dest_id,
                    "day_title": f"Day {day_num}: Cultural & Scenic Highlights of {dest_name}",
                    "narrative": f"Immerse yourself in the distinct heritage and landscapes of {dest_name}.",
                    "activities": [
                        {
                            "time": "09:00",
                            "title": f"Explore {dest_name} Landmark",
                            "description": f"Morning visit to prominent attractions in {dest_name}.",
                            "kind": "sightseeing",
                        },
                        {
                            "time": "13:00",
                            "title": "Traditional Karnataka Lunch",
                            "description": f"Sample authentic regional cuisine in {dest_name}.",
                            "kind": "food",
                        },
                        {
                            "time": "16:00",
                            "title": f"Afternoon Discovery in {dest_name}",
                            "description": f"Scenic walk and photography around {dest_name}.",
                            "kind": "leisure",
                        },
                    ],
                    "travel_tips": [f"Carry comfortable walking shoes for {dest_name}."],
                }
            )

        payload = {
            "summary": "A bespoke, immersive Karnataka journey balancing historic wonders and scenic landscapes.",
            "destination_explanations": dest_explanations,
            "practical_tips": [
                "Dress modestly when visiting historic temple complexes and sacred sites.",
                "Stay well hydrated during afternoon sightseeing excursions.",
                "Try local filter coffee and South Indian breakfast specialties early in the morning.",
            ],
            "suggested_substitutions": [],
            "days": days,
        }
        return json.dumps(payload)


def get_ai_provider(
    settings: Optional[Settings] = None,
    client: Optional[httpx.Client] = None,
    provider_override: Optional[AIProvider] = None,
) -> AIProvider:
    """Factory creating the appropriate AIProvider based on configuration."""
    if provider_override is not None:
        return provider_override

    cfg = settings or get_settings()
    provider_type = cfg.ai_provider.strip().lower()

    if provider_type in ("mock", "test", "stub"):
        return MockAIProvider()
    elif provider_type == "gemini":
        return GeminiProvider(
            api_key=cfg.llm_api_key,
            base_url=cfg.llm_base_url,
            model=cfg.llm_model,
            timeout_seconds=cfg.llm_timeout_seconds,
            client=client,
        )
    else:  # default "openai" or OpenAI-compatible
        return OpenAIProvider(
            api_key=cfg.llm_api_key,
            base_url=cfg.llm_base_url,
            model=cfg.llm_model,
            timeout_seconds=cfg.llm_timeout_seconds,
            client=client,
        )


# ---------------------------------------------------------------------------
# JSON Extraction & Validation
# ---------------------------------------------------------------------------


def extract_json_payload(raw_text: str) -> dict:
    """Parses JSON payload, tolerating markdown code fences and surrounding prose."""
    if not raw_text or not raw_text.strip():
        raise AIValidationError("AI provider returned an empty response")

    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw_text, re.DOTALL)
    candidate = fenced.group(1) if fenced else None
    if candidate is None:
        start = raw_text.find("{")
        end = raw_text.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise AIValidationError("AI response did not contain JSON object")
        candidate = raw_text[start : end + 1]

    try:
        data = json.loads(candidate)
    except json.JSONDecodeError as exc:
        raise AIValidationError(f"AI returned invalid JSON: {exc}") from exc

    if not isinstance(data, dict):
        raise AIValidationError("AI response root must be a JSON object")

    return data


def validate_and_map_ai_plan(
    raw_response: str,
    request: PlanRequest,
    stops: list[DestinationRecord],
    nightly_plan: list[tuple[int, DestinationRecord]],
    candidate_catalog: list[DestinationRecord],
    provider_name: str = "ai",
) -> AIPersonalizationResult:
    """Strictly validates the raw AI response against Pydantic models and critical constraints."""
    data = extract_json_payload(raw_response)

    # Pre-schema checks for clear descriptive errors
    raw_days = data.get("days")
    if not isinstance(raw_days, list) or len(raw_days) != request.days:
        raise AIValidationError("LLM did not return the requested number of days")

    allowed_stop_ids = {d.id for d in stops}

    for raw_day in raw_days:
        if not isinstance(raw_day, dict):
            raise AIValidationError("malformed day entry")
        try:
            day_num = int(raw_day.get("day", 0))
        except (TypeError, ValueError) as exc:
            raise AIValidationError(
                f"LLM returned a non-numeric day number: {raw_day.get('day')!r}"
            ) from exc

        declared_id = raw_day.get("destination_id")
        if declared_id is not None and str(declared_id) not in allowed_stop_ids:
            raise AIValidationError(
                f"LLM used unknown destination '{declared_id}' on day {day_num}"
            )

    raw_day_numbers = [int(r.get("day", 0)) for r in raw_days]
    if len(raw_day_numbers) != len(set(raw_day_numbers)):
        raise AIValidationError(
            f"LLM returned duplicate day numbers: {sorted(raw_day_numbers)}"
        )

    try:
        draft = AIPlanDraft.model_validate(data)
    except ValidationError as exc:
        raise AIValidationError(f"AI response failed schema validation: {exc}") from exc

    # Constraint Check 1: Day count must strictly equal requested days
    if len(draft.days) != request.days:
        raise AIValidationError("LLM did not return the requested number of days")

    # Constraint Check 2: Day numbers must be 1..days with no duplicates
    day_numbers = [d.day for d in draft.days]
    if sorted(day_numbers) != list(range(1, request.days + 1)):
        raise AIValidationError(
            f"LLM returned duplicate day numbers: {sorted(day_numbers)}"
        )

    # Constraint Check 3: Destination IDs must strictly exist in the supplied catalog
    allowed_stop_ids = {d.id for d in stops}
    all_catalog_ids = {d.id for d in stops} | {d.id for d in candidate_catalog}
    stops_by_id = {d.id: d for d in stops}
    catalog_by_id = {d.id: d for d in stops}
    for c in candidate_catalog:
        catalog_by_id[c.id] = c

    allocation = {day: d.id for day, d in nightly_plan}

    for day_draft in draft.days:
        if day_draft.destination_id not in allowed_stop_ids:
            raise AIValidationError(
                f"LLM used unknown destination '{day_draft.destination_id}' on day {day_draft.day}"
            )

    # Normalise day activities and enforce deterministic place allocation
    day_plans: list[DayPlan] = []
    drafts_by_day = {d.day: d for d in draft.days}

    for day_num, allocated_dest in nightly_plan:
        day_draft = drafts_by_day[day_num]
        dest_record = stops_by_id[allocated_dest.id]

        activities: list[DayActivity] = []
        for act in day_draft.activities:
            title = act.title.strip()
            if not title:
                continue
            time = act.time.strip()[:5] or "09:00"
            activities.append(
                DayActivity(
                    time=time,
                    title=title,
                    description=act.description.strip() or title,
                    destination_id=dest_record.id,
                    kind=act.kind,
                )
            )

        if not activities:
            raise AIValidationError(f"Day {day_num} has no valid activities")

        place = Place(
            destination_id=dest_record.id,
            name=dest_record.name,
            lat=dest_record.lat if dest_record.lat is not None else 0.0,
            lng=dest_record.lng if dest_record.lng is not None else 0.0,
            region=dest_record.region,
        )

        day_plans.append(
            DayPlan(
                day=day_num,
                place=place,
                day_title=day_draft.day_title.strip() or f"Day {day_num}: Exploring {dest_record.name}",
                narrative=day_draft.narrative,
                activities=activities,
                travel_tips=[t.strip() for t in day_draft.travel_tips if t.strip()],
            )
        )

    # Sort days
    day_plans.sort(key=lambda p: p.day)

    # Destination explanations: map to typed DestinationSuitability
    dest_explanations: list[DestinationSuitability] = []
    for exp in draft.destination_explanations:
        if exp.destination_id in stops_by_id:
            dest_rec = stops_by_id[exp.destination_id]
            dest_explanations.append(
                DestinationSuitability(
                    destination_id=dest_rec.id,
                    destination_name=dest_rec.name,
                    explanation=exp.explanation.strip(),
                )
            )

    # Suggested substitutions: ensure they reference only catalog destinations
    substitutions: list[SuggestedSubstitution] = []
    for sub in draft.suggested_substitutions:
        curr_id = sub.current_destination_id.strip()
        sugg_id = sub.suggested_destination_id.strip()
        if curr_id in all_catalog_ids and sugg_id in all_catalog_ids and curr_id != sugg_id:
            curr_dest = catalog_by_id[curr_id]
            sugg_dest = catalog_by_id[sugg_id]
            substitutions.append(
                SuggestedSubstitution(
                    current_destination_id=curr_dest.id,
                    current_destination_name=curr_dest.name,
                    suggested_destination_id=sugg_dest.id,
                    suggested_destination_name=sugg_dest.name,
                    reason=sub.reason.strip(),
                )
            )

    return AIPersonalizationResult(
        summary=draft.summary.strip(),
        itinerary=day_plans,
        destination_explanations=dest_explanations,
        practical_tips=[tip.strip() for tip in draft.practical_tips if tip.strip()],
        suggested_substitutions=substitutions,
        ai_provider=provider_name,
    )


# ---------------------------------------------------------------------------
# Main Public Service Entrypoint
# ---------------------------------------------------------------------------


def generate_ai_itinerary(
    request: PlanRequest,
    stops: list[DestinationRecord],
    nightly_plan: list[tuple[int, DestinationRecord]],
    candidate_catalog: Optional[list[DestinationRecord]] = None,
    client: Optional[httpx.Client] = None,
    provider: Optional[AIProvider] = None,
) -> AIPersonalizationResult:
    """Executes AI itinerary personalization with strict validation and error handling.

    Raises:
        AIAuthenticationError: when credentials are missing or invalid.
        AITimeoutError: on request timeout.
        AIRateLimitError: on HTTP 429.
        AIValidationError: on malformed JSON, unknown IDs, or constraint violation.
        AIGenerationError: on any other provider or network failure.
    """
    settings = get_settings()

    # Determine provider
    actual_provider = provider or get_ai_provider(settings=settings, client=client)

    # Build prompt
    candidates = candidate_catalog or []
    user_prompt = build_user_prompt(request, stops, nightly_plan, candidates)

    logger.info(
        "Requesting AI personalization via provider=%s for %s days, stops=%s",
        settings.ai_provider,
        request.days,
        [d.id for d in stops],
    )

    raw_response = actual_provider.generate(
        system_prompt=SYSTEM_PROMPT,
        user_prompt=user_prompt,
    )

    return validate_and_map_ai_plan(
        raw_response=raw_response,
        request=request,
        stops=stops,
        nightly_plan=nightly_plan,
        candidate_catalog=candidates,
        provider_name=settings.ai_provider,
    )
