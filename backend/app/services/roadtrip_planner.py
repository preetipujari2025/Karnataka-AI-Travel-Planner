"""Constraint-aware multi-day road-trip scheduling.

Turns a discovery result + the traveller's selected stops into a feasible
day-by-day schedule. Feasibility is honest arithmetic, not optimism:

  * waking window 07:00-22:00, departure honoured, per-day driving cap by pace,
  * stops are placed on the day whose route-progress window contains them,
  * a stop that cannot fit is REJECTED with a reason and concrete options —
    never scheduled at an impossible time,
  * progress along the route only ever moves forward (no circular legs),
  * every day ends at a real overnight place from the curated catalog.

The AI layer is not involved: scheduling and budgeting stay deterministic.
"""

from __future__ import annotations

import logging
import math
import uuid
from datetime import timedelta

from app.data.loader import get_destination
from app.schemas import (
    BudgetFit,
    DiscoveredStop,
    ExcludedStop,
    MealStop,
    Pace,
    Place,
    RoadTripDay,
    RoadTripPlanRequest,
    RoadTripPlanResponse,
    ScheduledItem,
)
from app.services import route_discovery
from app.services.budget import compute_roadtrip_budget
from app.services.destination_service import catalog_destinations
from app.services.geo import point_at_progress
from app.services.routing import haversine_coords

logger = logging.getLogger("karnataka.roadtrip")

DAY_START_MIN = 7 * 60      # 07:00 waking window
DAY_END_MIN = 22 * 60       # 22:00 hard stop
MEAL_DURATION_MIN = 45
MAX_VISIT_MIN = 600

PACE_MAX_DRIVING_MIN = {Pace.relaxed: 240, Pace.balanced: 360, Pace.packed: 480}


class PlanError(ValueError):
    """Raised when the request cannot be grounded in a real discovery result."""


def _hhmm(minutes: int) -> str:
    minutes = max(0, min(minutes, 24 * 60 - 1))
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def _parse_clock(value: str) -> int:
    hours, mins = value.split(":")
    return int(hours) * 60 + int(mins)


def _place_of_stop(stop: DiscoveredStop) -> Place:
    return Place(
        destination_id=stop.ref_id,
        name=stop.name,
        lat=stop.lat,
        lng=stop.lng,
        region="route corridor",
    )


def _overnight_record(lat: float, lng: float):
    """Nearest curated destination (with cost data preferred) to a day-end point."""
    records = [d for d in catalog_destinations() if d.has_usable_coords]
    if not records:
        return None
    with_cost = [d for d in records if d.daily_cost_inr is not None]
    pool = with_cost or records
    return min(
        pool,
        key=lambda d: (haversine_coords(lat, lng, float(d.lat), float(d.lng)), d.id),
    )


def _to_place(record) -> Place:
    return Place(
        destination_id=record.id,
        name=record.name,
        lat=float(record.lat),
        lng=float(record.lng),
        region=record.region,
    )


