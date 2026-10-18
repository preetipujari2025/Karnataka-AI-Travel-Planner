"""Plan orchestration.

Selects the planner (AI vs deterministic fallback), computes stops, routing and
budget with the dedicated modules, and assembles the API response.
"""

from __future__ import annotations

import logging
import uuid

from app.data.loader import all_destinations, get_destination
from app.schemas import (
    DestinationSuitability,
    DestinationSummary,
    PlanRequest,
    PlanResponse,
    SuggestedSubstitution,
)
from app.services import ai_planner, fallback_planner
from app.services.budget import compute_budget
from app.services.recommendation import default_start_month, select_destinations
from app.services.routing import (
    assign_nights,
    build_legs,
    build_stay_spans,
    nearest_neighbor_order,
)

logger = logging.getLogger("karnataka.planner")


class PlanValidationError(ValueError):
    """Raised when a request cannot be satisfied by any planner."""


class PlanConsistencyError(RuntimeError):
    """Raised when selected stops, itinerary days and route legs disagree.

    This is a bug guard, not a user error: it must never fire for a valid
    plan, and it exists so an inconsistent itinerary can never be serialised
    to the client silently.
    """


def _summary_of(destination) -> DestinationSummary:
    return DestinationSummary(
        id=destination.id,
        name=destination.name,
        region=destination.region,
        lat=destination.lat,
        lng=destination.lng,
        categories=list(destination.categories),
        description=destination.description,
        highlights=list(destination.highlights),
    )


def _assert_plan_consistency(
    selected_ids: list[str],
    itinerary,
    legs,
    stays,
    expected_days: int,
) -> None:
    """Guard the invariants the browser test found violated.

    - selected destination IDs are unique (no accidental double selection)
    - every itinerary day belongs to a selected destination
    - each selected destination appears in exactly ONE contiguous stay span
    - stays cover days 1..expected_days with no gaps or overlaps
    - every route leg departs from the previous day's destination and arrives
      at a selected destination, never on a day that stays put
    """
    if len(selected_ids) != len(set(selected_ids)):
        raise PlanConsistencyError(
            f"duplicate destination in selection: {selected_ids}"
        )

    days = sorted(itinerary, key=lambda d: d.day)
    if [d.day for d in days] != list(range(1, expected_days + 1)):
        raise PlanConsistencyError(
            f"itinerary days must be 1..{expected_days}, got "
            f"{[d.day for d in days]}"
        )
    day_place_ids = [d.place.destination_id for d in days]
    unknown = set(day_place_ids) - set(selected_ids)
    if unknown:
        raise PlanConsistencyError(
            f"itinerary stops not in selected destinations: {sorted(unknown)}"
        )
    unvisited = set(selected_ids) - set(day_place_ids)
    if unvisited:
        raise PlanConsistencyError(
            f"selected destinations never visited by any day: {sorted(unvisited)}"
        )
    # Activities must belong to the day they are scheduled in.
    for day in days:
        for activity in day.activities:
            if activity.destination_id != day.place.destination_id:
                raise PlanConsistencyError(
                    f"day {day.day} activity '{activity.title}' points at "
                    f"{activity.destination_id}, expected {day.place.destination_id}"
                )

    # Stay spans: each destination exactly once, contiguous, gapless cover.
    span_ids = [s.destination_id for s in stays]
    if len(span_ids) != len(set(span_ids)):
        raise PlanConsistencyError(f"destination has more than one stay: {span_ids}")
    covered: list[int] = []
    for span in stays:
        if span.first_day != (max(covered) + 1 if covered else 1):
            raise PlanConsistencyError(
                f"stay '{span.destination_id}' starts at day {span.first_day} "
                f"but previous stay ends at day {max(covered) if covered else 0}"
            )
        expected_segment = list(range(span.first_day, span.last_day + 1))
        actual_segment = day_place_ids[span.first_day - 1 : span.last_day]
        if actual_segment != [span.destination_id] * span.days:
            raise PlanConsistencyError(
                f"stay '{span.destination_id}' claims days {expected_segment} "
                f"but itinerary has {actual_segment} there"
            )
        covered.extend(expected_segment)
    if covered != list(range(1, expected_days + 1)):
        raise PlanConsistencyError(
            f"stays cover {covered}, expected 1..{expected_days}"
        )
    if set(span_ids) != set(day_place_ids):
        raise PlanConsistencyError(
            "stay destinations and itinerary destinations differ: "
            f"stays={sorted(set(span_ids))} days={sorted(set(day_place_ids))}"
        )

    # Route legs must mirror the day-to-day destination changes exactly.
    day_days = [d.day for d in days]
    for leg in legs:
        if leg.day not in day_days:
            raise PlanConsistencyError(f"leg on unknown day {leg.day}")
        i = day_days.index(leg.day)
        if i == 0:
            raise PlanConsistencyError(f"leg on day {leg.day} but no previous day")
        if leg.origin.destination_id != day_place_ids[i - 1]:
            raise PlanConsistencyError(
                f"leg day {leg.day} originates at {leg.origin.destination_id}, "
                f"but day {leg.day - 1} was spent in {day_place_ids[i - 1]}"
            )
        if leg.destination.destination_id != day_place_ids[i]:
            raise PlanConsistencyError(
                f"leg day {leg.day} arrives at {leg.destination.destination_id}, "
                f"but day {leg.day} is spent in {day_place_ids[i]}"
            )
        if leg.origin.destination_id == leg.destination.destination_id:
            raise PlanConsistencyError(f"self-loop leg on day {leg.day}")
        if leg.distance_km <= 0:
            raise PlanConsistencyError(f"zero-distance leg on day {leg.day}")

    # Every day-to-day change must be covered by a leg (no teleporting).
    leg_days = {leg.day for leg in legs}
    expected_leg_days = {
        i + 1
        for i in range(1, len(days))
        if day_place_ids[i] != day_place_ids[i - 1]
    }
    if leg_days != expected_leg_days:
        raise PlanConsistencyError(
            f"legs on days {sorted(leg_days)} but destination changes on "
            f"days {sorted(expected_leg_days)}"
        )


