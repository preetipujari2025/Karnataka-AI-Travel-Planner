"""Itinerary API service: generate / regenerate business logic.

Route handlers stay thin; all validation-adjacent orchestration, budget-fit
computation and the stateless regenerate contract live here.
"""

from __future__ import annotations

import logging

from pydantic import ValidationError

from app.schemas import (
    BudgetFit,
    GenerateItineraryResponse,
    RegenerateItineraryRequest,
    RegenerateItineraryResponse,
    TripRequest,
)
from app.services.planner import PlanValidationError, create_plan

logger = logging.getLogger("karnataka.itineraries")


class RegenerateError(ValueError):
    """Raised when a stateless regenerate request cannot be honoured."""


def _budget_fit(plan_budget_total: int, total_budget_inr: int | None) -> BudgetFit:
    if total_budget_inr is None:
        return BudgetFit(total_budget_inr=None, estimated_total_inr=plan_budget_total)
    variance = total_budget_inr - plan_budget_total
    return BudgetFit(
        total_budget_inr=total_budget_inr,
        estimated_total_inr=plan_budget_total,
        within_budget=variance >= 0,
        variance_inr=variance,
    )


def _apply_budget_fit(plan, trip: TripRequest):
    """Attach budget fit and append an over-budget warning (never a fake success)."""
    fit = _budget_fit(plan.budget.total_inr, trip.total_budget_inr)
    if fit.within_budget is False:
        over = abs(int(fit.variance_inr or 0))
        plan.warnings.append(
            f"Estimated cost INR {plan.budget.total_inr} exceeds your total budget "
            f"INR {trip.total_budget_inr} by INR {over}."
        )
    return GenerateItineraryResponse(**plan.model_dump(), budget_fit=fit)


def generate(trip: TripRequest) -> GenerateItineraryResponse:
    """Create a personalised itinerary for a validated trip request."""
    plan = create_plan(trip)  # PlanValidationError / AIGenerationError propagate
    response = _apply_budget_fit(plan, trip)
    logger.info(
        "itinerary generated plan_id=%s source=%s days=%s within_budget=%s",
        response.plan_id,
        response.source,
        response.budget.days,
        response.budget_fit.within_budget,
    )
    return response


def regenerate(
    itinerary_id: str, body: RegenerateItineraryRequest
) -> RegenerateItineraryResponse:
    """Stateless regenerate: the client resends the previous itinerary payload.

    The `trip` in the body is the source of truth for the user's constraints;
    `changes` (optional) explicitly overrides individual fields. The previous
    payload's plan_id must match the path id so we never pretend to look up
    something that is not stored.
    """
    previous = body.previous_itinerary
    if previous.plan_id != itinerary_id:
        raise RegenerateError(
            f"previous_itinerary.plan_id ('{previous.plan_id}') does not match the "
            f"path id ('{itinerary_id}'). This API is stateless: resend the full "
            "previous itinerary payload you received from /api/itineraries/generate "
            "or /api/itineraries/{id}/regenerate."
        )

    trip = body.trip
    if body.changes is not None:
        overrides = body.changes.model_dump(exclude_none=True)
        merged = {**trip.model_dump(), **overrides}
        try:
            trip = TripRequest.model_validate(merged)
        except ValidationError as exc:
            raise PlanValidationError(f"Invalid changes: {exc}") from exc
        logger.info(
            "regenerating itinerary %s with changes: %s",
            itinerary_id,
            sorted(overrides.keys()),
        )

    plan = create_plan(trip)
    response = _apply_budget_fit(plan, trip)
    logger.info(
        "itinerary regenerated plan_id=%s from=%s source=%s",
        response.plan_id,
        itinerary_id,
        response.source,
    )
    return RegenerateItineraryResponse(
        **response.model_dump(),
        regenerated_from=itinerary_id,
    )
