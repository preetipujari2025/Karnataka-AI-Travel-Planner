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
from app.services.recommendation import (
    default_start_month,
    find_suitable_substitutions,
    select_destinations,
)
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


def generate_why_this_plan(
    request: PlanRequest,
    order: list,
    budget,
) -> str:
    """Compose a personalized note highlighting interests, budget, and route fit."""
    interests_str = ", ".join(i.value.replace("_", " ").title() for i in request.interests)
    dest_names = " → ".join(d.name for d in order)
    traveller_str = f"{request.travellers} {'traveller' if request.travellers == 1 else 'travellers'}"
    budget_target = getattr(request, "total_budget_inr", None)

    if budget_target:
        budget_note = (
            f"tailored for your stated budget of INR {budget_target:,} "
            f"(estimated total cost: INR {budget.total_inr:,} across stay, food, transport, and entry tickets)"
        )
    else:
        budget_note = (
            f"aligned with the {request.budget_tier.value.title()} tier "
            f"(estimated total: INR {budget.total_inr:,} for {traveller_str})"
        )

    pace_str = f"{request.pace.value} pace"
    if getattr(request, "experience_preference", None):
        pace_str += f", {request.experience_preference.value.replace('_', ' ')} style"

    return (
        f"Why this plan for you: Crafted specifically for your interest in {interests_str} over {request.days} "
        f"{'day' if request.days == 1 else 'days'}, this journey links {dest_names}. "
        f"The itinerary is designed for {traveller_str} at a {pace_str}, and is {budget_note}. "
        f"Nearby sights are grouped on the same day to eliminate exhausting cross-state transit, verified entrance "
        f"fees are itemized, and authentic regional Karnataka dining highlights are included throughout."
    )


def check_duration_interest_advice(request: PlanRequest) -> str | None:
    """Polite advice when available days are insufficient for the chosen interests."""
    interests = [i.value for i in request.interests]
    days = request.days

    # 1-day trip with 3+ interests
    if days == 1 and len(interests) >= 3:
        kept = [interests[0].replace("_", " ").title()]
        dropped = [i.replace("_", " ").title() for i in interests[1:]]
        return (
            f"With only 1 day available, attempting to cover {len(interests)} diverse interests "
            f"({', '.join(i.replace('_', ' ').title() for i in interests)}) across Karnataka will leave you rushed. "
            f"We politely recommend focusing on {kept[0]} for this single day, and dropping {', '.join(dropped)} "
            f"for a future multi-day getaway."
        )

    # 1-day trip combining distant cross-state regional themes (e.g. beaches + hills/heritage)
    if days == 1 and any(b in interests for b in ("beach", "beaches")) and any(h in interests for h in ("hills", "coffee_hills", "heritage")):
        return (
            "With only 1 day available, combining coastal beaches with inland hill stations or royal heritage sites "
            "is not feasible due to 6+ hours of transit across the Western Ghats. We politely suggest focusing on one region "
            "and dropping the other for this trip."
        )

    # 2-3 day trips with 4+ diverse interests
    if days <= 3 and len(interests) >= 4:
        kept = [i.replace("_", " ").title() for i in interests[:2]]
        dropped = [i.replace("_", " ").title() for i in interests[2:]]
        return (
            f"With {days} days available, experiencing {len(interests)} diverse interests "
            f"({', '.join(i.replace('_', ' ').title() for i in interests)}) requires excessive highway transit. "
            f"We politely suggest focusing on {', '.join(kept)}, and saving {', '.join(dropped)} "
            f"for a dedicated 5+ day trip."
        )

    # 4-5 day trips with 6+ interests
    if days <= 5 and len(interests) >= 6:
        kept = [i.replace("_", " ").title() for i in interests[:3]]
        dropped = [i.replace("_", " ").title() for i in interests[3:]]
        return (
            f"With {days} days available, balancing {len(interests)} disparate interests spreads your schedule thin. "
            f"To allow meaningful exploration rather than rushed transit, we suggest prioritizing {', '.join(kept)} "
            f"and dropping {', '.join(dropped)}."
        )

    return None


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

    if len(order) > request.days:
        if final is not None and order[-1].id == final.id:
            intermediates = order[1:-1]
            order = [order[0]] + intermediates[: max(0, request.days - 2)] + [final]
            if len(order) > request.days:
                order = [final]
        else:
            order = order[: request.days]

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
    planner_label = "Smart planner"
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
                planner_label = "AI-personalized"
            except ai_planner.AIGenerationError as exc:
                if request.planner == "ai":
                    raise
                logger.warning("AI planner failed, falling back silently to Smart planner: %s", exc)
                warnings.append(
                    f"AI planner failed ({exc}); used the deterministic fallback planner."
                )
                source = "fallback"
                planner_label = "Smart planner"

    if itinerary is None:
        summary, itinerary = fallback_planner.build_fallback_itinerary(
            request, nightly_plan, legs, order
        )
        source = "fallback"
        planner_label = "Smart planner"
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
        subs = find_suitable_substitutions(order[-1], request, order_ids, max_km=160.0, limit=2)
        suggested_substitutions = [
            SuggestedSubstitution(
                current_destination_id=order[-1].id,
                current_destination_name=order[-1].name,
                suggested_destination_id=alt.id,
                suggested_destination_name=alt.name,
                reason=reason,
            )
            for alt, reason in subs
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
        total_budget_inr=getattr(request, "total_budget_inr", None),
    )

    if getattr(request, "total_budget_inr", None) is not None:
        if breakdown.total_inr > request.total_budget_inr:
            over = breakdown.total_inr - request.total_budget_inr
            warnings.append(
                f"Budget Warning: Estimated minimum trip cost of INR {breakdown.total_inr:,} "
                f"exceeds your total budget INR {request.total_budget_inr} by INR {over:,}. "
                "Consider shortening your trip, switching to the Budget Explorer tier, or using public transport."
            )

    why_this_plan_note = generate_why_this_plan(request, order, breakdown)
    duration_advice = check_duration_interest_advice(request)
    if duration_advice:
        warnings.append(f"Pacing Advice: {duration_advice}")

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
        planner_label=planner_label,
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
        why_this_plan=why_this_plan_note,
        duration_interest_advice=duration_advice,
    )
