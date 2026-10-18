"""Tests for the planning endpoint (deterministic fallback path)."""

from __future__ import annotations

from fastapi.testclient import TestClient

BASE_REQUEST = {
    "interests": ["heritage", "nature"],
    "days": 5,
    "travellers": 2,
    "budget_tier": "mid",
    "pace": "balanced",
    "start_city": "bengaluru",
    "start_month": 12,
    "planner": "fallback",
}


def test_plan_fallback_generates_full_itinerary(client: TestClient) -> None:
    response = client.post("/api/v1/plans", json=BASE_REQUEST)
    assert response.status_code == 200, response.text
    body = response.json()

    assert body["source"] == "fallback"
    assert len(body["itinerary"]) == 5
    assert [d["day"] for d in body["itinerary"]] == [1, 2, 3, 4, 5]
    for day in body["itinerary"]:
        assert day["activities"], f"day {day['day']} must have activities"
        assert day["place"]["destination_id"]

    # budget must be self-consistent
    budget = body["budget"]
    assert budget["total_inr"] == (
        budget["stay_food_inr"] + budget["transport_inr"] + budget["activities_inr"]
    )
    assert budget["per_person_total_inr"] > 0
    assert budget["travellers"] == 2

    # selected destinations must be part of the itinerary
    selected_ids = {d["id"] for d in body["selected_destinations"]}
    used_ids = {day["place"]["destination_id"] for day in body["itinerary"]}
    assert used_ids <= selected_ids


def test_plan_is_deterministic_without_ai(client: TestClient) -> None:
    first = client.post("/api/v1/plans", json=BASE_REQUEST).json()
    second = client.post("/api/v1/plans", json=BASE_REQUEST).json()

    def strip_volatile(payload: dict) -> dict:
        payload = dict(payload)
        payload.pop("plan_id")
        return payload

    assert strip_volatile(first) == strip_volatile(second)


def test_plan_start_city_is_respected(client: TestClient) -> None:
    request = dict(BASE_REQUEST, start_city="mangaluru", interests=["beach"])
    body = client.post("/api/v1/plans", json=request).json()
    assert body["itinerary"][0]["place"]["destination_id"] == "mangaluru"


def test_plan_unknown_start_city_is_rejected(client: TestClient) -> None:
    request = dict(BASE_REQUEST, start_city="gotham-city")
    response = client.post("/api/v1/plans", json=request)
    assert response.status_code == 400
    # Consistent error envelope: {"error": {"code", "message", "details"?}}
    error = response.json()["error"]
    assert error["code"] == "bad_request"
    assert "start_city" in error["message"]


def test_plan_invalid_days_rejected_by_validation(client: TestClient) -> None:
    request = dict(BASE_REQUEST, days=0)
    response = client.post("/api/v1/plans", json=request)
    assert response.status_code == 422


def test_plan_requires_interests(client: TestClient) -> None:
    request = {k: v for k, v in BASE_REQUEST.items() if k != "interests"}
    response = client.post("/api/v1/plans", json=request)
    assert response.status_code == 422


def test_forced_ai_without_key_returns_503(client: TestClient, monkeypatch) -> None:
    # Force the AI path with no key configured (settings cached -> patch property).
    from app.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(type(settings), "llm_configured", property(lambda self: False))

    request = dict(BASE_REQUEST, planner="ai")
    response = client.post("/api/v1/plans", json=request)
    assert response.status_code == 503


def test_auto_falls_back_when_llm_call_fails(client: TestClient, monkeypatch) -> None:
    from app.config import get_settings
    from app.services import ai_planner

    settings = get_settings()
    monkeypatch.setattr(type(settings), "llm_configured", property(lambda self: True))

    def boom(*args, **kwargs):
        raise ai_planner.AIGenerationError("provider down")

    monkeypatch.setattr(ai_planner, "generate_ai_plan", boom)

    request = dict(BASE_REQUEST, planner="auto")
    response = client.post("/api/v1/plans", json=request)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["source"] == "fallback"
    assert any("deterministic fallback" in w for w in body["warnings"])
