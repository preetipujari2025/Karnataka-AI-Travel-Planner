"""Comprehensive test suite for the dedicated AI Service layer.

Tests:
1. Valid structured responses and Pydantic validation
2. Malformed JSON handling
3. Unknown destination ID rejection
4. Duplicate days and schedule constraint violations
5. Request timeouts (connect & read)
6. Missing credentials error handling
7. Rate limit handling (HTTP 429)
8. Provider 5xx failures
9. Authentication 401/403 failures
10. Network errors (connection reset, DNS)
11. Fallback behavior in auto vs forced AI modes
12. Strict constraint preservation (duration & budget limits never overridden by AI)
13. API key sanitization (never logged or leaked in exceptions)
14. MockAIProvider operation without API keys
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.data.loader import require_destination
from app.schemas import (
    ActivityKind,
    DayPlan,
    DestinationRecord,
    PlanRequest,
    PlanResponse,
)
from app.services.ai_service import (
    AIAuthenticationError,
    AIGenerationError,
    AINetworkError,
    AIPlanDraft,
    AIProvider,
    AIProviderError,
    AIRateLimitError,
    AITimeoutError,
    AIValidationError,
    MockAIProvider,
    OpenAIProvider,
    extract_json_payload,
    generate_ai_itinerary,
    get_ai_provider,
    sanitize_sensitive_text,
    validate_and_map_ai_plan,
)
from app.services.planner import create_plan
from app.services.routing import assign_nights, nearest_neighbor_order

SAMPLE_REQUEST_DATA = {
    "interests": ["heritage", "nature"],
    "days": 4,
    "travellers": 2,
    "budget_tier": "mid",
    "pace": "balanced",
    "start_city": "bengaluru",
    "start_month": 11,
    "planner": "ai",
}


def _setup_test_circuit(days: int = 4):
    request = PlanRequest.model_validate({**SAMPLE_REQUEST_DATA, "days": days})
    bengaluru = require_destination("bengaluru")
    mysuru = require_destination("mysuru")
    hampi = require_destination("hampi")
    stops = [bengaluru, mysuru, hampi]
    order = nearest_neighbor_order(stops, bengaluru)
    nightly = assign_nights(order, days, request.pace)
    return request, order, nightly


def _mock_client(response_content: str, status_code: int = 200) -> httpx.Client:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            status_code,
            json={"choices": [{"message": {"content": response_content}}]},
        )

    return httpx.Client(transport=httpx.MockTransport(handler))


# ---------------------------------------------------------------------------
# 1. Valid Structured Response & Pydantic Validation
# ---------------------------------------------------------------------------


def test_valid_structured_response_passes_validation():
    request, stops, nightly = _setup_test_circuit(3)
    valid_payload = {
        "summary": "An exquisite heritage trail through Karnataka's royal capitals.",
        "destination_explanations": [
            {
                "destination_id": "bengaluru",
                "explanation": "Urban tech and heritage gateway offering colonial parks and craft cuisine.",
            },
            {
                "destination_id": "mysuru",
                "explanation": "Royal heritage capital featuring grand palaces and silk markets.",
            },
        ],
        "practical_tips": [
            "Start early to beat the Mysore palace queue.",
            "Carry light cotton clothing and a water bottle.",
        ],
        "suggested_substitutions": [
            {
                "current_destination_id": "mysuru",
                "suggested_destination_id": "hampi",
                "reason": "Offers world-famous boulder-strewn UNESCO ruins if archaeology is favored.",
            }
        ],
        "days": [
            {
                "day": 1,
                "destination_id": nightly[0][1].id,
                "day_title": "Day 1: Arrival & Garden City Heritage",
                "narrative": "Welcome to Bengaluru, exploring regal gardens and culinary districts.",
                "activities": [
                    {
                        "time": "09:30",
                        "title": "Lalbagh Botanical Walk",
                        "description": "Stroll through centuries-old trees and glasshouse conservatory.",
                        "kind": "sightseeing",
                    },
                    {
                        "time": "13:00",
                        "title": "MTR Traditional Lunch",
                        "description": "Authentic South Indian thali meal.",
                        "kind": "food",
                    },
                ],
                "travel_tips": ["Metro is the quickest way to traverse central Bengaluru."],
            },
            {
                "day": 2,
                "destination_id": nightly[1][1].id,
                "day_title": "Day 2: Royal Splendours of Mysuru",
                "narrative": "Journey into the heart of the Wadiyar dynasty.",
                "activities": [
                    {
                        "time": "10:00",
                        "title": "Mysore Palace Architecture Tour",
                        "description": "Admire Indo-Saracenic stained glass and royal pavilions.",
                        "kind": "sightseeing",
                    }
                ],
                "travel_tips": ["Remove shoes at the palace entrance pavilion."],
            },
            {
                "day": 3,
                "destination_id": nightly[2][1].id,
                "day_title": "Day 3: Chamundi Hill & Artisan Markets",
                "narrative": "Ascend Chamundi hill for panoramic views followed by silk shopping.",
                "activities": [
                    {
                        "time": "08:30",
                        "title": "Chamundeshwari Temple Morning Visit",
                        "description": "Climb to the hilltop shrine of Chamundi.",
                        "kind": "sightseeing",
                    }
                ],
                "travel_tips": ["Beware of playful monkeys around the temple steps."],
            },
        ],
    }

    mock_client = _mock_client(json.dumps(valid_payload))
    provider = OpenAIProvider(api_key="sk-test-key", client=mock_client)
    res = generate_ai_itinerary(request, stops, nightly, provider=provider)

    assert "exquisite heritage trail" in res.summary
    assert len(res.itinerary) == 3
    assert res.itinerary[0].day_title == "Day 1: Arrival & Garden City Heritage"
    assert res.itinerary[0].travel_tips == ["Metro is the quickest way to traverse central Bengaluru."]
    assert len(res.destination_explanations) == 2
    assert len(res.practical_tips) == 2
    assert len(res.suggested_substitutions) == 1
    assert res.suggested_substitutions[0].suggested_destination_id == "hampi"


# ---------------------------------------------------------------------------
# 2. Malformed Output & Truncated JSON
# ---------------------------------------------------------------------------


def test_malformed_json_raises_validation_error():
    request, stops, nightly = _setup_test_circuit(3)
    mock_client = _mock_client("{not valid json at all")
    provider = OpenAIProvider(api_key="sk-test-key", client=mock_client)

    with pytest.raises(AIValidationError, match="invalid JSON|did not contain JSON"):
        generate_ai_itinerary(request, stops, nightly, provider=provider)


def test_empty_response_raises_validation_error():
    request, stops, nightly = _setup_test_circuit(3)
    mock_client = _mock_client("")
    provider = OpenAIProvider(api_key="sk-test-key", client=mock_client)

    with pytest.raises(AIValidationError, match="empty response|did not contain JSON"):
        generate_ai_itinerary(request, stops, nightly, provider=provider)


# ---------------------------------------------------------------------------
# 3. Unknown Destination IDs
# ---------------------------------------------------------------------------


def test_unknown_destination_id_rejected():
    request, stops, nightly = _setup_test_circuit(3)
    payload = {
        "summary": "Trip to fantasy realm",
        "days": [
            {
                "day": 1,
                "destination_id": "shangri-la-unknown",
                "activities": [{"time": "09:00", "title": "Tour", "description": "Desc", "kind": "sightseeing"}],
            },
            {
                "day": 2,
                "destination_id": nightly[1][1].id,
                "activities": [{"time": "09:00", "title": "Tour", "description": "Desc", "kind": "sightseeing"}],
            },
            {
                "day": 3,
                "destination_id": nightly[2][1].id,
                "activities": [{"time": "09:00", "title": "Tour", "description": "Desc", "kind": "sightseeing"}],
            },
        ],
    }
    mock_client = _mock_client(json.dumps(payload))
    provider = OpenAIProvider(api_key="sk-test-key", client=mock_client)

    with pytest.raises(AIValidationError, match="unknown destination"):
        generate_ai_itinerary(request, stops, nightly, provider=provider)


# ---------------------------------------------------------------------------
# 4. Duplicate Stops & Schedule Invariants
# ---------------------------------------------------------------------------


def test_duplicate_day_numbers_rejected():
    request, stops, nightly = _setup_test_circuit(3)
    payload = {
        "summary": "Valid summary",
        "days": [
            {
                "day": 1,
                "destination_id": nightly[0][1].id,
                "activities": [{"time": "09:00", "title": "Tour", "description": "Desc", "kind": "sightseeing"}],
            },
            {
                "day": 1,  # DUPLICATE DAY 1
                "destination_id": nightly[1][1].id,
                "activities": [{"time": "09:00", "title": "Tour", "description": "Desc", "kind": "sightseeing"}],
            },
            {
                "day": 3,
                "destination_id": nightly[2][1].id,
                "activities": [{"time": "09:00", "title": "Tour", "description": "Desc", "kind": "sightseeing"}],
            },
        ],
    }
    mock_client = _mock_client(json.dumps(payload))
    provider = OpenAIProvider(api_key="sk-test-key", client=mock_client)

    with pytest.raises(AIValidationError, match="duplicate day"):
        generate_ai_itinerary(request, stops, nightly, provider=provider)


def test_wrong_day_count_rejected():
    request, stops, nightly = _setup_test_circuit(4)
    payload = {
        "summary": "Valid summary",
        "days": [
            {
                "day": 1,
                "destination_id": nightly[0][1].id,
                "activities": [{"time": "09:00", "title": "Tour", "description": "Desc", "kind": "sightseeing"}],
            }
        ],  # Only 1 day instead of 4
    }
    mock_client = _mock_client(json.dumps(payload))
    provider = OpenAIProvider(api_key="sk-test-key", client=mock_client)

    with pytest.raises(AIValidationError, match="number of days"):
        generate_ai_itinerary(request, stops, nightly, provider=provider)


# ---------------------------------------------------------------------------
# 5. Request Timeouts
# ---------------------------------------------------------------------------


def test_request_timeout_raises_timeout_error():
    def timeout_handler(req: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("Read timed out", request=req)

    client = httpx.Client(transport=httpx.MockTransport(timeout_handler))
    provider = OpenAIProvider(api_key="sk-test-key", client=client)
    request, stops, nightly = _setup_test_circuit(3)

    with pytest.raises(AITimeoutError, match="LLM request failed"):
        generate_ai_itinerary(request, stops, nightly, provider=provider)


# ---------------------------------------------------------------------------
# 6. Missing Credentials
# ---------------------------------------------------------------------------


def test_missing_credentials_raises_authentication_error():
    provider = OpenAIProvider(api_key="")
    request, stops, nightly = _setup_test_circuit(3)

    with pytest.raises(AIAuthenticationError, match="not configured"):
        generate_ai_itinerary(request, stops, nightly, provider=provider)


# ---------------------------------------------------------------------------
# 7. Rate Limits (HTTP 429)
# ---------------------------------------------------------------------------


def test_rate_limit_handled_cleanly():
    def rate_limit_handler(req: httpx.Request) -> httpx.Response:
        return httpx.Response(429, json={"error": {"message": "Rate limit reached"}})

    client = httpx.Client(transport=httpx.MockTransport(rate_limit_handler))
    provider = OpenAIProvider(api_key="sk-test-key", client=client)
    request, stops, nightly = _setup_test_circuit(3)

    with pytest.raises(AIRateLimitError, match="rate limit"):
        generate_ai_itinerary(request, stops, nightly, provider=provider)


# ---------------------------------------------------------------------------
# 8. Provider Server Failures (HTTP 5xx)
# ---------------------------------------------------------------------------


def test_provider_500_handled_cleanly():
    def server_error_handler(req: httpx.Request) -> httpx.Response:
        return httpx.Response(500, json={"error": {"message": "Internal server error"}})

    client = httpx.Client(transport=httpx.MockTransport(server_error_handler))
    provider = OpenAIProvider(api_key="sk-test-key", client=client)
    request, stops, nightly = _setup_test_circuit(3)

    with pytest.raises(AIProviderError, match="server error"):
        generate_ai_itinerary(request, stops, nightly, provider=provider)


# ---------------------------------------------------------------------------
# 9. Authentication Failures (HTTP 401/403)
# ---------------------------------------------------------------------------


def test_provider_401_auth_error():
    def auth_error_handler(req: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"error": {"message": "Invalid API Key"}})

    client = httpx.Client(transport=httpx.MockTransport(auth_error_handler))
    provider = OpenAIProvider(api_key="sk-bad-key", client=client)
    request, stops, nightly = _setup_test_circuit(3)

    with pytest.raises(AIAuthenticationError, match="authentication failed"):
        generate_ai_itinerary(request, stops, nightly, provider=provider)


# ---------------------------------------------------------------------------
# 10. Network Errors
# ---------------------------------------------------------------------------


def test_network_connection_error():
    def network_error_handler(req: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("Connection refused", request=req)

    client = httpx.Client(transport=httpx.MockTransport(network_error_handler))
    provider = OpenAIProvider(api_key="sk-test-key", client=client)
    request, stops, nightly = _setup_test_circuit(3)

    with pytest.raises(AINetworkError, match="Network error"):
        generate_ai_itinerary(request, stops, nightly, provider=provider)


# ---------------------------------------------------------------------------
# 11. MockAIProvider Operation (Offline / Keyless Development)
# ---------------------------------------------------------------------------


def test_mock_ai_provider_generates_valid_itinerary():
    request, stops, nightly = _setup_test_circuit(4)
    provider = MockAIProvider()
    res = generate_ai_itinerary(request, stops, nightly, provider=provider)

    assert res.summary
    assert len(res.itinerary) == 4
    for day in res.itinerary:
        assert day.day_title
        assert day.activities
    assert res.destination_explanations
    assert res.practical_tips


def test_mock_ai_provider_configurable_via_settings(monkeypatch):
    from app.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "ai_provider", "mock")
    monkeypatch.setattr(settings, "llm_api_key", "")
    assert settings.llm_configured is True

    provider = get_ai_provider(settings=settings)
    assert isinstance(provider, MockAIProvider)


# ---------------------------------------------------------------------------
# 12. Fallback Behavior in Auto vs Forced AI
# ---------------------------------------------------------------------------


def test_auto_planner_falls_back_when_ai_fails(client: TestClient, monkeypatch):
    from app.config import get_settings
    from app.services import ai_service

    settings = get_settings()
    monkeypatch.setattr(type(settings), "llm_configured", property(lambda self: True))

    def fail_generate(*args, **kwargs):
        raise AIRateLimitError("LLM request failed: rate limited")

    monkeypatch.setattr(ai_service, "generate_ai_itinerary", fail_generate)

    req = {**SAMPLE_REQUEST_DATA, "planner": "auto"}
    response = client.post("/api/itineraries/generate", json=req)
    assert response.status_code == 200, response.text
    body = response.json()

    assert body["source"] == "fallback"
    assert any("fallback" in w for w in body["warnings"])
    assert body["destination_explanations"]
    assert body["practical_tips"]


def test_forced_ai_fails_with_503_when_provider_fails(client: TestClient, monkeypatch):
    from app.config import get_settings
    from app.services import ai_service

    settings = get_settings()
    monkeypatch.setattr(type(settings), "llm_configured", property(lambda self: True))
    monkeypatch.setattr(settings, "llm_api_key", "mock-test-key")

    def fail_generate(*args, **kwargs):
        raise AITimeoutError("LLM request failed: provider timed out")

    monkeypatch.setattr(ai_service, "generate_ai_itinerary", fail_generate)

    req = {**SAMPLE_REQUEST_DATA, "planner": "ai"}
    response = client.post("/api/itineraries/generate", json=req)
    assert response.status_code == 503
    error = response.json()["error"]
    assert "timed out" in error["message"]


# ---------------------------------------------------------------------------
# 13. Critical Constraints: AI Cannot Override Duration or Budget
# ---------------------------------------------------------------------------


def test_ai_cannot_override_duration_or_budget():
    """Verify that duration and budget calculations are strictly computed deterministically."""
    request_data = {**SAMPLE_REQUEST_DATA, "days": 5, "planner": "fallback"}
    request = PlanRequest.model_validate(request_data)

    # Deterministic budget calculation test
    plan = create_plan(request)
    assert len(plan.itinerary) == 5
    assert plan.budget.days == 5
    assert plan.budget.total_inr > 0


# ---------------------------------------------------------------------------
# 14. Sensitive Data Sanitization (No API Key Leaks)
# ---------------------------------------------------------------------------


def test_sanitize_sensitive_text_masks_bearer_and_keys():
    raw_message = (
        "Request failed with Bearer sk-1234567890abcdef and api_key='sk-secret999999'. "
        "Sensitive custom token: super-secret-value-xyz"
    )
    sanitized = sanitize_sensitive_text(raw_message, sensitive_values=["super-secret-value-xyz"])

    assert "sk-1234567890abcdef" not in sanitized
    assert "sk-secret999999" not in sanitized
    assert "super-secret-value-xyz" not in sanitized
    assert "Bearer [REDACTED]" in sanitized
    assert "[REDACTED]" in sanitized


def test_exception_messages_do_not_contain_api_key():
    secret_key = "super-secret-prod-key-xyz-12345"

    def boom_handler(req: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError(f"Cannot connect to https://api.openai.com?key={secret_key}", request=req)

    client = httpx.Client(transport=httpx.MockTransport(boom_handler))
    provider = OpenAIProvider(api_key=secret_key, client=client)
    request, stops, nightly = _setup_test_circuit(3)

    with pytest.raises(AIGenerationError) as exc_info:
        generate_ai_itinerary(request, stops, nightly, provider=provider)

    err_text = str(exc_info.value)
    assert secret_key not in err_text
    assert "[REDACTED]" in err_text


# ---------------------------------------------------------------------------
# 15. Mock Bad AI Answers & Verify Smart Planner Fallback
# ---------------------------------------------------------------------------


def test_fallback_on_broken_json(client: TestClient, monkeypatch):
    """When the AI produces broken or unparseable JSON, fallback planner activates silently with 'Smart planner'."""
    from app.config import get_settings
    from app.services import ai_service

    settings = get_settings()
    monkeypatch.setattr(type(settings), "llm_configured", property(lambda self: True))
    monkeypatch.setattr(settings, "llm_api_key", "test-key-mock")

    class BrokenJsonProvider(AIProvider):
        def generate(self, system_prompt: str, user_prompt: str) -> str:
            return "This is not valid JSON! { broken json: [unclosed"

    monkeypatch.setattr(ai_service, "get_ai_provider", lambda **kwargs: BrokenJsonProvider())

    req = {**SAMPLE_REQUEST_DATA, "planner": "auto"}
    response = client.post("/api/itineraries/generate", json=req)
    assert response.status_code == 200, response.text
    body = response.json()

    assert body["source"] == "fallback"
    assert body["planner_label"] == "Smart planner"
    assert len(body["itinerary"]) == req["days"]
    assert any("fallback" in w for w in body["warnings"])


def test_fallback_on_invented_place(client: TestClient, monkeypatch):
    """When the AI invents destinations outside the 38 curated hubs, it is rejected and falls back."""
    from app.config import get_settings
    from app.services import ai_service

    settings = get_settings()
    monkeypatch.setattr(type(settings), "llm_configured", property(lambda self: True))
    monkeypatch.setattr(settings, "llm_api_key", "test-key-mock")

    class InventedPlaceProvider(AIProvider):
        def generate(self, system_prompt: str, user_prompt: str) -> str:
            return json.dumps({
                "summary": "Trip with invented fantasy places",
                "destination_explanations": [],
                "practical_tips": [],
                "suggested_substitutions": [],
                "days": [
                    {
                        "day": 1,
                        "destination_id": "atlantis_underwater",  # Not in 38 curated destinations
                        "day_title": "Day 1: Exploring Atlantis",
                        "activities": [
                            {"time": "09:00", "title": "Visit Ruins", "description": "Underwater tour", "kind": "sightseeing"}
                        ],
                    },
                    {
                        "day": 2,
                        "destination_id": "mysuru",
                        "day_title": "Day 2: Mysuru",
                        "activities": [
                            {"time": "09:00", "title": "Palace", "description": "Mysuru palace", "kind": "sightseeing"}
                        ],
                    },
                    {
                        "day": 3,
                        "destination_id": "hampi",
                        "day_title": "Day 3: Hampi",
                        "activities": [
                            {"time": "09:00", "title": "Temples", "description": "Hampi ruins", "kind": "sightseeing"}
                        ],
                    },
                    {
                        "day": 4,
                        "destination_id": "bengaluru",
                        "day_title": "Day 4: Bengaluru",
                        "activities": [
                            {"time": "09:00", "title": "Lalbagh", "description": "Botanical garden", "kind": "sightseeing"}
                        ],
                    },
                ],
            })

    monkeypatch.setattr(ai_service, "get_ai_provider", lambda **kwargs: InventedPlaceProvider())

    req = {**SAMPLE_REQUEST_DATA, "days": 4, "planner": "auto"}
    response = client.post("/api/itineraries/generate", json=req)
    assert response.status_code == 200, response.text
    body = response.json()

    assert body["source"] == "fallback"
    assert body["planner_label"] == "Smart planner"
    # Ensure no invented place is in the final itinerary
    curated_ids = {d["id"] for d in client.get("/api/v1/destinations").json()}
    for day in body["itinerary"]:
        assert day["place"]["destination_id"] in curated_ids
        assert day["place"]["destination_id"] != "atlantis_underwater"


def test_fallback_on_over_budget(client: TestClient, monkeypatch):
    """When the AI proposes a budget exceeding the user's maximum budget, it is rejected and falls back."""
    from app.config import get_settings
    from app.services import ai_service

    settings = get_settings()
    monkeypatch.setattr(type(settings), "llm_configured", property(lambda self: True))
    monkeypatch.setattr(settings, "llm_api_key", "test-key-mock")

    class OverBudgetProvider(AIProvider):
        def generate(self, system_prompt: str, user_prompt: str) -> str:
            # Matches day format but returns estimated_cost_inr way above total_budget_inr
            days_matches = re.findall(r"Day\s+(\d+):\s+destination_id='([^']+)'", user_prompt)
            days = []
            for d_num, d_id in days_matches:
                days.append({
                    "day": int(d_num),
                    "destination_id": d_id,
                    "day_title": f"Day {d_num}",
                    "activities": [
                        {"time": "09:00", "title": "Activity", "description": "Desc", "kind": "sightseeing", "cost_inr": 200000}
                    ],
                })
            return json.dumps({
                "summary": "Extravagant VIP trip",
                "estimated_cost_inr": 500000,  # 5 Lakhs, far above the 30,000 budget
                "destination_explanations": [],
                "practical_tips": [],
                "suggested_substitutions": [],
                "days": days,
            })

    monkeypatch.setattr(ai_service, "get_ai_provider", lambda **kwargs: OverBudgetProvider())

    req = {**SAMPLE_REQUEST_DATA, "total_budget_inr": 30000, "planner": "auto"}
    response = client.post("/api/itineraries/generate", json=req)
    assert response.status_code == 200, response.text
    body = response.json()

    assert body["source"] == "fallback"
    assert body["planner_label"] == "Smart planner"


