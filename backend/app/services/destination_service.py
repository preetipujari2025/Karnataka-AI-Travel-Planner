"""Destination service: validation, lookup, filtering, search and proximity.

Reusable, side-effect free functions over the curated dataset. Callers (API,
planner, validation script) go through this module instead of parsing the file.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional

from pydantic import ValidationError

from app.data.loader import (
    DATASET_PATH,
    DatasetValidationError,
    all_destinations,
    get_destination,
    load_raw_dataset,
    load_dataset,
)
from app.schemas import (
    DataConfidence,
    DestinationRecord,
    DestinationSummary,
    ExperienceType,
    Interest,
    NearbyDestination,
)
from app.services.routing import haversine_coords

_ID_PATTERN = re.compile(r"^[a-z0-9][a-z0-9-]*$")


# ---------------------------------------------------------------------------
# Validation report
# ---------------------------------------------------------------------------


@dataclass
class DatasetReport:
    """Outcome of validating the raw dataset. `errors` means the file is unusable."""

    source: str = str(DATASET_PATH)
    destination_count: int = 0
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    estimated_ids: list[str] = field(default_factory=list)
    unverified_ids: list[str] = field(default_factory=list)
    missing_coordinates: list[str] = field(default_factory=list)
    unknown_fee_ids: list[str] = field(default_factory=list)
    ids_without_sources: list[str] = field(default_factory=list)

    @property
    def is_valid(self) -> bool:
        return not self.errors

    @property
    def estimated_or_unverified_ids(self) -> list[str]:
        return [*self.estimated_ids, *self.unverified_ids]


def validate_dataset(raw: dict) -> DatasetReport:
    """Validate a parsed dataset dict. Never raises for content problems.

    Errors  -> the file is structurally broken (dup ids, bad schema, bad coords).
    Warnings -> the file works but has gaps (no sources, no verification date).
    """
    report = DatasetReport()

    destinations = raw.get("destinations")
    if not isinstance(destinations, list) or not destinations:
        report.errors.append("'destinations' must be a non-empty list")
        return report

    report.destination_count = len(destinations)

    # Duplicate ids (checked on raw data so duplicates are reported, not raised).
    seen: set[str] = set()
    for item in destinations:
        if isinstance(item, dict):
            identifier = str(item.get("id", ""))
            if identifier in seen and identifier:
                report.errors.append(f"duplicate id: {identifier}")
            seen.add(identifier)

    for index, item in enumerate(destinations):
        if not isinstance(item, dict):
            report.errors.append(f"entry {index}: not an object")
            continue

        identifier = str(item.get("id", f"entry-{index}"))
        try:
            record = DestinationRecord.model_validate(item)
        except ValidationError as exc:
            for err in exc.errors():
                loc = ".".join(str(part) for part in err["loc"])
                report.errors.append(f"{identifier}: {loc}: {err['msg']}")
            continue

        if not _ID_PATTERN.match(record.id):
            report.errors.append(
                f"{identifier}: id must be a lowercase slug (a-z, 0-9, hyphens)"
            )

        # Coordinates: null is allowed (unknown); out-of-envelope is a warning.
        if not record.has_usable_coords:
            report.missing_coordinates.append(record.id)
            report.warnings.append(f"{record.id}: no coordinates (excluded from map/routing)")
        elif not record.within_karnataka:
            report.warnings.append(
                f"{record.id}: coordinates outside the expected Karnataka envelope"
            )

        # Provenance.
        if not record.sources:
            report.ids_without_sources.append(record.id)
            report.warnings.append(f"{record.id}: no source URLs")
        if record.last_verified_on is None:
            report.warnings.append(f"{record.id}: no last_verified_on date")

        if record.data_confidence is DataConfidence.verified:
            if not record.sources:
                report.errors.append(f"{record.id}: verified confidence requires at least one source")
        elif record.data_confidence is DataConfidence.estimated:
            report.estimated_ids.append(record.id)
        else:
            report.unverified_ids.append(record.id)

        # Costs.
        if record.entry_fees_inr is None:
            report.unknown_fee_ids.append(record.id)

    return report


def load_and_validate() -> DatasetReport:
    """Load the dataset from disk and validate it.

    Raises DatasetValidationError only when the file itself cannot be read;
    content problems are returned in the report (report.is_valid is False).
    """
    report = DatasetReport()
    try:
        raw = load_raw_dataset()
    except DatasetValidationError as exc:
        raise DatasetValidationError(str(exc)) from exc

    report = validate_dataset(raw)

    # Cross-check that the strict loader accepts the same file (fails fast parity).
    try:
        load_dataset.cache_clear()
        load_dataset()
    except DatasetValidationError as exc:
        report.errors.append(f"loader rejected the dataset: {exc}")

    return report


# ---------------------------------------------------------------------------
# Lookup / filter / search
# ---------------------------------------------------------------------------


def catalog_destinations() -> list[DestinationRecord]:
    """Return all catalog destinations (from SQLite store when populated, else curated seed)."""
    from app.data import store

    if store.is_database_populated():
        return store.list_destinations()
    return all_destinations()


def get_by_id(destination_id: str) -> Optional[DestinationRecord]:
    return get_destination(destination_id)


def filter_destinations(
    *,
    region: Optional[str] = None,
    interest: Optional[Interest] = None,
    experience: Optional[ExperienceType] = None,
    category: Optional[str] = None,
    map_only: bool = False,
) -> list[DestinationRecord]:
    """Filter by region (substring, case-insensitive), traveller interest,
    experience type, plain category tag, and/or map usability."""
    from app.services.recommendation import INTEREST_CATEGORIES

    wanted_categories = INTEREST_CATEGORIES.get(interest.value, []) if interest else []
    region_lower = region.strip().lower() if region else None
    category_lower = category.strip().lower() if category else None

    results: list[DestinationRecord] = []
    for destination in catalog_destinations():
        if map_only and not destination.is_map_ready:
            continue
        if region_lower and region_lower not in destination.region.lower():
            continue
        if wanted_categories and not any(c in wanted_categories for c in destination.categories):
            continue
        if experience and experience not in destination.experience_types:
            continue
        if category_lower and category_lower not in {c.lower() for c in destination.categories}:
            continue
        results.append(destination)
    return results


def search_by_name(query: str, *, limit: Optional[int] = 10) -> list[DestinationRecord]:
    """Case-insensitive name search. Exact matches rank before prefix before substring.

    `limit=None` returns every match (needed when intersecting with filters).
    """
    needle = query.strip().lower()
    if not needle:
        return []

    exact: list[DestinationRecord] = []
    prefix: list[DestinationRecord] = []
    substring: list[DestinationRecord] = []
    for destination in catalog_destinations():
        name = destination.name.lower()
        if name == needle:
            exact.append(destination)
        elif name.startswith(needle):
            prefix.append(destination)
        elif needle in name:
            substring.append(destination)

    ranked = exact + prefix + substring
    return ranked if limit is None else ranked[:limit]


def nearby(
    lat: float,
    lng: float,
    *,
    limit: int = 5,
    max_km: Optional[float] = None,
) -> list[NearbyDestination]:
    """Destinations closest to a point, using great-circle distance.

    Destinations without usable coordinates are skipped. `max_km` optionally
    caps the radius. Ties break by id for determinism.
    """
    if not -90.0 <= lat <= 90.0:
        raise ValueError("lat must be between -90 and 90")
    if not -180.0 <= lng <= 180.0:
        raise ValueError("lng must be between -180 and 180")
    if limit < 1:
        raise ValueError("limit must be >= 1")

    scored: list[tuple[float, DestinationRecord]] = []
    for destination in catalog_destinations():
        if not destination.has_usable_coords:
            continue
        distance = haversine_coords(lat, lng, float(destination.lat), float(destination.lng))
        if max_km is not None and distance > max_km:
            continue
        scored.append((distance, destination))

    scored.sort(key=lambda pair: (pair[0], pair[1].id))
    return [
        NearbyDestination(
            destination=to_summary(destination), distance_km=round(distance, 1)
        )
        for distance, destination in scored[:limit]
    ]


def map_ready_destinations() -> list[DestinationRecord]:
    """Only valid records with usable coordinates — safe for map display."""
    return [d for d in catalog_destinations() if d.is_map_ready]


def valid_destinations() -> list[DestinationRecord]:
    """All destinations that pass strict loading (schema-valid, unique ids)."""
    load_dataset()  # raises DatasetValidationError when the file is broken
    return all_destinations()


def to_summary(destination: DestinationRecord) -> DestinationSummary:
    return DestinationSummary(
        id=destination.id,
        name=destination.name,
        region=destination.region,
        lat=destination.lat,
        lng=destination.lng,
        categories=list(destination.categories),
        description=destination.description,
        highlights=list(destination.highlights),
    )
