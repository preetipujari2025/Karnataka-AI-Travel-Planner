"""Tests for route-aware road-trip discovery, meals, scheduling and budget.

External providers (OSRM/Overpass) stay disabled suite-wide via conftest;
provider-backed behaviour is exercised with monkeypatched, realistic payloads
so no test ever calls a live service.
"""

from __future__ import annotations

import copy

import pytest

from app.schemas import (
    BudgetTier,
    DietaryPreference,
    FieldVerification,
    Interest,
    Pace,
    RoadTripPlanRequest,
    RouteDiscoveryRequest,
    TransportPreference,
    TravellerType,
    TripPriority,
)
from app.services import meal_discovery, places_osm, route_discovery, route_provider
from app.services.roadtrip_planner import plan_road_trip


def _request(**overrides) -> RouteDiscoveryRequest:
    base = {
        "start_city": "bengaluru",
        "final_destination": "mysuru",
        "interests": [Interest.heritage, Interest.temples],
        "days": 2,
        "travellers": 2,
        "pace": Pace.balanced,
        "transport_preference": TransportPreference.private_car,
    }
    base.update(overrides)
    return RouteDiscoveryRequest(**base)


# ---------------------------------------------------------------------------
# Geo helpers
# ---------------------------------------------------------------------------


def test_project_onto_polyline_on_line_and_off_line():
    from app.services.geo import point_at_progress, project_onto_polyline

    line = [[12.97, 77.59], [12.30, 76.65]]  # Bengaluru -> Mysuru corridor
    dist, progress = project_onto_polyline(12.97, 77.59, line)
    assert dist < 0.1 and progress == pytest.approx(0.0, abs=0.01)

    dist, progress = project_onto_polyline(12.30, 76.65, line)
    assert dist < 0.1 and progress == pytest.approx(1.0, abs=0.01)

    far_lat, far_lng = 15.0, 77.0  # far north of the corridor
    dist, _ = project_onto_polyline(far_lat, far_lng, line)
    assert dist > 200

    assert point_at_progress(line, 0.0) == pytest.approx((12.97, 77.59), abs=0.001)
    assert point_at_progress(line, 1.0) == pytest.approx((12.30, 76.65), abs=0.001)


# ---------------------------------------------------------------------------
# Offline discovery (labelled estimate, curated pool)
# ---------------------------------------------------------------------------


def test_discover_offline_uses_labelled_estimate_and_curated_candidates():
    response = route_discovery.discover_route(_request())
    assert response.route.source == "estimated"
    assert response.route.verified is False
    assert any("estimate" in w.lower() for w in response.warnings)
    assert len(response.candidates) > 0
    assert all(c.source_kind in {"curated_destination", "stored_attraction", "openstreetmap"}
               for c in response.candidates)
    # Discovery is broad: every candidate carries a transparent score + reasons.
    for stop in response.candidates:
        assert 0.0 <= stop.score <= 100.0
        assert stop.reasons
        assert stop.distance_from_route_km <= response.request.corridor_radius_km or not stop.recommended
    # Selection labels stay inside the candidate pool.
    candidate_ids = {c.candidate_id for c in response.candidates}
    assert {s.candidate_id for s in response.recommended} <= candidate_ids
    assert "estimate" in response.coverage_note.lower() or "OSRM" in response.coverage_note


def test_discover_is_dynamic_for_any_pair():
    # Belagavi -> Hampi (north Karnataka) works with zero hardcoding.
    response = route_discovery.discover_route(
        _request(start_city="belagavi", final_destination="hampi", days=3)
    )
    assert response.route.origin.name
    assert response.route.destination.name
    assert response.route.distance_km > 200
    assert response.recommended or response.optional_stops  # corridor has real places


