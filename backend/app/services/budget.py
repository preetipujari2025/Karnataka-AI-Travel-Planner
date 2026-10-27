"""Budget calculation: converts a destination sequence into rupee totals.

Only this module decides money figures; the AI planner never supplies costs.
"""

from __future__ import annotations

import math
from typing import Optional

from app.schemas import (
    BudgetBreakdown,
    BudgetTier,
    DestinationRecord,
    DiscoveredStop,
    RouteLeg,
    TransportPreference,
)
from app.services.recommendation import tier_daily_cost

# Per-person intercity road transport cost, INR per km, by transport preference
# (shared cab / bus mix by default).
TRANSPORT_INR_PER_KM = 6.0
TRANSPORT_INR_PER_KM_BY_MODE: dict[TransportPreference, float] = {
    TransportPreference.any: 6.0,
    TransportPreference.public_transport: 2.0,
    TransportPreference.private_cab: 10.0,
    TransportPreference.self_drive: 7.0,
    TransportPreference.private_car: 8.0,
}


def day_cost_per_person(destination: DestinationRecord, tier: BudgetTier) -> int:
    """Stay + food + local transport for one person for one day at a destination."""
    return tier_daily_cost(destination, tier)


def leg_transport_per_person(
    distance_km: float, mode: TransportPreference = TransportPreference.any
) -> int:
    """Cost of one intercity leg per person, with a minimum (short hops still cost)."""
    rate = TRANSPORT_INR_PER_KM_BY_MODE[mode]
    return max(50, int(math.ceil(distance_km * rate)))


def compute_budget(
    *,
    nightly_plan: list[tuple[int, DestinationRecord]],
    legs: list[RouteLeg],
    tier: BudgetTier,
    travellers: int,
    entry_fee_destinations: list[DestinationRecord],
    transport: TransportPreference = TransportPreference.any,
    total_budget_inr: Optional[int] = None,
) -> BudgetBreakdown:
    """Build a full breakdown with transparent 5-way cost split.

    nightly_plan: one entry per trip day -> (day number, destination for that day).
    legs: intercity legs computed by the routing module.
    entry_fee_destinations: destinations where entry fees/activities are charged once;
        each is classified as known (summed) or unknown (excluded + reported).
    transport: how the traveller covers intercity legs (drives per-km cost).
    total_budget_inr: optional user-specified rupee budget to stay within.
    """
    travellers = max(1, travellers)
    num_days = len(nightly_plan)

    transport_cost = (
        sum(leg_transport_per_person(leg.distance_km, transport) for leg in legs) * travellers
    )

    unknown_fee_names = [d.name for d in entry_fee_destinations if d.entry_fees_inr is None]
    zero_fee_names = [
        d.name for d in entry_fee_destinations if d.entry_fees_inr is not None and d.entry_fees_inr == 0
    ]
    activities = (
        sum(
            d.entry_fees_inr
            for d in entry_fee_destinations
            if d.entry_fees_inr is not None
        )
        * travellers
    )
    entry_fees_inr = activities

    # Raw daily stay and food per destination
    raw_stay_food_total = sum(day_cost_per_person(dest, tier) for _, dest in nightly_plan) * travellers

    # Honest 5-way split: stay, food, transport, entry fees, extra.
    # The total is ALWAYS the genuine sum of stay + food + transport + entry fees + extra,
    # and is NEVER artificially padded or forced to match the traveller's stated budget.
    if num_days == 1:
        stay_inr = 0
        food_inr = int(raw_stay_food_total * 0.70)
        extra_inr = raw_stay_food_total - food_inr
    else:
        stay_inr = int(raw_stay_food_total * 0.52)
        food_inr = int(raw_stay_food_total * 0.32)
        extra_inr = raw_stay_food_total - stay_inr - food_inr

    total = stay_inr + food_inr + transport_cost + entry_fees_inr + extra_inr
    stay_food_inr = stay_inr + food_inr + extra_inr

    if unknown_fee_names:
        excluded = (
            f"Incomplete estimate: entry fees for {', '.join(unknown_fee_names)} "
            "are not verified and are EXCLUDED from this total (they are not "
            "zero). Actual cost may be higher; local activity costs are also "
            "excluded."
        )
    else:
        excluded = None

    return BudgetBreakdown(
        tier=tier,
        days=num_days,
        travellers=travellers,
        stay_food_inr=stay_food_inr,
        stay_inr=stay_inr,
        food_inr=food_inr,
        transport_inr=transport_cost,
        activities_inr=activities,
        entry_fees_inr=entry_fees_inr,
        extra_inr=extra_inr,
        total_inr=total,
        per_person_total_inr=math.ceil(total / travellers) if travellers else total,
        unknown_entry_fees=unknown_fee_names,
        zero_entry_fees=zero_fee_names,
        estimate_complete=not unknown_fee_names,
        excluded_costs_note=excluded,
    )


# ---------------------------------------------------------------------------
# Road-trip budget: main route + detours + meals, same honesty rules
# ---------------------------------------------------------------------------

# Per-person daily food estimate when the traveller gives no meal budget.
MEAL_ESTIMATE_PER_PERSON_BY_TIER: dict[BudgetTier, int] = {
    BudgetTier.budget: 300,
    BudgetTier.mid: 600,
    BudgetTier.luxury: 1500,
}

_PRIVATE_MODES = {TransportPreference.self_drive, TransportPreference.private_car, TransportPreference.private_cab}


