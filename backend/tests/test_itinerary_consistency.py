"""Regression tests for the browser-test findings.

1. The reported route Bengaluru -> Srirangapatna -> Hampi -> Hampi -> Badami:
   Hampi is an INTENTIONAL 2-night stay (min_nights=2), not a duplicated
   selection — but it must be represented as an explicit stay, never as a
   repeated destination, and its two days must not repeat sightseeing stops.
2. Duplicate/non-contiguous stops across days must be impossible to serialise.
3. Budget must keep unknown entry fees distinct from confirmed zero fees.
4. AI provider failure modes must raise AIGenerationError (mocked, no network).
"""

from __future__ import annotations

from collections import defaultdict

import httpx
import pytest
from fastapi.testclient import TestClient

from app.data.loader import require_destination
from app.schemas import Pace, PlanRequest, StaySpan
from app.services import ai_planner
from app.services.ai_planner import AIGenerationError, generate_ai_plan
from app.services.planner import PlanConsistencyError, _assert_plan_consistency, create_plan
from app.services.routing import assign_nights, build_legs, build_stay_spans, nearest_neighbor_order

# The exact shape of the browser test's request (5-day heritage/nature trip).
BROWSER_TRIP = {
    "interests": ["heritage", "nature"],
    "days": 5,
    "travellers": 2,
    "budget_tier": "mid",
    "pace": "balanced",
    "start_city": "bengaluru",
    "start_month": 12,
    "planner": "fallback",
}


def make_plan(**overrides):
    payload = {**BROWSER_TRIP, **overrides}
    return create_plan(PlanRequest.model_validate(payload))


# ---------------------------------------------------------------------------
# 1. Repeated-Hampi scenario
# ---------------------------------------------------------------------------


def test_browser_scenario_destinations_are_unique() -> None:
    plan = make_plan()
    ids = [d.id for d in plan.selected_destinations]
    assert ids == ["bengaluru", "srirangapatna", "hampi", "badami"]
    assert len(ids) == len(set(ids)), "no destination may be selected twice"


def test_browser_scenario_hampi_is_an_explicit_two_day_stay() -> None:
    """The reported 'Hampi -> Hampi' is one contiguous 2-day stay, not a dupe."""
    plan = make_plan()

    hampi_stays = [s for s in plan.stays if s.destination_id == "hampi"]
    assert len(hampi_stays) == 1, "Hampi must appear exactly once in stays"
    span = hampi_stays[0]
    assert span.first_day == 3 and span.last_day == 4 and span.days == 2

    # Day-wise places agree with the stay: days 3 and 4 are Hampi, once each.
    hampi_days = [d.day for d in plan.itinerary if d.place.destination_id == "hampi"]
    assert hampi_days == [3, 4]

    # The itinerary days carry the stay metadata explicitly.
    by_day = {d.day: d for d in plan.itinerary}
    assert (by_day[3].stay_day, by_day[3].stay_days) == (1, 2)
    assert (by_day[4].stay_day, by_day[4].stay_days) == (2, 2)

    # Route legs never contain a self-loop (Hampi -> Hampi must not exist).
    for leg in plan.route:
        assert leg.origin.destination_id != leg.destination.destination_id


def test_browser_scenario_no_duplicate_sightseeing_across_stay_days() -> None:
    """The two Hampi days previously repeated 'Virupaksha Temple' twice."""
    plan = make_plan()
    sightseeing_by_dest: dict[str, list[str]] = defaultdict(list)
    for day in plan.itinerary:
        for activity in day.activities:
            if activity.kind.value in ("sightseeing", "leisure"):
                sightseeing_by_dest[activity.destination_id].append(activity.title)
    for dest_id, titles in sightseeing_by_dest.items():
        assert len(titles) == len(set(titles)), (
            f"duplicate sightseeing stops at {dest_id}: {titles}"
        )


def test_browser_scenario_selected_days_and_legs_agree() -> None:
    plan = make_plan()
    selected_ids = [d.id for d in plan.selected_destinations]
    day_ids = [d.place.destination_id for d in plan.itinerary]
    assert set(day_ids) <= set(selected_ids)
    # Every selected destination is actually visited.
    assert set(selected_ids) == set(day_ids)
    # Stays cover 1..5 with no gaps.
    assert [s.first_day for s in plan.stays] == [1, 2, 3, 5]
    assert [s.last_day for s in plan.stays] == [1, 2, 4, 5]
    # Legs exist exactly on destination-change days.
    change_days = {
        i + 1 for i in range(1, len(day_ids)) if day_ids[i] != day_ids[i - 1]
    }
    assert {leg.day for leg in plan.route} == change_days


