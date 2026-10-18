"""FastAPI application entrypoint.

Run locally:  uvicorn app.main:app --reload --port 8000
Docs:         http://localhost:8000/docs (Swagger UI), /redoc for ReDoc

Cross-cutting concerns live here: CORS (from environment), a consistent JSON
error envelope for every non-2xx response, and access logging that records
method/path/status only (never bodies, headers or secrets).
"""

from __future__ import annotations

import logging
import time

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api import api_router
from app.config import get_settings

logger = logging.getLogger("karnataka.api")

# Stable machine-readable codes for the error envelope.
_HTTP_ERROR_CODES = {
    400: "bad_request",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    405: "method_not_allowed",
    409: "conflict",
    422: "unprocessable_entity",
    429: "rate_limited",
    502: "bad_gateway",
    503: "service_unavailable",
}


def _configure_logging() -> None:
    if not logging.getLogger().handlers:
        logging.basicConfig(
            level=logging.INFO,
            format="%(asctime)s %(levelname)s %(name)s %(message)s",
        )


def _error(code: str, message: str, details: list | None = None) -> dict:
    error: dict = {"code": code, "message": message}
    if details:
        error["details"] = details
    return {"error": error}


def create_app() -> FastAPI:
    _configure_logging()
    settings = get_settings()
    application = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=(
            "AI travel planner for Karnataka. Supports an LLM-backed planner with a "
            "deterministic fallback so plans are always generated. Errors always use "
            "the envelope {\"error\": {\"code\", \"message\", \"details\"?}}. "
            "Itineraries are not persisted in this MVP: there is no "
            "GET /api/itineraries/{id}; regenerate is stateless and takes the "
            "previous itinerary payload in the request body."
        ),
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )

    @application.middleware("http")
    async def _access_log(request: Request, call_next):
        started = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - started) * 1000
        # Method, path and status only — no bodies, headers or credentials.
        logger.info(
            "%s %s -> %s (%.1f ms)",
            request.method,
            request.url.path,
            response.status_code,
            elapsed_ms,
        )
        return response

    # --- Consistent error envelope -----------------------------------------
    @application.exception_handler(RequestValidationError)
    async def _validation_error(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        details = []
        for error in exc.errors():
            location = ".".join(str(part) for part in error["loc"] if part != "body")
            details.append({"field": location or "body", "message": error["msg"]})
        return JSONResponse(
            status_code=422,
            content=_error(
                "request_validation_error",
                "Request validation failed",
                details,
            ),
        )

    @application.exception_handler(StarletteHTTPException)
    async def _http_error(
        request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        code = _HTTP_ERROR_CODES.get(exc.status_code, "http_error")
        if isinstance(exc.detail, str):
            message, details = exc.detail, None
        else:
            message, details = "Request failed", [exc.detail]
        return JSONResponse(
            status_code=exc.status_code,
            content=_error(code, message, details),
            headers=exc.headers,
        )

    @application.exception_handler(Exception)
    async def _unhandled_error(request: Request, exc: Exception) -> JSONResponse:
        logger.exception(
            "Unhandled error on %s %s", request.method, request.url.path
        )
        return JSONResponse(
            status_code=500,
            content=_error("internal_error", "Internal server error"),
        )

    application.include_router(api_router)

    @application.get("/", include_in_schema=False)
    def root() -> dict[str, str]:
        return {
            "service": settings.app_name,
            "version": settings.app_version,
            "docs": "/docs",
            "health": "/api/health",
        }

    logger.info(
        "Starting %s v%s (environment=%s, llm_configured=%s, cors_origins=%s)",
        settings.app_name,
        settings.app_version,
        settings.environment,
        settings.llm_configured,
        settings.cors_origin_list,
    )
    return application


app = create_app()
