"""Itinerary planning endpoint."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.schemas import PlanRequest, PlanResponse
from app.services import ai_planner
from app.services.planner import PlanValidationError, create_plan

router = APIRouter(prefix="/api/v1", tags=["plans"])


# NOTE: declared as a plain function (not async) on purpose — the LLM call is
# synchronous, and FastAPI runs sync handlers in its threadpool.
@router.post("/plans", response_model=PlanResponse, summary="Create a trip plan")
def create_plan_endpoint(request: PlanRequest) -> PlanResponse:
    try:
        return create_plan(request)
    except PlanValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ai_planner.AIGenerationError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"AI planner unavailable: {exc}. Retry with planner='auto' for the fallback.",
        ) from exc
