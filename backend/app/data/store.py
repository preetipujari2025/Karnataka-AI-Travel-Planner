"""SQLite database store for Karnataka tourism data.

Manages districts, destinations, attractions, and ingestion provenance with
safe, idempotent upserts, transactions, and foreign key enforcement.
"""

from __future__ import annotations

import json
import logging
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Generator, Optional

from app.schemas import (
    Attraction,
    DailyCost,
    DataConfidence,
    DestinationRecord,
    District,
    DistrictCoverage,
    ExperienceType,
    FieldVerification,
    ProvenanceEntry,
    RecordClass,
)

logger = logging.getLogger(__name__)

DEFAULT_DB_PATH = Path(__file__).resolve().parent / "karnataka_tourism.db"


def get_db_path() -> Path:
    env_path = os.environ.get("TOURISM_DB_PATH")
    if env_path:
        return Path(env_path)
    return DEFAULT_DB_PATH


@contextmanager
def get_connection(db_path: Optional[Path] = None) -> Generator[sqlite3.Connection, None, None]:
    path = db_path or get_db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db(db_path: Optional[Path] = None) -> None:
    """Create schema tables and indexes if they do not exist."""
    with get_connection(db_path) as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS districts (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                aliases_json TEXT NOT NULL DEFAULT '[]',
                division TEXT,
                wikidata_qid TEXT,
                census_2011_code TEXT,
                lgd_code TEXT,
                lat REAL,
                lng REAL,
                source_urls_json TEXT NOT NULL DEFAULT '[]',
                verified_on TEXT,
                notes TEXT,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS destinations (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                region TEXT NOT NULL,
                district TEXT,
                district_id TEXT REFERENCES districts(id) ON DELETE SET NULL,
                record_class TEXT NOT NULL DEFAULT 'curated',
                lat REAL,
                lng REAL,
                categories_json TEXT NOT NULL DEFAULT '[]',
                interest_tags_json TEXT NOT NULL DEFAULT '[]',
                experience_types_json TEXT NOT NULL DEFAULT '[]',
                is_start_hub INTEGER NOT NULL DEFAULT 0,
                description TEXT NOT NULL,
                highlights_json TEXT NOT NULL DEFAULT '[]',
                best_months_json TEXT NOT NULL DEFAULT '[]',
                season_note TEXT,
                min_nights INTEGER NOT NULL DEFAULT 1,
                typical_nights INTEGER NOT NULL DEFAULT 1,
                daily_cost_json TEXT,
                entry_fees_inr INTEGER,
                entry_fee_note TEXT,
                activity_cost_inr INTEGER,
                family_friendly INTEGER,
                accessibility_notes TEXT,
                sources_json TEXT NOT NULL DEFAULT '[]',
                data_confidence TEXT NOT NULL DEFAULT 'unverified',
                last_verified_on TEXT,
                field_verification_json TEXT NOT NULL DEFAULT '{}',
                provenance_json TEXT NOT NULL DEFAULT '[]',
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS attractions (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                lat REAL,
                lng REAL,
                district_id TEXT REFERENCES districts(id) ON DELETE SET NULL,
                district TEXT,
                categories_json TEXT NOT NULL DEFAULT '[]',
                source_kind TEXT NOT NULL DEFAULT 'imported',
                source_ids_json TEXT NOT NULL DEFAULT '[]',
                source_urls_json TEXT NOT NULL DEFAULT '[]',
                license TEXT,
                attribution TEXT,
                verification_status TEXT NOT NULL DEFAULT 'discovered',
                linked_destination_id TEXT REFERENCES destinations(id) ON DELETE SET NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS ingestion_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_id TEXT NOT NULL,
                fetched_count INTEGER NOT NULL DEFAULT 0,
                inserted_count INTEGER NOT NULL DEFAULT 0,
                updated_count INTEGER NOT NULL DEFAULT 0,
                skipped_count INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL,
                message TEXT,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS route_cache (
                cache_key TEXT PRIMARY KEY,
                kind TEXT NOT NULL,
                origin_id TEXT NOT NULL,
                destination_id TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                retrieved_at TEXT NOT NULL,
                expires_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_destinations_district_id ON destinations(district_id);
            CREATE INDEX IF NOT EXISTS idx_destinations_region ON destinations(region);
            CREATE INDEX IF NOT EXISTS idx_attractions_district_id ON attractions(district_id);
            CREATE INDEX IF NOT EXISTS idx_attractions_destination_id ON attractions(linked_destination_id);
            CREATE INDEX IF NOT EXISTS idx_route_cache_expiry ON route_cache(expires_at);
            """
        )
        _migrate_attraction_columns(conn)


# Additive columns introduced for route discovery (safe migration: existing DBs
# keep their data; NULL simply means 'unknown', never a fabricated default).
_ATTRACTION_MIGRATION_COLUMNS = {
    "opening_hours": "TEXT",
    "typical_visit_minutes": "INTEGER",
    "retrieved_at": "TEXT",
}


def _migrate_attraction_columns(conn: sqlite3.Connection) -> None:
    existing = {row["name"] for row in conn.execute("PRAGMA table_info(attractions)").fetchall()}
    for column, sql_type in _ATTRACTION_MIGRATION_COLUMNS.items():
        if column not in existing:
            conn.execute(f"ALTER TABLE attractions ADD COLUMN {column} {sql_type}")


def _row_to_district(row: sqlite3.Row) -> District:
    return District(
        id=row["id"],
        name=row["name"],
        aliases=json.loads(row["aliases_json"]),
        division=row["division"],
        wikidata_qid=row["wikidata_qid"],
        census_2011_code=row["census_2011_code"],
        lgd_code=row["lgd_code"],
        lat=row["lat"],
        lng=row["lng"],
        source_urls=json.loads(row["source_urls_json"]),
        verified_on=row["verified_on"],
        notes=row["notes"],
    )


def _row_to_destination(row: sqlite3.Row) -> DestinationRecord:
    daily_cost = None
    if row["daily_cost_json"]:
        try:
            cost_data = json.loads(row["daily_cost_json"])
            daily_cost = DailyCost.model_validate(cost_data)
        except Exception:
            daily_cost = None

    experience_types = []
    for exp in json.loads(row["experience_types_json"]):
        try:
            experience_types.append(ExperienceType(exp))
        except ValueError:
            pass

    field_verifications = {}
    for k, v in json.loads(row["field_verification_json"]).items():
        try:
            field_verifications[k] = FieldVerification(v)
        except ValueError:
            pass

    provenance = []
    for p in json.loads(row["provenance_json"]):
        try:
            provenance.append(ProvenanceEntry.model_validate(p))
        except Exception:
            pass

    return DestinationRecord(
        id=row["id"],
        name=row["name"],
        region=row["region"],
        district=row["district"],
        district_id=row["district_id"],
        record_class=RecordClass(row["record_class"]),
        lat=row["lat"],
        lng=row["lng"],
        categories=json.loads(row["categories_json"]),
        interest_tags=json.loads(row["interest_tags_json"]),
        experience_types=experience_types,
        is_start_hub=bool(row["is_start_hub"]),
        description=row["description"],
        highlights=json.loads(row["highlights_json"]),
        best_months=json.loads(row["best_months_json"]),
        season_note=row["season_note"],
        min_nights=row["min_nights"],
        typical_nights=row["typical_nights"],
        daily_cost_inr=daily_cost,
        entry_fees_inr=row["entry_fees_inr"],
        entry_fee_note=row["entry_fee_note"],
        activity_cost_inr=row["activity_cost_inr"],
        family_friendly=bool(row["family_friendly"]) if row["family_friendly"] is not None else None,
        accessibility_notes=row["accessibility_notes"],
        sources=json.loads(row["sources_json"]),
        data_confidence=DataConfidence(row["data_confidence"]),
        last_verified_on=row["last_verified_on"],
        field_verification=field_verifications,
        provenance=provenance,
    )


def _row_to_attraction(row: sqlite3.Row) -> Attraction:
    def _column(name: str) -> Any:
        # Older DBs pre-migration may lack the column; treat as unknown.
        return row[name] if name in row.keys() else None

    return Attraction(
        id=row["id"],
        name=row["name"],
        lat=row["lat"],
        lng=row["lng"],
        district_id=row["district_id"],
        district=row["district"],
        categories=json.loads(row["categories_json"]),
        source_kind=RecordClass(row["source_kind"]),
        source_ids=json.loads(row["source_ids_json"]),
        source_urls=json.loads(row["source_urls_json"]),
        license=row["license"],
        attribution=row["attribution"],
        verification_status=row["verification_status"],
        linked_destination_id=row["linked_destination_id"],
        opening_hours=_column("opening_hours"),
        typical_visit_minutes=_column("typical_visit_minutes"),
        retrieved_at=_column("retrieved_at"),
    )


def upsert_district(district: District, db_path: Optional[Path] = None) -> None:
    now_iso = datetime.now(timezone.utc).isoformat()
    with get_connection(db_path) as conn:
        conn.execute(
            """
            INSERT INTO districts (
                id, name, aliases_json, division, wikidata_qid, census_2011_code,
                lgd_code, lat, lng, source_urls_json, verified_on, notes, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                aliases_json = excluded.aliases_json,
                division = COALESCE(excluded.division, districts.division),
                wikidata_qid = COALESCE(excluded.wikidata_qid, districts.wikidata_qid),
                census_2011_code = COALESCE(excluded.census_2011_code, districts.census_2011_code),
                lgd_code = COALESCE(excluded.lgd_code, districts.lgd_code),
                lat = COALESCE(excluded.lat, districts.lat),
                lng = COALESCE(excluded.lng, districts.lng),
                source_urls_json = excluded.source_urls_json,
                verified_on = COALESCE(excluded.verified_on, districts.verified_on),
                notes = COALESCE(excluded.notes, districts.notes),
                updated_at = excluded.updated_at
            """,
            (
                district.id,
                district.name,
                json.dumps(district.aliases),
                district.division,
                district.wikidata_qid,
                district.census_2011_code,
                district.lgd_code,
                district.lat,
                district.lng,
                json.dumps(district.source_urls),
                district.verified_on,
                district.notes,
                now_iso,
            ),
        )


def upsert_destination(
    destination: DestinationRecord,
    preserve_curated: bool = True,
    db_path: Optional[Path] = None,
) -> bool:
    """Upsert a destination record safely.

    If preserve_curated is True and an existing record has record_class='curated',
    hand-curated descriptions, highlights, and budgets are kept intact, while
    updating coordinates, sources, and provenance if missing.
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    with get_connection(db_path) as conn:
        cursor = conn.execute("SELECT record_class, sources_json, provenance_json FROM destinations WHERE id = ?", (destination.id,))
        existing = cursor.fetchone()

        sources = list(destination.sources)
        provenance = [p.model_dump() for p in destination.provenance]

        if existing and preserve_curated and existing["record_class"] == RecordClass.curated.value:
            # Merge sources and provenance instead of clobbering
            existing_sources = set(json.loads(existing["sources_json"]))
            existing_sources.update(sources)
            merged_sources = sorted(existing_sources)

            existing_prov = json.loads(existing["provenance_json"])
            existing_source_ids = {p.get("source_id") for p in existing_prov}
            for p in provenance:
                if p.get("source_id") not in existing_source_ids:
                    existing_prov.append(p)

            conn.execute(
                """
                UPDATE destinations SET
                    district = COALESCE(destinations.district, ?),
                    district_id = COALESCE(destinations.district_id, ?),
                    lat = COALESCE(destinations.lat, ?),
                    lng = COALESCE(destinations.lng, ?),
                    sources_json = ?,
                    provenance_json = ?,
                    updated_at = ?
                WHERE id = ?
                """,
                (
                    destination.district,
                    destination.district_id,
                    destination.lat,
                    destination.lng,
                    json.dumps(merged_sources),
                    json.dumps(existing_prov),
                    now_iso,
                    destination.id,
                ),
            )
            return False  # updated existing curated record

        daily_cost_json = json.dumps(destination.daily_cost_inr.model_dump()) if destination.daily_cost_inr else None
        field_ver_json = json.dumps({k: v.value for k, v in destination.field_verification.items()})

        conn.execute(
            """
            INSERT INTO destinations (
                id, name, region, district, district_id, record_class, lat, lng,
                categories_json, interest_tags_json, experience_types_json,
                is_start_hub, description, highlights_json, best_months_json,
                season_note, min_nights, typical_nights, daily_cost_json,
                entry_fees_inr, entry_fee_note, activity_cost_inr, family_friendly,
                accessibility_notes, sources_json, data_confidence, last_verified_on,
                field_verification_json, provenance_json, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                region = excluded.region,
                district = excluded.district,
                district_id = excluded.district_id,
                record_class = excluded.record_class,
                lat = excluded.lat,
                lng = excluded.lng,
                categories_json = excluded.categories_json,
                interest_tags_json = excluded.interest_tags_json,
                experience_types_json = excluded.experience_types_json,
                is_start_hub = excluded.is_start_hub,
                description = excluded.description,
                highlights_json = excluded.highlights_json,
                best_months_json = excluded.best_months_json,
                season_note = excluded.season_note,
                min_nights = excluded.min_nights,
                typical_nights = excluded.typical_nights,
                daily_cost_json = excluded.daily_cost_json,
                entry_fees_inr = excluded.entry_fees_inr,
                entry_fee_note = excluded.entry_fee_note,
                activity_cost_inr = excluded.activity_cost_inr,
                family_friendly = excluded.family_friendly,
                accessibility_notes = excluded.accessibility_notes,
                sources_json = excluded.sources_json,
                data_confidence = excluded.data_confidence,
                last_verified_on = excluded.last_verified_on,
                field_verification_json = excluded.field_verification_json,
                provenance_json = excluded.provenance_json,
                updated_at = excluded.updated_at
            """,
            (
                destination.id,
                destination.name,
                destination.region,
                destination.district,
                destination.district_id,
                destination.record_class.value,
                destination.lat,
                destination.lng,
                json.dumps(destination.categories),
                json.dumps(destination.interest_tags),
                json.dumps([e.value for e in destination.experience_types]),
                1 if destination.is_start_hub else 0,
                destination.description,
                json.dumps(destination.highlights),
                json.dumps(destination.best_months),
                destination.season_note,
                destination.min_nights,
                destination.typical_nights,
                daily_cost_json,
                destination.entry_fees_inr,
                destination.entry_fee_note,
                destination.activity_cost_inr,
                1 if destination.family_friendly is True else (0 if destination.family_friendly is False else None),
                destination.accessibility_notes,
                json.dumps(sources),
                destination.data_confidence.value,
                destination.last_verified_on,
                field_ver_json,
                json.dumps(provenance),
                now_iso,
            ),
        )
        return existing is None


def upsert_attraction(attraction: Attraction, db_path: Optional[Path] = None) -> bool:
    now_iso = datetime.now(timezone.utc).isoformat()
    with get_connection(db_path) as conn:
        conn.execute(
            """
            INSERT INTO attractions (
                id, name, lat, lng, district_id, district, categories_json,
                source_kind, source_ids_json, source_urls_json, license,
                attribution, verification_status, linked_destination_id,
                opening_hours, typical_visit_minutes, retrieved_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                lat = excluded.lat,
                lng = excluded.lng,
                district_id = excluded.district_id,
                district = excluded.district,
                categories_json = excluded.categories_json,
                source_kind = excluded.source_kind,
                source_ids_json = excluded.source_ids_json,
                source_urls_json = excluded.source_urls_json,
                license = excluded.license,
                attribution = excluded.attribution,
                verification_status = excluded.verification_status,
                linked_destination_id = excluded.linked_destination_id,
                opening_hours = COALESCE(excluded.opening_hours, attractions.opening_hours),
                typical_visit_minutes = COALESCE(excluded.typical_visit_minutes, attractions.typical_visit_minutes),
                retrieved_at = excluded.retrieved_at,
                updated_at = excluded.updated_at
            """,
            (
                attraction.id,
                attraction.name,
                attraction.lat,
                attraction.lng,
                attraction.district_id,
                attraction.district,
                json.dumps(attraction.categories),
                attraction.source_kind.value,
                json.dumps(attraction.source_ids),
                json.dumps(attraction.source_urls),
                attraction.license,
                attraction.attribution,
                attraction.verification_status,
                attraction.linked_destination_id,
                attraction.opening_hours,
                attraction.typical_visit_minutes,
                attraction.retrieved_at,
                now_iso,
            ),
        )
        return True


def log_ingestion(
    source_id: str,
    fetched: int,
    inserted: int,
    updated: int,
    skipped: int,
    status: str,
    message: str = "",
    db_path: Optional[Path] = None,
) -> None:
    now_iso = datetime.now(timezone.utc).isoformat()
    with get_connection(db_path) as conn:
        conn.execute(
            """
            INSERT INTO ingestion_logs (
                source_id, fetched_count, inserted_count, updated_count,
                skipped_count, status, message, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (source_id, fetched, inserted, updated, skipped, status, message, now_iso),
        )


def get_destination(destination_id: str, db_path: Optional[Path] = None) -> Optional[DestinationRecord]:
    with get_connection(db_path) as conn:
        cursor = conn.execute("SELECT * FROM destinations WHERE id = ?", (destination_id.strip().lower(),))
        row = cursor.fetchone()
        if not row:
            return None
        return _row_to_destination(row)


def list_destinations(
    district_id: Optional[str] = None,
    region: Optional[str] = None,
    db_path: Optional[Path] = None,
) -> list[DestinationRecord]:
    query = "SELECT * FROM destinations WHERE 1=1"
    params: list[Any] = []
    if district_id:
        query += " AND district_id = ?"
        params.append(district_id.strip().lower())
    if region:
        query += " AND LOWER(region) = ?"
        params.append(region.strip().lower())
    query += " ORDER BY name ASC"

    with get_connection(db_path) as conn:
        cursor = conn.execute(query, params)
        return [_row_to_destination(row) for row in cursor.fetchall()]


def list_attractions(
    district_id: Optional[str] = None,
    linked_destination_id: Optional[str] = None,
    db_path: Optional[Path] = None,
) -> list[Attraction]:
    query = "SELECT * FROM attractions WHERE 1=1"
    params: list[Any] = []
    if district_id:
        query += " AND district_id = ?"
        params.append(district_id.strip().lower())
    if linked_destination_id:
        query += " AND linked_destination_id = ?"
        params.append(linked_destination_id.strip().lower())
    query += " ORDER BY name ASC"

    with get_connection(db_path) as conn:
        cursor = conn.execute(query, params)
        return [_row_to_attraction(row) for row in cursor.fetchall()]


def list_districts(db_path: Optional[Path] = None) -> list[District]:
    with get_connection(db_path) as conn:
        cursor = conn.execute("SELECT * FROM districts ORDER BY name ASC")
        return [_row_to_district(row) for row in cursor.fetchall()]


def get_district_coverage(db_path: Optional[Path] = None) -> list[DistrictCoverage]:
    """Calculate destination and attraction counts across all 31 districts."""
    with get_connection(db_path) as conn:
        cursor = conn.execute(
            """
            SELECT
                d.id AS district_id,
                d.name AS name,
                d.division AS division,
                COUNT(DISTINCT dest.id) AS destination_count,
                COUNT(DISTINCT attr.id) AS attraction_count,
                GROUP_CONCAT(DISTINCT dest.categories_json) AS categories_agg
            FROM districts d
            LEFT JOIN destinations dest ON d.id = dest.district_id
            LEFT JOIN attractions attr ON d.id = attr.district_id
            GROUP BY d.id
            ORDER BY d.name ASC
            """
        )
        results = []
        for row in cursor.fetchall():
            cats = set()
            if row["categories_agg"]:
                for sublist in row["categories_agg"].split("],["):
                    cleaned = sublist.replace("[", "").replace("]", "").replace('"', "")
                    for item in cleaned.split(","):
                        item = item.strip()
                        if item:
                            cats.add(item)
            dest_count = row["destination_count"]
            results.append(
                DistrictCoverage(
                    district_id=row["district_id"],
                    name=row["name"],
                    division=row["division"],
                    destination_count=dest_count,
                    attraction_count=row["attraction_count"],
                    categories=sorted(cats),
                    low_coverage=(dest_count == 0),
                )
            )
        return results


def get_counts(db_path: Optional[Path] = None) -> dict[str, int]:
    with get_connection(db_path) as conn:
        dest_count = conn.execute("SELECT COUNT(*) FROM destinations").fetchone()[0]
        dist_count = conn.execute("SELECT COUNT(*) FROM districts").fetchone()[0]
        attr_count = conn.execute("SELECT COUNT(*) FROM attractions").fetchone()[0]
        return {
            "destinations": dest_count,
            "districts": dist_count,
            "attractions": attr_count,
        }


def is_database_populated(db_path: Optional[Path] = None) -> bool:
    path = db_path or get_db_path()
    if not path.exists():
        return False
    try:
        counts = get_counts(path)
        return counts["destinations"] > 0 and counts["districts"] == 31
    except Exception:
        return False


def seed_base_catalog(db_path: Optional[Path] = None) -> None:
    """Seed initial districts and curated destinations from canonical JSON files."""
    init_db(db_path)
    from app.data.districts import all_districts, resolve_district
    from app.data.loader import all_destinations

    for district in all_districts():
        upsert_district(district, db_path=db_path)

    for dest in all_destinations():
        if not dest.district_id and dest.district:
            matched_dist = resolve_district(dest.district)
            if matched_dist:
                dest = dest.model_copy(update={"district_id": matched_dist.id})
        upsert_destination(dest, preserve_curated=False, db_path=db_path)


# ---------------------------------------------------------------------------
# Route-discovery cache (short-lived external results, TTL-bounded)
# ---------------------------------------------------------------------------


def cache_put(
    cache_key: str,
    kind: str,
    origin_id: str,
    destination_id: str,
    payload: dict,
    ttl_seconds: int,
    db_path: Optional[Path] = None,
) -> None:
    now = datetime.now(timezone.utc)
    expires = now.timestamp() + max(60, ttl_seconds)
    with get_connection(db_path) as conn:
        conn.execute(
            """
            INSERT INTO route_cache (cache_key, kind, origin_id, destination_id, payload_json, retrieved_at, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(cache_key) DO UPDATE SET
                payload_json = excluded.payload_json,
                retrieved_at = excluded.retrieved_at,
                expires_at = excluded.expires_at
            """,
            (
                cache_key,
                kind,
                origin_id,
                destination_id,
                json.dumps(payload),
                now.isoformat(),
                datetime.fromtimestamp(expires, tz=timezone.utc).isoformat(),
            ),
        )


def cache_get(cache_key: str, db_path: Optional[Path] = None) -> Optional[dict]:
    """Return {'payload', 'retrieved_at', 'stale'} for a fresh-or-stale entry, else None."""
    with get_connection(db_path) as conn:
        row = conn.execute(
            "SELECT payload_json, retrieved_at, expires_at FROM route_cache WHERE cache_key = ?",
            (cache_key,),
        ).fetchone()
    if row is None:
        return None
    now_iso = datetime.now(timezone.utc).isoformat()
    return {
        "payload": json.loads(row["payload_json"]),
        "retrieved_at": row["retrieved_at"],
        "stale": row["expires_at"] < now_iso,
    }


def cache_purge_expired(db_path: Optional[Path] = None) -> int:
    now_iso = datetime.now(timezone.utc).isoformat()
    with get_connection(db_path) as conn:
        cursor = conn.execute("DELETE FROM route_cache WHERE expires_at < ?", (now_iso,))
        return cursor.rowcount