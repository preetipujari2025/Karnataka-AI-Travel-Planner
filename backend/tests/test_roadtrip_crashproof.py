"""Tests proving the road trip planner is crash-proof and handles all edge cases gracefully:
1. Departure date handling in RoadTripPlanRequest & RoadTripDay (dt_date type shadowing fix).
2. The 10+ required routes:
   - Bengaluru -> Mysuru
   - Bengaluru -> Hampi
   - Bengaluru -> Coorg (alias to madikeri)
   - Bengaluru -> Gokarna
   - Mangaluru -> Udupi
   - Hubballi -> Gokak (alias to gokak-falls)
   - Mysuru -> Ooty border (bandipur)
   - Route where start and end are the same -> clean 400/422, NEVER 500
   - Very short route (Mysuru -> Srirangapatna, ~16 km)
   - Belagavi -> Vijayapura
   - Unknown destination (e.g. Atlantis) -> clean 400/422, NEVER 500
   - Missing location -> clean 422, NEVER 500
3. OpenStreetMap degradation:
   - When Overpass fails or times out, returns friendly warning and curated stops, never 500.
4. Empty stop selections:
   - Planning with 0 selected stops still builds a valid day-wise transit itinerary without crashing.
"""

from __future__ import annotations

import datetime
from unittest.mock import patch
import pytest
from starlette.testclient import TestClient

from app.main import create_app
from app.schemas import RoadTripDay, Place, ScheduledItem


@pytest.fixture
def client() -> TestClient:
    return TestClient(create_app())


# ===========================================================================
# 1. Pydantic Model Validation Fix (departure_date in RoadTripDay)
# ===========================================================================
def test_road_trip_day_accepts_valid_date() -> None:
    """RoadTripDay must accept datetime.date without raising Pydantic ValidationError."""
    today = datetime.date(2026, 11, 11)
    day = RoadTripDay(
        day=1,
        date=today,
        title="Day 1: Sightseeing",
        overnight_place=Place(
            destination_id="mysuru",
            name="Mysuru",
            region="South Karnataka",
            lat=12.3086,
            lng=76.6531,
        ),
        driving_minutes=120,
        schedule=[],
        notes=["Test note"],
    )
    assert day.date == today
    assert day.date is not None


# ===========================================================================
# 2. Ten Required Route Tests
# ===========================================================================
def test_route_bengaluru_to_mysuru_discover_and_plan(client: TestClient) -> None:
    payload = {
        "start_city": "bengaluru",
        "final_destination": "mysuru",
        "days": 2,
        "departure_date": "2026-11-11",
    }
    res_disc = client.post("/api/routes/discover", json=payload)
    assert res_disc.status_code == 200
    disc_data = res_disc.json()
    assert disc_data["route"]["distance_km"] > 100

    plan_payload = {
        "discovery": payload,
        "selected_stop_ids": [s["candidate_id"] for s in disc_data["candidates"][:2]],
        "selected_meal_ids": [],
    }
    res_plan = client.post("/api/routes/plan", json=plan_payload)
    assert res_plan.status_code == 200
    plan_data = res_plan.json()
    assert len(plan_data["itinerary"]) == 2
    assert plan_data["itinerary"][0]["date"] == "2026-11-11"
    assert plan_data["itinerary"][1]["date"] == "2026-11-12"


def test_route_bengaluru_to_hampi_discover_and_plan(client: TestClient) -> None:
    payload = {
        "start_city": "bengaluru",
        "final_destination": "hampi",
        "days": 4,
        "departure_date": "2026-11-11",
    }
    res = client.post("/api/routes/discover", json=payload)
    assert res.status_code == 200
    disc = res.json()
    assert disc["route"]["distance_km"] > 300

    plan_payload = {
        "discovery": payload,
        "selected_stop_ids": [s["candidate_id"] for s in disc["candidates"][:2]],
        "selected_meal_ids": [],
    }
    res_plan = client.post("/api/routes/plan", json=plan_payload)
    assert res_plan.status_code == 200
    assert len(res_plan.json()["itinerary"]) == 4


