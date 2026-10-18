"""Validate the Karnataka destination dataset from the command line.

Usage (from backend/):
    python scripts/validate_dataset.py

Exit codes:
    0 = dataset is valid (warnings may still be printed)
    1 = dataset has content errors (dup ids, bad schema, bad coordinates, ...)
    2 = dataset file could not be read/parsed
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.data.loader import DatasetValidationError  # noqa: E402
from app.services.destination_service import load_and_validate  # noqa: E402


def main() -> int:
    try:
        report = load_and_validate()
    except DatasetValidationError as exc:
        print(f"FATAL: {exc}")
        return 2

    print(f"Dataset: {report.source}")
    print(f"Records: {report.destination_count}")
    print()

    if report.errors:
        print(f"ERRORS ({len(report.errors)}):")
        for error in report.errors:
            print(f"  x {error}")
        print()

    if report.warnings:
        print(f"WARNINGS ({len(report.warnings)}):")
        for warning in report.warnings:
            print(f"  ! {warning}")
        print()

    verified = report.destination_count - len(report.estimated_or_unverified_ids)
    print(f"Verification status ({verified} verified):")
    print(f"  verified  : {verified}")
    print(f"  estimated : {len(report.estimated_ids)} -> {', '.join(report.estimated_ids) or '-'}")
    print(f"  unverified: {len(report.unverified_ids)} -> {', '.join(report.unverified_ids) or '-'}")
    print()
    print(
        f"Entry fee unknown for {len(report.unknown_fee_ids)} records; "
        f"missing coordinates for {len(report.missing_coordinates)} records; "
        f"no sources for {len(report.ids_without_sources)} records."
    )

    if not report.is_valid:
        print("\nRESULT: INVALID")
        return 1
    print("\nRESULT: VALID")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
