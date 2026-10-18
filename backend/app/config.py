"""Application settings loaded from environment variables (.env supported)."""

from __future__ import annotations

from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration. Every value has a safe local default."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_name: str = "Karnataka AI Travel Planner API"
    app_version: str = "0.1.0"
    environment: str = "development"

    # Comma separated origins allowed by CORS
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # AI provider configuration. Supported providers: 'openai' (default), 'gemini', 'mock'.
    ai_provider: str = Field(
        default="openai",
        validation_alias=AliasChoices("ai_provider", "llm_provider"),
    )
    llm_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("llm_api_key", "ai_api_key"),
    )
    llm_base_url: str = Field(
        default="https://api.openai.com/v1",
        validation_alias=AliasChoices("llm_base_url", "ai_base_url"),
    )
    llm_model: str = Field(
        default="gpt-4o-mini",
        validation_alias=AliasChoices("llm_model", "ai_model"),
    )
    llm_timeout_seconds: float = Field(
        default=30.0,
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
        return self.llm_base_url

    @property
    def ai_model(self) -> str:
        return self.llm_model

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