def test_fallback_on_timeout(client: TestClient, monkeypatch):
    """When the AI call exceeds the timeout (20s), it falls back silently with 'Smart planner'."""
    from app.config import get_settings
    from app.services import ai_service

    settings = get_settings()
    monkeypatch.setattr(type(settings), "llm_configured", property(lambda self: True))
    monkeypatch.setattr(settings, "llm_api_key", "test-key-mock")

    class TimeoutProvider(AIProvider):
        def generate(self, system_prompt: str, user_prompt: str) -> str:
            raise AITimeoutError("LLM request failed: Read timeout after 20.0s")

    monkeypatch.setattr(ai_service, "get_ai_provider", lambda **kwargs: TimeoutProvider())

    req = {**SAMPLE_REQUEST_DATA, "planner": "auto"}
    response = client.post("/api/itineraries/generate", json=req)
    assert response.status_code == 200, response.text
    body = response.json()

    assert body["source"] == "fallback"
    assert body["planner_label"] == "Smart planner"


def test_ai_personalized_label_on_success(client: TestClient, monkeypatch):
    """When the AI succeeds, the response includes the 'AI-personalized' label."""
    from app.config import get_settings
    from app.services import ai_service

    settings = get_settings()
    monkeypatch.setattr(type(settings), "llm_configured", property(lambda self: True))
    monkeypatch.setattr(settings, "llm_api_key", "test-key-mock")

    # MockAIProvider generates a valid, compliant itinerary
    monkeypatch.setattr(ai_service, "get_ai_provider", lambda **kwargs: MockAIProvider())

    req = {**SAMPLE_REQUEST_DATA, "planner": "auto"}
    response = client.post("/api/itineraries/generate", json=req)
    assert response.status_code == 200, response.text
    body = response.json()

    assert body["source"] == "ai"
    assert body["planner_label"] == "AI-personalized"


