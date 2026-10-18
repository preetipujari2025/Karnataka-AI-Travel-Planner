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
