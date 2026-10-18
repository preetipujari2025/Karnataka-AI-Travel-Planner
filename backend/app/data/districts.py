"""Karnataka district directory: 31 districts with stable slugs.

The JSON file is the canonical, hand-maintained directory (verified against
official Karnataka government sources — see its `sources` list). The ingestion
store mirrors it into SQLite; the API and planner resolve district names to
stable ids through this module.

Identifier honesty: `wikidata_qid` / `census_2011_code` / `lgd_code` are null
unless actually verified — `python -m app.ingest districts sync` fills Wikidata
Q-IDs from live verified matches only. Codes are never invented.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Optional

from pydantic import BaseModel, Field, ValidationError

from app.schemas import District

DISTRICTS_PATH = Path(__file__).with_name("karnataka_districts.json")

EXPECTED_DISTRICT_COUNT = 31


class DistrictDirectoryError(RuntimeError):
    """Raised when the district directory file is structurally invalid."""


class DistrictDirectory(BaseModel):
    updated: str
    state: dict
    sources: list[str] = Field(default_factory=list)
    identifier_policy: dict = Field(default_factory=dict)
    districts: list[District]


def _check_duplicates(districts: list[District]) -> None:
    seen_ids: set[str] = set()
    seen_names: set[str] = set()
    alias_owner: dict[str, str] = {}
    for district in districts:
        if district.id in seen_ids:
            raise DistrictDirectoryError(f"duplicate district id: {district.id}")
        seen_ids.add(district.id)
        name_key = district.name.strip().lower()
        if name_key in seen_names:
            raise DistrictDirectoryError(f"duplicate district name: {district.name}")
        seen_names.add(name_key)
        for alias in [district.name, *district.aliases]:
            key = alias.strip().lower()
            owner = alias_owner.get(key)
            if owner is not None and owner != district.id:
                raise DistrictDirectoryError(
                    f"alias '{alias}' is claimed by both {owner} and {district.id}"
                )
            alias_owner[key] = district.id


@lru_cache
def load_directory(path: Path = DISTRICTS_PATH) -> DistrictDirectory:
    """Read and validate the district directory. Fails fast on structural errors."""
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise DistrictDirectoryError(f"district file not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise DistrictDirectoryError(f"district file is not valid JSON: {exc}") from exc

    try:
        directory = DistrictDirectory.model_validate(raw)
    except ValidationError as exc:
        raise DistrictDirectoryError(f"invalid district directory: {exc}") from exc

    if len(directory.districts) != EXPECTED_DISTRICT_COUNT:
        raise DistrictDirectoryError(
            f"expected {EXPECTED_DISTRICT_COUNT} districts, found {len(directory.districts)}"
        )
    _check_duplicates(directory.districts)
    return directory


def all_districts() -> list[District]:
    return list(load_directory().districts)


def district_count() -> int:
    return len(load_directory().districts)


def get_district(district_id: str) -> Optional[District]:
    wanted = district_id.strip().lower()
    for district in load_directory().districts:
        if district.id == wanted:
            return district
    return None


def resolve_district(name: Optional[str]) -> Optional[District]:
    """Map a free-text district name (or slug) to a directory entry.

    Matches ids, official names and documented aliases, case-insensitively.
    """
    if not name:
        return None
    needle = name.strip().lower()
    if not needle:
        return None
    for district in load_directory().districts:
        candidates = {district.id, district.name.strip().lower()}
        candidates.update(alias.strip().lower() for alias in district.aliases)
        if needle in candidates:
            return district
    return None


def state_info() -> dict:
    return dict(load_directory().state)


def directory_updated() -> str:
    return load_directory().updated


def identifiers_populated() -> dict[str, int]:
    """How many districts have each optional official identifier (honesty report)."""
    districts = load_directory().districts
    return {
        "wikidata_qid": sum(1 for d in districts if d.wikidata_qid),
        "census_2011_code": sum(1 for d in districts if d.census_2011_code),
        "lgd_code": sum(1 for d in districts if d.lgd_code),
        "division": sum(1 for d in districts if d.division),
        "coordinates": sum(1 for d in districts if d.lat is not None and d.lng is not None),
    }


DISTRICT_HQ_NAMES: dict[str, str] = {
    "bagalkote": "Bagalkote",
    "ballari": "Ballari",
    "belagavi": "Belagavi",
    "bengaluru-rural": "Doddaballapura",
    "bengaluru-south": "Ramanagara",
    "bengaluru-urban": "Bengaluru",
    "bidar": "Bidar",
    "chamarajanagara": "Chamarajanagara",
    "chikkaballapura": "Chikkaballapura",
    "chikkamagaluru": "Chikkamagaluru",
    "chitradurga": "Chitradurga",
    "dakshina-kannada": "Mangaluru",
    "davanagere": "Davanagere",
    "dharwad": "Dharwad",
    "gadag": "Gadag-Betageri",
    "hassan": "Hassan",
    "haveri": "Haveri",
    "kalaburagi": "Kalaburagi",
    "kodagu": "Madikeri",
    "kolar": "Kolar",
    "koppal": "Koppal",
    "mandya": "Mandya",
    "mysuru": "Mysuru",
    "raichur": "Raichur",
    "shivamogga": "Shivamogga",
    "tumakuru": "Tumakuru",
    "udupi": "Udupi",
    "uttara-kannada": "Karwar",
    "vijayanagara": "Hosapete",
    "vijayapura": "Vijayapura",
    "yadgir": "Yadgir",
}


def district_to_destination(district: District):
    """Convert a district headquarters into a plannable DestinationRecord for routing."""
    from app.schemas import (
        DailyCost,
        DataConfidence,
        DestinationRecord,
        ExperienceType,
        RecordClass,
    )

    hq_city = DISTRICT_HQ_NAMES.get(district.id, district.name)
    division_label = f"{district.division} Division" if district.division else "Karnataka"

    return DestinationRecord(
        id=district.id,
        name=f"{hq_city} ({district.name} District HQ)",
        region=division_label,
        district=district.name,
        district_id=district.id,
        record_class=RecordClass.curated,
        lat=district.lat,
        lng=district.lng,
        categories=["urban", "heritage"],
        interest_tags=["district-hq", "transit-hub", "administrative-center"],
        experience_types=[ExperienceType.sightseeing],
        is_start_hub=True,
        description=district.notes or f"District headquarters administrative center of {district.name} district, Karnataka.",
        highlights=[f"{hq_city} Town Center", f"{district.name} Administrative Hub"],
        best_months=list(range(1, 13)),
        min_nights=1,
        typical_nights=1,
        daily_cost_inr=DailyCost(budget=1500, mid=3500, luxury=8000),
        entry_fees_inr=0,
        data_confidence=DataConfidence.verified,
    )