def compute_roadtrip_budget(
    *,
    route_distance_km: float,
    days: int,
    travellers: int,
    tier: BudgetTier,
    transport: TransportPreference,
    overnight_places: list[tuple[int, Optional[DestinationRecord]]],
    selected_stops: list[DiscoveredStop],
    meal_budget_per_day_inr: Optional[int] = None,
) -> BudgetBreakdown:
    """Deterministic road-trip breakdown. AI never touches these figures.

    Honesty rules carried over from `compute_budget`: unknown entry fees and
    unknown daily costs are EXCLUDED and named, never counted as zero. Meal
    costs are an assumption-backed estimate (sources carry no prices) and are
    reported in `assumptions`. `total_inr` always equals the component sum.
    """
    rate = TRANSPORT_INR_PER_KM_BY_MODE[transport]
    per_vehicle = transport in _PRIVATE_MODES

    # Accommodation + local costs from overnight places (verified values only).
    unknown_daily: list[str] = []
    stay_food_per_day = 0
    for _day, place in overnight_places:
        if place is None or place.daily_cost_inr is None:
            unknown_daily.append(place.name if place else f"overnight day {_day}")
            continue
        stay_food_per_day += tier_daily_cost(place, tier)
    stay_food_total = stay_food_per_day * travellers

    # Transport: private modes drive the car once, shared modes per traveller.
    traveller_multiplier = 1 if per_vehicle else travellers
    main_transport = max(50, int(math.ceil(route_distance_km * rate))) * traveller_multiplier
    detour_km_total = sum(max(0.0, stop.detour_km) for stop in selected_stops)
    detour_transport = int(math.ceil(detour_km_total * rate)) * traveller_multiplier

    # Entry fees: never-verified/unknown fees excluded and named, not zeroed.
    unknown_fee_names = [
        s.name for s in selected_stops
        if s.entry_fee_inr is None and s.source_kind != "openstreetmap"
    ]
    known_fee_stops = [s for s in selected_stops if s.entry_fee_inr is not None]
    zero_fee_names = [s.name for s in known_fee_stops if s.entry_fee_inr == 0]
    activities = sum(s.entry_fee_inr or 0 for s in known_fee_stops) * travellers

    # Meals: explicit budget wins; otherwise a labelled tier estimate.
    meal_per_person = meal_budget_per_day_inr or MEAL_ESTIMATE_PER_PERSON_BY_TIER[tier]
    meals = meal_per_person * days * travellers

    total = stay_food_total + main_transport + detour_transport + activities + meals

    assumptions = [
        f"Main route transport: {route_distance_km:.0f} km at \u20b9{rate:g}/km "
        + ("per vehicle (private drive)" if per_vehicle else f"per person \u00d7 {travellers}"),
        f"Detour transport: {detour_km_total:.0f} extra km across {len(selected_stops)} selected stops.",
        f"Meals: \u20b9{meal_per_person}/person/day "
        + ("(your stated meal budget)" if meal_budget_per_day_inr else "(tier estimate \u2014 no sourced prices exist)")
        + f" \u00d7 {days} days \u00d7 {travellers} traveller(s).",
        "Entry fees counted only where a sourced figure exists; unknowns are excluded, not zeroed.",
    ]

    # Minimum practical budget: same journey, optional detours dropped,
    # budget-tier stay rates, no frills on meals.
    min_stay = sum(
        tier_daily_cost(place, BudgetTier.budget)
        for _d, place in overnight_places
        if place is not None and place.daily_cost_inr is not None
    ) * travellers
    min_transport = max(50, int(math.ceil(route_distance_km * rate))) * traveller_multiplier
    min_meals = (meal_budget_per_day_inr or MEAL_ESTIMATE_PER_PERSON_BY_TIER[BudgetTier.budget]) * days * travellers
    minimum_total = min_stay + min_transport + activities + min_meals

    excluded_note = None
    if unknown_fee_names or unknown_daily:
        bits = []
        if unknown_fee_names:
            bits.append("entry fees for " + ", ".join(unknown_fee_names))
        if unknown_daily:
            bits.append("accommodation costs for " + ", ".join(unknown_daily))
        excluded_note = (
            "Incomplete estimate: " + " and ".join(bits)
            + " are unverified and EXCLUDED from this total (treated as unknown, not zero)."
        )

    stay_inr = int(stay_food_total * 0.6)
    food_inr = meals if meals else int(stay_food_total * 0.3)
    extra_inr = max(0, stay_food_total - stay_inr - (0 if meals else food_inr))

    return BudgetBreakdown(
        tier=tier,
        days=days,
        travellers=travellers,
        stay_food_inr=stay_food_total,
        stay_inr=stay_inr,
        food_inr=food_inr,
        transport_inr=main_transport,
        activities_inr=activities,
        entry_fees_inr=activities,
        extra_inr=extra_inr,
        detour_transport_inr=detour_transport,
        meals_inr=meals,
        total_inr=total,
        per_person_total_inr=math.ceil(total / travellers) if travellers else total,
        minimum_total_inr=minimum_total,
        unknown_entry_fees=unknown_fee_names,
        unknown_daily_costs=unknown_daily,
        zero_entry_fees=zero_fee_names,
        estimate_complete=not (unknown_fee_names or unknown_daily),
        excluded_costs_note=excluded_note,
        assumptions=assumptions,
    )
