"""Live road-routing provider with a deterministic, clearly-labelled fallback.

Uses an OSRM-compatible routing server for real road geometry, distance and
driving duration. When the provider is unreachable (or disabled in tests),
the deterministic haversine x road-factor estimate is used instead and is
NEVER presented as a verified road route: `source="estimated"` /
`verified=False` travel with the result all the way to the API response.

Never invents a route, distance, duration or coordinate: every number is
either fetched from the provider or computed from stored coordinates with a
labelled model.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone

import httpx

from app.config import get_settings
from app.schemas import DestinationRecord, Place, RouteAlternative, RouteInfo
from app.services.routing import road_distance_km, travel_hours

logger = logging.getLogger("karnataka.routing.provider")

OSRM_PROVIDER_NAME = "osrm"

# A route polyline is thinned to keep API payloads small without losing shape.
MAX_GEOMETRY_POINTS = 240


@dataclass
class RouteResult:
    """Raw routing outcome shared with the discovery + scheduling layers."""

    distance_km: float
    duration_hours: float
    geometry: list[list[float]] = field(default_factory=list)  # [lat, lng]
    alternatives: list[RouteAlternative] = field(default_factory=list)
    source: str = "estimated"  # "osrm" | "estimated"
    verified: bool = False
    error: str | None = None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _place_of(record: DestinationRecord) -> Place:
    if not record.has_usable_coords:
        raise ValueError(f"destination '{record.id}' has no coordinates for routing")
    return Place(
        destination_id=record.id,
        name=record.name,
        lat=float(record.lat),
        lng=float(record.lng),
        region=record.region,
    )


def _thin(points: list[list[float]]) -> list[list[float]]:
    if len(points) <= MAX_GEOMETRY_POINTS:
        return points
    step = len(points) / MAX_GEOMETRY_POINTS
    thinned = [points[int(i * step)] for i in range(MAX_GEOMETRY_POINTS)]
    thinned[-1] = points[-1]
    return thinned


def _parse_osrm_route(route: dict) -> RouteAlternative:
    # OSRM geojson coordinates are [lng, lat]; the API contract uses [lat, lng].
    coords = [[lat, lng] for lng, lat in route["geometry"]["coordinates"]]
    return RouteAlternative(
        distance_km=round(route["distance"] / 1000.0, 1),
        duration_hours=round(route["duration"] / 3600.0, 1),
        geometry=_thin(coords),
    )


def fetch_route(
    origin: DestinationRecord,
    destination: DestinationRecord,
    alternatives: bool = False,
) -> RouteResult:
    """Get a road route between two records: live OSRM first, estimate fallback."""
    if not origin.has_usable_coords or not destination.has_usable_coords:
        raise ValueError(
            f"cannot route '{origin.id}' -> '{destination.id}': missing coordinates"
        )

    settings = get_settings()
    if settings.routing_enabled:
        try:
            return _fetch_osrm(origin, destination, settings, alternatives)
        except Exception as exc:  # network/parse issues degrade, never fake
            logger.warning(
                "OSRM route %s->%s failed (%s); using labelled estimate",
                origin.id,
                destination.id,
                exc,
            )
            return _estimated(origin, destination, error=str(exc))
    return _estimated(origin, destination, error="routing provider disabled")


def _osrm_url(settings, origin: DestinationRecord, destination: DestinationRecord, alternatives: bool) -> str:
    points = f"{origin.lng},{origin.lat};{destination.lng},{destination.lat}"
    query = "overview=full&geometries=geojson"
    if alternatives:
        query += "&alternatives=2"
    return f"{settings.osrm_base_url.rstrip('/')}/route/v1/driving/{points}?{query}"


def _fetch_osrm(
    origin: DestinationRecord,
    destination: DestinationRecord,
    settings,
    alternatives: bool,
) -> RouteResult:
    url = _osrm_url(settings, origin, destination, alternatives)
    response = httpx.get(
        url,
        timeout=settings.provider_timeout_seconds,
        headers={"User-Agent": "KarnatakaTravelPlanner/1.0 (research prototype)"},
    )
    response.raise_for_status()
    payload = response.json()
    routes = payload.get("routes") or []
    if not routes:
        raise RuntimeError("OSRM returned no routes")
    main = _parse_osrm_route(routes[0])
    alts = [_parse_osrm_route(r) for r in routes[1:]] if alternatives else []
    return RouteResult(
        distance_km=main.distance_km,
        duration_hours=main.duration_hours,
        geometry=main.geometry,
        alternatives=alts,
        source=OSRM_PROVIDER_NAME,
        verified=True,
    )


def _estimated(
    origin: DestinationRecord, destination: DestinationRecord, error: str | None
) -> RouteResult:
    distance = road_distance_km(origin, destination)
    return RouteResult(
        distance_km=distance,
        duration_hours=travel_hours(distance),
        geometry=[[origin.lat, origin.lng], [destination.lat, destination.lng]],
        source="estimated",
        verified=False,
        error=error,
    )


def route_between_points(
    origin: DestinationRecord, destination: DestinationRecord, alternatives: bool = False
) -> RouteResult:
    """Public alias used by discovery for arbitrary pairs (kept named by record)."""
    return fetch_route(origin, destination, alternatives=alternatives)


def detour_via(
    origin: DestinationRecord,
    via: DestinationRecord,
    destination: DestinationRecord,
    baseline_km: float,
    baseline_hours: float,
) -> tuple[float, float, bool]:
    """Road-network detour cost of inserting `via` between origin and destination.

    Returns (extra_km, extra_minutes, measured). Falls back to twice the
    straight-line deviation when the provider is unavailable — labelled as an
    estimate by `measured=False`, never as a fetched figure.
    """
    try:
        outbound = fetch_route(origin, via)
        inbound = fetch_route(via, destination)
        via_km = outbound.distance_km + inbound.distance_km
        via_hours = outbound.duration_hours + inbound.duration_hours
        extra_km = max(0.0, round(via_km - baseline_km, 1))
        extra_minutes = max(0.0, round((via_hours - baseline_hours) * 60, 5))
        measured = outbound.verified and inbound.verified
        return extra_km, extra_minutes, measured
    except Exception:
        return -1.0, -1.0, False


def estimated_detour(distance_from_route_km: float) -> tuple[float, float]:
    """Labelled estimate: out-and-back deviation from the corridor."""
    extra_km = round(distance_from_route_km * 2.0, 1)
    speed = 45.0 if extra_km < 150 else 60.0
    return extra_km, round(extra_km / speed * 60.0, 1)


def to_route_info(
    origin: DestinationRecord, destination: DestinationRecord, result: RouteResult
) -> RouteInfo:
    return RouteInfo(
        origin=_place_of(origin),
        destination=_place_of(destination),
        distance_km=result.distance_km,
        duration_hours=result.duration_hours,
        geometry=result.geometry,
        source=result.source,  # type: ignore[arg-type]
        verified=result.verified,
        provider=OSRM_PROVIDER_NAME if result.source == OSRM_PROVIDER_NAME else None,
        alternatives=result.alternatives,
        retrieved_at=_now_iso(),
    )