def plan_road_trip(request: RoadTripPlanRequest) -> RoadTripPlanResponse:
    discovery = route_discovery.get_or_discover(request.discovery)
    route = discovery.route
    geometry = route.geometry
    days = request.discovery.days
    req = request.discovery

    warnings: list[str] = []
    candidates_by_id = {s.candidate_id: s for s in discovery.candidates}
    meals_by_id = {m.meal_id: m for m in discovery.meal_stops}

    selected: list[DiscoveredStop] = []
    for stop_id in request.selected_stop_ids:
        stop = candidates_by_id.get(stop_id)
        if stop is None:
            warnings.append(f"Selected stop '{stop_id}' is not part of the current discovery result and was ignored.")
            continue
        selected.append(stop)
    selected_meals: list[MealStop] = []
    for meal_id in request.selected_meal_ids:
        meal = meals_by_id.get(meal_id)
        if meal is None:
            warnings.append(f"Selected meal '{meal_id}' is not part of the current discovery result and was ignored.")
            continue
        selected_meals.append(meal)

    selected.sort(key=lambda s: (s.progress_fraction, s.candidate_id))

    route_km = max(route.distance_km, 0.001)
    minutes_per_km = route.duration_hours * 60.0 / route_km

    # Day window by route progress; stops land on the day containing them.
    by_day: dict[int, list[DiscoveredStop]] = {d: [] for d in range(1, days + 1)}
    for stop in selected:
        day = min(days, max(1, math.ceil(stop.progress_fraction * days - 1e-9)))
        by_day[day].append(stop)
    meals_by_day: dict[int, list[MealStop]] = {d: [] for d in range(1, days + 1)}
    for meal in selected_meals:
        meals_by_day.setdefault(meal.day, []).append(meal)

    itinerary: list[RoadTripDay] = []
    rejected: list[ExcludedStop] = []
    conflicts: list[str] = []
    assumptions: list[str] = [
        "Sightseeing detours add their listed detour time to that day's driving.",
        f"Waking window assumed {_hhmm(DAY_START_MIN)}-{_hhmm(DAY_END_MIN)}; departure at {req.departure_time}.",
    ]
    overnight_places: list[tuple[int, object]] = []
    cursor_progress = 0.0
    start_clock = max(_parse_clock(req.departure_time), DAY_START_MIN)
    trip_start = req.departure_date

    for day in range(1, days + 1):
        day_end_progress = day / days
        items: list[ScheduledItem] = []
        notes: list[str] = []
        driving = 0
        clock = start_clock if day == 1 else DAY_START_MIN
        day_max_driving = PACE_MAX_DRIVING_MIN[req.pace]

        if day == 1:
            items.append(ScheduledItem(
                item_type="departure", name=f"Depart {route.origin.name}",
                start_time=_hhmm(clock), end_time=_hhmm(clock), duration_minutes=0,
                verification_status="verified" if route.verified else "estimated",
            ))

        meals_today = sorted(meals_by_day.get(day, []), key=lambda m: _parse_clock(m.expected_arrival or "13:00"))
        meal_index = 0

        stops = by_day[day]
        for stop in stops:
            visit = stop.suggested_visit_minutes or 60
            visit = max(15, min(visit, MAX_VISIT_MIN))
            seg_km = max(0.0, (stop.progress_fraction - cursor_progress)) * route_km
            travel_min = int(math.ceil(seg_km * minutes_per_km + max(0.0, stop.detour_minutes)))
            needed = travel_min + visit
            if clock + needed > DAY_END_MIN or driving + travel_min > day_max_driving:
                rejected.append(_reject(stop, clock, travel_min, driving, day_max_driving, DAY_END_MIN))
                conflicts.append(_conflict_text(day, stop.name, needed, clock, driving, day_max_driving))
                continue

            # Insert any meal whose window has passed before we drive on.
            while meal_index < len(meals_today) and _parse_clock(meals_today[meal_index].expected_arrival or "13:00") <= clock + travel_min:
                meal = meals_today[meal_index]
                items.append(_meal_item(meal, clock))
                clock += MEAL_DURATION_MIN
                meal_index += 1

            items.append(ScheduledItem(
                item_type="travel",
                name=f"Drive to {stop.name} ({seg_km:.0f} km route + {stop.detour_km:.0f} km detour)",
                start_time=_hhmm(clock), end_time=_hhmm(clock + travel_min), duration_minutes=travel_min,
                detour_km=round(stop.detour_km, 1),
                verification_status="verified" if stop.detour_measured and route.verified else "estimated",
            ))
            clock += travel_min
            driving += travel_min
            items.append(ScheduledItem(
                item_type="sightseeing", name=stop.name, ref_id=stop.candidate_id,
                start_time=_hhmm(clock), end_time=_hhmm(clock + visit), duration_minutes=visit,
                verification_status=stop.verification_status,
            ))
            clock += visit
            cursor_progress = max(cursor_progress, stop.progress_fraction)
            if not stop.detour_measured:
                notes.append(f"Detour to {stop.name} is a corridor estimate, not provider-measured.")

        # Remaining drive for the day (to the day's progress window end).
        tail_km = max(0.0, (day_end_progress - cursor_progress)) * route_km
        tail_min = int(math.ceil(tail_km * minutes_per_km))
        if tail_min > 0:
            end_point = point_at_progress(geometry, day_end_progress) if len(geometry) >= 2 else (0.0, 0.0)
            items.append(ScheduledItem(
                item_type="travel",
                name=f"Continue towards {route.destination.name}" if day == days else f"Drive day {day} segment ({tail_km:.0f} km)",
                start_time=_hhmm(clock), end_time=_hhmm(clock + tail_min), duration_minutes=tail_min,
                verification_status="verified" if route.verified else "estimated",
            ))
            clock += tail_min
            driving += tail_min
            cursor_progress = max(cursor_progress, day_end_progress)

        # Late meals not yet inserted land at the day's end point.
        for meal in meals_today[meal_index:]:
            if clock + MEAL_DURATION_MIN <= DAY_END_MIN:
                items.append(_meal_item(meal, clock))
                clock += MEAL_DURATION_MIN

        if day == days:
            overnight_record = get_destination(route.destination.destination_id)
            overnight_place = route.destination
            items.append(ScheduledItem(
                item_type="arrival", name=f"Arrive at {route.destination.name}",
                start_time=_hhmm(min(clock, DAY_END_MIN)), end_time=_hhmm(min(clock, DAY_END_MIN)),
                duration_minutes=0, verification_status="verified" if route.verified else "estimated",
            ))
        else:
            end_lat, end_lng = (
                point_at_progress(geometry, day_end_progress) if len(geometry) >= 2
                else ((route.origin.lat + route.destination.lat) / 2,
                      (route.origin.lng + route.destination.lng) / 2)
            )
            overnight_record = _overnight_record(end_lat, end_lng)
            if overnight_record is None:
                overnight_record = get_destination(route.destination.destination_id)
                notes.append("No curated overnight place was found along the corridor; using the final destination as fallback.")
            elif overnight_record.daily_cost_inr is None:
                notes.append(f"Accommodation cost for {overnight_record.name} is unknown and excluded from the budget.")
            overnight_place = _to_place(overnight_record) if overnight_record is not None else route.destination
            if overnight_record is not None:
                items.append(ScheduledItem(
                    item_type="overnight", name=f"Overnight at {overnight_record.name}",
                    ref_id=overnight_record.id,
                    start_time=_hhmm(min(max(clock, 20 * 60), DAY_END_MIN)),
                    end_time=_hhmm(DAY_END_MIN), duration_minutes=0,
                    verification_status="verified",
                ))
        overnight_places.append((day, overnight_record))

        day_date = trip_start + timedelta(days=day - 1) if trip_start else None
        stop_names = ", ".join(s.name for s in stops if s.candidate_id not in {r.candidate_id for r in rejected})
        itinerary.append(RoadTripDay(
            day=day,
            date=day_date,
            title=f"Day {day}: {stop_names}" if stop_names else f"Day {day}: driving day",
            overnight_place=overnight_place,
            driving_minutes=min(max(0, driving), 24 * 60 - 1),
            schedule=items,
            notes=notes,
        ))

        if clock > DAY_END_MIN:
            notes.append("The day ran past the 22:00 waking window; consider dropping a stop.")
            warnings.append(f"Day {day} exceeded the waking window; remove optional stops to keep it realistic.")

    # Unscheduled selected stops that made it onto no day (shouldn't happen — belt & braces).
    scheduled_ids = {
        item.ref_id for day_items in (d.schedule for d in itinerary) for item in day_items
        if item.item_type == "sightseeing" and item.ref_id
    }
    for stop in selected:
        if stop.candidate_id not in scheduled_ids and stop.candidate_id not in {r.candidate_id for r in rejected}:
            rejected.append(_reject(stop, DAY_END_MIN, 0, PACE_MAX_DRIVING_MIN[req.pace], PACE_MAX_DRIVING_MIN[req.pace], DAY_END_MIN,
                                    reason_extra="no feasible day window remained"))
            conflicts.append(_conflict_text(req.days, stop.name, 0, DAY_END_MIN, 0, PACE_MAX_DRIVING_MIN[req.pace]))

    optional_left = [s for s in discovery.candidates if s.candidate_id not in {x.candidate_id for x in selected}]

    budget = compute_roadtrip_budget(
        route_distance_km=route.distance_km,
        days=days,
        travellers=req.travellers,
        tier=req.budget_tier,
        transport=req.transport_preference,
        overnight_places=overnight_places,
        selected_stops=[s for s in selected if s.candidate_id in scheduled_ids],
        meal_budget_per_day_inr=req.meal_budget_per_day_inr,
    )
    # Internal invariant: the total must equal the sum of its components.
    component_sum = (
        budget.stay_food_inr + budget.transport_inr + budget.detour_transport_inr
        + budget.activities_inr + budget.meals_inr
    )
    if component_sum != budget.total_inr:  # pragma: no cover - arithmetic guard
        logger.error("road-trip budget component mismatch: %s vs %s", component_sum, budget.total_inr)

    budget_fit: BudgetFit | None = None
    if request.total_budget_inr is not None:
        budget_fit = BudgetFit(
            total_budget_inr=request.total_budget_inr,
            estimated_total_inr=budget.total_inr,
            within_budget=request.total_budget_inr >= budget.total_inr,
            variance_inr=request.total_budget_inr - budget.total_inr,
        )
        if budget_fit.within_budget is False:
            warnings.append(
                f"Plan exceeds the stated budget by ₹{abs(budget_fit.variance_inr or 0):,}. "
                "Drop optional stops or choose the minimum (no-detour) plan."
            )

    if not route.verified:
        warnings.append("Route figures are a labelled estimate (road provider unavailable).")

    return RoadTripPlanResponse(
        plan_id=f"rt-{uuid.uuid4().hex[:12]}",
        route=route,
        days=days,
        itinerary=itinerary,
        selected_stops=[s for s in selected if s.candidate_id in scheduled_ids],
        optional_stops=optional_left,
        meal_stops=selected_meals,
        rejected_stops=rejected,
        budget=budget,
        conflicts=conflicts,
        warnings=warnings,
        assumptions=assumptions + budget.assumptions,
        providers=discovery.providers,
        budget_fit=budget_fit,
    )


