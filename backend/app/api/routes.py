"""Road-trip route discovery and planning endpoints.

POST /api/routes/discover  — corridor candidates + meals for a real road route
POST /api/routes/plan      — constraint-aware schedule for the selected stops

Both are sync handlers (FastAPI threadpool): provider HTTP calls are blocking
and short-lived, and results reuse the TTL-bounded discovery cache.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.schemas import (
    RoadTripPlanRequest,
    RoadTripPlanResponse,
    RouteDiscoveryRequest,
    RouteDiscoveryResponse,
)
from app.services import route_discovery, roadtrip_planner
from app.services.route_discovery import DiscoveryError
from app.services.roadtrip_planner import PlanError

router = APIRouter(prefix="/api/routes", tags=["road-trip"])


import logging

logger = logging.getLogger("karnataka.routes")


@router.post(
    "/discover",
    response_model=RouteDiscoveryResponse,
    summary="Discover attractions and food stops along a real road route",
)
def discover_route(request: RouteDiscoveryRequest) -> RouteDiscoveryResponse:
    try:
        return route_discovery.discover_route(request)
    except (DiscoveryError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Unexpected error in route discovery: %s", exc)
        raise HTTPException(
            status_code=400,
            detail=f"We could not discover this route: {str(exc)}",
        ) from exc


@router.post(
    "/plan",
    response_model=RoadTripPlanResponse,
    summary="Build a feasible multi-day road-trip plan from selected stops",
)
def plan_road_trip(request: RoadTripPlanRequest) -> RoadTripPlanResponse:
    try:
        return roadtrip_planner.plan_road_trip(request)
    except (DiscoveryError, PlanError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Unexpected error in road trip planning: %s", exc)
        raise HTTPException(
            status_code=400,
            detail=f"We could not plan this road trip: {str(exc)}",
        ) from exc