def create_plan(request: PlanRequest) -> PlanResponse:
    """Build a full plan. Raises PlanValidationError / ai_planner.AIGenerationError."""
    start = get_destination(request.start_city)
    if start is None:
        raise PlanValidationError(
            f"Unknown start_city '{request.start_city}'. "
            "Pick one from GET /api/v1/meta."
        )
    if not start.has_usable_coords:
        raise PlanValidationError(
            f"start_city '{start.id}' has no usable coordinates and cannot be routed."
        )

    final = None
    if request.final_destination:
        final = get_destination(request.final_destination)
        if final is None:
            raise PlanValidationError(
                f"Unknown final_destination '{request.final_destination}'. "
                "Pick one from GET /api/v1/meta or /api/destinations."
            )
        if not final.has_usable_coords:
            raise PlanValidationError(
                f"final_destination '{final.id}' has no usable coordinates and cannot be routed."
            )
        if final.id == start.id:
            # Round trip back to the start: the start city is also the arrival city.
            final = None

    month = request.start_month or default_start_month()

    # 1. Destination selection (recommendation module)
    selected = [item.destination for item in select_destinations(request, month)]
    if start.id not in {d.id for d in selected}:
        selected.insert(0, start)
    if final is not None and final.id not in {d.id for d in selected}:
        selected.append(final)

    # 2. Routing: order + day allocation + legs
    order = nearest_neighbor_order(selected, start)
    if final is not None:
        # A journey with a stated arrival city must END there: keep one logical
        # origin -> destination route instead of letting nearest-neighbour put
        # the final destination mid-tour.
        order = [d for d in order if d.id != final.id] + [final]
    # No destination may be selected twice — a repeat in the order is a bug.
    if len({d.id for d in order}) != len(order):
        raise PlanValidationError(
            "duplicate destination in route order: "
            + ", ".join(d.id for d in order)
        )
    nightly_plan = assign_nights(order, request.days, request.pace)
    legs = build_legs(nightly_plan, request.transport_preference)
    # Explicit stay spans: consecutive days at one stop = ONE multi-day stay.
    stays = build_stay_spans(nightly_plan)

    warnings: list[str] = []
    for destination in order:
        if month not in destination.best_months:
            warnings.append(
                f"{destination.name} is outside its best season in month {month}."
            )
        if destination.entry_fees_inr is None:
            warnings.append(
                f"Entry fee for {destination.name} is not verified; excluded from the budget."
            )
        if request.accessibility_requirements and destination.accessibility_notes:
            warnings.append(
                f"Accessibility at {destination.name}: {destination.accessibility_notes}"
            )

    # 3. Planner selection (AI first, deterministic fallback always available)
    source = "fallback"
    summary: str | None = None
    itinerary = None
    dest_explanations: list[DestinationSuitability] = []
    practical_tips: list[str] = []
    suggested_substitutions: list[SuggestedSubstitution] = []
    ai_provider_name: str | None = None

    if request.planner in ("auto", "ai"):
        if not ai_planner.llm_available():
            if request.planner == "ai":
                raise ai_planner.AIGenerationError(
                    "LLM is not configured (LLM_API_KEY is empty); use planner='auto' or 'fallback'."
                )
            warnings.append("LLM not configured; used the deterministic fallback planner.")
        else:
            try:
                ai_res = ai_planner.generate_ai_plan_full(request, order, nightly_plan)
                summary = ai_res.summary
                itinerary = ai_res.itinerary
                dest_explanations = ai_res.destination_explanations
                practical_tips = ai_res.practical_tips
                suggested_substitutions = ai_res.suggested_substitutions
                ai_provider_name = ai_res.ai_provider
                source = "ai"
            except ai_planner.AIGenerationError as exc:
                if request.planner == "ai":
                    raise
                logger.warning("AI planner failed, using fallback: %s", exc)
                warnings.append(
                    f"AI planner failed ({exc}); used the deterministic fallback planner."
                )

    if itinerary is None:
        summary, itinerary = fallback_planner.build_fallback_itinerary(
            request, nightly_plan, legs, order
        )
        source = "fallback"
        # Deterministic explanations and regional recommendations
        dest_explanations = [
            DestinationSuitability(
                destination_id=d.id,
                destination_name=d.name,
                explanation=f"{d.name} in {d.region} matches your preferences with highlights including {', '.join(d.highlights[:2])}.",
            )
            for d in order
        ]
        practical_tips = [
            "Start early to avoid peak afternoon heat, especially at open monument complexes.",
            "Carry modest clothing and remove footwear when entering temple premises.",
            "Pre-book verified state transport or local registered guides for heritage circuits.",
        ]
        order_ids = {d.id for d in order}
        alts = [d for d in all_destinations() if d.id not in order_ids and d.has_usable_coords][:2]
        suggested_substitutions = [
            SuggestedSubstitution(
                current_destination_id=order[-1].id,
                current_destination_name=order[-1].name,
                suggested_destination_id=alt.id,
                suggested_destination_name=alt.name,
                reason=f"Approved alternative in {alt.region} known for {', '.join(alt.highlights[:2])}.",
            )
            for alt in alts
        ]

    # 3b. Consistency guard: selected IDs, itinerary stops and route legs must
    # agree before anything is serialised to the client.
    stay_by_day: dict[int, object] = {
        day: span for span in stays for day in range(span.first_day, span.last_day + 1)
    }
    for day_plan in itinerary:  # also backfills AI-drafted day plans
        span = stay_by_day[day_plan.day]
        day_plan.stay_day = day_plan.day - span.first_day + 1
        day_plan.stay_days = span.days
    _assert_plan_consistency(
        selected_ids=[d.id for d in order],
        itinerary=itinerary,
        legs=legs,
        stays=stays,
        expected_days=request.days,
    )

    # 4. Budget (never trusted to the LLM)
    unique_stops: list = []
    for destination in order:
        if all(d.id != destination.id for d in unique_stops):
            unique_stops.append(destination)
    breakdown = compute_budget(
        nightly_plan=nightly_plan,
        legs=legs,
        tier=request.budget_tier,
        travellers=request.travellers,
        entry_fee_destinations=unique_stops,
        transport=request.transport_preference,
    )

    logger.info(
        "plan generated source=%s days=%s stops=%s transport=%s total_inr=%s",
        source,
        request.days,
        len(order),
        request.transport_preference.value,
        breakdown.total_inr,
    )

    return PlanResponse(
        plan_id=uuid.uuid4().hex[:12],
        source=source,
        summary=summary or "",
        interests=list(request.interests),
        itinerary=itinerary,
        selected_destinations=[_summary_of(d) for d in order],
        route=legs,
        stays=stays,
        budget=breakdown,
        warnings=warnings,
        destination_explanations=dest_explanations,
        practical_tips=practical_tips,
        suggested_substitutions=suggested_substitutions,
        ai_provider=ai_provider_name if source == "ai" else None,
    )