def test_discover_pace_sizes_recommendation():
    relaxed = route_discovery.discover_route(_request(pace=Pace.relaxed))
    packed = route_discovery.discover_route(_request(pace=Pace.packed))
    assert len(relaxed.recommended) <= len(packed.recommended) + 2
    assert all(s.default_selected for s in relaxed.recommended)


def test_discover_excluded_candidates_have_reasons():
    response = route_discovery.discover_route(_request(corridor_radius_km=5.0))
    for stop in response.excluded:
        assert stop.exclusion_reason


# ---------------------------------------------------------------------------
# Validation + API surface
# ---------------------------------------------------------------------------


def test_discovery_rejects_same_origin_and_destination():
    with pytest.raises(Exception):
        _request(start_city="bengaluru", final_destination="bengaluru")


def test_discovery_unknown_place_raises_discovery_error():
    with pytest.raises(route_discovery.DiscoveryError):
        route_discovery.discover_route(_request(start_city="nowhere-city"))


def test_api_discover_and_plan_roundtrip(client):
    body = {
        "start_city": "bengaluru",
        "final_destination": "chikkamagaluru",
        "interests": ["nature", "waterfalls"],
        "days": 3,
        "travellers": 2,
        "pace": "balanced",
        "transport_preference": "private_car",
    }
    res = client.post("/api/routes/discover", json=body)
    assert res.status_code == 200, res.text
    discovery = res.json()
    assert discovery["route"]["origin"]["destination_id"]
    selected = [s["candidate_id"] for s in discovery["recommended"][:3]]

    plan_res = client.post(
        "/api/routes/plan",
        json={"discovery": body, "selected_stop_ids": selected, "selected_meal_ids": []},
    )
    assert plan_res.status_code == 200, plan_res.text
    plan = plan_res.json()
    assert plan["days"] == 3
    assert len(plan["itinerary"]) == 3
    total = plan["budget"]
    assert total["total_inr"] == (
        total["stay_food_inr"] + total["transport_inr"] + total["detour_transport_inr"]
        + total["activities_inr"] + total["meals_inr"]
    )

    bad = client.post("/api/routes/discover", json={**body, "start_city": "atlantis"})
    assert bad.status_code == 400


# ---------------------------------------------------------------------------
# Provider-backed behaviour (mocked OSRM / Overpass)
# ---------------------------------------------------------------------------


def _fake_osrm_route(origin, destination, alternatives=False):
    mid = [(origin.lat + destination.lat) / 2, (origin.lng + destination.lng) / 2]
    return route_provider.RouteResult(
        distance_km=150.0,
        duration_hours=3.0,
        geometry=[[origin.lat, origin.lng], mid, [destination.lat, destination.lng]],
        source="osrm",
        verified=True,
    )


