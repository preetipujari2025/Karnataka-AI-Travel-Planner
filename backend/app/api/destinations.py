"""Destination catalogue and planning metadata endpoints.

Thin HTTP layer over app.services.destination_service.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.data.loader import dataset_updated, start_hubs
from app.schemas import (
    Attraction,
    BudgetTier,
    DestinationRecord,
    DestinationSummary,
    DistrictCoverage,
    ExperienceType,
    Interest,
    InterestMeta,
    MapMarker,
    MapMarkersResponse,
    MetaResponse,
    NearbyDestination,
    Pace,
    RecordClass,
)
from app.services import destination_service as service

# No router-level prefix: included at BOTH /api/v1 (legacy) and /api (canonical).
router = APIRouter(tags=["destinations"])

INTEREST_META: list[InterestMeta] = [
    InterestMeta(value=Interest.heritage, label="Heritage", description="Forts, temples, ruins and museums"),
    InterestMeta(value=Interest.nature, label="Nature", description="Hills, waterfalls, forests and trails"),
    InterestMeta(value=Interest.beach, label="Beach", description="Coast, islands and seaside towns"),
    InterestMeta(value=Interest.adventure, label="Adventure", description="Rafting, trekking and jungle activities"),
    InterestMeta(value=Interest.spirituality, label="Spirituality", description="Temples, mathas and pilgrim towns"),
    InterestMeta(value=Interest.wildlife, label="Wildlife", description="Safaris and birding"),
    InterestMeta(value=Interest.food, label="Food", description="Regional cuisine and café culture"),
    InterestMeta(value=Interest.urban, label="Urban", description="City life, markets and nightlife"),
    InterestMeta(value=Interest.photography, label="Photography", description="Scenic and photogenic spots"),
]

PACE_NOTES = {
    "relaxed": "One highlight area per day, longer stays at each stop.",
    "balanced": "Two to three sights per day with travel mornings.",
    "packed": "Short stays, early starts, maximum coverage.",
}


def _summary(destination: DestinationRecord) -> DestinationSummary:
    return service.to_summary(destination)


@router.get("/destinations", response_model=list[DestinationSummary], summary="List destinations")
def list_destinations(
    interest: Optional[Interest] = Query(default=None, description="Filter by traveller interest"),
    region: Optional[str] = Query(default=None, description="Filter by region, case-insensitive"),
    experience: Optional[ExperienceType] = Query(default=None, description="Filter by experience type"),
    category: Optional[str] = Query(default=None, description="Filter by plain category tag"),
    q: Optional[str] = Query(default=None, min_length=1, max_length=100, description="Search destination names"),
    search: Optional[str] = Query(
        default=None, min_length=1, max_length=100, description="Alias for q"
    ),
    map_only: bool = Query(default=False, description="Only destinations with usable map coordinates"),
    limit: int = Query(50, ge=1, le=100, description="Page size (max 100)"),
    offset: int = Query(0, ge=0, description="Rows to skip for pagination"),
) -> list[DestinationSummary]:
    results = service.filter_destinations(
        region=region,
        interest=interest,
        experience=experience,
        category=category,
        map_only=map_only,
    )
    effective_query = search or q
    if effective_query is not None:
        # Full match set first, then intersect with the filters (never truncate
        # search results before combining with other filters).
        matched_ids = {d.id for d in service.search_by_name(effective_query, limit=None)}
        results = [d for d in results if d.id in matched_ids]
    page = results[offset : offset + limit]
    return [_summary(d) for d in page]


@router.get(
    "/destinations/nearby",
    response_model=list[NearbyDestination],
    summary="Destinations near a coordinate",
)
def destinations_nearby(
    lat: float = Query(..., ge=-90, le=90, description="Latitude in decimal degrees"),
    lng: float = Query(..., ge=-180, le=180, description="Longitude in decimal degrees"),
    limit: int = Query(5, ge=1, le=25),
    max_km: Optional[float] = Query(None, gt=0, description="Optional radius cap in km"),
) -> list[NearbyDestination]:
    try:
        return service.nearby(lat, lng, limit=limit, max_km=max_km)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/destinations/{destination_id}", response_model=DestinationRecord, summary="Get one destination")
def get_destination_detail(destination_id: str) -> DestinationRecord:
    destination = service.get_by_id(destination_id)
    if destination is None:
        raise HTTPException(status_code=404, detail=f"destination '{destination_id}' not found")
    return destination


@router.get("/meta", response_model=MetaResponse, summary="Form metadata for the planner UI")
def meta() -> MetaResponse:
    return MetaResponse(
        interests=INTEREST_META,
        budget_tiers=list(BudgetTier),
        paces=list(Pace),
        start_cities=[_summary(d) for d in start_hubs()],
        dataset_updated=dataset_updated(),
        example_pace_notes=PACE_NOTES,
        experience_types=list(ExperienceType),
    )


@router.get("/districts", response_model=list[DistrictCoverage], summary="District coverage statistics")
def list_districts() -> list[DistrictCoverage]:
    from app.data import store
    if store.is_database_populated():
        return store.get_district_coverage()
    from app.data.districts import all_districts
    from app.data.loader import all_destinations
    dests = all_destinations()
    return [
        DistrictCoverage(
            district_id=d.id,
            name=d.name,
            division=d.division,
            destination_count=sum(1 for x in dests if x.district_id == d.id or (x.district and x.district.lower() == d.name.lower())),
            attraction_count=0,
            categories=[],
            low_coverage=sum(1 for x in dests if x.district_id == d.id or (x.district and x.district.lower() == d.name.lower())) == 0,
        )
        for d in all_districts()
    ]


@router.get("/attractions", response_model=list[Attraction], summary="List discovered attractions")
def list_attractions(
    district_id: Optional[str] = Query(default=None, description="Filter by district slug"),
) -> list[Attraction]:
    from app.data import store
    if store.is_database_populated():
        return store.list_attractions(district_id=district_id)
    return []


@router.get("/map/markers", response_model=MapMarkersResponse, summary="Markers for map view")
def get_map_markers() -> MapMarkersResponse:
    from app.data import store
    from app.schemas import MapMarker, MapMarkersResponse, RecordClass

    markers: list[MapMarker] = []
    dest_count = 0
    attr_count = 0
    attributions: set[str] = {
        "© OpenStreetMap contributors",
        "Department of Tourism, Government of Karnataka (karnatakatourism.org)",
        "National Informatics Centre (NIC) / Government of Karnataka",
    }

    # Add destination markers
    for d in service.map_ready_destinations():
        dest_count += 1
        markers.append(
            MapMarker(
                id=d.id,
                name=d.name,
                lat=float(d.lat),
                lng=float(d.lng),
                kind="destination",
                source_kind=d.record_class,
                categories=list(d.categories),
                district_id=d.district_id,
            )
        )

    # Add attraction markers if database is populated
    if store.is_database_populated():
        for a in store.list_attractions():
            if a.lat is not None and a.lng is not None:
                attr_count += 1
                markers.append(
                    MapMarker(
                        id=a.id,
                        name=a.name,
                        lat=float(a.lat),
                        lng=float(a.lng),
                        kind="attraction",
                        source_kind=a.source_kind,
                        categories=list(a.categories),
                        district_id=a.district_id,
                    )
                )

    return MapMarkersResponse(
        markers=markers,
        destination_count=dest_count,
        attraction_count=attr_count,
        attribution=sorted(attributions),
    )

