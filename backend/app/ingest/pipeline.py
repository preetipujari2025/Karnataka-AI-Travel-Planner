"""Ingestion Pipeline Runner and Coverage Reporter.

Coordinates data extraction, normalization, deduplication, and safe upserts
into the SQLite store, providing rich CLI diagnostics and coverage reporting.
"""

from __future__ import annotations

import argparse
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from app.data import store
from app.ingest.normalizer import (
    candidate_to_attraction,
    candidate_to_destination,
    is_spatially_duplicate,
    normalize_slug,
)
from app.ingest.sources import DISTRICT_VERIFIED_CANDIDATES

logger = logging.getLogger(__name__)


def run_pipeline(db_path: Optional[Path] = None, dry_run: bool = False) -> dict[str, Any]:
    """Execute the full data ingestion pipeline."""
    # 1. Initialize store and seed base catalog if needed
    store.init_db(db_path=db_path)
    if not store.is_database_populated(db_path=db_path):
        logger.info("Database not yet populated; seeding base catalog...")
        store.seed_base_catalog(db_path=db_path)

    # 2. Get current records for deduplication check
    existing_destinations = store.list_destinations(db_path=db_path)
    existing_ids = {d.id for d in existing_destinations}
    existing_coords = [
        (d.lat, d.lng, d.id) for d in existing_destinations if d.lat is not None and d.lng is not None
    ]

    fetched_count = len(DISTRICT_VERIFIED_CANDIDATES)
    inserted_destinations = 0
    updated_destinations = 0
    skipped_destinations = 0
    inserted_attractions = 0

    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    for candidate in DISTRICT_VERIFIED_CANDIDATES:
        cand_slug = normalize_slug(candidate.id)

        # Spatial / ID deduplication check
        if cand_slug in existing_ids:
            # Already exists; let safe upsert handle update or preserve curated
            dest = candidate_to_destination(candidate, retrieved_iso=now_iso)
            if dest and not dry_run:
                is_new = store.upsert_destination(dest, preserve_curated=True, db_path=db_path)
                if is_new:
                    inserted_destinations += 1
                else:
                    updated_destinations += 1
            else:
                updated_destinations += 1
            continue

        # Proximity duplicate check against existing points
        close_id = is_spatially_duplicate(candidate.lat, candidate.lng, existing_coords, threshold_km=2.5)
        if close_id and not candidate.is_attraction_only:
            logger.info(
                "Candidate '%s' is within 2.5km of existing destination '%s'; registering as attraction",
                candidate.name,
                close_id,
            )
            candidate.linked_destination_id = close_id
            candidate.is_attraction_only = True

        if candidate.is_attraction_only:
            attraction = candidate_to_attraction(candidate)
            if attraction and not dry_run:
                store.upsert_attraction(attraction, db_path=db_path)
                inserted_attractions += 1
        else:
            dest = candidate_to_destination(candidate, retrieved_iso=now_iso)
            if dest:
                if not dry_run:
                    is_new = store.upsert_destination(dest, preserve_curated=True, db_path=db_path)
                    # Also register as attraction so map marker endpoints can access all POIs
                    attr = candidate_to_attraction(candidate)
                    if attr:
                        store.upsert_attraction(attr, db_path=db_path)
                        inserted_attractions += 1

                    existing_ids.add(dest.id)
                    existing_coords.append((dest.lat, dest.lng, dest.id))
                    if is_new:
                        inserted_destinations += 1
                    else:
                        updated_destinations += 1
                else:
                    inserted_destinations += 1
            else:
                skipped_destinations += 1

    status = "success" if not dry_run else "dry_run"
    msg = (
        f"Fetched {fetched_count} candidates: {inserted_destinations} new destinations, "
        f"{updated_destinations} updated, {inserted_attractions} attractions, {skipped_destinations} skipped."
    )

    if not dry_run:
        store.log_ingestion(
            source_id="karnataka_ingest_pipeline",
            fetched=fetched_count,
            inserted=inserted_destinations,
            updated=updated_destinations,
            skipped=skipped_destinations,
            status=status,
            message=msg,
            db_path=db_path,
        )

    counts = store.get_counts(db_path=db_path)
    return {
        "fetched": fetched_count,
        "inserted_destinations": inserted_destinations,
        "updated_destinations": updated_destinations,
        "inserted_attractions": inserted_attractions,
        "skipped": skipped_destinations,
        "total_destinations": counts["destinations"],
        "total_districts": counts["districts"],
        "total_attractions": counts["attractions"],
        "message": msg,
    }


def format_coverage_report(db_path: Optional[Path] = None) -> str:
    """Generate a formatted markdown coverage report for all 31 districts."""
    coverage = store.get_district_coverage(db_path=db_path)
    counts = store.get_counts(db_path=db_path)

    lines = [
        "# Karnataka Tourism Catalogue Coverage Report",
        f"**Generated**: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
        f"**Total Destinations**: {counts['destinations']} | **Total Attractions**: {counts['attractions']} | **Total Districts**: {counts['districts']}",
        "",
        "| District | Division | Destinations | Attractions | Categories | Status |",
        "| :--- | :--- | :---: | :---: | :--- | :---: |",
    ]

    zero_count = 0
    low_count = 0
    good_count = 0

    for cov in coverage:
        div = cov.division or "—"
        cats = ", ".join(cov.categories[:3]) if cov.categories else "—"
        if cov.destination_count == 0:
            status = "[ZERO]"
            zero_count += 1
        elif cov.destination_count == 1:
            status = "[LOW]"
            low_count += 1
        else:
            status = "[GOOD]"
            good_count += 1

        lines.append(
            f"| **{cov.name}** | {div} | {cov.destination_count} | {cov.attraction_count} | {cats} | {status} |"
        )

    lines.extend(
        [
            "",
            "### Summary Statistics",
            f"- **Districts with Good Coverage (2+ destinations)**: {good_count} / 31",
            f"- **Districts with Low Coverage (1 destination)**: {low_count} / 31",
            f"- **Districts with Zero Coverage**: {zero_count} / 31",
        ]
    )

    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Karnataka Tourism Ingestion Pipeline")
    parser.add_argument("command", choices=["run", "report", "seed"], default="run", nargs="?")
    parser.add_argument("--dry-run", action="store_true", help="Simulate without writing to database")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    if args.command == "seed":
        print("Seeding base catalog into SQLite...")
        store.seed_base_catalog()
        print("Seeding complete.")
        return 0

    if args.command == "report":
        print(format_coverage_report())
        return 0

    if args.command == "run":
        print(f"Running Karnataka tourism data ingestion (dry_run={args.dry_run})...")
        summary = run_pipeline(dry_run=args.dry_run)
        print(summary["message"])
        print()
        print(format_coverage_report())
        return 0

    return 0


if __name__ == "__main__":
    sys.exit(main())
