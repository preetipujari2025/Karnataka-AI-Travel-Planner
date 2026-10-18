"""Deterministic fallback planner.

Produces a complete itinerary without any LLM call so the product always
works in demos, tests and when the AI provider is down.
"""

from __future__ import annotations

from typing import Callable

from app.schemas import (
    ActivityKind,
    DayActivity,
    DayPlan,
    DestinationRecord,
    DietaryPreference,
    PlanRequest,
    RouteLeg,
)
from app.services.routing import (
    assign_nights,
    build_legs,
    build_stay_spans,
    nearest_neighbor_order,
)
from app.data.loader import require_destination
from app.services.recommendation import select_destinations

# Picks the next unused highlight for a destination (per-stop cursor).
HighlightPicker = Callable[[DestinationRecord], str]


def plan_fallback(request: PlanRequest) -> tuple[str, list[DayPlan], list[RouteLeg]]:
    """Convenience wrapper: select stops, route them and build the itinerary.

    Fully deterministic for a given request.
    """
    start = require_destination(request.start_city)

    selected = [item.destination for item in select_destinations(request)]
    if start.id not in {d.id for d in selected}:
        selected.insert(0, start)

    order = nearest_neighbor_order(selected, start)
    nightly_plan = assign_nights(order, request.days, request.pace)
    legs = build_legs(nightly_plan)
    summary, itinerary = build_fallback_itinerary(request, nightly_plan, legs, order)
    return summary, itinerary, legs


def build_fallback_itinerary(
    request: PlanRequest,
    nightly_plan: list[tuple[int, DestinationRecord]],
    legs: list[RouteLeg],
    order: list[DestinationRecord],
) -> tuple[str, list[DayPlan]]:
    """Turn a day allocation into narrative day plans (no I/O, fully deterministic)."""
    legs_by_day = {leg.day: leg for leg in legs}

    # Contiguous stays, so a multi-day stop knows its position in the stay.
    stays = build_stay_spans(nightly_plan)
    stay_by_day: dict[int, StaySpan] = {
        day: span for span in stays for day in range(span.first_day, span.last_day + 1)
    }

    # Each destination gets its own highlight cursor so two days at the same
    # stop never repeat the same sightseeing highlight.
    highlight_offsets: dict[str, int] = {}

    def next_highlight(destination: DestinationRecord) -> str:
        highlights = destination.highlights or [destination.name]
        offset = highlight_offsets.get(destination.id, 0)
        highlight_offsets[destination.id] = offset + 1
        return highlights[offset % len(highlights)]

    itinerary: list[DayPlan] = []

    for day, destination in nightly_plan:
        span = stay_by_day[day]
        stay_day = day - span.first_day + 1
        leg = legs_by_day.get(day)
        if leg is not None:
            activities = _travel_day_activities(
                day, destination, leg, is_first=day == 1, pick=next_highlight
            )
        elif day == 1:
            activities = _arrival_day_activities(day, destination, pick=next_highlight)
        elif day == request.days:
            activities = _departure_day_activities(day, destination, pick=next_highlight)
        else:
            activities = _regular_day_activities(day, destination, pick=next_highlight)
        itinerary.append(
            DayPlan(
                day=day,
                place=_place(destination),
                stay_day=stay_day,
                stay_days=span.days,
                day_title=f"Day {day}: {destination.name} Exploration",
                narrative=f"Experience the primary sights and local character of {destination.name}.",
                activities=activities,
                travel_tips=[f"Check opening hours and dress code for attractions in {destination.name}."],
            )
        )

    route_text = " -> ".join(d.name for d in order)

    # Reflect the traveller's dietary preference in food activities (honest copy,
    # not a fabricated menu).
    dietary_note = _DIETARY_NOTES.get(request.dietary_preference, "")
    if dietary_note:
        for day in itinerary:
            for activity in day.activities:
                if activity.kind is ActivityKind.food:
                    activity.description = activity.description + dietary_note

    summary = (
        f"{request.days}-day Karnataka trip ({request.pace.value} pace) covering "
        f"{len(order)} stops: {route_text}. Interests: "
        f"{', '.join(i.value for i in request.interests)}; budget tier: {request.budget_tier.value}."
    )
    return summary, itinerary


_DIETARY_NOTES: dict[DietaryPreference, str] = {
    DietaryPreference.no_preference: "",
    DietaryPreference.vegetarian: " Vegetarian options prioritised.",
    DietaryPreference.vegan: " Vegan options prioritised.",
    DietaryPreference.jain: " Jain (no onion/garlic) options prioritised.",
    DietaryPreference.non_vegetarian: " Local non-vegetarian specialities included.",
}


