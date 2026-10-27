"""Route-aware corridor discovery: the heart of the road-trip planner.

Given any origin -> destination pair, this service:
  1. fetches a real road route (OSRM; labelled estimate fallback),
  2. pools candidate places from the curated catalog, the attraction store
     and OpenStreetMap nodes sampled along the route corridor,
  3. measures each candidate's distance-from-route and road detour cost,
  4. scores candidates transparently and separates DISCOVERY from SELECTION —
     every candidate is returned with reasons; recommended/optional/excluded
     are labels, not hidden data.

AI is never involved here: results are grounded in stored or fetched records.
"""

from __future__ import annotations

import hashlib
import json
import logging
import math
from datetime import datetime, timezone

from app.config import get_settings
from app.data.loader import get_destination
from app.schemas import (
    DestinationRecord,
    DiscoveredStop,
    ExcludedStop,
    FieldVerification,
    Interest,
    Pace,
    RouteDiscoveryRequest,
    RouteDiscoveryResponse,
    RouteInfo,
    BudgetTier,
    TravellerType,
    TripPriority,
)
from app.data import store
from app.services import meal_discovery, places_osm, route_provider
from app.services.destination_service import catalog_destinations
from app.services.geo import project_onto_polyline
from app.services.recommendation import INTEREST_CATEGORIES

logger = logging.getLogger("karnataka.discovery")

class DiscoveryError(ValueError):
    """Raised when the request cannot be grounded in real data."""


# Category synonyms so OSM/attraction categories speak the catalog's language.
_CATEGORY_ALIASES = {
    "spiritual": "temples",
    "hills": "nature",
    "waterfall": "waterfalls",
    "viewpoint": "viewpoints",
    "museum": "culture",
    "culture": "heritage",
}

_STOPS_PER_DAY_BY_PACE = {Pace.relaxed: 2, Pace.balanced: 3, Pace.packed: 4}
_MEASURED_DETOUR_LIMIT = 3  # road-provider calls per discovery (cost & latency guard)
_ENDPOINT_PROXIMITY_KM = 8.0  # candidates essentially at origin/destination


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _cache_key(request: RouteDiscoveryRequest) -> str:
    raw = json.dumps(request.model_dump(mode="json"), sort_keys=True, default=str)
    return "discovery:" + hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]


def _resolve_place(location_id: str, label: str) -> DestinationRecord:
    clean_id = (location_id or "").strip()
    if not clean_id:
        human_label = "Start city" if "start" in label else "Final destination"
        raise DiscoveryError(f"{human_label} is required. Please choose a Karnataka city, district, or attraction.")
    record = get_destination(clean_id)
    if record is None:
        human_label = "start city" if "start" in label else "final destination"
        raise DiscoveryError(
            f"Unknown {human_label} '{clean_id}'. "
            "Please select a destination from Karnataka (e.g. Bengaluru, Mysuru, Hampi, Gokarna, Gokak Falls, Bandipur)."
        )
    if not record.has_usable_coords:
        raise DiscoveryError(f"'{record.name}' does not have geographic coordinates for routing.")
    return record


def _synthetic_record(name: str, lat: float, lng: float) -> DestinationRecord:
    """Routing-only wrapper for a non-catalog point (keeps detour measurement honest)."""
    return DestinationRecord(
        id=f"osm-{lat:.4f}-{lng:.4f}",
        name=name,
        region="route corridor",
        lat=lat,
        lng=lng,
        categories=[],
        description="",
        highlights=[],
        min_nights=1,
        typical_nights=1,
    )


# ---------------------------------------------------------------------------
# Candidate pooling
# ---------------------------------------------------------------------------