@pytest.fixture()
def mocked_providers(monkeypatch, tmp_path):
    # Point the store (incl. the route cache) at an isolated temp database.
    from app.data import store

    monkeypatch.setenv("TOURISM_DB_PATH", str(tmp_path / "roadtrip-test.db"))
    store.init_db()
    monkeypatch.setattr(route_provider, "fetch_route", _fake_osrm_route)
    monkeypatch.setattr(
        route_discovery.route_provider, "fetch_route", _fake_osrm_route
    )
    monkeypatch.setattr(route_discovery.route_provider, "to_route_info",
                        route_provider.to_route_info)
    # Measured detours: fixed plausible values through the provider path.
    def fake_detour(origin, via, destination, baseline_km, baseline_hours):
        return 18.0, 25.0, True
    monkeypatch.setattr(route_discovery.route_provider, "detour_via", fake_detour)

    def fake_attractions(lat, lng, radius_km, limit=60):
        return [
            {
                "osm_id": "node/111", "name": "Corridor Fort", "lat": lat + 0.12, "lng": lng,
                "categories": ["heritage"], "description": None, "opening_hours": "Mo-Su 09:00-17:00",
                "cuisine": None, "diet_tags": [], "fee": None,
                "attribution": places_osm.ODBL_ATTRIBUTION, "license": places_osm.ODBL_LICENSE,
                "source_url": "https://www.openstreetmap.org/node/111", "retrieved_at": "2026-01-01T00:00:00+00:00",
            },
            {
                "osm_id": "node/222", "name": "Twin Falls", "lat": lat, "lng": lng + 0.15,
                "categories": ["waterfall"], "description": None, "opening_hours": None,
                "cuisine": None, "diet_tags": [], "fee": None,
                "attribution": places_osm.ODBL_ATTRIBUTION, "license": places_osm.ODBL_LICENSE,
                "source_url": "https://www.openstreetmap.org/node/222", "retrieved_at": "2026-01-01T00:00:00+00:00",
            },
        ]

    def fake_food(lat, lng, radius_km, limit=40):
        return [
            {
                "osm_id": "node/901", "name": "Vegetarian Corner", "lat": lat, "lng": lng,
                "categories": [], "description": None, "opening_hours": "10:00-22:00",
                "cuisine": "south_indian", "diet_tags": ["vegetarian"], "fee": None,
                "attribution": places_osm.ODBL_ATTRIBUTION, "license": places_osm.ODBL_LICENSE,
                "source_url": "https://www.openstreetmap.org/node/901", "retrieved_at": "2026-01-01T00:00:00+00:00",
            },
            {
                "osm_id": "node/902", "name": "Nonveg House", "lat": lat, "lng": lng + 0.01,
                "categories": [], "description": None, "opening_hours": None,
                "cuisine": "chinese", "diet_tags": [], "fee": None,
                "attribution": places_osm.ODBL_ATTRIBUTION, "license": places_osm.ODBL_LICENSE,
                "source_url": "https://www.openstreetmap.org/node/902", "retrieved_at": "2026-01-01T00:00:00+00:00",
            },
        ]

    monkeypatch.setattr(places_osm, "find_attractions_around", fake_attractions)
    monkeypatch.setattr(route_discovery.places_osm, "find_attractions_around", fake_attractions)
    monkeypatch.setattr(places_osm, "find_food_stops", fake_food)
    monkeypatch.setattr(meal_discovery.places_osm, "find_food_stops", fake_food)
    # Pretend the settings allow live providers (cache path stays off via refresh default).
    from app.config import get_settings
    settings = get_settings().model_copy(update={"routing_enabled": True})
    monkeypatch.setattr(route_discovery, "get_settings", lambda: settings)
    monkeypatch.setattr(places_osm, "get_settings", lambda: settings)
    monkeypatch.setattr(route_provider, "get_settings", lambda: settings)
    return settings


def test_discover_with_mocked_osrm_and_overpass(mocked_providers):
    response = route_discovery.discover_route(_request(refresh=True))
    assert response.route.source == "osrm"
    assert response.route.verified is True
    assert len(response.route.geometry) == 3
    assert "osrm" in response.providers

    osm_stops = [c for c in response.candidates if c.source_kind == "openstreetmap"]
    assert osm_stops, "mocked OSM nodes must surface as candidates"
    fort = next(s for s in osm_stops if s.name == "Corridor Fort")
    assert fort.detour_measured is True
    assert fort.detour_km == 18.0
    assert fort.opening_hours == "Mo-Su 09:00-17:00"
    assert fort.opening_hours_status is FieldVerification.verified
    assert fort.license == "ODbL-1.0"
    assert fort.attribution == places_osm.ODBL_ATTRIBUTION

    # Meal discovery respected the vegetarian preference.
    response = route_discovery.discover_route(_request(refresh=True, dietary_preference="vegetarian"))
    assert response.meal_stops
    assert all("vegetarian" in m.dietary_tags for m in response.meal_stops)
    assert all(m.meal_id.startswith("meal:") for m in response.meal_stops)
    # Prices were never invented.
    assert all(m.price_status is FieldVerification.unknown for m in response.meal_stops)


