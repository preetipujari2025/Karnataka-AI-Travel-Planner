"""Loads and indexes the Karnataka destination dataset.

Integrity checks (duplicate ids, schema/coordinate validation) run at load time
so a broken data file fails fast with a clear error instead of at request time.
Provides the curated benchmark dataset to the planner and bridges to the SQLite store
for extended destination lookups.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Literal, Optional

from pydantic import ValidationError

from app.schemas import DestinationRecord

DATASET_PATH = Path(__file__).with_name("karnataka_destinations.json")


class DatasetValidationError(RuntimeError):
    """Raised when the destination data file is structurally invalid."""


def load_raw_dataset(path: Path = DATASET_PATH) -> dict:
    """Read and parse the JSON file without validating records (for tooling/tests)."""
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise DatasetValidationError(f"dataset file not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise DatasetValidationError(f"dataset is not valid JSON: {exc}") from exc


def _check_duplicate_ids(destinations: list[dict]) -> None:
    seen: set[str] = set()
    duplicates: set[str] = set()
    for item in destinations:
        destination_id = str(item.get("id", ""))
        if destination_id in seen:
            duplicates.add(destination_id)
        seen.add(destination_id)
    if duplicates:
        raise DatasetValidationError(
            "duplicate destination ids: " + ", ".join(sorted(duplicates))
        )


@lru_cache
def load_dataset() -> tuple[str, tuple[DestinationRecord, ...]]:
    """Return (updated, destinations) for curated dataset. Cached per process."""
    raw = load_raw_dataset()
    destinations_raw = raw.get("destinations")
    if not isinstance(destinations_raw, list) or not destinations_raw:
        raise DatasetValidationError("dataset must contain a non-empty 'destinations' list")

    _check_duplicate_ids(destinations_raw)

    records: list[DestinationRecord] = []
    for index, item in enumerate(destinations_raw):
        try:
            records.append(DestinationRecord.model_validate(item))
        except ValidationError as exc:
            identifier = item.get("id", f"index {index}") if isinstance(item, dict) else f"index {index}"
            raise DatasetValidationError(f"invalid record '{identifier}': {exc}") from exc

    return str(raw.get("updated", "")), tuple(records)


def clear_loader_cache() -> None:
    """Invalidate cached destination records."""
    load_dataset.cache_clear()


def get_data_source() -> Literal["database", "seed"]:
    from app.data import store

    return "database" if store.is_database_populated() else "seed"


def get_attractions_count() -> int:
    from app.data import store

    if store.is_database_populated():
        return store.get_counts().get("attractions", 0)
    return 0


def get_total_catalog_size() -> int:
    from app.data import store

    if store.is_database_populated():
        return store.get_counts().get("destinations", len(load_dataset()[1]))
    return len(load_dataset()[1])


def all_destinations() -> list[DestinationRecord]:
    return list(load_dataset()[1])


def dataset_updated() -> str:
    return load_dataset()[0]


def get_destination(destination_id: str) -> Optional[DestinationRecord]:
    wanted = destination_id.strip().lower()
    if wanted.startswith("district-"):
        wanted = wanted[len("district-"):]

    for destination in load_dataset()[1]:
        if destination.id == wanted:
            return destination
    from app.data import store

    if store.is_database_populated():
        res = store.get_destination(wanted)
        if res is not None:
            return res

    # Resolve from district directory if matching any district id, name or alias
    from app.data.districts import resolve_district, district_to_destination

    dist = resolve_district(wanted)
    if dist is not None and dist.lat is not None and dist.lng is not None:
        return district_to_destination(dist)
    return None


def require_destination(destination_id: str) -> DestinationRecord:
    destination = get_destination(destination_id)
    if destination is None:
        raise KeyError(f"unknown destination: {destination_id}")
    return destination


def start_hubs() -> list[DestinationRecord]:
    """Return major transit hubs and all 31 Karnataka district headquarters."""
    curated_hubs = [d for d in load_dataset()[1] if d.is_start_hub]
    existing_ids = {d.id for d in curated_hubs}

    from app.data.districts import all_districts, district_to_destination

    district_hubs: list[DestinationRecord] = []
    for dist in all_districts():
        if dist.lat is not None and dist.lng is not None:
            if dist.id not in existing_ids:
                district_hubs.append(district_to_destination(dist))

    district_hubs.sort(key=lambda d: d.name)
    return curated_hubs + district_hubs


def destination_count() -> int:
    return len(load_dataset()[1])