def _pool_curated(request: RouteDiscoveryRequest, origin: DestinationRecord, destination: DestinationRecord):
    pool: list[dict] = []
    for record in catalog_destinations():
        if not record.has_usable_coords or record.id in {origin.id, destination.id}:
            continue
        pool.append({
            "ref_id": record.id,
            "source_kind": "curated_destination",
            "name": record.name,
            "lat": float(record.lat),
            "lng": float(record.lng),
            "categories": list(record.categories),
            "description": record.description,
            "record": record,
            "opening_hours": None,
            "visit_minutes": None,
            "entry_fee_inr": record.entry_fees_inr,
            "entry_fee_status": (
                FieldVerification.verified
                if record.data_confidence.value == "verified" and record.entry_fees_inr is not None
                else (FieldVerification.estimated if record.entry_fees_inr is not None else FieldVerification.unknown)
            ),
            "verification_status": record.data_confidence.value,
            "source_urls": list(record.sources),
            "license": None,
            "attribution": None,
            "retrieved_at": record.last_verified_on or _now_iso(),
        })
    return pool


def _pool_stored_attractions(request: RouteDiscoveryRequest) -> list[dict]:
    pool: list[dict] = []
    if not store.is_database_populated():
        return pool
    for attraction in store.list_attractions():
        if attraction.lat is None or attraction.lng is None:
            continue
        pool.append({
            "ref_id": attraction.id,
            "source_kind": "stored_attraction",
            "name": attraction.name,
            "lat": float(attraction.lat),
            "lng": float(attraction.lng),
            "categories": list(attraction.categories),
            "description": None,
            "record": None,
            "opening_hours": attraction.opening_hours,
            "visit_minutes": attraction.typical_visit_minutes,
            "entry_fee_inr": None,
            "entry_fee_status": FieldVerification.unknown,
            "verification_status": attraction.verification_status,
            "source_urls": list(attraction.source_urls),
            "license": attraction.license,
            "attribution": attraction.attribution,
            "retrieved_at": attraction.retrieved_at or _now_iso(),
        })
    return pool


def _pool_osm(geometry: list[list[float]], request: RouteDiscoveryRequest) -> tuple[list[dict], list[str]]:
    """Sample Overpass queries along the route so long corridors get coverage."""
    warnings: list[str] = []
    if not geometry or len(geometry) < 2 or not get_settings().routing_enabled:
        return [], warnings

    route_km = 0.0
    for a, b in zip(geometry, geometry[1:]):
        route_km += _pt_km(a, b)
    chunk_km = 45.0
    chunks = max(1, min(6, int(math.ceil(route_km / chunk_km))))
    pool: list[dict] = []
    seen_ids: set[str] = set()
    failures = 0
    for index in range(chunks + 1):
        fraction = index / chunks if chunks else 0.0
        lat, lng = _point_along(geometry, fraction)
        try:
            places = places_osm.find_attractions_around(
                lat, lng, request.corridor_radius_km, limit=40
            )
        except Exception as exc:
            failures += 1
            logger.warning("OSM attraction query failed at %.2f: %s", fraction, exc)
            if failures >= 2 and not pool:
                logger.info("Aborting remaining Overpass chunks due to repeated upstream failures")
                break
            continue
        for place in places:
            if place["osm_id"] in seen_ids:
                continue
            seen_ids.add(place["osm_id"])
            pool.append({
                "ref_id": place["osm_id"],
                "source_kind": "openstreetmap",
                "name": place["name"],
                "lat": float(place["lat"]),
                "lng": float(place["lng"]),
                "categories": list(place.get("categories", [])),
                "description": place.get("description"),
                "record": None,
                "opening_hours": place.get("opening_hours"),
                "visit_minutes": None,
                "entry_fee_inr": None,
                "entry_fee_status": FieldVerification.unknown,
                "verification_status": "discovered",
                "source_urls": [place.get("source_url")] if place.get("source_url") else [],
                "license": place.get("license"),
                "attribution": place.get("attribution"),
                "retrieved_at": place.get("retrieved_at") or _now_iso(),
            })
    if failures:
        warnings.append(
            "We could not load live stops, showing our curated suggestions."
        )
    return pool, warnings