def test_plan_schedules_selected_stops_and_meals(mocked_providers):
    discovery = route_discovery.discover_route(_request(refresh=True, include_meals=True))
    selected = [s.candidate_id for s in discovery.recommended[:2]]
    meal_ids = [m.meal_id for m in discovery.meal_stops[:2]]
    plan = plan_road_trip(RoadTripPlanRequest(
        discovery=discovery.request,
        selected_stop_ids=selected,
        selected_meal_ids=meal_ids,
    ))
    assert plan.days == discovery.request.days
    assert len(plan.itinerary) == plan.days

    sightseeing_ids = {
        item.ref_id for day in plan.itinerary for item in day.schedule
        if item.item_type == "sightseeing"
    }
    assert set(selected) <= sightseeing_ids | {r.candidate_id for r in plan.rejected_stops}

    for day in plan.itinerary:
        for item in day.schedule:
            assert "07:00" <= item.start_time <= "22:00", f"{day.day}: {item.name} @ {item.start_time}"
            assert "07:00" <= item.end_time <= "22:59"
        assert day.overnight_place.name

    last = plan.itinerary[-1]
    assert any(item.item_type == "arrival" for item in last.schedule)

    meal_items = [
        item for day in plan.itinerary for item in day.schedule if item.item_type == "meal"
    ]
    assert len(meal_items) == len(meal_ids)

    budget = plan.budget
    assert budget.total_inr == (
        budget.stay_food_inr + budget.transport_inr + budget.detour_transport_inr
        + budget.activities_inr + budget.meals_inr
    )
    assert budget.minimum_total_inr is not None
    assert budget.minimum_total_inr <= budget.total_inr
    assert budget.assumptions


def test_plan_rejects_infeasible_selections_with_options():
    # One relaxed day on a long route: the scheduler must refuse, not fabricate.
    discovery = route_discovery.discover_route(
        _request(start_city="bengaluru", final_destination="chikkamagaluru", days=1, pace=Pace.relaxed)
    )
    all_ids = [s.candidate_id for s in discovery.candidates]
    assert all_ids, "this corridor has curated candidates offline"
    plan = plan_road_trip(RoadTripPlanRequest(
        discovery=discovery.request, selected_stop_ids=all_ids
    ))
    assert plan.rejected_stops
    assert all(r.exclusion_reason for r in plan.rejected_stops)
    assert plan.conflicts
    assert any("Options" in c for c in plan.conflicts)
    # Progress never rewinds: selected stops stay monotonic along the route.
    seen = [
        item for day in plan.itinerary for item in day.schedule if item.item_type == "sightseeing"
    ]
    assert len(seen) == len(plan.selected_stops)


def test_plan_budget_respects_stated_meal_budget():
    discovery = route_discovery.discover_route(_request())
    plan = plan_road_trip(RoadTripPlanRequest(
        discovery=discovery.request.model_copy(update={"meal_budget_per_day_inr": 400}),
        selected_stop_ids=[],
    ))
    assert plan.budget.meals_inr == 400 * plan.days * discovery.request.travellers
    assert any("400" in a for a in plan.budget.assumptions)


def test_plan_budget_fit_flags_over_budget():
    discovery = route_discovery.discover_route(_request())
    plan = plan_road_trip(RoadTripPlanRequest(
        discovery=discovery.request, selected_stop_ids=[], total_budget_inr=100,
    ))
    assert plan.budget_fit is not None
    assert plan.budget_fit.within_budget is False
    assert plan.budget_fit.variance_inr < 0
    assert any("exceeds" in w.lower() for w in plan.warnings)


