"""Health-check endpoint."""

from fastapi import APIRouter

from app.config import get_settings
from app.data.loader import destination_count, get_attractions_count, get_data_source
from app.schemas import HealthResponse

router = APIRouter(tags=["system"])


@router.get("/health", response_model=HealthResponse, summary="Health check")
@router.get("/api/health", response_model=HealthResponse, include_in_schema=True, summary="Health check (API)")
def health() -> HealthResponse:
    settings = get_settings()
    return HealthResponse(
        status="ok",
        service=settings.app_name,
        version=settings.app_version,
        environment=settings.environment,
        llm_configured=settings.llm_configured,
        dataset_size=destination_count(),
        districts=31,
        attractions=get_attractions_count(),
        data_source=get_data_source(),
    )