def _pt_km(a: list[float], b: list[float]) -> float:
    from app.services.routing import haversine_coords

    return haversine_coords(a[0], a[1], b[0], b[1])


def _point_along(geometry: list[list[float]], fraction: float) -> tuple[float, float]:
    from app.services.geo import point_at_progress

    return point_at_progress(geometry, fraction)


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------


def _matched_interests(candidate: dict, interests: list[Interest]) -> list[str]:
    categories = set(candidate["categories"])
    categories |= {_CATEGORY_ALIASES.get(c, c) for c in categories}
    matched = []
    for interest in interests:
        wanted = set(INTEREST_CATEGORIES.get(interest.value, []))
        wanted.add(interest.value)
        if categories & wanted:
            matched.append(interest.value)
    return matched


def _default_visit_minutes(source_kind: str, categories: list[str]) -> int:
    if "wildlife" in categories or "heritage" in categories:
        return 150
    if "nature" in categories or "spiritual" in categories:
        return 90
    return 60 if source_kind == "curated_destination" else 45


def _score_candidate(
    candidate: DiscoveredStop,
    raw: dict,
    request: RouteDiscoveryRequest,
) -> tuple[list[str], float]:
    """Transparent 0..100 score + human-readable reasons (deterministic)."""
    score = 0.0
    reasons: list[str] = []

    matched = candidate.interests_matched
    if request.interests and matched:
        ratio = len(matched) / len(request.interests)
        points = round(40.0 * ratio, 1)
        score += points
        reasons.append(f"matches {len(matched)} of {len(request.interests)} interests (+{points:g})")
    elif request.interests:
        reasons.append("no requested interests matched (+0)")

    proximity = 20.0 * max(0.0, 1.0 - candidate.distance_from_route_km / max(request.corridor_radius_km, 1.0))
    score += proximity
    reasons.append(f"{candidate.distance_from_route_km:.1f} km from the route (+{proximity:g})")

    if candidate.detour_measured:
        detour_good = 15.0 * max(0.0, 1.0 - candidate.detour_km / max(request.max_detour_km, 1.0))
        score += detour_good
        reasons.append(f"measured road detour of {candidate.detour_km:.0f} km (+{detour_good:g})")
    else:
        reasons.append("detour is a corridor estimate, not provider-measured")

    if raw["source_kind"] == "curated_destination":
        score += 10
        reasons.append("curated, source-checked destination (+10)")
    elif raw["source_kind"] == "stored_attraction":
        score += 5
        reasons.append("stored attraction record (+5)")

    if candidate.opening_hours:
        score += 4
        reasons.append("source provides opening hours (+4)")

    if candidate.entry_fee_inr is not None:
        ceiling = {BudgetTier.budget: 100, BudgetTier.mid: 500, BudgetTier.luxury: 2000}[request.budget_tier]
        if candidate.entry_fee_inr <= ceiling:
            score += 4
            reasons.append(f"entry fee ₹{candidate.entry_fee_inr} within tier expectations (+4)")
        else:
            score -= 4
            reasons.append(f"entry fee ₹{candidate.entry_fee_inr} above tier expectations (-4)")

    minutes = candidate.suggested_visit_minutes or 60
    pace_budget = {Pace.relaxed: 120, Pace.balanced: 200, Pace.packed: 300}[request.pace]
    if minutes <= pace_budget:
        score += 5
        reasons.append(f"fits a {request.pace.value} day (+5)")
    else:
        score -= 5
        reasons.append(f"long visit for a {request.pace.value} pace (-5)")

    # Trip Priority
    if request.trip_priority == TripPriority.min_cost:
        if candidate.entry_fee_inr == 0 or (candidate.entry_fee_inr is not None and candidate.entry_fee_inr <= 50):
            score += 5
            reasons.append("budget priority: zero or minimal entry fee (+5)")
        if candidate.detour_km > 20:
            score -= 5
            reasons.append("budget priority: long detour increases fuel/transport cost (-5)")
    elif request.trip_priority == TripPriority.min_travel_time:
        if candidate.distance_from_route_km <= 5.0:
            score += 6
            reasons.append("time priority: right along the main corridor (+6)")
        elif candidate.detour_km > 25:
            score -= 6
            reasons.append("time priority: excessive detour time (-6)")
    elif request.trip_priority == TripPriority.max_sightseeing:
        if len(matched) >= 2 or len(candidate.categories) >= 2:
            score += 5
            reasons.append("sightseeing priority: rich multi-attraction appeal (+5)")
        if minutes <= 90:
            score += 3
            reasons.append("sightseeing priority: compact visit length fits more stops (+3)")

    # Traveller Type
    categories = set(raw.get("categories", []))
    if request.traveller_type == TravellerType.family:
        if raw.get("record") and getattr(raw["record"], "family_friendly", None) is True:
            score += 4
            reasons.append("family-friendly certified stop (+4)")
        elif categories & {"wildlife", "nature", "heritage", "gardens", "zoo"}:
            score += 3
            reasons.append("suitable for family travelers (+3)")
    elif request.traveller_type == TravellerType.senior:
        if categories & {"spiritual", "temples", "heritage", "gardens"}:
            score += 4
            reasons.append("accessible and peaceful for senior travelers (+4)")
        if categories & {"adventure", "trekking"}:
            score -= 6
            reasons.append("strenuous activity for senior pace (-6)")
    elif request.traveller_type == TravellerType.solo:
        if categories & {"photography", "adventure", "culture", "viewpoints"}:
            score += 3
            reasons.append("great fit for solo exploration (+3)")

    return reasons, round(max(0.0, min(100.0, score)), 1)


