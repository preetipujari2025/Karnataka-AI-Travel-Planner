"""Normalizer and validator for ingested tourism records.

Validates coordinates within Karnataka boundaries, resolves administrative districts,
standardizes categories and experience types, and prepares safe Pydantic models.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from typing import Optional

from app.data.districts import resolve_district
from app.ingest.sources import RawCandidate
from app.schemas import (
    KARNATAKA_BOUNDS,
    Attraction,
    DailyCost,
    DataConfidence,
    DestinationRecord,
    ExperienceType,
    FieldVerification,
    ProvenanceEntry,
    RecordClass,
)
from app.services.routing import haversine_coords

logger = logging.getLogger(__name__)

_ID_CLEAN_RE = re.compile(r"[^a-z0-9-]+")


def normalize_slug(name_or_id: str) -> str:
    """Produce a clean lowercase slug suitable for a primary key."""
    slug = name_or_id.strip().lower().replace(" ", "-")
    slug = _ID_CLEAN_RE.sub("", slug)
    return slug.strip("-")


def is_within_karnataka(lat: Optional[float], lng: Optional[float]) -> bool:
    if lat is None or lng is None:
        return False
    return (
        KARNATAKA_BOUNDS["lat_min"] <= lat <= KARNATAKA_BOUNDS["lat_max"]
        and KARNATAKA_BOUNDS["lng_min"] <= lng <= KARNATAKA_BOUNDS["lng_max"]
    )


def is_spatially_duplicate(
    lat: float,
    lng: float,
    existing_coords: list[tuple[float, float, str]],
    threshold_km: float = 2.5,
) -> Optional[str]:
    """Check if given coordinates are within threshold_km of an existing destination."""
    for ex_lat, ex_lng, ex_id in existing_coords:
        dist = haversine_coords(lat, lng, ex_lat, ex_lng)
        if dist < threshold_km:
            return ex_id
    return None


def candidate_to_destination(
    candidate: RawCandidate,
    retrieved_iso: Optional[str] = None,
) -> Optional[DestinationRecord]:
    """Transform and validate a RawCandidate into a DestinationRecord."""
    if not is_within_karnataka(candidate.lat, candidate.lng):
        logger.error(
            "Candidate '%s' coordinates (%s, %s) outside Karnataka bounds",
            candidate.id,
            candidate.lat,
            candidate.lng,
        )
        return None

    resolved_dist = resolve_district(candidate.district_raw)
    district_id = resolved_dist.id if resolved_dist else None
    district_name = resolved_dist.name if resolved_dist else candidate.district_raw

    # Convert experience types
    exps: list[ExperienceType] = []
    for exp_str in candidate.experience_types:
        try:
            exps.append(ExperienceType(exp_str))
        except ValueError:
            pass
    if not exps:
        exps = [ExperienceType.sightseeing]

    now_iso = retrieved_iso or datetime.now(timezone.utc).strftime("%Y-%m-%d")

    provenance = [
        ProvenanceEntry(
            source_id=candidate.source_name,
            source_url=candidate.source_url,
            license=candidate.license,
            attribution=candidate.attribution,
            retrieved_at=now_iso,
            verification_status="verified",
        )
    ]

    daily_cost = DailyCost(
        budget=candidate.daily_cost_budget,
        mid=candidate.daily_cost_mid,
        luxury=candidate.daily_cost_luxury,
    )

    field_ver: dict[str, FieldVerification] = {
        "lat": FieldVerification.verified,
        "lng": FieldVerification.verified,
        "entry_fees_inr": FieldVerification.verified if candidate.entry_fees_inr is not None else FieldVerification.estimated,
        "best_months": FieldVerification.verified,
    }

    try:
        record = DestinationRecord(
            id=normalize_slug(candidate.id),
            name=candidate.name,
            region=candidate.region,
            district=district_name,
            district_id=district_id,
            record_class=RecordClass.imported,
            lat=candidate.lat,
            lng=candidate.lng,
            categories=candidate.categories,
            interest_tags=candidate.interest_tags,
            experience_types=exps,
            is_start_hub=False,
            description=candidate.description,
            highlights=candidate.highlights,
            best_months=candidate.best_months,
            season_note=candidate.season_note,
            min_nights=max(1, candidate.min_nights),
            typical_nights=max(1, candidate.typical_nights),
            daily_cost_inr=daily_cost,
            entry_fees_inr=candidate.entry_fees_inr,
            entry_fee_note=candidate.entry_fee_note,
            activity_cost_inr=None,
            family_friendly=candidate.family_friendly,
            accessibility_notes=candidate.accessibility_notes,
            sources=[candidate.source_url],
            data_confidence=DataConfidence.verified,
            last_verified_on=now_iso,
            field_verification=field_ver,
            provenance=provenance,
        )
        return record
    except Exception as exc:
        logger.error("Failed to model_validate destination for '%s': %s", candidate.id, exc)
        return None


def candidate_to_attraction(candidate: RawCandidate) -> Optional[Attraction]:
    """Transform a RawCandidate into an Attraction point of interest."""
    if not is_within_karnataka(candidate.lat, candidate.lng):
        return None

    resolved_dist = resolve_district(candidate.district_raw)
    district_id = resolved_dist.id if resolved_dist else None
    district_name = resolved_dist.name if resolved_dist else candidate.district_raw

    try:
        return Attraction(
            id=normalize_slug(candidate.id),
            name=candidate.name,
            lat=candidate.lat,
            lng=candidate.lng,
            district_id=district_id,
            district=district_name,
            categories=candidate.categories,
            source_kind=RecordClass.imported,
            source_ids=[candidate.source_name],
            source_urls=[candidate.source_url],
            license=candidate.license,
            attribution=candidate.attribution,
            verification_status="verified",
            linked_destination_id=candidate.linked_destination_id,
        )
    except Exception as exc:
        logger.error("Failed to model_validate attraction for '%s': %s", candidate.id, exc)
        return None