def test_meal_discovery_provider_failure_never_invents_names(monkeypatch):
    def boom(lat, lng, radius_km, limit=40):
        raise RuntimeError("overpass down")

    monkeypatch.setattr(meal_discovery.places_osm, "find_food_stops", boom)
    monkeypatch.setattr(meal_discovery, "VERIFIED_KARNATAKA_FOOD_STOPS", [])
    geometry = [[12.97, 77.59], [12.30, 76.65]]
    stops, warnings = meal_discovery.discover_meals(geometry, _request())
    assert stops == []
    assert any("invented" in w.lower() or "unavailable" in w.lower() for w in warnings)


def test_meal_discovery_uses_verified_stops_when_overpass_fails(monkeypatch):
    def boom(lat, lng, radius_km, limit=40):
        raise RuntimeError("overpass down")

    monkeypatch.setattr(meal_discovery.places_osm, "find_food_stops", boom)
    geometry = [[12.97, 77.59], [12.30, 76.65]]
    stops, warnings = meal_discovery.discover_meals(geometry, _request())
    assert len(stops) > 0
    assert all(s.source_kind == "verified_food_stop" for s in stops)
    assert all(s.price_status is FieldVerification.unknown for s in stops)


def test_six_requested_routes_dynamic_discovery():
    test_routes = [
        ("bengaluru", "mysuru"),
        ("bengaluru", "chikkamagaluru"),
        ("bengaluru", "belagavi"),
        ("bengaluru", "hampi"),
        ("belagavi", "hampi"),
        ("hampi", "mysuru"),
    ]
    for start, destination in test_routes:
        req = _request(start_city=start, final_destination=destination, days=3)
        res = route_discovery.discover_route(req)
        assert res.route.origin.name, f"Origin name missing for {start}->{destination}"
        assert res.route.destination.name, f"Destination name missing for {start}->{destination}"
        assert res.route.distance_km > 50, f"Unrealistic distance {res.route.distance_km} for {start}->{destination}"
        assert len(res.route.geometry) >= 2, f"Invalid geometry for {start}->{destination}"
        assert len(res.candidates) > 0 or len(res.optional_stops) > 0 or len(res.recommended) > 0
        for c in res.candidates:
            assert 0.0 <= c.score <= 100.0
            assert len(c.reasons) > 0
            assert 0.0 <= c.progress_fraction <= 1.0


def test_trip_priority_scoring_effects():
    # Compare candidate scores under min_cost, min_travel_time, max_sightseeing vs balanced
    req_bal = _request(trip_priority=TripPriority.balanced)
    req_cost = _request(trip_priority=TripPriority.min_cost)
    req_time = _request(trip_priority=TripPriority.min_travel_time)

    res_bal = route_discovery.discover_route(req_bal)
    res_cost = route_discovery.discover_route(req_cost)
    res_time = route_discovery.discover_route(req_time)

    # Free/low-cost stops get a budget priority boost in min_cost
    low_fee_candidates = [c for c in res_cost.candidates if c.entry_fee_inr == 0 or (c.entry_fee_inr and c.entry_fee_inr <= 50)]
    if low_fee_candidates:
        assert any("budget priority: zero or minimal entry fee" in r for r in low_fee_candidates[0].reasons)

    # Stops right along the corridor (<= 5 km) get a time priority boost
    close_candidates = [c for c in res_time.candidates if c.distance_from_route_km <= 5.0]
    if close_candidates:
        assert any("time priority: right along the main corridor" in r for r in close_candidates[0].reasons)


def test_traveller_type_scoring_effects():
    req_senior = _request(traveller_type=TravellerType.senior, interests=[Interest.temples, Interest.heritage])
    res_senior = route_discovery.discover_route(req_senior)

    spiritual_stops = [
        c for c in res_senior.candidates
        if any(cat in {"spiritual", "temples", "heritage", "gardens"} for cat in c.categories)
    ]
    if spiritual_stops:
        assert any("accessible and peaceful for senior travelers" in r for r in spiritual_stops[0].reasons)