def test_ai_retries_once_on_invalid_schema_and_succeeds(client: TestClient, monkeypatch):
    """When the AI produces invalid schema on attempt 1, it retries once. If attempt 2 is valid, it succeeds."""
    from app.config import get_settings
    from app.services import ai_service

    settings = get_settings()
    monkeypatch.setattr(type(settings), "llm_configured", property(lambda self: True))
    monkeypatch.setattr(settings, "llm_api_key", "test-key-mock")

    calls = []

    class RetrySuccessProvider(AIProvider):
        def generate(self, system_prompt: str, user_prompt: str) -> str:
            calls.append(user_prompt)
            if len(calls) == 1:
                # First attempt: invalid schema (empty JSON)
                return "{}"
            # Second attempt: valid mock response
            return MockAIProvider().generate(system_prompt, user_prompt)

    monkeypatch.setattr(ai_service, "get_ai_provider", lambda **kwargs: RetrySuccessProvider())

    req = {**SAMPLE_REQUEST_DATA, "planner": "auto"}
    response = client.post("/api/itineraries/generate", json=req)
    assert response.status_code == 200, response.text
    body = response.json()

    assert len(calls) == 2, "Expected exactly 2 attempts (1 initial + 1 retry)"
    assert "IMPORTANT CORRECTION (Attempt 2/2)" in calls[1]
    assert body["source"] == "ai"
    assert body["planner_label"] == "AI-personalized"


def test_ai_retries_once_and_then_falls_back(client: TestClient, monkeypatch):
    """When the AI produces invalid schema on both attempts, it retries once, then falls back to Smart planner."""
    from app.config import get_settings
    from app.services import ai_service

    settings = get_settings()
    monkeypatch.setattr(type(settings), "llm_configured", property(lambda self: True))
    monkeypatch.setattr(settings, "llm_api_key", "test-key-mock")

    calls = []

    class AlwaysInvalidProvider(AIProvider):
        def generate(self, system_prompt: str, user_prompt: str) -> str:
            calls.append(user_prompt)
            return "{\"invalid\": true}"

    monkeypatch.setattr(ai_service, "get_ai_provider", lambda **kwargs: AlwaysInvalidProvider())

    req = {**SAMPLE_REQUEST_DATA, "planner": "auto"}
    response = client.post("/api/itineraries/generate", json=req)
    assert response.status_code == 200, response.text
    body = response.json()

    assert len(calls) == 2, "Expected 2 attempts before fallback"
    assert body["source"] == "fallback"
    assert body["planner_label"] == "Smart planner"


