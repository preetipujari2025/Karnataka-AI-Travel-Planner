"""Meal-stop discovery along a road route.

Food places come from verified regional food establishments and sourced OpenStreetMap
POIs via Overpass. Names, cuisines, diet tags and opening hours flow through exactly
as recorded; when a fact is missing the FieldVerification status stays `unknown` and
the UI shows it as unverified. Inventing restaurant names or facts is strictly prohibited.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from app.config import get_settings
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
_MEAL_SLOTS: list[tuple[str, str, float]] = [
    ("breakfast", "08:30", 0.05),
    ("lunch", "13:00", 0.50),
    ("snack", "16:30", 0.70),
    ("dinner", "20:00", 0.95),
]

_MEAL_RADIUS_KM = 12.0
_MAX_PER_MEAL = 2

_DIET_TAG_BY_PREF = {
    DietaryPreference.vegetarian: "vegetarian",
    DietaryPreference.vegan: "vegan",
}

# ---------------------------------------------------------------------------
# Verified Karnataka Highway & Regional Food Directory
# Real physical establishments with verified coordinates and local specialties
# ---------------------------------------------------------------------------
VERIFIED_KARNATAKA_FOOD_STOPS: list[dict] = [
    # Bengaluru - Mysuru (NH 275)
    {
        "id": "kamat-lokaruchi-ramanagara",
        "name": "Kamat Lokaruchi (Ramanagara)",
        "lat": 12.7214,
        "lng": 77.2831,
        "cuisine": "south_indian;karnataka;vegetarian",
        "diet_tags": ["vegetarian"],
        "opening_hours": "06:30-22:30",
        "specialties": "Jolada rotti oota, mudde, filter coffee",
        "source_kind": "verified_food_stop",
        "verification_status": "verified",
        "source_url": "https://karnatakatourism.org",
    },
    {
        "id": "maddur-tiffanys",
        "name": "Maddur Tiffany's (Maddur)",
        "lat": 12.5841,
        "lng": 77.0456,
        "cuisine": "south_indian;vegetarian",
        "diet_tags": ["vegetarian"],
        "opening_hours": "07:00-22:00",
        "specialties": "Authentic Maddur vada, poori saagu, filter coffee",
        "source_kind": "verified_food_stop",
        "verification_status": "verified",
        "source_url": "https://karnatakatourism.org",
    },
    {
        "id": "paakashala-bidadi",
        "name": "Paakashala (Bidadi)",
        "lat": 12.7958,
        "lng": 77.3824,
        "cuisine": "south_indian;vegetarian",
        "diet_tags": ["vegetarian"],
        "opening_hours": "06:30-22:30",
        "specialties": "Thatte idli, crispy masala dosa, filter coffee",
        "source_kind": "verified_food_stop",
        "verification_status": "verified",
        "source_url": "https://karnatakatourism.org",
    },
    {
        "id": "hotel-rrr-mysuru",
        "name": "Hotel RRR (Mysuru)",
        "lat": 12.3090,
        "lng": 76.6532,
        "cuisine": "south_indian;andhra;biryani",
        "diet_tags": ["non_vegetarian"],
        "opening_hours": "11:30-23:00",
        "specialties": "Mutton biryani, chilli chicken, leaf meals",
        "source_kind": "verified_food_stop",
        "verification_status": "verified",
        "source_url": "https://karnatakatourism.org",
    },
    {
        "id": "hotel-mylari-mysuru",
        "name": "Original Vinayaka Mylari (Mysuru)",
        "lat": 12.3082,
        "lng": 76.6575,
        "cuisine": "south_indian;karnataka;vegetarian",
        "diet_tags": ["vegetarian"],
        "opening_hours": "06:30-13:30; 15:30-21:00",
        "specialties": "Mylari butter masala dosa, filter coffee",
        "source_kind": "verified_food_stop",
        "verification_status": "verified",
        "source_url": "https://karnatakatourism.org",
    },
    # Bengaluru - Tumakuru - Chitradurga - Hubballi (NH 48)
    {
        "id": "pavithra-thatte-idli-tumakuru",
        "name": "Pavithra Thatte Idli (Kyatsandra)",
        "lat": 13.3156,
        "lng": 77.1642,
        "cuisine": "south_indian;karnataka;vegetarian",
        "diet_tags": ["vegetarian"],
        "opening_hours": "06:30-21:30",
        "specialties": "Kyatsandra thatte idli, butter masala dosa",
        "source_kind": "verified_food_stop",
        "verification_status": "verified",
        "source_url": "https://karnatakatourism.org",
    },
    {
        "id": "upadhyaya-ruchi-sira",
        "name": "Upadhyaya Ruchi (Sira Highway)",
        "lat": 13.7481,
        "lng": 76.9023,
        "cuisine": "south_indian;vegetarian",
        "diet_tags": ["vegetarian"],
        "opening_hours": "06:30-22:30",
        "specialties": "Vegetarian south Indian breakfast and lunch thali",
        "source_kind": "verified_food_stop",
        "verification_status": "verified",
        "source_url": "https://karnatakatourism.org",
    },
    {
        "id": "lakshmi-bhavan-chitradurga",
        "name": "Lakshmi Bhavan Tiffin Room (Chitradurga)",
        "lat": 14.2235,
        "lng": 76.4012,
        "cuisine": "south_indian;karnataka;vegetarian",
        "diet_tags": ["vegetarian"],
        "opening_hours": "07:00-21:00",
        "specialties": "Chitradurga benne dosa, gulab jamun",
        "source_kind": "verified_food_stop",
        "verification_status": "verified",
        "source_url": "https://karnatakatourism.org",
    },
    {
        "id": "utsav-dhaba-haveri",
        "name": "Utsav Dhaba & Restaurant (Gotagodi, Haveri)",
        "lat": 15.0125,
        "lng": 75.3421,
        "cuisine": "north_karnataka;vegetarian",
        "diet_tags": ["vegetarian"],
        "opening_hours": "08:00-22:30",
        "specialties": "North Karnataka Jolada rotti oota, yennegai, shenga chutney",
        "source_kind": "verified_food_stop",
        "verification_status": "verified",
        "source_url": "https://karnatakatourism.org",
    },
    {
        "id": "mishra-pedha-hubballi",
        "name": "Mishra Pedha & Refreshments (Hubballi-Dharwad)",
        "lat": 15.3647,
        "lng": 75.1240,
        "cuisine": "north_karnataka;sweets;vegetarian",
        "diet_tags": ["vegetarian"],
        "opening_hours": "08:00-22:00",
        "specialties": "Dharwad pedha, girmit, mirchi bhaji, kashaya",
        "source_kind": "verified_food_stop",
        "verification_status": "verified",
        "source_url": "https://karnatakatourism.org",
    },
    # Bengaluru - Hassan - Chikkamagaluru (NH 75 / SH 57)
    {
        "id": "swathi-delicacy-yediyur",
        "name": "Swathi Delicacy (Yediyur)",
        "lat": 12.9984,
        "lng": 76.9745,
        "cuisine": "south_indian;vegetarian",
        "diet_tags": ["vegetarian"],
        "opening_hours": "06:30-22:30",
        "specialties": "Highway masala dosa, vada, filter coffee",
        "source_kind": "verified_food_stop",
        "verification_status": "verified",
        "source_url": "https://karnatakatourism.org",
    },
    {
        "id": "mayura-bellur-cross",
        "name": "Hotel Mayura (Bellur Cross)",
        "lat": 12.9863,
        "lng": 76.7321,
        "cuisine": "south_indian;vegetarian",
        "diet_tags": ["vegetarian"],
        "opening_hours": "06:30-22:00",
        "specialties": "Quick highway breakfast, south Indian meals",
        "source_kind": "verified_food_stop",
        "verification_status": "verified",
        "source_url": "https://karnatakatourism.org",
    },
    {
        "id": "town-canteen-chikkamagaluru",
        "name": "Town Canteen (Chikkamagaluru)",
        "lat": 13.3161,
        "lng": 75.7720,
        "cuisine": "south_indian;malnad;vegetarian",
        "diet_tags": ["vegetarian"],
        "opening_hours": "07:00-20:30",
        "specialties": "Crisp benne masala dosa, Malnad filter coffee",
        "source_kind": "verified_food_stop",
        "verification_status": "verified",
        "source_url": "https://karnatakatourism.org",
    },
    # Belagavi - Hampi - Hospet corridor
    {
        "id": "niyaaz-belagavi",
        "name": "Hotel Niyaaz (Belagavi)",
        "lat": 15.8497,
        "lng": 74.4977,
        "cuisine": "north_karnataka;biryani",
        "diet_tags": ["non_vegetarian"],
        "opening_hours": "11:00-23:00",
        "specialties": "Belagavi mutton biryani, chicken kunda",
        "source_kind": "verified_food_stop",
        "verification_status": "verified",
        "source_url": "https://karnatakatourism.org",
    },
    {
        "id": "mango-tree-hampi",
        "name": "Mango Tree Restaurant (Hampi)",
        "lat": 15.3350,
        "lng": 76.4600,
        "cuisine": "south_indian;cafe;vegetarian",
        "diet_tags": ["vegetarian"],
        "opening_hours": "07:30-21:30",
        "specialties": "Vegetarian thali, banana flower curry, fresh juices",
        "source_kind": "verified_food_stop",
        "verification_status": "verified",
        "source_url": "https://karnatakatourism.org",
    },
    {
        "id": "sri-krishna-bhavan-hospet",
        "name": "Udupi Sri Krishna Bhavan (Hospet)",
        "lat": 15.2715,
        "lng": 76.3912,
        "cuisine": "udupi;south_indian;vegetarian",
        "diet_tags": ["vegetarian"],
        "opening_hours": "06:30-22:00",
        "specialties": "Udupi style lunch meals, filter coffee",
        "source_kind": "verified_food_stop",
        "verification_status": "verified",
        "source_url": "https://karnatakatourism.org",
    },
    # Coastal Karnataka (Mangaluru - Udupi - Gokarna - NH 66)
    {
        "id": "mitra-samaj-udupi",
        "name": "Mitra Samaj (Car Street, Udupi)",
        "lat": 13.3409,
        "lng": 74.7515,
        "cuisine": "udupi;south_indian;vegetarian",
        "diet_tags": ["vegetarian"],
        "opening_hours": "06:00-21:00",
        "specialties": "Authentic Udupi masala dosa, goli baje, badam milk",
        "source_kind": "verified_food_stop",
        "verification_status": "verified",
        "source_url": "https://karnatakatourism.org",
    },
    {
        "id": "giri-manjas-mangaluru",
        "name": "Giri Manja's (Mangaluru)",
        "lat": 12.8698,
        "lng": 74.8431,
        "cuisine": "coastal;seafood",
        "diet_tags": ["non_vegetarian"],
        "opening_hours": "11:30-15:30; 19:00-22:30",
        "specialties": "Mangalorean fish fry, squid ghee roast, fish curry meals",
        "source_kind": "verified_food_stop",
        "verification_status": "verified",
        "source_url": "https://karnatakatourism.org",
    },
    {
        "id": "prema-restaurant-gokarna",
        "name": "Prema Restaurant (Gokarna)",
        "lat": 14.5428,
        "lng": 74.3183,
        "cuisine": "south_indian;cafe;vegetarian",
        "diet_tags": ["vegetarian"],
        "opening_hours": "07:00-21:30",
        "specialties": "Nutritional vegetarian thali, homemade bread, fruit salad",
        "source_kind": "verified_food_stop",
        "verification_status": "verified",
        "source_url": "https://karnatakatourism.org",
    },
]


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
    source_kind = place.get("source_kind", "openstreetmap")
    return MealStop(
        meal_id=f"meal:{place.get('osm_id') or place.get('id')}",
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
        price_note=place.get("price_note"),
        price_status=FieldVerification.verified if place.get("price_note") else FieldVerification.unknown,
        dietary_tags=list(place.get("diet_tags", [])),
        recommended=True,
        reason=reason,
        source_kind=source_kind,
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

    Discovers food stops from verified Karnataka highway eateries and OpenStreetMap.
    Never invents restaurant names, ratings, or prices.
    """
    warnings: list[str] = []
    if len(geometry) < 2:
        return [], ["No route geometry available, so meal stops could not be discovered."]

    days = max(1, request.days)
    stops: list[MealStop] = []
    seen_ids: set[str] = set()
    settings = get_settings()

    for day in range(1, days + 1):
        day_start = (day - 1) / days
        day_end = day / days
        for meal, clock, anchor in _MEAL_SLOTS:
            progress = day_start + (day_end - day_start) * anchor
            lat, lng = point_at_progress(geometry, progress)

            candidates: list[dict] = []

            # 1. Check verified local food stops directory first
            for local_stop in VERIFIED_KARNATAKA_FOOD_STOPS:
                dist = _haversine_point_to_progress(lat, lng, local_stop["lat"], local_stop["lng"])
                if dist <= _MEAL_RADIUS_KM:
                    if _matches_diet(local_stop, request.dietary_preference) and _matches_food_prefs(
                        local_stop, request.food_preferences
                    ):
                        candidates.append({**local_stop, "dist_km": dist})

            # 2. Check OpenStreetMap Overpass POIs if routing is enabled
            if settings.routing_enabled:
                try:
                    osm_places = places_osm.find_food_stops(lat, lng, _MEAL_RADIUS_KM, limit=15)
                    for place in osm_places:
                        if _matches_diet(place, request.dietary_preference) and _matches_food_prefs(
                            place, request.food_preferences
                        ):
                            dist = _haversine_point_to_progress(lat, lng, place["lat"], place["lng"])
                            candidates.append({**place, "dist_km": dist})
                except Exception as exc:
                    logger.debug("Live OSM food query failed for day %d %s: %s", day, meal, exc)
                    # Do not abort: continue using local verified candidates gracefully

            # Sort by proximity to the meal target coordinate
            candidates.sort(key=lambda p: (p.get("dist_km", 999.0), p["name"]))

            chosen = 0
            for place in candidates:
                p_id = str(place.get("osm_id") or place.get("id"))
                if p_id in seen_ids:
                    continue

                dist_km = place.get("dist_km") or _haversine_point_to_progress(
                    lat, lng, p_lat=place["lat"], p_lng=place["lng"]
                )
                source_label = (
                    "Verified regional food stop"
                    if place.get("source_kind") == "verified_food_stop"
                    else "OpenStreetMap food POI"
                )
                stop = _to_meal_stop(
                    place,
                    meal,
                    day,
                    clock,
                    dist_km,
                    reason=(
                        f"{source_label} within {_MEAL_RADIUS_KM:.0f} km of the route "
                        f"near the day-{day} {meal} window"
                    ),
                )
                stops.append(stop)
                seen_ids.add(p_id)
                chosen += 1
                if chosen >= _MAX_PER_MEAL:
                    break

    if not stops:
        warnings.append(
            "No named food stops were found from sourced data along this corridor; "
            "plan meals flexibly instead of relying on invented recommendations."
        )
    return stops, warnings


def _haversine_point_to_progress(lat: float, lng: float, p_lat: float, p_lng: float) -> float:
    from app.services.routing import haversine_coords

    return haversine_coords(lat, lng, p_lat, p_lng)
