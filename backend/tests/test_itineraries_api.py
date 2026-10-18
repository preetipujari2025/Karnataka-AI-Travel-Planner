"""Tests for POST /api/itineraries/generate and .../regenerate (stateless)."""

from __future__ import annotations

import datetime as dt

from fastapi.testclient import TestClient

# Deterministic for tests: force the fallback planner (no LLM needed).
BASE_TRIP = {
    "start_city": "bengaluru",
    "days": 5,
    "travellers": 2,
    "budget_tier": "mid",
    "pace": "balanced",
    "interests": ["heritage", "nature"],
    "planner": "fallback",
    "total_budget_inr": 60000,
    "transport_preference": "any",
    "dietary_preference": "vegetarian",
}


def _future_dates(days: int) -> dict:
    start = dt.date.today() + dt.timedelta(days=30)
    end = start + dt.timedelta(days=days - 1)
    return {"start_date": start.isoformat(), "end_date": end.isoformat()}


# ---------------------------------------------------------------------------
# POST /api/itineraries/generate
# ---------------------------------------------------------------------------


def test_generate_returns_complete_itinerary(client: TestClient) -> None:
    response = client.post("/api/itineraries/generate", json=BASE_TRIP)
    assert response.status_code == 200, response.text
    body = response.json()

    assert body["source"] == "fallback"
    assert len(body["itinerary"]) == 5
    assert body["selected_destinations"]
    assert body["route"] is not None
    # Structured budget-fit model present and consistent with the budget
    fit = body["budget_fit"]
    assert fit["estimated_total_inr"] == body["budget"]["total_inr"]
    assert fit["total_budget_inr"] == 60000
    assert fit["within_budget"] is True
    assert fit["variance_inr"] == 60000 - body["budget"]["total_inr"]


def test_generate_applies_dietary_preference(client: TestClient) -> None:
    body = client.post("/api/itineraries/generate", json=BASE_TRIP).json()
    food_descriptions = [
        activity["description"]
        for day in body["itinerary"]
        for activity in day["activities"]
        if activity["kind"] == "food"
    ]
    assert food_descriptions
    assert all("Vegetarian" in text for text in food_descriptions)


def test_generate_rejects_invalid_budgets(client: TestClient) -> None:
    for bad_budget in (0, -500, 99_999_999):
        response = client.post(
            "/api/itineraries/generate", json={**BASE_TRIP, "total_budget_inr": bad_budget}
        )
        assert response.status_code == 422, bad_budget
        error = response.json()["error"]
        assert error["code"] == "request_validation_error"
        assert any("total_budget_inr" in d["field"] for d in error["details"])


def test_generate_rejects_impossible_durations(client: TestClient) -> None:
    for days in (0, -3, 999):
        response = client.post(
            "/api/itineraries/generate", json={**BASE_TRIP, "days": days}
        )
        assert response.status_code == 422, days


def test_generate_rejects_empty_interests(client: TestClient) -> None:
    response = client.post("/api/itineraries/generate", json={**BASE_TRIP, "interests": []})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "request_validation_error"


