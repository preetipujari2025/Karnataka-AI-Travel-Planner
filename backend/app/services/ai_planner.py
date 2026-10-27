"""AI integration: LLM-backed itinerary drafting over configurable AI providers.

Delegates execution to app.services.ai_service while maintaining backwards-compatible
function signatures and interfaces for callers and existing tests.
"""

from __future__ import annotations

from typing import Optional

import httpx

from app.config import get_settings
from app.schemas import DayPlan, DestinationRecord, PlanRequest
from app.services import ai_service
from app.services.ai_service import (
    AIAuthenticationError,
    AIGenerationError,
    AINetworkError,
    AIPersonalizationResult,
    AIProvider,
    AIProviderError,
    AIRateLimitError,
    AITimeoutError,
    AIValidationError,
)
from app.services.recommendation import find_corridor_candidates

__all__ = [
    "AIGenerationError",
    "AITimeoutError",
    "AIRateLimitError",
    "AIAuthenticationError",
    "AIProviderError",
    "AINetworkError",
    "AIValidationError",
    "AIPersonalizationResult",
    "llm_available",
    "generate_ai_plan",
    "generate_ai_plan_full",
]


def llm_available() -> bool:
    return get_settings().llm_configured


def generate_ai_plan_full(
    request: PlanRequest,
    stops: list[DestinationRecord],
    nightly: list[tuple[int, DestinationRecord]],
    candidate_catalog: Optional[list[DestinationRecord]] = None,
    client: Optional[httpx.Client] = None,
    provider: Optional[AIProvider] = None,
) -> AIPersonalizationResult:
    """Full AI generation returning complete AIPersonalizationResult."""
    if not llm_available():
        raise AIGenerationError("LLM_API_KEY is not configured")

    if candidate_catalog is None:
        candidates = find_corridor_candidates(stops, request, limit=6)
    else:
        candidates = candidate_catalog

    return ai_service.generate_ai_itinerary(
        request=request,
        stops=stops,
        nightly_plan=nightly,
        candidate_catalog=candidates,
        client=client,
        provider=provider,
    )


def generate_ai_plan(
    request: PlanRequest,
    stops: list[DestinationRecord],
    nightly: list[tuple[int, DestinationRecord]],
    client: Optional[httpx.Client] = None,
) -> tuple[str, list[DayPlan]]:
    """Draft (summary, itinerary) from the AI provider.

    Maintains the 2-tuple return contract expected by existing tests and callers.
    """
    res = generate_ai_plan_full(request, stops, nightly, client=client)
    return res.summary, res.itinerary
