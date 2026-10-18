"""Tests for the canonical /api endpoints: health, destinations list/detail."""

from __future__ import annotations

from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# GET /api/health
# ---------------------------------------------------------------------------


def test_api_health_returns_status_and_version(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["version"]  # application version present
    assert isinstance(body["llm_configured"], bool)
    assert body["dataset_size"] >= 30


def test_legacy_health_still_works(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


# ---------------------------------------------------------------------------
# GET /api/destinations — filters + pagination
# ---------------------------------------------------------------------------


def test_destinations_default_page_fits_within_limit(client: TestClient) -> None:
    response = client.get("/api/destinations")
    assert response.status_code == 200
    body = response.json()
    assert len(body) >= 30
    assert len(body) <= 50  # default limit


def test_destinations_pagination_produces_disjoint_pages(client: TestClient) -> None:
    page1 = client.get("/api/destinations", params={"limit": 5, "offset": 0}).json()
    page2 = client.get("/api/destinations", params={"limit": 5, "offset": 5}).json()
    assert len(page1) == 5
    assert len(page2) == 5
    assert {d["id"] for d in page1}.isdisjoint({d["id"] for d in page2})


def test_destinations_limit_bounds_are_validated(client: TestClient) -> None:
    assert client.get("/api/destinations", params={"limit": 0}).status_code == 422
    assert client.get("/api/destinations", params={"limit": 101}).status_code == 422
    assert client.get("/api/destinations", params={"offset": -1}).status_code == 422


def test_destinations_filter_by_category(client: TestClient) -> None:
    body = client.get("/api/destinations", params={"category": "hills"}).json()
    assert body
    assert all("hills" in d["categories"] for d in body)


def test_destinations_filter_by_interest(client: TestClient) -> None:
    body = client.get("/api/destinations", params={"interest": "beach"}).json()
    assert body
    assert all("beach" in d["categories"] for d in body)


def test_destinations_filter_by_region(client: TestClient) -> None:
    body = client.get("/api/destinations", params={"region": "coastal"}).json()
    assert body
    assert all("coastal" in d["region"].lower() for d in body)


def test_destinations_search_with_q_and_search_alias(client: TestClient) -> None:
    by_q = client.get("/api/destinations", params={"q": "hampi"}).json()
    by_alias = client.get("/api/destinations", params={"search": "hampi"}).json()
    assert [d["id"] for d in by_q] == ["hampi"]
    assert by_q == by_alias


def test_destinations_search_combines_with_region(client: TestClient) -> None:
    body = client.get(
        "/api/destinations", params={"search": "a", "region": "coastal", "limit": 100}
    ).json()
    assert body
    assert all("coastal" in d["region"].lower() for d in body)


def test_legacy_v1_destinations_still_work(client: TestClient) -> None:
    legacy = client.get("/api/v1/destinations", params={"q": "hampi"}).json()
    canonical = client.get("/api/destinations", params={"q": "hampi"}).json()
    assert legacy == canonical


# ---------------------------------------------------------------------------
# GET /api/destinations/{destination_id}
# ---------------------------------------------------------------------------


def test_destination_detail_returns_full_record(client: TestClient) -> None:
    response = client.get("/api/destinations/hampi")
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == "hampi"
    assert body["district"] == "Vijayanagara"
    assert body["sources"]
    assert body["data_confidence"] == "verified"


def test_destination_detail_unknown_id_is_404_with_error_envelope(client: TestClient) -> None:
    response = client.get("/api/destinations/atlantis")
    assert response.status_code == 404
    error = response.json()["error"]
    assert error["code"] == "not_found"
    assert "atlantis" in error["message"]


def test_unknown_route_uses_error_envelope(client: TestClient) -> None:
    response = client.get("/api/definitely-not-a-route")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"
