"""API package: routers grouped by endpoint family.

Destinations are mounted twice: /api/v1/* (legacy, existing clients/tests) and
/api/* (the canonical routes of the current API spec). Same handlers, one
service layer.
"""

from fastapi import APIRouter

from app.api.destinations import router as destinations_router
from app.api.health import router as health_router
from app.api.itineraries import router as itineraries_router
from app.api.plans import router as plans_router
from app.api.routes import router as roadtrip_router

api_router = APIRouter()
api_router.include_router(health_router)  # /health and /api/health
api_router.include_router(destinations_router, prefix="/api/v1")
api_router.include_router(destinations_router, prefix="/api")
api_router.include_router(roadtrip_router)  # /api/routes/* (road-trip discovery + planning)
api_router.include_router(itineraries_router)  # /api/itineraries/*
api_router.include_router(plans_router)  # /api/v1/plans (legacy)

__all__ = ["api_router"]