# ---------------------------------------------------------------------------
# 2. Duplicate stops / multi-day stay validity
# ---------------------------------------------------------------------------


def test_duplicate_day_places_raise_consistency_error() -> None:
    """A destination that reappears after being left cannot be serialised."""
    start = require_destination("bengaluru")
    mysuru = require_destination("mysuru")
    hampi = require_destination("hampi")
    # B A B pattern: teleports back to a previously left stop.
    nightly = [(1, start), (2, mysuru), (3, start)]
    with pytest.raises(ValueError, match="non-contiguous"):
        build_stay_spans(nightly)

    # Consistency guard also rejects a stay that does not match the days.
    bad_stays = [
        StaySpan(destination_id="bengaluru", name="Bengaluru", first_day=1, last_day=1, days=1),
        StaySpan(destination_id="hampi", name="Hampi", first_day=2, last_day=3, days=2),
    ]
    class FakeDay:
        def __init__(self, day, dest_id):
            self.day = day
            self.place = type("P", (), {"destination_id": dest_id})()
            self.activities = []
    days = [FakeDay(1, "bengaluru"), FakeDay(2, "hampi"), FakeDay(3, "mysuru")]
    with pytest.raises(PlanConsistencyError):
        _assert_plan_consistency(
            selected_ids=["bengaluru", "hampi", "mysuru"],
            itinerary=days,
            legs=[],
            stays=bad_stays,
            expected_days=3,
        )


def test_duplicate_selected_ids_rejected_by_guard() -> None:
    class FakeDay:
        def __init__(self, day, dest_id):
            self.day = day
            self.place = type("P", (), {"destination_id": dest_id})()
            self.activities = []
    days = [FakeDay(1, "hampi"), FakeDay(2, "hampi")]
    stays = [StaySpan(destination_id="hampi", name="Hampi", first_day=1, last_day=2, days=2)]
    with pytest.raises(PlanConsistencyError, match="duplicate destination"):
        _assert_plan_consistency(
            selected_ids=["hampi", "hampi"],
            itinerary=days,
            legs=[],
            stays=stays,
            expected_days=2,
        )


def test_multiday_stay_is_valid_and_contiguous_across_paces() -> None:
    for pace in (Pace.relaxed, Pace.balanced, Pace.packed):
        plan = make_plan(pace=pace.value)
        span_ids = [s.destination_id for s in plan.stays]
        assert len(span_ids) == len(set(span_ids)), f"{pace}: duplicate stays"
        covered = []
        for span in plan.stays:
            assert span.days == span.last_day - span.first_day + 1
            covered.extend(range(span.first_day, span.last_day + 1))
        assert covered == list(range(1, plan.budget.days + 1))
        # day-wise metadata agrees with its span
        by_day = {d.day: d for d in plan.itinerary}
        for span in plan.stays:
            for day in range(span.first_day, span.last_day + 1):
                assert by_day[day].stay_day == day - span.first_day + 1
                assert by_day[day].stay_days == span.days


def test_hampi_multiday_stay_respects_min_nights() -> None:
    """Hampi (min_nights=2) is never split into a single-night stop."""
    hampi = require_destination("hampi")
    plan = make_plan(start_city="hampi", days=5)
    hampi_span = next(s for s in plan.stays if s.destination_id == "hampi")
    assert hampi_span.days >= hampi.min_nights


def test_assign_nights_and_stays_agree_for_many_shapes() -> None:
    start = require_destination("bengaluru")
    others = [
        require_destination("mysuru"),
        require_destination("hampi"),
        require_destination("badami"),
        require_destination("srirangapatna"),
    ]
    order = nearest_neighbor_order([start, *others], start)
    for days in (3, 5, 7, 9):
        for pace in (Pace.relaxed, Pace.balanced, Pace.packed):
            schedule = assign_nights(order, days, pace)
            spans = build_stay_spans(schedule)
            covered = [
                day for span in spans for day in range(span.first_day, span.last_day + 1)
            ]
            assert covered == list(range(1, days + 1)), (days, pace)
            legs = build_legs(schedule)
            day_ids = [d.id for _, d in schedule]
            change_days = {
                i + 1 for i in range(1, len(day_ids)) if day_ids[i] != day_ids[i - 1]
            }
            assert {leg.day for leg in legs} == change_days