def test_generate_rejects_malformed_json(client: TestClient) -> None:
    response = client.post(
        "/api/itineraries/generate",
        content="{not valid json",
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "request_validation_error"


def test_generate_with_travel_dates(client: TestClient) -> None:
    response = client.post(
        "/api/itineraries/generate",
        json={**BASE_TRIP, "travel_dates": _future_dates(5)},
    )
    assert response.status_code == 200, response.text
    assert len(response.json()["itinerary"]) == 5


def test_generate_rejects_travel_dates_span_mismatch(client: TestClient) -> None:
    response = client.post(
        "/api/itineraries/generate",
        json={**BASE_TRIP, "travel_dates": _future_dates(9)},  # days stays 5
    )
    assert response.status_code == 422
    details = response.json()["error"]["details"]
    assert any("match" in d["message"] for d in details)


def test_generate_rejects_past_travel_dates(client: TestClient) -> None:
    past = {
        "start_date": (dt.date.today() - dt.timedelta(days=10)).isoformat(),
        "end_date": (dt.date.today() - dt.timedelta(days=6)).isoformat(),
    }
    response = client.post(
        "/api/itineraries/generate", json={**BASE_TRIP, "travel_dates": past}
    )
    assert response.status_code == 422


def test_generate_unknown_start_city_is_400(client: TestClient) -> None:
    response = client.post(
        "/api/itineraries/generate", json={**BASE_TRIP, "start_city": "gotham-city"}
    )
    assert response.status_code == 400
    error = response.json()["error"]
    assert error["code"] == "bad_request"
    assert "start_city" in error["message"]


def test_generate_over_budget_flagged_not_failed(client: TestClient) -> None:
    response = client.post(
        "/api/itineraries/generate", json={**BASE_TRIP, "total_budget_inr": 1000}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["budget_fit"]["within_budget"] is False
    assert body["budget_fit"]["variance_inr"] < 0
    assert any("exceeds your total budget" in w for w in body["warnings"])


def test_transport_preference_changes_cost(client: TestClient) -> None:
    public = client.post(
        "/api/itineraries/generate",
        json={**BASE_TRIP, "transport_preference": "public_transport"},
    ).json()
    private = client.post(
        "/api/itineraries/generate",
        json={**BASE_TRIP, "transport_preference": "private_cab"},
    ).json()
    assert public["budget"]["transport_inr"] < private["budget"]["transport_inr"]
    assert public["budget"]["total_inr"] < private["budget"]["total_inr"]
    # Public transport models slower door-to-door travel on the same legs.
    assert public["route"]
    for pub_leg, priv_leg in zip(public["route"], private["route"]):
        assert pub_leg["duration_hours"] >= priv_leg["duration_hours"]


def test_accessibility_requirements_produce_warnings(client: TestClient) -> None:
    response = client.post(
        "/api/itineraries/generate",
        json={
            **BASE_TRIP,
            "start_city": "hampi",
            "accessibility_requirements": "wheelchair access needed",
        },
    )
    assert response.status_code == 200
    warnings = response.json()["warnings"]
    # Hampi is the start city (always included) and documents rocky terrain.
    assert any("Accessibility at Hampi" in w for w in warnings)


# ---------------------------------------------------------------------------
# POST /api/itineraries/{itinerary_id}/regenerate (stateless)
# ---------------------------------------------------------------------------


def _generate(client: TestClient) -> dict:
    response = client.post("/api/itineraries/generate", json=BASE_TRIP)
    assert response.status_code == 200, response.text
    return response.json()


def test_regenerate_without_changes_rerolls_but_preserves_constraints(
    client: TestClient,
) -> None:
    previous = _generate(client)
    response = client.post(
        f"/api/itineraries/{previous['plan_id']}/regenerate",
        json={"previous_itinerary": previous, "trip": BASE_TRIP},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["regenerated_from"] == previous["plan_id"]
    assert body["plan_id"] != previous["plan_id"]  # a fresh plan was produced
    assert len(body["itinerary"]) == previous["budget"]["days"]
    assert body["interests"] == previous["interests"]
    assert body["budget_fit"]["estimated_total_inr"] == body["budget"]["total_inr"]


def test_regenerate_applies_explicit_changes(client: TestClient) -> None:
    previous = _generate(client)
    response = client.post(
        f"/api/itineraries/{previous['plan_id']}/regenerate",
        json={
            "previous_itinerary": previous,
            "trip": BASE_TRIP,
            "changes": {"days": 3, "pace": "packed"},
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert len(body["itinerary"]) == 3
    assert body["budget"]["days"] == 3
    # Explicit constraints not overridden are preserved.
    assert body["interests"] == ["heritage", "nature"]
    assert body["budget_fit"]["total_budget_inr"] == 60000


def test_regenerate_rejects_id_mismatch(client: TestClient) -> None:
    previous = _generate(client)
    response = client.post(
        "/api/itineraries/some-other-id/regenerate",
        json={"previous_itinerary": previous, "trip": BASE_TRIP},
    )
    assert response.status_code == 400
    error = response.json()["error"]
    assert error["code"] == "bad_request"
    assert "stateless" in error["message"]


def test_regenerate_requires_previous_itinerary_payload(client: TestClient) -> None:
    previous = _generate(client)
    response = client.post(
        f"/api/itineraries/{previous['plan_id']}/regenerate",
        json={"trip": BASE_TRIP},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "request_validation_error"


def test_regenerate_rejects_invalid_changes(client: TestClient) -> None:
    previous = _generate(client)
    response = client.post(
        f"/api/itineraries/{previous['plan_id']}/regenerate",
        json={"previous_itinerary": previous, "trip": BASE_TRIP, "changes": {"days": 0}},
    )
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# GET /api/itineraries/{itinerary_id} — intentionally not implemented
# ---------------------------------------------------------------------------


def test_itinerary_retrieval_returns_documented_404(client: TestClient) -> None:
    """No persistence in this MVP: retrieval is a documented 404, not a fake record."""
    response = client.get("/api/itineraries/abc123")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"