def test_route_bengaluru_to_coorg_alias_resolves_and_plans(client: TestClient) -> None:
    """'coorg' alias must resolve to Madikeri/Kodagu without error."""
    payload = {
        "start_city": "bengaluru",
        "final_destination": "coorg",
        "days": 3,
        "departure_date": "2026-11-11",
    }
    res = client.post("/api/routes/discover", json=payload)
    assert res.status_code == 200
    disc = res.json()
    assert disc["route"]["destination"]["destination_id"] in ["madikeri", "kodagu"]

    plan_payload = {
        "discovery": payload,
        "selected_stop_ids": [s["candidate_id"] for s in disc["candidates"][:2]],
        "selected_meal_ids": [],
    }
    res_plan = client.post("/api/routes/plan", json=plan_payload)
    assert res_plan.status_code == 200
    assert len(res_plan.json()["itinerary"]) == 3


def test_route_bengaluru_to_gokarna_discover_and_plan(client: TestClient) -> None:
    payload = {
        "start_city": "bengaluru",
        "final_destination": "gokarna",
        "days": 4,
        "departure_date": "2026-11-11",
    }
    res = client.post("/api/routes/discover", json=payload)
    assert res.status_code == 200
    disc = res.json()
    assert disc["route"]["distance_km"] > 400

    plan_payload = {
        "discovery": payload,
        "selected_stop_ids": [s["candidate_id"] for s in disc["candidates"][:2]],
        "selected_meal_ids": [],
    }
    res_plan = client.post("/api/routes/plan", json=plan_payload)
    assert res_plan.status_code == 200


def test_route_mangaluru_to_udupi_discover_and_plan(client: TestClient) -> None:
    payload = {
        "start_city": "mangaluru",
        "final_destination": "udupi",
        "days": 2,
        "departure_date": "2026-11-11",
    }
    res = client.post("/api/routes/discover", json=payload)
    assert res.status_code == 200
    disc = res.json()
    assert disc["route"]["distance_km"] > 40

    plan_payload = {
        "discovery": payload,
        "selected_stop_ids": [s["candidate_id"] for s in disc["candidates"][:2]],
        "selected_meal_ids": [],
    }
    res_plan = client.post("/api/routes/plan", json=plan_payload)
    assert res_plan.status_code == 200


def test_route_hubballi_to_gokak_resolves_and_plans(client: TestClient) -> None:
    """'gokak' alias must resolve to Gokak Falls in northern Karnataka."""
    payload = {
        "start_city": "hubballi",
        "final_destination": "gokak",
        "days": 2,
        "departure_date": "2026-11-11",
    }
    res = client.post("/api/routes/discover", json=payload)
    assert res.status_code == 200
    disc = res.json()
    assert "gokak" in disc["route"]["destination"]["destination_id"]

    plan_payload = {
        "discovery": payload,
        "selected_stop_ids": [s["candidate_id"] for s in disc["candidates"][:1]],
        "selected_meal_ids": [],
    }
    res_plan = client.post("/api/routes/plan", json=plan_payload)
    assert res_plan.status_code == 200


def test_route_mysuru_to_ooty_border_resolves_and_plans(client: TestClient) -> None:
    """'ooty' must resolve to Bandipur / Karnataka border along NH-766."""
    payload = {
        "start_city": "mysuru",
        "final_destination": "ooty",
        "days": 2,
        "departure_date": "2026-11-11",
    }
    res = client.post("/api/routes/discover", json=payload)
    assert res.status_code == 200
    disc = res.json()
    assert "bandipur" in disc["route"]["destination"]["destination_id"]

    plan_payload = {
        "discovery": payload,
        "selected_stop_ids": [s["candidate_id"] for s in disc["candidates"][:1]],
        "selected_meal_ids": [],
    }
    res_plan = client.post("/api/routes/plan", json=plan_payload)
    assert res_plan.status_code == 200


def test_route_same_start_and_end_returns_clean_400_or_422(client: TestClient) -> None:
    """Origin and destination being identical must return 400/422, NEVER 500."""
    payload = {
        "start_city": "bengaluru",
        "final_destination": "bengaluru",
        "days": 2,
        "departure_date": "2026-11-11",
    }
    res = client.post("/api/routes/discover", json=payload)
    assert res.status_code in [400, 422]
    assert res.status_code != 500
    err = res.json()
    msg = err.get("error", {}).get("message", "") or err.get("detail", "")
    assert "different" in str(msg).lower() or "validation" in str(msg).lower()


