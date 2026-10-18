"""Destination service tests: lookup, filtering, search, nearby, map readiness."""

from __future__ import annotations

import pytest

from app.schemas import ExperienceType, Interest
from app.services import destination_service as service
from app.services.routing import haversine_coords


# ---------------------------------------------------------------------------
# Lookup
# ---------------------------------------------------------------------------


def test_get_by_id_finds_known_destination() -> None:
    assert service.get_by_id("hampi") is not None


def test_get_by_id_is_case_insensitive() -> None:
    assert service.get_by_id("HAMPI") is not None


def test_get_by_id_returns_none_for_unknown() -> None:
    assert service.get_by_id("atlantis") is None


# ---------------------------------------------------------------------------
# Filtering
# ---------------------------------------------------------------------------


def test_filter_by_region_is_case_insensitive() -> None:
    results = service.filter_destinations(region="coastal")
    assert results
    assert all("coastal" in d.region.lower() for d in results)


def test_filter_by_interest_maps_to_categories() -> None:
    results = service.filter_destinations(interest=Interest.beach)
    assert results
    assert all(
        any(c in ("beach",) for c in d.categories) for d in results
    )


def test_filter_by_experience_type() -> None:
    results = service.filter_destinations(experience=ExperienceType.wildlife_safari)
    ids = {d.id for d in results}
    assert "bandipur" in ids
    assert "kabini" in ids
    assert results
    assert all(ExperienceType.wildlife_safari in d.experience_types for d in results)


def test_filter_by_plain_category() -> None:
    results = service.filter_destinations(category="hills")
    assert results
    assert all("hills" in d.categories for d in results)


def test_combined_filters_narrow_results() -> None:
    coastal = service.filter_destinations(region="coastal")
    coastal_spiritual = service.filter_destinations(
        region="coastal", experience=ExperienceType.pilgrimage
    )
    assert coastal_spiritual
    assert len(coastal_spiritual) < len(coastal)
    assert all(ExperienceType.pilgrimage in d.experience_types for d in coastal_spiritual)


def test_map_only_returns_exclusively_map_ready_records() -> None:
    results = service.filter_destinations(map_only=True)
    assert results
    assert all(d.is_map_ready and d.has_usable_coords for d in results)


# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------


def test_search_finds_exact_name_case_insensitively() -> None:
    results = service.search_by_name("BENGALURU")
    assert [d.id for d in results][:1] == ["bengaluru"]


def test_search_prefix_matching_ranks_first() -> None:
    results = service.search_by_name("mys")
    assert results
    assert results[0].id == "mysuru"


def test_search_matches_substrings() -> None:
    results = service.search_by_name("coorg")
    assert any(d.id == "madikeri" for d in results)


def test_search_respects_limit() -> None:
    results = service.search_by_name("a", limit=3)
    assert len(results) <= 3


def test_search_empty_query_returns_nothing() -> None:
    assert service.search_by_name("   ") == []


def test_search_unknown_term_returns_nothing() -> None:
    assert service.search_by_name("zzzz-not-a-place") == []


# ---------------------------------------------------------------------------
# Nearby
# ---------------------------------------------------------------------------


def test_nearby_returns_sorted_distinct_results() -> None:
    # Bengaluru city centre
    results = service.nearby(12.9716, 77.5946, limit=5)
    assert len(results) == 5
    distances = [r.distance_km for r in results]
    assert distances == sorted(distances)
    assert distances[0] < distances[-1]
    ids = [r.destination.id for r in results]
    assert ids[0] == "bengaluru", "the query point's own city should be nearest"


def test_nearby_is_deterministic() -> None:
    first = service.nearby(12.9716, 77.5946, limit=5)
    second = service.nearby(12.9716, 77.5946, limit=5)
    assert [r.destination.id for r in first] == [r.destination.id for r in second]
    assert [r.distance_km for r in first] == [r.distance_km for r in second]


def test_nearby_max_km_caps_radius() -> None:
    results = service.nearby(12.9716, 77.5946, limit=25, max_km=60)
    assert results
    assert all(r.distance_km <= 60 for r in results)


def test_nearby_skips_destinations_without_coordinates(monkeypatch) -> None:
    import app.data.loader as loader
    from app.schemas import DestinationRecord

    no_coords = DestinationRecord.model_validate(
        {
            "id": "nowhere-ville",
            "name": "Nowhere Ville",
            "region": "South Karnataka",
            "categories": ["nature"],
            "description": "Missing coordinates on purpose.",
            "highlights": ["Void"],
            "best_months": [1],
            "min_nights": 1,
            "typical_nights": 1,
            "daily_cost_inr": {"budget": 1, "mid": 2, "luxury": 3},
        }
    )
    monkeypatch.setattr(
        "app.services.destination_service.all_destinations",
        lambda: [*loader.all_destinations(), no_coords],
    )
    results = service.nearby(12.9716, 77.5946, limit=100)
    assert all(r.destination.id != "nowhere-ville" for r in results)


def test_nearby_rejects_invalid_coordinates() -> None:
    with pytest.raises(ValueError):
        service.nearby(120.0, 77.0)
    with pytest.raises(ValueError):
        service.nearby(12.0, 500.0)


def test_nearby_rejects_bad_limit() -> None:
    with pytest.raises(ValueError):
        service.nearby(12.97, 77.59, limit=0)


def test_haversine_matches_known_scale() -> None:
    # Bengaluru -> Mysuru is roughly 120-150 km by road factor in routing; raw
    # great-circle should be ~110 km.
    distance = haversine_coords(12.9716, 77.5946, 12.3086, 76.6531)
    assert 90 <= distance <= 130


# ---------------------------------------------------------------------------
# Map readiness / validity
# ---------------------------------------------------------------------------


def test_map_ready_destinations_all_have_valid_coordinates() -> None:
    results = service.map_ready_destinations()
    assert len(results) >= 30
    for destination in results:
        assert destination.is_map_ready
        assert destination.lat is not None and destination.lng is not None


def test_valid_destinations_matches_loader() -> None:
    assert len(service.valid_destinations()) == len(service.all_destinations())
