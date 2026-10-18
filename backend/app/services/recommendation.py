"""Recommendation logic: score and select destinations for a trip.

Kept separate from planning so it can be unit tested and reused.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from app.data.loader import all_destinations, get_destination
from app.schemas import BudgetTier, DestinationRecord, ExperienceType, FamilyPreference, Pace, TripPreferences

# Which dataset categories satisfy each traveller interest.
INTEREST_CATEGORIES: dict[str, list[str]] = {
    "heritage": ["heritage"],
    "nature": ["nature", "hills"],
    "beach": ["beach"],
    "adventure": ["adventure", "hills"],
    "spirituality": ["spiritual"],
    "wildlife": ["wildlife"],
    "food": ["food", "urban"],
    "urban": ["urban"],
    "photography": ["nature", "hills", "beach", "heritage"],
    "temples": ["spiritual", "heritage"],
    "waterfalls": ["nature"],
    "viewpoints": ["nature", "hills", "adventure"],
    "shopping": ["urban", "food"],
    "culture": ["heritage", "spiritual"],
}

# Per-person daily ceilings (INR) used to test tier affordability.
TIER_DAILY_CEILING: dict[BudgetTier, int] = {
    BudgetTier.budget: 2000,
    BudgetTier.mid: 5500,
    BudgetTier.luxury: 15000,
}

# How many nights a destination keeps at a given pace.
PACE_NIGHTS_FACTOR: dict[Pace, float] = {
    Pace.relaxed: 1.5,
    Pace.balanced: 1.0,
    Pace.packed: 0.67,
}


@dataclass(frozen=True)
class ScoredDestination:
    destination: DestinationRecord
    score: float
    reasons: tuple[str, ...]


def default_start_month() -> int:
    return date.today().month


def interest_score(destination: DestinationRecord, interests: list[str]) -> tuple[float, list[str]]:
    """0..1 match between traveller interests and destination categories."""
    matched: list[str] = []
    hits = 0
    for interest in interests:
        wanted = INTEREST_CATEGORIES.get(interest, [])
        if any(category in wanted for category in destination.categories):
            hits += 1
            matched.append(interest)
    return hits / max(len(interests), 1), matched


def season_score(destination: DestinationRecord, month: int) -> bool:
    return month in destination.best_months


def tier_daily_cost(destination: DestinationRecord, tier: BudgetTier) -> int:
    return getattr(destination.daily_cost_inr, tier.value)


def score_destination(
    destination: DestinationRecord, request: TripPreferences, month: int
) -> ScoredDestination:
    """Deterministic score in 0..100 with human-readable reasons."""
    match_ratio, matched = interest_score(destination, [i.value for i in request.interests])
    score = 55.0 * match_ratio
    reasons: list[str] = []
    if matched:
        reasons.append("matches interests: " + ", ".join(matched))

    # Budget fit: cheaper-than-ceiling gets partial credit, over-ceiling penalised.
    cost = tier_daily_cost(destination, request.budget_tier)
    ceiling = TIER_DAILY_CEILING[request.budget_tier]
    if cost <= ceiling * 0.6:
        score += 15
        reasons.append("comfortably within tier budget")
    elif cost <= ceiling:
        score += 8
        reasons.append("within tier budget")
    else:
        score -= 12
        reasons.append("above typical tier budget")

    # Season fit.
    if season_score(destination, month):
        score += 15
        reasons.append("good in selected month")
    else:
        score -= 5

    # Time fit: a place whose stay does not fit the trip length is penalised.
    nights = stay_nights(destination, request.pace)
    if nights <= request.days:
        score += 10
    else:
        score -= 20
        reasons.append("needs more days than requested")

    # Start-city proximity bonus (cheap first hop).
    start = get_destination(request.start_city)
    if start is not None and destination.id == start.id:
        score += 5

    # Preferred experience types are a bonus, not a hard filter.
    if request.experience_types:
        experience_hits = sum(
            1 for e in request.experience_types if e in destination.experience_types
        )
        if experience_hits:
            score += min(12, 6 * experience_hits)
            reasons.append("matches preferred experiences")

    # Family preference rewards destinations documented as family friendly.
    if (
        request.family_preference is FamilyPreference.with_children
        and destination.family_friendly is True
    ):
        score += 5
        reasons.append("documented as family friendly")

    return ScoredDestination(destination=destination, score=round(score, 2), reasons=tuple(reasons))


def stay_nights(destination: DestinationRecord, pace: Pace) -> int:
    """Nights this destination should get at the requested pace (clamped to >= min)."""
    factor = PACE_NIGHTS_FACTOR[pace]
    nights = round(destination.typical_nights * factor)
    return max(destination.min_nights, nights)


def rank_destinations(request: TripPreferences, month: int | None = None) -> list[ScoredDestination]:
    """Score all destinations; ties broken by id for determinism."""
    effective_month = month or request.start_month or default_start_month()
    scored = [score_destination(d, request, effective_month) for d in all_destinations()]
    scored.sort(key=lambda item: (-item.score, item.destination.id))
    return scored


def select_destinations(request: TripPreferences, month: int | None = None) -> list[ScoredDestination]:
    """Pick an ordered set of stops whose stay fits exactly into `days`.

    Greedy by score, then re-ordered geographically by the routing module.
    The start city is always included as day-1 anchor when it is part of the trip.
    """
    ranked = rank_destinations(request, month)
    start = get_destination(request.start_city)

    # Destinations without coordinates cannot be routed or mapped.
    ranked = [item for item in ranked if item.destination.has_usable_coords]

    chosen: list[ScoredDestination] = []
    total_nights = 0

    # Always begin in the start city (one night) unless it was scored terribly
    # (e.g. user picked a start hub far from their interests, still fine to pass through).
    if start is not None:
        start_scored = next((s for s in ranked if s.destination.id == start.id), None)
        if start_scored is None:
            effective_month = month or request.start_month or default_start_month()
            start_scored = score_destination(start, request, effective_month)
        chosen.append(start_scored)
        total_nights += stay_nights(start, request.pace)

    for item in ranked:
        if len(chosen) >= 6:
            break
        if item.destination.id in {c.destination.id for c in chosen}:
            continue
        nights = stay_nights(item.destination, request.pace)
        remaining = request.days - total_nights
        if remaining <= 0:
            break
        if nights > remaining:
            continue
        chosen.append(item)
        total_nights += nights

    # Fill any leftover days with the best remaining fits (respecting min_nights).
    for item in ranked:
        if request.days - total_nights <= 0:
            break
        if item.destination.id in {c.destination.id for c in chosen}:
            continue
        remaining = request.days - total_nights
        if item.destination.min_nights <= remaining:
            chosen.append(item)
            total_nights += item.destination.min_nights

    return chosen