def _meal_item(meal: MealStop, clock: int) -> ScheduledItem:
    return ScheduledItem(
        item_type="meal", name=f"{meal.meal.title()} at {meal.name}", ref_id=meal.meal_id,
        start_time=_hhmm(clock), end_time=_hhmm(clock + MEAL_DURATION_MIN),
        duration_minutes=MEAL_DURATION_MIN, detour_km=round(meal.detour_km, 1),
        verification_status=meal.verification_status,
    )


def _reject(stop: DiscoveredStop, clock: int, travel_min: int, driving: int,
            day_budget: int, day_end: int, reason_extra: str | None = None) -> ExcludedStop:
    parts = []
    if driving + travel_min > day_budget:
        parts.append(f"the {reason_extra or 'daily driving limit'} of {day_budget} min would be exceeded")
    if clock + travel_min > day_end:
        parts.append("arrival would fall outside the 07:00-22:00 waking window")
    if not parts:
        parts.append(reason_extra or "no feasible time window remained")
    return ExcludedStop(**stop.model_dump(), exclusion_reason="Could not be scheduled: " + "; ".join(parts))


def _conflict_text(day: int, name: str, needed: int, clock: int, driving: int, day_budget: int) -> str:
    return (
        f"Day {day}: '{name}' needs about {needed} min but only "
        f"{max(0, DAY_END_MIN - clock)} min of waking time and "
        f"{max(0, day_budget - driving)} min of driving budget remain. "
        "Options: drop another stop from this day, add a trip day, or switch to a "
        "'packed' pace for a higher daily driving cap."
    )