# ---------------------------------------------------------------------------
# 3. Budget transparency
# ---------------------------------------------------------------------------


def test_budget_total_matches_components_in_browser_scenario() -> None:
    budget = make_plan().budget
    assert budget.total_inr == (
        budget.stay_food_inr + budget.transport_inr + budget.activities_inr
    )


def test_unknown_fees_are_not_presented_as_zero() -> None:
    budget = make_plan().budget
    # Bengaluru/Srirangapatna/Badami have entry_fees_inr = null in the dataset.
    assert set(budget.unknown_entry_fees) == {
        "Bengaluru",
        "Srirangapatna",
        "Badami",
    }
    assert budget.estimate_complete is False
    note = budget.excluded_costs_note
    assert note is not None
    assert "EXCLUDED" in note and "not zero" in note
    for name in budget.unknown_entry_fees:
        assert name in note
    # Activities only contains Hampi's verified fee x travellers.
    hampi = require_destination("hampi")
    assert budget.activities_inr == hampi.entry_fees_inr * budget.travellers


def test_confirmed_zero_fees_are_distinct_from_unknown() -> None:
    """Gokarna/Karkala have a verified 'free entry' (0) — must not be 'unknown'."""
    plan = make_plan(
        interests=["beach"],
        days=6,
        start_city="gokarna",
    )
    budget = plan.budget
    selected_names = {d.name for d in plan.selected_destinations}
    if "Gokarna" in selected_names:
        assert "Gokarna" in budget.zero_entry_fees
        assert "Gokarna" not in budget.unknown_entry_fees
    # Unknown classification never overlaps zero classification.
    assert set(budget.unknown_entry_fees).isdisjoint(budget.zero_entry_fees)


def test_budget_is_deterministic_with_transparency_fields() -> None:
    first = make_plan().budget
    second = make_plan().budget
    assert first.model_dump() == second.model_dump()


def test_api_response_carries_budget_transparency(client: TestClient) -> None:
    response = client.post("/api/itineraries/generate", json={
        "start_city": "bengaluru",
        "days": 5,
        "interests": ["heritage", "nature"],
        "planner": "fallback",
    })
    assert response.status_code == 200, response.text
    budget = response.json()["budget"]
    assert budget["estimate_complete"] is False
    assert budget["unknown_entry_fees"]
    assert budget["excluded_costs_note"]
    assert budget["total_inr"] == (
        budget["stay_food_inr"] + budget["transport_inr"] + budget["activities_inr"]
    )
    # The plan-level warning matches the budget label.
    warnings = response.json()["warnings"]
    assert any("not verified; excluded from the budget" in w for w in warnings)


# ---------------------------------------------------------------------------
# 4. AI provider failures (mocked — no network, no real credentials)
# ---------------------------------------------------------------------------


@pytest.fixture()
def llm_configured(monkeypatch) -> None:
    from app.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(type(settings), "llm_configured", property(lambda self: True))
    monkeypatch.setattr(settings, "llm_api_key", "test-key-not-real")


def _ai_request(days: int = 3) -> PlanRequest:
    return PlanRequest.model_validate(
        {**BROWSER_TRIP, "days": days, "planner": "ai"}
    )


def _allocation(request: PlanRequest):
    from app.services.recommendation import default_start_month, select_destinations
    from app.data.loader import get_destination

    start = get_destination(request.start_city)
    selected = [i.destination for i in select_destinations(request, default_start_month())]
    if start.id not in {d.id for d in selected}:
        selected.insert(0, start)
    order = nearest_neighbor_order(selected, start)
    return order, assign_nights(order, request.days, request.pace)


def _client_returning(content: str, status_code: int = 200) -> httpx.Client:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            status_code,
            json={"choices": [{"message": {"content": content}}]},
        )

    return httpx.Client(transport=httpx.MockTransport(handler))


def _valid_llm_payload(order, nightly) -> str:
    import json

    days = [
        {
            "day": day,
            "destination_id": dest.id,
            "activities": [
                {"time": "09:00", "title": f"See {dest.name}", "description": "x",
                 "kind": "sightseeing"}
            ],
        }
        for day, dest in nightly
    ]
    return json.dumps({"summary": "A lovely trip", "days": days})


