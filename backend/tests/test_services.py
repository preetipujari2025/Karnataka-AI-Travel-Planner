"""Unit tests for the pure service modules."""

from __future__ import annotations

from app.data.loader import require_destination
from app.schemas import BudgetTier, Pace, PlanRequest
from app.services.budget import compute_budget, leg_transport_per_person
from app.services.recommendation import rank_destinations, select_destinations, stay_nights
from app.services.routing import (
    assign_nights,
    build_legs,
    nearest_neighbor_order,
    road_distance_km,
    travel_hours,
)


def make_request(**overrides) -> PlanRequest:
    payload = {
        "interests": ["heritage", "nature"],
        "days": 6,
        "budget_tier": "mid",
        "pace": "balanced",
        "start_city": "bengaluru",
        "start_month": 12,
        "planner": "fallback",
    }
    payload.update(overrides)
    return PlanRequest.model_validate(payload)


def test_haversine_bengaluru_mysuru_is_plausible() -> None:
    a = require_destination("bengaluru")
    b = require_destination("mysuru")
    distance = road_distance_km(a, b)
    # real road distance is roughly 145-150 km
    assert 130 <= distance <= 180
    assert 0 < travel_hours(distance) < 6


def test_transport_cost_has_floor() -> None:
    assert leg_transport_per_person(1.0) == 50
    assert leg_transport_per_person(100) == 600


def test_rank_destinations_prefers_matching_interests() -> None:
    ranked = rank_destinations(make_request(interests=["beach"]), month=12)
    top_ids = [item.destination.id for item in ranked[:3]]
    beach_ids = {"gokarna", "karwar", "udupi", "mangaluru", "murudeshwar"}
    assert set(top_ids) <= beach_ids


def test_select_destinations_fills_requested_days() -> None:
    request = make_request(days=6)
    selected = select_destinations(request, month=12)
    assert selected, "must select at least one destination"
    total = sum(stay_nights(item.destination, request.pace) for item in selected)
    # selection may slightly under/over-shoot; routing's assign_nights normalises it
    assert 1 <= total <= request.days + 2


def test_pace_changes_stay_length() -> None:
    hampi = require_destination("hampi")
    relaxed = stay_nights(hampi, Pace.relaxed)
    packed = stay_nights(hampi, Pace.packed)
    assert relaxed >= hampi.min_nights
    assert packed >= hampi.min_nights
    assert relaxed >= packed


def test_nearest_neighbor_starts_at_hub() -> None:
    start = require_destination("bengaluru")
    others = [require_destination("mysuru"), require_destination("hampi")]
    order = nearest_neighbor_order([start, *others], start)
    assert order[0].id == "bengaluru"
    assert {d.id for d in order} == {"bengaluru", "mysuru", "hampi"}


def test_assign_nights_covers_all_days() -> None:
    start = require_destination("bengaluru")
    others = [require_destination("mysuru"), require_destination("hampi")]
    order = nearest_neighbor_order([start, *others], start)
    schedule = assign_nights(order, days=5, pace=Pace.balanced)
    assert len(schedule) == 5
    assert [day for day, _ in schedule] == [1, 2, 3, 4, 5]
    # schedule is contiguous: a destination appears in consecutive days only
    seen = [d.id for _, d in schedule]
    # no instant jumping back after leaving (A B A pattern is invalid for a road trip)
    for i in range(1, len(seen)):
        if seen[i] != seen[i - 1] and seen[i] in seen[: i - 1]:
            raise AssertionError(f"non-contiguous stay detected: {seen}")


def test_build_legs_only_on_destination_change() -> None:
    start = require_destination("bengaluru")
    mysuru = require_destination("mysuru")
    schedule = [(1, start), (2, start), (3, mysuru), (4, mysuru)]
    legs = build_legs(schedule)
    assert len(legs) == 1
    assert legs[0].day == 3
    assert legs[0].origin.destination_id == "bengaluru"
    assert legs[0].destination.destination_id == "mysuru"
    assert legs[0].distance_km > 0


def test_budget_adds_up() -> None:
    start = require_destination("bengaluru")
    mysuru = require_destination("mysuru")
    schedule = [(1, start), (2, start), (3, mysuru), (4, mysuru)]
    legs = build_legs(schedule)
    breakdown = compute_budget(
        nightly_plan=schedule,
        legs=legs,
        tier=BudgetTier.mid,
        travellers=2,
        entry_fee_destinations=[start, mysuru],
    )
    assert breakdown.total_inr == (
        breakdown.stay_food_inr + breakdown.transport_inr + breakdown.activities_inr
    )
    assert breakdown.transport_inr > 0
    assert breakdown.per_person_total_inr == breakdown.total_inr // 2
    # mid tier: bengaluru 4000/day, mysuru 3200/day per person
    assert breakdown.stay_food_inr == (4000 + 4000 + 3200 + 3200) * 2
