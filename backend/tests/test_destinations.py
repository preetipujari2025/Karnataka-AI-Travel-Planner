"""Tests for destination catalogue and metadata endpoints."""

from __future__ import annotations

from fastapi.testclient import TestClient


def test_list_destinations(client: TestClient) -> None:
    response = client.get("/api/v1/destinations")
    assert response.status_code == 200
    body = response.json()
    assert len(body) >= 20
    for item in body:
        assert {"id", "name", "lat", "lng", "categories"} <= set(item)


def test_filter_by_interest(client: TestClient) -> None:
    response = client.get("/api/v1/destinations", params={"interest": "beach"})
    assert response.status_code == 200
    body = response.json()
    assert body, "expected beach destinations"
    # every returned destination must carry the beach category
    assert all("beach" in item["categories"] for item in body)


def test_filter_by_region_is_case_insensitive(client: TestClient) -> None:
    response = client.get("/api/v1/destinations", params={"region": "coastal"})
    assert response.status_code == 200
    assert response.json()


def test_unknown_destination_is_404(client: TestClient) -> None:
    response = client.get("/api/v1/destinations/atlantis")
    assert response.status_code == 404


def test_meta_returns_enum_choices(client: TestClient) -> None:
    response = client.get("/api/v1/meta")
    assert response.status_code == 200
    body = response.json()
    # enums serialise as plain strings, interest metadata stays rich
    assert set(body["budget_tiers"]) == {"budget", "mid", "luxury"}
    assert set(body["paces"]) == {"relaxed", "balanced", "packed"}
    assert {i["value"] for i in body["interests"]} >= {"heritage", "beach", "wildlife"}
    assert "wildlife_safari" in body["experience_types"]
    assert body["start_cities"], "at least one start city"
    assert any(c["id"] == "bengaluru" for c in body["start_cities"])


def test_filter_by_experience(client: TestClient) -> None:
    response = client.get("/api/v1/destinations", params={"experience": "wildlife_safari"})
    assert response.status_code == 200
    body = response.json()
    assert body
    ids = {item["id"] for item in body}
    assert {"bandipur", "kabini"} <= ids


def test_search_by_name_query(client: TestClient) -> None:
    response = client.get("/api/v1/destinations", params={"q": "hampi"})
    assert response.status_code == 200
    assert [item["id"] for item in response.json()] == ["hampi"]


def test_map_only_filter(client: TestClient) -> None:
    response = client.get("/api/v1/destinations", params={"map_only": "true"})
    assert response.status_code == 200
    body = response.json()
    assert body
    assert all(item["lat"] is not None and item["lng"] is not None for item in body)


def test_nearby_endpoint_returns_distances(client: TestClient) -> None:
    response = client.get(
        "/api/v1/destinations/nearby",
        params={"lat": 12.9716, "lng": 77.5946, "limit": 3},
    )
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 3
    assert body[0]["destination"]["id"] == "bengaluru"
    distances = [item["distance_km"] for item in body]
    assert distances == sorted(distances)


def test_nearby_endpoint_rejects_bad_coordinates(client: TestClient) -> None:
    response = client.get(
        "/api/v1/destinations/nearby", params={"lat": 999, "lng": 77.0}
    )
    assert response.status_code == 422