def test_ai_success_is_mapped_to_our_allocation(llm_configured) -> None:
    request = _ai_request()
    order, nightly = _allocation(request)
    client = _client_returning(_valid_llm_payload(order, nightly))
    summary, plans = generate_ai_plan(request, order, nightly, client=client)
    assert summary == "A lovely trip"
    assert [p.day for p in plans] == list(range(1, request.days + 1))


def test_ai_unknown_destination_id_is_rejected(llm_configured) -> None:
    import json

    request = _ai_request()
    order, nightly = _allocation(request)
    payload = {
        "summary": "x",
        "days": [
            {"day": d, "destination_id": "atlantis",
             "activities": [{"time": "09:00", "title": "t", "description": "d",
                             "kind": "sightseeing"}]}
            for d, _ in nightly
        ],
    }
    client = _client_returning(json.dumps(payload))
    with pytest.raises(AIGenerationError, match="unknown destination"):
        generate_ai_plan(request, order, nightly, client=client)


def test_ai_timeout_is_wrapped_as_generation_error(llm_configured) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectTimeout("provider timed out", request=request)

    request = _ai_request()
    order, nightly = _allocation(request)
    client = httpx.Client(transport=httpx.MockTransport(handler))
    with pytest.raises(AIGenerationError, match="LLM request failed"):
        generate_ai_plan(request, order, nightly, client=client)


def test_ai_http_error_is_wrapped(llm_configured) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, json={"error": "boom"})

    request = _ai_request()
    order, nightly = _allocation(request)
    client = httpx.Client(transport=httpx.MockTransport(handler))
    with pytest.raises(AIGenerationError, match="LLM request failed"):
        generate_ai_plan(request, order, nightly, client=client)


def test_ai_invalid_json_is_rejected(llm_configured) -> None:
    request = _ai_request()
    order, nightly = _allocation(request)
    client = _client_returning("Sorry, I cannot help with that.")
    with pytest.raises(AIGenerationError, match="did not contain JSON"):
        generate_ai_plan(request, order, nightly, client=client)


def test_ai_wrong_day_count_is_rejected(llm_configured) -> None:
    import json

    request = _ai_request()
    order, nightly = _allocation(request)
    payload = {"summary": "x", "days": []}
    client = _client_returning(json.dumps(payload))
    with pytest.raises(AIGenerationError, match="number of days"):
        generate_ai_plan(request, order, nightly, client=client)


def test_ai_non_numeric_day_is_rejected(llm_configured) -> None:
    import json

    request = _ai_request()
    order, nightly = _allocation(request)
    payload = {
        "summary": "x",
        "days": [
            {"day": "not-a-number", "destination_id": dest.id,
             "activities": [{"time": "09:00", "title": "t", "description": "d",
                             "kind": "sightseeing"}]}
            for _, dest in nightly
        ],
    }
    client = _client_returning(json.dumps(payload))
    with pytest.raises(AIGenerationError, match="non-numeric day"):
        generate_ai_plan(request, order, nightly, client=client)


def test_ai_duplicate_day_numbers_are_rejected(llm_configured) -> None:
    import json

    request = _ai_request()
    order, nightly = _allocation(request)
    first_dest = nightly[0][1]
    payload = {
        "summary": "x",
        "days": [
            {"day": 1, "destination_id": first_dest.id,
             "activities": [{"time": "09:00", "title": "t", "description": "d",
                             "kind": "sightseeing"}]}
            for _ in range(request.days)
        ],
    }
    client = _client_returning(json.dumps(payload))
    with pytest.raises(AIGenerationError, match="duplicate day"):
        generate_ai_plan(request, order, nightly, client=client)


def test_ai_missing_credentials_raises_clear_error(monkeypatch) -> None:
    from app.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(type(settings), "llm_configured", property(lambda self: False))
    request = _ai_request()
    order, nightly = _allocation(request)
    with pytest.raises(AIGenerationError, match="not configured"):
        generate_ai_plan(request, order, nightly)


def test_forced_ai_without_key_is_503_not_fake_success(
    client: TestClient, monkeypatch
) -> None:
    from app.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(type(settings), "llm_configured", property(lambda self: False))
    response = client.post(
        "/api/itineraries/generate", json={**BROWSER_TRIP, "planner": "ai"}
    )
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "service_unavailable"