def test_very_short_route_mysuru_to_srirangapatna(client: TestClient) -> None:
    """Very short route (~16 km) must discover and plan cleanly without division by zero or errors."""
    payload = {
        "start_city": "mysuru",
        "final_destination": "srirangapatna",
        "days": 1,
        "departure_date": "2026-11-11",
    }
    res = client.post("/api/routes/discover", json=payload)
    assert res.status_code == 200
    disc = res.json()
    assert disc["route"]["distance_km"] < 25

    plan_payload = {
        "discovery": payload,
        "selected_stop_ids": [s["candidate_id"] for s in disc["candidates"][:1]],
        "selected_meal_ids": [],
    }
    res_plan = client.post("/api/routes/plan", json=plan_payload)
    assert res_plan.status_code == 200
    assert len(res_plan.json()["itinerary"]) == 1


def test_route_belagavi_to_vijayapura(client: TestClient) -> None:
    payload = {
        "start_city": "belagavi",
        "final_destination": "vijayapura",
        "days": 3,
        "departure_date": "2026-11-11",
    }
    res = client.post("/api/routes/discover", json=payload)
    assert res.status_code == 200
    disc = res.json()
    assert disc["route"]["distance_km"] > 180

    plan_payload = {
        "discovery": payload,
        "selected_stop_ids": [s["candidate_id"] for s in disc["candidates"][:1]],
        "selected_meal_ids": [],
    }
    res_plan = client.post("/api/routes/plan", json=plan_payload)
    assert res_plan.status_code == 200


def test_unknown_city_returns_friendly_400_never_500(client: TestClient) -> None:
    """Unknown destination outside Karnataka must return 400 Bad Request, NEVER 500."""
    payload = {
        "start_city": "bengaluru",
        "final_destination": "atlantis-fantasy-city",
        "days": 2,
    }
    res = client.post("/api/routes/discover", json=payload)
    assert res.status_code == 400
    err = res.json()
    assert "error" in err
    msg = err["error"]["message"]
    assert "Unknown" in msg
    assert "Karnataka" in msg


def test_missing_city_returns_422_never_500(client: TestClient) -> None:
    """Missing or empty location input must return 422 Unprocessable Entity, NEVER 500."""
    payload = {
        "start_city": "",
        "final_destination": "mysuru",
        "days": 2,
    }
    res = client.post("/api/routes/discover", json=payload)
    assert res.status_code == 422


# ===========================================================================
# 3. Crash-Proof OpenStreetMap Degradation
# ===========================================================================
def test_osm_failure_degrades_gracefully_to_curated_data(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    """When Overpass API times out or raises an exception, the system must not 500."""
    from app.config import get_settings
    settings = get_settings().model_copy(update={"routing_enabled": True})
    monkeypatch.setattr("app.services.route_discovery.get_settings", lambda: settings)

    def raise_timeout(*args, **kwargs):
        raise TimeoutError("Overpass timed out")

    monkeypatch.setattr("app.services.places_osm.find_attractions_around", raise_timeout)
    monkeypatch.setattr("app.services.places_osm.find_food_stops", raise_timeout)

    payload = {
        "start_city": "bengaluru",
        "final_destination": "mysuru",
        "days": 2,
        "refresh": True,
    }
    res = client.post("/api/routes/discover", json=payload)
    assert res.status_code == 200
    data = res.json()

    # Must include curated destinations along Bengaluru-Mysuru corridor
    assert len(data["candidates"]) > 0
    # Must display user-friendly warning message
    warnings = data.get("warnings", [])
    assert any("curated suggestions" in w.lower() for w in warnings)


# ===========================================================================
# 4. Empty Stop Selection Road Trip Planning
# ===========================================================================
def test_plan_with_zero_stops_succeeds(client: TestClient) -> None:
    """Planning a road trip with 0 selected stops must succeed with pure driving schedule."""
    payload = {
        "start_city": "bengaluru",
        "final_destination": "mysuru",
        "days": 2,
        "departure_date": "2026-11-11",
    }
    plan_payload = {
        "discovery": payload,
        "selected_stop_ids": [],
        "selected_meal_ids": [],
    }
    res = client.post("/api/routes/plan", json=plan_payload)
    assert res.status_code == 200
    data = res.json()
    assert len(data["itinerary"]) == 2
    assert any("Depart Bengaluru" in item["name"] for item in data["itinerary"][0]["schedule"])
    assert any("Arrive at Mysuru" in item["name"] for item in data["itinerary"][1]["schedule"])

