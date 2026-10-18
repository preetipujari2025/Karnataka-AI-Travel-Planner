"""Meal-stop discovery along a road route.

Food places come ONLY from sourced records (OpenStreetMap POIs via Overpass).
Names, cuisines, diet tags and opening hours flow through exactly as the
source provides them; when a fact is missing the FieldVerification status
stays `unknown` and the UI shows it as unverified. If the provider is down we
return no meal stops plus a warning — inventing restaurant names is forbidden.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from app.schemas import (
    DietaryPreference,
    FieldVerification,
    MealStop,
    RouteDiscoveryRequest,
)
from app.services import places_osm
from app.services.geo import point_at_progress
from app.services.route_provider import estimated_detour

logger = logging.getLogger("karnataka.meals")

# (meal, target clock time, route-progress anchor per trip day)
# Anchors are fractions of the day's route-coverage window.
_MEAL_SLOTS: list[tuple[str, str, float]] = [
    ("breakfast", "08:30", 0.05),
    ("lunch", "13:00", 0.50),
    ("snack", "16:30", 0.70),
    ("dinner", "20:00", 0.95),
]

_MEAL_RADIUS_KM = 10.0
_MAX_PER_MEAL = 2

_DIET_TAG_BY_PREF = {
    DietaryPreference.vegetarian: "vegetarian",
    DietaryPreference.vegan: "vegan",
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _matches_diet(place: dict, preference: DietaryPreference) -> bool:
    if preference is DietaryPreference.no_preference:
        return True
    if preference is DietaryPreference.non_vegetarian:
        return True  # any place qualifies; non-veg availability is shown from tags
    tag = _DIET_TAG_BY_PREF.get(preference)
    if tag is None:  # jain: no reliable source tag -> do not filter on it
        return True
    return tag in [t.lower() for t in place.get("diet_tags", [])]


def _matches_food_prefs(place: dict, food_preferences: list[str]) -> bool:
    if not food_preferences:
        return True
    cuisine = (place.get("cuisine") or "").lower()
    if not cuisine:
        return True  # unknown cuisine is not a mismatch
    return any(pref.split("_")[0] in cuisine or cuisine in pref for pref in food_preferences)


def _to_meal_stop(
    place: dict,
    meal: str,
    day: int,
    arrival: str,
    distance_from_route_km: float,
    reason: str,
) -> MealStop:
    detour_km, detour_minutes = estimated_detour(distance_from_route_km)
    opening_hours = place.get("opening_hours")
    cuisine = place.get("cuisine")
    return MealStop(
        meal_id=f"meal:{place['osm_id']}",
        meal=meal,  # type: ignore[arg-type]
        day=day,
        name=place["name"],
        lat=float(place["lat"]),
        lng=float(place["lng"]),
        cuisine_tags=[c.strip() for c in cuisine.split(";")] if cuisine else [],
        distance_from_route_km=round(distance_from_route_km, 2),
        detour_km=detour_km,
        detour_minutes=detour_minutes,
        expected_arrival=arrival,
        opening_hours=opening_hours,
        opening_hours_status=(
            FieldVerification.verified if opening_hours else FieldVerification.unknown
        ),
        price_note=None,  # OSM carries no reliable pricing; never invent one
        price_status=FieldVerification.unknown,
        dietary_tags=list(place.get("diet_tags", [])),
        recommended=True,
        reason=reason,
        source_kind="openstreetmap",
        verification_status=place.get("verification_status", "discovered"),
        source_urls=[place["source_url"]] if place.get("source_url") else [],
        license=place.get("license"),
        attribution=place.get("attribution"),
        retrieved_at=place.get("retrieved_at") or _now_iso(),
    )


def discover_meals(
    geometry: list[list[float]],
    request: RouteDiscoveryRequest,
) -> tuple[list[MealStop], list[str]]:
    """Sourced meal stops for every trip day along the route geometry.

    Returns (meal_stops, warnings). Empty results with a warning is the
    honest outcome when the food provider has no data for the corridor.
    """
    warnings: list[str] = []
    if len(geometry) < 2:
        return [], ["No route geometry available, so meal stops could not be discovered."]

    days = max(1, request.days)
    stops: list[MealStop] = []
    seen_osm_ids: set[str] = set()

    for day in range(1, days + 1):
        day_start = (day - 1) / days
        day_end = day / days
        for meal, clock, anchor in _MEAL_SLOTS:
            progress = day_start + (day_end - day_start) * anchor
            lat, lng = point_at_progress(geometry, progress)
            try:
                places = places_osm.find_food_stops(lat, lng, _MEAL_RADIUS_KM, limit=20)
            except Exception as exc:
                logger.warning("food discovery failed for day %d %s: %s", day, meal, exc)
                warnings.append(
                    f"Meal discovery via OpenStreetMap was unavailable for day {day} "
                    "({exc.__class__.__name__}); no restaurant names were invented."
                )
                return stops, warnings
            candidates = [p for p in places if _matches_diet(p, request.dietary_preference)
                          and _matches_food_prefs(p, request.food_preferences)]
            candidates.sort(key=lambda p: (
                abs(((p["lat"] - lat) ** 2 + (p["lng"] - lng) ** 2) ** 0.5), p["name"]
            ))
            chosen = 0
            for place in candidates:
                if place["osm_id"] in seen_osm_ids:
                    continue
                dist_km = _haversine_point_to_progress(lat, lng, p_lat=place["lat"], p_lng=place["lng"])
                stop = _to_meal_stop(
                    place,
                    meal,
                    day,
                    clock,
                    dist_km,
                    reason=(
                        f"OpenStreetMap food POI within {_MEAL_RADIUS_KM:.0f} km of the route "
                        f"near the day-{day} {meal} window"
                    ),
                )
                stops.append(stop)
                seen_osm_ids.add(place["osm_id"])
                chosen += 1
                if chosen >= _MAX_PER_MEAL:
                    break

    if not stops:
        warnings.append(
            "No named food stops were found from sourced OpenStreetMap data along this "
            "corridor; plan meals flexibly instead of relying on invented recommendations."
        )
    return stops, warnings


def _haversine_point_to_progress(lat: float, lng: float, p_lat: float, p_lng: float) -> float:
    from app.services.routing import haversine_coords

    return haversine_coords(lat, lng, p_lat, p_lng)
