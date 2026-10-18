"""Tests for SQLite database store, data ingestion pipeline, and expanded catalog."""

from __future__ import annotations

import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.data import store
from app.ingest import normalizer, pipeline, sources
from app.schemas import District, RecordClass


@pytest.fixture
def temp_db():
    with tempfile.TemporaryDirectory() as tmpdir:
        db_file = Path(tmpdir) / "test_tourism.db"
        yield db_file


def test_store_init_and_seeding(temp_db):
    assert not store.is_database_populated(db_path=temp_db)
    store.seed_base_catalog(db_path=temp_db)
    assert store.is_database_populated(db_path=temp_db)

    counts = store.get_counts(db_path=temp_db)
    assert counts["districts"] == 31
    assert counts["destinations"] == 38
    assert counts["attractions"] == 0


def test_store_safe_upsert_preserves_curated(temp_db):
    store.seed_base_catalog(db_path=temp_db)
    bengaluru = store.get_destination("bengaluru", db_path=temp_db)
    assert bengaluru is not None
    original_description = bengaluru.description
    assert bengaluru.record_class == RecordClass.curated

    # Attempt to upsert with modified description as imported record
    modified = bengaluru.model_copy(
        update={
            "description": "SHOULD_NOT_OVERWRITE",
            "record_class": RecordClass.imported,
            "sources": [*bengaluru.sources, "https://example.com/extra-source"],
        }
    )
    is_new = store.upsert_destination(modified, preserve_curated=True, db_path=temp_db)
    assert not is_new  # updated existing

    checked = store.get_destination("bengaluru", db_path=temp_db)
    assert checked.description == original_description  # Curated editorial text preserved!
    assert "https://example.com/extra-source" in checked.sources  # Source safely merged!


def test_pipeline_ingestion_and_idempotency(temp_db):
    store.seed_base_catalog(db_path=temp_db)
    initial_counts = store.get_counts(db_path=temp_db)
    assert initial_counts["destinations"] == 38

    # First run
    result1 = pipeline.run_pipeline(db_path=temp_db)
    assert result1["total_destinations"] == 67
    assert result1["total_attractions"] == 32
    assert result1["total_districts"] == 31

    # Second run (proves idempotency and zero duplicate creation)
    result2 = pipeline.run_pipeline(db_path=temp_db)
    assert result2["total_destinations"] == 67
    assert result2["total_attractions"] == 32
    assert result2["inserted_destinations"] == 0  # No redundant records added!


def test_coverage_reaches_all_31_districts(temp_db):
    pipeline.run_pipeline(db_path=temp_db)
    coverage = store.get_district_coverage(db_path=temp_db)
    assert len(coverage) == 31

    zero_coverage = [c for c in coverage if c.destination_count == 0]
    assert len(zero_coverage) == 0, f"Expected 0 uncovered districts, found {len(zero_coverage)}"

    chitradurga = next((c for c in coverage if c.district_id == "chitradurga"), None)
    assert chitradurga is not None
    assert chitradurga.destination_count >= 2
    assert "fort" in chitradurga.categories or "heritage" in chitradurga.categories


def test_normalizer_validates_karnataka_bounds():
    assert normalizer.is_within_karnataka(12.97, 77.59)  # Bengaluru -> True
    assert normalizer.is_within_karnataka(15.15, 76.92)  # Ballari -> True
    assert not normalizer.is_within_karnataka(28.61, 77.20)  # Delhi -> False
    assert not normalizer.is_within_karnataka(None, 77.59)  # None -> False


def test_normalizer_spatial_deduplication():
    existing = [(15.148, 76.924, "ballari-fort")]
    # Same point (< 2.5 km)
    close_match = normalizer.is_spatially_duplicate(15.150, 76.925, existing, threshold_km=2.5)
    assert close_match == "ballari-fort"

    # Far point (> 10 km)
    far_match = normalizer.is_spatially_duplicate(15.400, 76.924, existing, threshold_km=2.5)
    assert far_match is None


def test_api_districts_endpoint(client: TestClient):
    response = client.get("/api/v1/districts")
    assert response.status_code == 200
    districts = response.json()
    assert len(districts) == 31
    names = {d["name"] for d in districts}
    assert "Chitradurga" in names
    assert "Ballari" in names
    assert "Chikkaballapura" in names
    assert "Bengaluru South" in names


def test_api_attractions_endpoint(client: TestClient):
    response = client.get("/api/v1/attractions")
    assert response.status_code == 200
    attractions = response.json()
    assert len(attractions) >= 30
    for a in attractions:
        assert "name" in a
        assert "license" in a
        assert "attribution" in a


def test_api_map_markers_endpoint(client: TestClient):
    response = client.get("/api/v1/map/markers")
    assert response.status_code == 200
    data = response.json()
    assert "markers" in data
    assert data["destination_count"] >= 38
    assert data["attraction_count"] >= 30
    assert len(data["attribution"]) >= 2
    assert any("OpenStreetMap" in attr for attr in data["attribution"])


def test_api_search_expanded_destinations(client: TestClient):
    # Search for an imported destination from previously zero-coverage district
    response = client.get("/api/v1/destinations", params={"q": "Chitradurga"})
    assert response.status_code == 200
    results = response.json()
    assert len(results) >= 1
    assert any(r["id"] == "chitradurga-fort" for r in results)

    # Search for Nandi Hills in Chikkaballapura
    resp_nandi = client.get("/api/v1/destinations", params={"q": "Nandi"})
    assert resp_nandi.status_code == 200
    assert any(r["id"] == "nandi-hills" for r in resp_nandi.json())


def test_api_get_imported_destination_detail(client: TestClient):
    response = client.get("/api/v1/destinations/chitradurga-fort")
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Chitradurga Fort"
    assert body["district"] == "Chitradurga"
    assert body["district_id"] == "chitradurga"
    assert body["lat"] is not None and body["lng"] is not None
    assert body["data_confidence"] == "verified"
    assert len(body["provenance"]) >= 1
    assert "attribution" in body["provenance"][0]


def test_api_health_shows_database_source(client: TestClient):
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["data_source"] == "database"
    assert body["districts"] == 31
    assert body["attractions"] >= 30
    assert body["dataset_size"] >= 38
