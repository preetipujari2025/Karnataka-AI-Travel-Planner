"""Application settings loaded from environment variables (.env supported)."""

from __future__ import annotations

from functools import lru_cache

from pathlib import Path
from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

_backend_dir = Path(__file__).resolve().parent.parent
_root_dir = _backend_dir.parent


class Settings(BaseSettings):
    """Runtime configuration. Every value has a safe local default."""

    model_config = SettingsConfigDict(
        env_file=[
            str(_backend_dir / ".env"),
            str(_root_dir / ".env"),
            ".env",
        ],
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_name: str = "Karnataka AI Travel Planner API"
    app_version: str = "0.1.0"
    environment: str = "development"

    # Comma separated origins allowed by CORS
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # AI provider configuration. Supported providers: 'gemini' (default), 'openai', 'mock'.
    ai_provider: str = Field(
        default="gemini",
        validation_alias=AliasChoices("ai_provider", "llm_provider"),
    )
    llm_api_key: str = Field(
        default="",
        validation_alias=AliasChoices(
            "llm_api_key",
            "ai_api_key",
            "gemini_api_key",
            "google_api_key",
            "google_ai_key",
        ),
    )
    llm_base_url: str = Field(
        default="",
        validation_alias=AliasChoices("llm_base_url", "ai_base_url"),
    )
    llm_model: str = Field(
        default="",
        validation_alias=AliasChoices("llm_model", "ai_model"),
    )
    llm_timeout_seconds: float = Field(
        default=25.0,
        validation_alias=AliasChoices("llm_timeout_seconds", "ai_timeout_seconds"),
    )

    # Road routing + place discovery providers (all free, public services).
    # Automated tests MUST NOT hit these: conftest disables external access.
    routing_enabled: bool = Field(
        default=True,
        validation_alias=AliasChoices("routing_enabled", "external_providers_enabled"),
        description="Allow live OSRM/Overpass calls; False = deterministic local data only",
    )
    osrm_base_url: str = Field(
        default="https://router.project-osrm.org",
        validation_alias=AliasChoices("osrm_base_url", "routing_osrm_base_url"),
        description="OSRM road-routing server (public demo; consider self-hosting for production)",
    )
    overpass_base_url: str = Field(
        default="https://overpass-api.de/api/interpreter",
        validation_alias=AliasChoices("overpass_base_url"),
        description="Overpass API endpoint for OpenStreetMap POI discovery",
    )
    provider_timeout_seconds: float = Field(
        default=12.0,
        validation_alias=AliasChoices("provider_timeout_seconds"),
    )
    route_cache_ttl_seconds: int = Field(
        default=24 * 3600,
        validation_alias=AliasChoices("route_cache_ttl_seconds"),
        description="How long cached route/discovery results stay fresh before refetch",
    )

    @property
    def ai_api_key(self) -> str:
        return self.llm_api_key

    @property
    def ai_base_url(self) -> str:
        if self.llm_base_url.strip():
            return self.llm_base_url
        if self.ai_provider.strip().lower() == "gemini":
            return "https://generativelanguage.googleapis.com/v1beta/openai"
        return "https://api.openai.com/v1"

    @property
    def ai_model(self) -> str:
        if self.llm_model.strip():
            return self.llm_model
        if self.ai_provider.strip().lower() == "gemini":
            return "gemini-2.0-flash"
        return "gpt-4o-mini"

    @property
    def ai_timeout_seconds(self) -> float:
        return self.llm_timeout_seconds

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def llm_configured(self) -> bool:
        if self.ai_provider.strip().lower() in ("mock", "test", "stub"):
            return True
        return bool(self.llm_api_key.strip())


@lru_cache
def get_settings() -> Settings:
    return Settings()
