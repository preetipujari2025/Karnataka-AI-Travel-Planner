"""Itinerary endpoints (stateless design).

GET /api/itineraries/{itinerary_id} is intentionally NOT implemented: this MVP
has no persistence layer, so itineraries are not stored server-side. Regenerate
takes the previous itinerary payload back in the request body instead. The
absence of the GET route returns a documented 404 rather than a fake record.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.schemas import (
    GenerateItineraryResponse,
    RegenerateItineraryRequest,
    RegenerateItineraryResponse,
    TripRequest,
)
from app.services import ai_planner
from app.services import itinerary_service
from app.services.itinerary_service import RegenerateError
from app.services.planner import PlanValidationError

router = APIRouter(prefix="/api", tags=["itineraries"])


# Plain functions on purpose: the LLM call is synchronous and FastAPI runs sync
# handlers in its threadpool.
@router.post(
    "/itineraries/generate",
    response_model=GenerateItineraryResponse,
    summary="Generate a personalised itinerary",
)
def generate_itinerary(request: TripRequest) -> GenerateItineraryResponse:
    try:
        return itinerary_service.generate(request)
    except PlanValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ai_planner.AIGenerationError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"AI planner unavailable: {exc}. Retry with planner='auto' for the fallback.",
        ) from exc


@router.post(
    "/itineraries/{itinerary_id}/regenerate",
    response_model=RegenerateItineraryResponse,
    summary="Regenerate/revise a previous itinerary (stateless)",
)
def regenerate_itinerary(
    itinerary_id: str, body: RegenerateItineraryRequest
) -> RegenerateItineraryResponse:
    try:
        return itinerary_service.regenerate(itinerary_id, body)
    except RegenerateError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except PlanValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ai_planner.AIGenerationError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"AI planner unavailable: {exc}. Retry with planner='auto' for the fallback.",
        ) from exc
