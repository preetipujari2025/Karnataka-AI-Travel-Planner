"""OpenStreetMap POI access via the Overpass API (ODbL licensed data).

Used for corridor ATTRACTION discovery and FOOD-STOP discovery — Nominatim is
a geocoder, not a place-search API, so Overpass is the right source here.
Every returned record carries its source, licence and retrieval time; if the
provider is unavailable the callers degrade to local data and say so loudly
instead of inventing places.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

import httpx

from app.config import get_settings

logger = logging.getLogger("karnataka.osm")

ODBL_ATTRIBUTION = "© OpenStreetMap contributors (ODbL)"
ODBL_LICENSE = "ODbL-1.0"

# Attraction selectors: heritage sites, nature features and visitor attractions.
_ATTRACTION_SELECTORS = [
    ['tourism~"attraction|viewpoint|artwork|museum|gallery|theme_park|zoo|aquarium"'],
    ['historic~"."', '["historic"!~"yes|no"]'],
    ['natural=waterfall'],
    ['leisure~"nature_reserve|park|garden|marina"'],
    ['amenity~"place_of_worship"', '["religion"~"hindu|buddhist|jain|muslim|christian"]'],
]

_FOOD_SELECTORS = ['node["amenity"~"restaurant|cafe|fast_food|food_court"]']

CATEGORY_BY_TAG_KEY = {
    "tourism": {
        "attraction": "heritage",
        "viewpoint": "viewpoint",
        "museum": "museum",
        "gallery": "culture",
        "theme_park": "adventure",
        "zoo": "wildlife",
        "aquarium": "wildlife",
    },
    "natural": {"waterfall": "waterfall"},
    "leisure": {
        "nature_reserve": "wildlife",
        "park": "nature",
        "garden": "nature",
        "marina": "beach",
    },
    "amenity": {"place_of_worship": "spiritual"},
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _run_query(ql: str) -> list[dict]:
    """POST an Overpass QL query and return elements; raises on any failure."""
    settings = get_settings()
    if not settings.routing_enabled:
        raise RuntimeError("external providers disabled")
    timeout = min(6.0, settings.provider_timeout_seconds)
    response = httpx.post(
        settings.overpass_base_url,
        data={"data": ql},
        timeout=timeout,
        headers={"User-Agent": "KarnatakaTravelPlanner/1.0 (research prototype)"},
    )
    response.raise_for_status()
    payload = response.json()
    return [el for el in payload.get("elements", []) if el.get("type") == "node"]


def _bbox_for_circle(lat: float, lng: float, radius_km: float) -> tuple[float, float, float, float]:
    deg_lat = radius_km / 111.0
    deg_lng = radius_km / (111.0 * max(0.2, __import__("math").cos(__import__("math").radians(lat))))
    return (lat - deg_lat, lng - deg_lng, lat + deg_lat, lng + deg_lng)


def _element_to_place(el: dict, name_keys: tuple[str, ...]) -> dict | None:
    tags = el.get("tags", {})
    name = next((tags[k] for k in name_keys if tags.get(k)), None)
    if not name:
        return None
    categories: list[str] = []
    for tag_key, mapping in CATEGORY_BY_TAG_KEY.items():
        value = tags.get(tag_key)
        if value and value in mapping:
            categories.append(mapping[value])
    return {
        "osm_id": f"node/{el['id']}",
        "name": name,
        "lat": el["lat"],
        "lng": el["lon"],
        "categories": sorted(set(categories)),
        "description": tags.get("description") or tags.get("wikipedia"),
        "opening_hours": tags.get("opening_hours"),
        "cuisine": tags.get("cuisine"),
        "diet_tags": [t for k in ("diet_vegetarian", "vegetarian", "vegan") if (t := tags.get(k)) == "yes"],
        "fee": tags.get("fee"),
        "attribution": ODBL_ATTRIBUTION,
        "license": ODBL_LICENSE,
        "source_url": f"https://www.openstreetmap.org/node/{el['id']}",
        "retrieved_at": _now_iso(),
    }


def _dedupe(places: list[dict]) -> list[dict]:
    seen_ids: set[str] = set()
    seen_names: set[str] = set()
    result = []
    for place in places:
        name_key = place["name"].strip().lower()
        if place["osm_id"] in seen_ids or not name_key or name_key in seen_names:
            continue
        seen_ids.add(place["osm_id"])
        seen_names.add(name_key)
        result.append(place)
    return result


def find_attractions_around(lat: float, lng: float, radius_km: float, limit: int = 60) -> list[dict]:
    """Attraction-like OSM nodes near a point (used for corridor chunks)."""
    bbox = _bbox_for_circle(lat, lng, radius_km)
    bbox_str = ",".join(f"{v:.4f}" for v in bbox)
    parts = []
    for selectors in _ATTRACTION_SELECTORS:
        base = selectors[0]
        extra = "".join(selectors[1:]) if len(selectors) > 1 else ""
        parts.append(f'node{base}({bbox_str}){extra};')
    ql = f"[out:json][timeout:20];({''.join(parts)})out body {limit};"
    elements = _run_query(ql)
    places = [p for p in (_element_to_place(el, ("name", "tourism", "historic")) for el in elements) if p]
    return _dedupe(places)[:limit]


def find_food_stops(lat: float, lng: float, radius_km: float, limit: int = 40) -> list[dict]:
    """Restaurant / cafe / fast-food OSM nodes near a point."""
    bbox = _bbox_for_circle(lat, lng, radius_km)
    bbox_str = ",".join(f"{v:.4f}" for v in bbox)
    selector = _FOOD_SELECTORS[0]
    ql = f'[out:json][timeout:20];(node{selector}({bbox_str}););out body {limit};'
    elements = _run_query(ql)
    places = [p for p in (_element_to_place(el, ("name",)) for el in elements) if p]
    # Keep only entries with a name; cuisine/diet info flows through untouched.
    return _dedupe(places)[:limit]