def _place(destination: DestinationRecord):
    from app.schemas import Place

    return Place(
        destination_id=destination.id,
        name=destination.name,
        lat=destination.lat,
        lng=destination.lng,
        region=destination.region,
    )


def _arrival_day_activities(
    day: int, destination: DestinationRecord, *, pick: HighlightPicker
) -> list[DayActivity]:
    highlight = pick(destination)
    return [
        DayActivity(
            time="10:00",
            title=f"Arrive in {destination.name}",
            description=f"Settle in and get oriented in {destination.name} ({destination.region}).",
            destination_id=destination.id,
            kind=ActivityKind.arrival,
        ),
        DayActivity(
            time="15:00",
            title=highlight,
            description=f"Afternoon visit: {highlight}.",
            destination_id=destination.id,
            kind=ActivityKind.sightseeing,
        ),
        DayActivity(
            time="19:30",
            title="Local dinner",
            description=f"Try the regional specialities of {destination.name}.",
            destination_id=destination.id,
            kind=ActivityKind.food,
        ),
    ]


def _travel_day_activities(
    day: int,
    destination: DestinationRecord,
    leg: RouteLeg,
    is_first: bool,
    *,
    pick: HighlightPicker,
) -> list[DayActivity]:
    first_look = pick(destination)
    evening = pick(destination)
    activities = [
        DayActivity(
            time="08:00",
            title=f"Travel to {destination.name}",
            description=(
                f"Road transfer from {leg.origin.name} to {destination.name}: "
                f"{leg.distance_km} km, approx {leg.duration_hours} h."
            ),
            destination_id=destination.id,
            kind=ActivityKind.travel,
        ),
        DayActivity(
            time="14:00",
            title=first_look,
            description=f"First look at {first_look} in {destination.name}.",
            destination_id=destination.id,
            kind=ActivityKind.sightseeing,
        ),
        DayActivity(
            time="17:00",
            title=evening,
            description=f"Evening at {evening}.",
            destination_id=destination.id,
            kind=ActivityKind.sightseeing,
        ),
        DayActivity(
            time="20:00",
            title="Dinner",
            description=f"Local food in {destination.name}.",
            destination_id=destination.id,
            kind=ActivityKind.food,
        ),
    ]
    if is_first:
        activities.insert(
            0,
            DayActivity(
                time="06:00",
                title="Start trip",
                description="Departure day — head out for the first leg of the Karnataka circuit.",
                destination_id=destination.id,
                kind=ActivityKind.arrival,
            ),
        )
    return activities


def _regular_day_activities(
    day: int, destination: DestinationRecord, *, pick: HighlightPicker
) -> list[DayActivity]:
    morning = pick(destination)
    afternoon = pick(destination)
    if "nature" in destination.categories or "hills" in destination.categories:
        morning_kind = ActivityKind.leisure
        morning_title = f"Morning walk around {morning}"
        morning_desc = "Easy morning outdoors before the day heats up."
    else:
        morning_kind = ActivityKind.sightseeing
        morning_title = morning
        morning_desc = f"Sightseeing: {morning}."
    return [
        DayActivity(
            time="09:00",
            title=morning_title,
            description=morning_desc,
            destination_id=destination.id,
            kind=morning_kind,
        ),
        DayActivity(
            time="13:00",
            title="Lunch break",
            description=f"Regional lunch in {destination.name}.",
            destination_id=destination.id,
            kind=ActivityKind.food,
        ),
        DayActivity(
            time="15:30",
            title=afternoon,
            description=f"Afternoon: {afternoon}.",
            destination_id=destination.id,
            kind=ActivityKind.sightseeing,
        ),
        DayActivity(
            time="19:30",
            title="Evening at leisure",
            description=f"Free evening in {destination.name}.",
            destination_id=destination.id,
            kind=ActivityKind.leisure,
        ),
    ]


def _departure_day_activities(
    day: int, destination: DestinationRecord, *, pick: HighlightPicker
) -> list[DayActivity]:
    final_morning = pick(destination)
    return [
        DayActivity(
            time="09:00",
            title=final_morning,
            description=f"Final morning at {final_morning}.",
            destination_id=destination.id,
            kind=ActivityKind.sightseeing,
        ),
        DayActivity(
            time="12:00",
            title="Check-out and souvenirs",
            description=f"Pick up local produce or crafts from {destination.name}.",
            destination_id=destination.id,
            kind=ActivityKind.leisure,
        ),
        DayActivity(
            time="16:00",
            title="Departure",
            description=f"Leave from {destination.name} with your Karnataka itinerary complete.",
            destination_id=destination.id,
            kind=ActivityKind.departure,
        ),
    ]