# ---------------------------------------------------------------------------
# Main discovery
# ---------------------------------------------------------------------------


def discover_route(request: RouteDiscoveryRequest) -> RouteDiscoveryResponse:
    origin = _resolve_place(request.start_city, "start_city")
    destination = _resolve_place(request.final_destination, "final_destination")
    if origin.id == destination.id:
        raise DiscoveryError("Start city and final destination cannot be the same place. Please choose two different destinations.")

    settings = get_settings()
    cache_key = _cache_key(request)
    if not request.refresh and settings.routing_enabled:
        try:
            hit = store.cache_get(cache_key)
        except Exception:  # a broken cache must never break discovery
            hit = None
        if hit and not hit["stale"]:
            payload = RouteDiscoveryResponse.model_validate(hit["payload"])
            return payload.model_copy(update={"cached": True})

    route_result = route_provider.fetch_route(origin, destination, alternatives=True)
    route_info = route_provider.to_route_info(origin, destination, route_result)
    geometry = route_info.geometry

    warnings: list[str] = []
    if not route_info.verified:
        warnings.append(
            "Road route is a labelled local estimate (provider unavailable); "
            "distances and corridor positions are approximate."
        )

    providers = [route_info.source]
    osm_pool, osm_warnings = _pool_osm(geometry, request)
    warnings.extend(osm_warnings)
    if osm_pool:
        providers.append("overpass")
    pool = _pool_curated(request, origin, destination) + _pool_stored_attractions(request) + osm_pool
    if any(p["source_kind"] == "curated_destination" for p in pool):
        providers.append("curated-dataset")

    # --- corridor filter + dedupe ------------------------------------------
    seen_names: set[str] = set()
    for endpoint in (origin, destination):
        seen_names.add(endpoint.name.strip().lower())
    in_corridor: list[tuple[dict, float, float]] = []
    excluded: list[ExcludedStop] = []

    for raw in pool:
        distance_km, progress = project_onto_polyline(raw["lat"], raw["lng"], geometry)
        name_key = raw["name"].strip().lower()
        if name_key in seen_names:
            continue
        if distance_km > request.corridor_radius_km:
            excluded.append(_to_stop(raw, distance_km, progress, 0, 0, False, request, route_info, [],
                                      excluded_reason=f"{distance_km:.1f} km off the route "
                                      f"(corridor limit {request.corridor_radius_km:g} km)"))
            continue
        near_endpoint = _pt_km([raw["lat"], raw["lng"]], [origin.lat, origin.lng]) < _ENDPOINT_PROXIMITY_KM
        near_finish = _pt_km([raw["lat"], raw["lng"]], [destination.lat, destination.lng]) < _ENDPOINT_PROXIMITY_KM
        if near_endpoint or near_finish:
            excluded.append(_to_stop(raw, distance_km, progress, 0, 0, False, request, route_info, [],
                                      excluded_reason="too close to the start or end point to be a separate en-route stop"))
            continue
        seen_names.add(name_key)
        in_corridor.append((raw, distance_km, progress))

    # --- measured detours for the closest candidates ------------------------
    in_corridor.sort(key=lambda item: (item[1], item[0]["ref_id"]))
    measured: dict[str, tuple[float, float, bool]] = {}
    detour_failures = 0
    for raw, distance_km, _progress in in_corridor[:_MEASURED_DETOUR_LIMIT]:
        if detour_failures >= 2:
            measured[raw["ref_id"]] = (*route_provider.estimated_detour(distance_km), False)
            continue
        record = raw.get("record") or _synthetic_record(raw["name"], raw["lat"], raw["lng"])
        extra_km, extra_minutes, ok = route_provider.detour_via(
            origin, record, destination, route_info.distance_km, route_info.duration_hours
        )
        if ok and extra_km >= 0:
            measured[raw["ref_id"]] = (extra_km, extra_minutes, True)
        else:
            detour_failures += 1
            measured[raw["ref_id"]] = (*route_provider.estimated_detour(distance_km), False)

    candidates: list[DiscoveredStop] = []
    for raw, distance_km, progress in in_corridor:
        ref_id = raw["ref_id"]
        if ref_id in measured:
            detour_km, detour_minutes, was_measured = measured[ref_id]
        else:
            detour_km, detour_minutes = route_provider.estimated_detour(distance_km)
            was_measured = False

        stop = _to_stop(raw, distance_km, progress, detour_km, detour_minutes, was_measured, request, route_info, [])
        if was_measured and stop.detour_km > request.max_detour_km:
            stop = ExcludedStop(**stop.model_dump(),
                               exclusion_reason=f"measured detour of {stop.detour_km:.0f} km exceeds "
                               f"the {request.max_detour_km:g} km limit")
            excluded.append(stop)
            continue

        matched = _matched_interests(raw, request.interests)
        stop = stop.model_copy(update={"interests_matched": matched})
        reasons, score = _score_candidate(stop, raw, request)
        stop = stop.model_copy(update={"score": score, "reasons": reasons})
        candidates.append(stop)

    candidates.sort(key=lambda s: (-s.score, s.progress_fraction, s.candidate_id))

    # --- recommended set sized by pace (selection is the traveller's job) ----
    max_recommended = _STOPS_PER_DAY_BY_PACE[request.pace] * request.days
    recommended_ids = {s.candidate_id for s in candidates[:max_recommended]}
    final_candidates: list[DiscoveredStop] = []
    for stop in candidates:
        is_recommended = stop.candidate_id in recommended_ids
        day = min(request.days, max(1, math.ceil(stop.progress_fraction * request.days - 1e-9)))
        final_candidates.append(stop.model_copy(update={
            "recommended": is_recommended,
            "default_selected": is_recommended,
            "suggested_day": day,
            "segment_label": f"Day {day} of {request.days}",
        }))
        if is_recommended:
            continue

    optional = [s for s in final_candidates if not s.recommended]

    # --- meals ---------------------------------------------------------------
    meal_stops: list = []
    if request.include_meals:
        meal_stops, meal_warnings = meal_discovery.discover_meals(geometry, request)
        warnings.extend(meal_warnings)
        if meal_stops:
            providers.append("overpass:food")

    coverage = _coverage_note(route_info, final_candidates, osm_pool, request)
    response = RouteDiscoveryResponse(
        discovery_id="disc-" + hashlib.sha256(cache_key.encode()).hexdigest()[:12],
        request=request,
        route=route_info,
        candidates=final_candidates,
        recommended=[s for s in final_candidates if s.recommended],
        optional_stops=optional,
        excluded=excluded,
        meal_stops=meal_stops,
        coverage_note=coverage,
        providers=sorted(set(providers)),
        cached=False,
        retrieved_at=_now_iso(),
        warnings=warnings,
    )

    if settings.routing_enabled:
        try:
            store.cache_put(
                cache_key, "discovery", origin.id, destination.id,
                response.model_dump(mode="json"), settings.route_cache_ttl_seconds,
            )
        except Exception as exc:
            logger.warning("discovery cache write failed: %s", exc)

    return response


