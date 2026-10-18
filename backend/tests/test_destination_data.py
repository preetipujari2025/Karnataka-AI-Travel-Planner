"""Dataset quality tests: loading, validation, optional fields, coordinates, dup ids."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.data.loader import (
    DATASET_PATH,
    DatasetValidationError,
    all_destinations,
    destination_count,
    load_dataset,
    load_raw_dataset,
)
from app.schemas import DataConfidence, DestinationRecord, ExperienceType
from app.services.destination_service import load_and_validate, validate_dataset


def _minimal_record(**overrides) -> dict:
    """Smallest record that should still validate (all optional fields omitted)."""
    record = {
        "id": "test-ville",
        "name": "Test Ville",
        "region": "South Karnataka",
        "categories": ["heritage"],
        "description": "A placeholder destination for schema tests.",
        "highlights": ["Test monument"],
        "best_months": [12],
        "min_nights": 1,
        "typical_nights": 1,
        "daily_cost_inr": {"budget": 1000, "mid": 2000, "luxury": 3000},
    }
    record.update(overrides)
    return record


# ---------------------------------------------------------------------------
# Loading the real dataset
# ---------------------------------------------------------------------------


def test_dataset_loads_with_expected_scale() -> None:
    updated, destinations = load_dataset()
    assert updated
    assert 30 <= len(destinations) <= 150, "dataset should hold 30-150 records"
    assert len(all_destinations()) == destination_count()


def test_load_and_validate_reports_real_dataset_valid() -> None:
    report = load_and_validate()
    assert report.is_valid, f"unexpected validation errors: {report.errors}"
    assert report.destination_count == destination_count()


def test_real_dataset_has_no_duplicate_ids() -> None:
    raw = load_raw_dataset()
    ids = [item["id"] for item in raw["destinations"]]
    assert len(ids) == len(set(ids))


def test_confidence_values_are_from_the_enum() -> None:
    for destination in all_destinations():
        assert isinstance(destination.data_confidence, DataConfidence)
        # Every sourced record must carry provenance fields.
        if destination.data_confidence is not DataConfidence.unverified:
            assert destination.sources, f"{destination.id} claims confidence but has no sources"


# ---------------------------------------------------------------------------
# Optional fields / null handling
# ---------------------------------------------------------------------------


def test_missing_optional_fields_default_to_null() -> None:
    record = DestinationRecord.model_validate(_minimal_record())
    assert record.district is None
    assert record.lat is None and record.lng is None
    assert record.interest_tags == []
    assert record.experience_types == []
    assert record.entry_fees_inr is None
    assert record.activity_cost_inr is None
    assert record.family_friendly is None
    assert record.accessibility_notes is None
    assert record.sources == []
    assert record.data_confidence is DataConfidence.unverified
    assert record.last_verified_on is None
    assert not record.has_usable_coords
    assert not record.is_map_ready


def test_explicit_null_coordinates_are_allowed() -> None:
    record = DestinationRecord.model_validate(_minimal_record(lat=None, lng=None))
    assert record.lat is None
    assert record.has_usable_coords is False


# ---------------------------------------------------------------------------
# Invalid coordinates / values
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("bad_lat", [91.0, -90.1, 200.0])
def test_out_of_range_latitude_is_rejected(bad_lat: float) -> None:
    with pytest.raises(ValidationError):
        DestinationRecord.model_validate(_minimal_record(lat=bad_lat, lng=75.0))


@pytest.mark.parametrize("bad_lng", [180.1, -181.0])
def test_out_of_range_longitude_is_rejected(bad_lng: float) -> None:
    with pytest.raises(ValidationError):
        DestinationRecord.model_validate(_minimal_record(lat=13.0, lng=bad_lng))


def test_invalid_best_month_is_rejected() -> None:
    with pytest.raises(ValidationError):
        DestinationRecord.model_validate(_minimal_record(best_months=[13]))


def test_invalid_verification_date_is_rejected() -> None:
    with pytest.raises(ValidationError):
        DestinationRecord.model_validate(_minimal_record(last_verified_on="14-10-2026"))


def test_coordinates_outside_karnataka_are_not_map_ready() -> None:
    # Globally valid but far from Karnataka -> usable, yet not map-ready.
    record = DestinationRecord.model_validate(_minimal_record(lat=28.6, lng=77.2))
    assert record.has_usable_coords
    assert not record.within_karnataka
    assert not record.is_map_ready


# ---------------------------------------------------------------------------
# Duplicate ids & structural errors (report-style validation)
# ---------------------------------------------------------------------------


def test_duplicate_ids_are_reported_as_errors() -> None:
    raw = {"destinations": [_minimal_record(), _minimal_record(name="Copy Cat")]}
    report = validate_dataset(raw)
    assert not report.is_valid
    assert any("duplicate id" in error for error in report.errors)


def test_invalid_coordinates_are_reported_in_raw_validation() -> None:
    raw = {"destinations": [_minimal_record(lat=999.0)]}
    report = validate_dataset(raw)
    assert not report.is_valid
    assert any("lat" in error for error in report.errors)


def test_non_object_entries_are_reported() -> None:
    raw = {"destinations": ["not-a-dict"]}
    report = validate_dataset(raw)
    assert not report.is_valid


def test_empty_destinations_list_is_invalid() -> None:
    report = validate_dataset({"destinations": []})
    assert not report.is_valid


def test_verified_confidence_requires_sources() -> None:
    raw = {"destinations": [_minimal_record(data_confidence="verified")]}
    report = validate_dataset(raw)
    assert not report.is_valid
    assert any("source" in error for error in report.errors)


def test_unknown_fees_and_missing_sources_are_tracked() -> None:
    raw = {"destinations": [_minimal_record()]}
    report = validate_dataset(raw)
    assert report.unknown_fee_ids == ["test-ville"]
    assert report.ids_without_sources == ["test-ville"]
    assert report.unverified_ids == ["test-ville"]
    assert any("last_verified_on" in warning for warning in report.warnings)


def test_strict_loader_rejects_duplicate_ids() -> None:
    import json
    import tempfile
    from pathlib import Path

    from app.data.loader import _check_duplicate_ids

    payload = {"updated": "2026-10-14", "destinations": [_minimal_record(), _minimal_record()]}
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "dupes.json"
        path.write_text(json.dumps(payload), encoding="utf-8")
        raw = load_raw_dataset(path)
        with pytest.raises(DatasetValidationError):
            _check_duplicate_ids(raw["destinations"])


def test_dataset_file_is_named_as_documented() -> None:
    assert DATASET_PATH.name == "karnataka_destinations.json"


def test_experience_types_use_the_controlled_vocabulary() -> None:
    allowed = {member.value for member in ExperienceType}
    for destination in all_destinations():
        for experience in destination.experience_types:
            assert experience.value in allowed