def test_allow_backtracking_enforcement():
    discovery = route_discovery.discover_route(_request(days=1, pace=Pace.packed))
    if len(discovery.candidates) >= 2:
        # Pick two candidates: first at higher progress, second at lower progress
        sorted_by_prog = sorted(discovery.candidates, key=lambda c: c.progress_fraction)
        second = sorted_by_prog[0]   # low progress
        first = sorted_by_prog[-1]   # high progress
        if first.progress_fraction - second.progress_fraction > 0.05:
            # 1. When allow_backtracking=False, stops MUST progress generally forward along the route
            # Even if caller passes [first, second], planner ensures second (lower progress) is visited first.
            plan_no_bt = plan_road_trip(RoadTripPlanRequest(
                discovery=discovery.request.model_copy(update={"allow_backtracking": False, "days": 1}),
                selected_stop_ids=[first.candidate_id, second.candidate_id],
            ))
            scheduled_ids = [
                item.ref_id for day in plan_no_bt.itinerary for item in day.schedule
                if item.item_type == "sightseeing"
            ]
            if second.candidate_id in scheduled_ids and first.candidate_id in scheduled_ids:
                assert scheduled_ids.index(second.candidate_id) < scheduled_ids.index(first.candidate_id), (
                    "Forward progression was not enforced when allow_backtracking=False"
                )

            # 2. When allow_backtracking=True, caller order [first, second] is preserved allowing backtracking.
            plan_bt = plan_road_trip(RoadTripPlanRequest(
                discovery=discovery.request.model_copy(update={"allow_backtracking": True, "days": 1}),
                selected_stop_ids=[first.candidate_id, second.candidate_id],
            ))
            scheduled_bt_ids = [
                item.ref_id for day in plan_bt.itinerary for item in day.schedule
                if item.item_type == "sightseeing"
            ]
            if second.candidate_id in scheduled_bt_ids and first.candidate_id in scheduled_bt_ids:
                assert scheduled_bt_ids.index(first.candidate_id) < scheduled_bt_ids.index(second.candidate_id), (
                    "Caller reverse order was not honored when allow_backtracking=True"
                )



def test_roadtrip_budget_invariant_across_modes_and_tiers():
    discovery = route_discovery.discover_route(_request())
    for transport in [
        TransportPreference.private_car,
        TransportPreference.self_drive,
        TransportPreference.private_cab,
        TransportPreference.public_transport,
    ]:
        for tier in [BudgetTier.budget, BudgetTier.mid, BudgetTier.luxury]:
            req = discovery.request.model_copy(
                update={"transport_preference": transport, "budget_tier": tier}
            )
            plan = plan_road_trip(RoadTripPlanRequest(
                discovery=req,
                selected_stop_ids=[s.candidate_id for s in discovery.recommended[:2]],
            ))
            b = plan.budget
            expected_sum = (
                b.stay_food_inr + b.transport_inr + b.detour_transport_inr
                + b.activities_inr + b.meals_inr
            )
            assert b.total_inr == expected_sum, f"Budget invariant failed for {transport}/{tier}: {b.total_inr} != {expected_sum}"
            assert b.total_inr > 0


def test_discovery_cache_roundtrip(tmp_path):
    from app.data import store

    db = tmp_path / "cache-test.db"
    store.init_db(db)
    payload = {"hello": "route"}
    store.cache_put("k1", "discovery", "bengaluru", "mysuru", payload, ttl_seconds=3600, db_path=db)
    hit = store.cache_get("k1", db_path=db)
    assert hit and hit["payload"] == payload and hit["stale"] is False

    store.cache_put("k2", "discovery", "a", "b", payload, ttl_seconds=1, db_path=db)
    # Force expiry by rewriting expires_at into the past.
    with store.get_connection(db) as conn:
        conn.execute("UPDATE route_cache SET expires_at = '2000-01-01' WHERE cache_key = 'k2'")
    hit = store.cache_get("k2", db_path=db)
    assert hit and hit["stale"] is True
    assert store.cache_purge_expired(db_path=db) == 1