def _to_stop(
    raw: dict,
    distance_km: float,
    progress: float,
    detour_km: float,
    detour_minutes: float,
    was_measured: bool,
    request: RouteDiscoveryRequest,
    route_info: RouteInfo,
    _reasons: list[str],
    excluded_reason: str | None = None,
):
    visit_minutes = raw.get("visit_minutes")
    opening_hours = raw.get("opening_hours")
    common = {
        "candidate_id": f"{raw['source_kind']}:{raw['ref_id']}",
        "ref_id": raw["ref_id"],
        "source_kind": raw["source_kind"],
        "name": raw["name"],
        "categories": raw["categories"],
        "description": raw.get("description"),
        "lat": raw["lat"],
        "lng": raw["lng"],
        "distance_from_route_km": round(distance_km, 2),
        "detour_km": round(max(0.0, detour_km), 1),
        "detour_minutes": round(max(0.0, detour_minutes), 1),
        "detour_measured": was_measured,
        "progress_fraction": round(progress, 4),
        "suggested_visit_minutes": visit_minutes,
        "visit_duration_status": (
            FieldVerification.verified if visit_minutes else FieldVerification.estimated
        ),
        "entry_fee_inr": raw.get("entry_fee_inr"),
        "entry_fee_status": raw.get("entry_fee_status", FieldVerification.unknown),
        "opening_hours": opening_hours,
        "opening_hours_status": (
            FieldVerification.verified if opening_hours else FieldVerification.unknown
        ),
        "verification_status": raw.get("verification_status", "discovered"),
        "source_urls": raw.get("source_urls", []),
        "license": raw.get("license"),
        "attribution": raw.get("attribution"),
        "retrieved_at": raw.get("retrieved_at") or _now_iso(),
        "score": 0.0,
    }
    if excluded_reason is not None:
        return ExcludedStop(**common, exclusion_reason=excluded_reason)
    return DiscoveredStop(**common)


def _coverage_note(
    route_info: RouteInfo,
    candidates: list[DiscoveredStop],
    osm_pool: list[dict],
    request: RouteDiscoveryRequest,
) -> str:
    live = route_info.verified and bool(osm_pool)
    parts = [
        f"Route from {route_info.source}." if route_info.verified
        else "Route is a labelled estimate (OSRM unavailable or disabled).",
        f"{len(candidates)} in-corridor candidates from curated catalog, stored attractions"
        f"{' and live OpenStreetMap sampling' if osm_pool else ' (live OSM sampling contributed none)'}.",
    ]
    if live:
        parts.append(
            f"Corridor searched within {request.corridor_radius_km:g} km of the road geometry; "
            "detours for the nearest candidates were measured on the road network."
        )
    else:
        parts.append(
            "Coverage is limited to locally stored data in this run — real-world attractions "
            "along the corridor may be missing."
        )
    return " ".join(parts)


def get_or_discover(request: RouteDiscoveryRequest) -> RouteDiscoveryResponse:
    """Entry used by the plan endpoint: reuses fresh cache, rediscovers otherwise."""
    return discover_route(request)
