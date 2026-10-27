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
    "beaches": ["beach"],
    "adventure": ["adventure", "hills"],
    "spirituality": ["spiritual"],
    "spiritual": ["spiritual"],
    "wildlife": ["wildlife"],
    "food": ["food", "urban"],
    "urban": ["urban"],
    "photography": ["nature", "hills", "beach", "heritage"],
    "temples": ["spiritual", "heritage"],
    "waterfalls": ["nature"],
    "viewpoints": ["nature", "hills", "adventure"],
    "shopping": ["urban", "food"],
    "culture": ["heritage", "spiritual"],
    "coffee_hills": ["hills", "nature"],
    "hills": ["hills"],
    "coffee": ["hills"],
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
    """0..1 match between traveller interests and destination categories/tags.
    
    Exact primary category and tag matches receive full weight; secondary/associated
    categories receive partial weight to break ties naturally.
    """
    matched: list[str] = []
    total_weight = 0.0
    for interest in interests:
        wanted = INTEREST_CATEGORIES.get(interest, [interest])
        # Direct category match (e.g. 'adventure' in categories, or primary wanted category)
        exact_cat = interest in destination.categories or (len(wanted) > 0 and wanted[0] in destination.categories)
        tag_match = any(
            interest.lower() in tag.lower()
            or any(w in tag.lower() for w in wanted)
            for tag in destination.interest_tags
        )
        secondary_cat = any(category in wanted for category in destination.categories)

        if exact_cat:
            total_weight += 1.0
            matched.append(interest)
        elif tag_match:
            total_weight += 0.95
            matched.append(interest)
        elif secondary_cat:
            total_weight += 0.8
            matched.append(interest)

    ratio = min(1.0, total_weight / max(len(interests), 1))
    return ratio, matched


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
    total_budget = getattr(request, "total_budget_inr", None)
    if total_budget is not None and request.days > 0 and request.travellers > 0:
        daily_target = (total_budget * 0.85) / (request.days * request.travellers)
        if cost <= daily_target * 0.7:
            score += 16
            reasons.append("comfortably within stated INR budget")
        elif cost <= daily_target:
            score += 8
            reasons.append("within stated INR budget")
        else:
            penalty = min(22.0, 8.0 + ((cost - daily_target) / max(daily_target, 1)) * 14.0)
            score -= penalty
            reasons.append("above stated daily INR budget")
    else:
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

    # Season fit: in-season destinations strongly preferred; out-of-season penalised
    if destination.best_months:
        if season_score(destination, month):
            score += 20
            reasons.append(f"prime season in month {month}")
        else:
            score -= 30
            reasons.append(f"outside ideal season for month {month}")
    else:
        reasons.append("season information pending verification")

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

    # Overarching experience preference impacts scoring significantly
    if getattr(request, "experience_preference", None):
        exp_pref = request.experience_preference
        val = getattr(exp_pref, "value", str(exp_pref))
        if val == "relaxed":
            if any(c in ("nature", "hills", "beach") for c in destination.categories):
                score += 10
                reasons.append("suits relaxed pacing")
        elif val == "adventure":
            if "adventure" in destination.categories or any("trek" in t or "raft" in t for t in destination.interest_tags):
                score += 12
                reasons.append("matches adventure profile")
        elif val == "cultural":
            if "heritage" in destination.categories or "spiritual" in destination.categories:
                score += 12
                reasons.append("matches cultural heritage focus")
        elif val == "family":
            if destination.family_friendly is True:
                score += 10
                reasons.append("family-friendly destination")
        elif val == "solo":
            if any(t in destination.interest_tags for t in ("cafes", "markets", "sunsets")) or destination.id in ("gokarna", "hampi", "bengaluru", "mysuru", "udupi"):
                score += 14
                reasons.append("solo-traveller friendly hub")
        elif val == "couple":
            if destination.id in ("madikeri", "chikkamagaluru", "kabini", "gokarna", "agumbe") or any(c in ("hills", "beach") for c in destination.categories):
                score += 14
                reasons.append("romantic scenic destination")
        elif val == "luxury":
            if destination.id in ("kabini", "mysuru", "bengaluru", "madikeri", "bandipur") or (destination.daily_cost_inr and destination.daily_cost_inr.luxury >= 8000):
                score += 10
                reasons.append("premium luxury destination")
        elif val == "budget_backpacking":
            if (destination.daily_cost_inr and destination.daily_cost_inr.budget <= 1500) or destination.id in ("hampi", "gokarna", "shravanabelagola", "melkote", "belur"):
                score += 10
                reasons.append("budget backpacking destination")

    # Family preference rewards destinations documented as family friendly.
    if (
        (request.family_preference is FamilyPreference.with_children or getattr(request, "traveller_type", None) == "family")
        and destination.family_friendly is True
        and "family-friendly destination" not in reasons
    ):
        score += 5
        reasons.append("documented as family friendly")

    return ScoredDestination(destination=destination, score=round(score, 2), reasons=tuple(reasons))


def _haversine_distance_km(a: DestinationRecord, b: DestinationRecord) -> float:
    """Great-circle distance in km between two destinations without circular imports."""
    if a.lat is None or a.lng is None or b.lat is None or b.lng is None:
        return 9999.0
    import math
    lat1, lon1, lat2, lon2 = map(math.radians, [float(a.lat), float(a.lng), float(b.lat), float(b.lng)])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * 6371.0 * math.asin(math.sqrt(h))


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

    Greedy by score, filtered by geographic reachability so short trips never
    send the traveller across the state in a single day, then re-ordered
    geographically by the routing module.
    """
    ranked = rank_destinations(request, month)
    start = get_destination(request.start_city)

    # Destinations without coordinates cannot be routed or mapped.
    ranked = [item for item in ranked if item.destination.has_usable_coords]

    chosen: list[ScoredDestination] = []
    total_nights = 0

    # Always begin in the start city (one night) unless it was scored terribly
    if start is not None:
        start_scored = next((s for s in ranked if s.destination.id == start.id), None)
        if start_scored is None:
            effective_month = month or request.start_month or default_start_month()
            start_scored = score_destination(start, request, effective_month)
        chosen.append(start_scored)
        start_initial_nights = max(start.min_nights, 1) if request.days > start.min_nights else request.days
        total_nights += start_initial_nights

    final_id = getattr(request, "final_destination", None)
    final = get_destination(final_id) if final_id else None
    if final is not None and start is not None and final.id == start.id:
        final = None
    if final is not None and total_nights < request.days:
        final_scored = next((s for s in ranked if s.destination.id == final.id), None)
        if final_scored is None:
            effective_month = month or request.start_month or default_start_month()
            final_scored = score_destination(final, request, effective_month)
        chosen.append(final_scored)
        total_nights += min(stay_nights(final, request.pace), max(1, request.days - total_nights))

    def _is_geographically_viable(candidate: DestinationRecord) -> bool:
        """Never send the traveller across the state in one day."""
        if not chosen:
            return True
        if candidate.lat is None:
            return False

        if request.days <= 3:
            dist_from_start = _haversine_distance_km(candidate, start) if (start and start.lat is not None) else 0
            if dist_from_start > 215:
                return False
            non_start_chosen = [c for c in chosen if start is None or c.destination.id != start.id]
            if non_start_chosen:
                anchor = non_start_chosen[0].destination
                if anchor.lat is not None:
                    dist_from_anchor = _haversine_distance_km(candidate, anchor)
                    if dist_from_anchor > 120:
                        return False
            return True

        return True

    # Pass 1: Add highest-scoring destinations that are geographically coherent
    for item in ranked:
        if len(chosen) >= 6:
            break
        if item.destination.id in {c.destination.id for c in chosen}:
            continue
        if not _is_geographically_viable(item.destination):
            continue
        nights = stay_nights(item.destination, request.pace)
        remaining = request.days - total_nights
        if remaining <= 0:
            break
        if nights > remaining:
            if remaining >= item.destination.min_nights:
                nights = remaining
            else:
                continue
        chosen.append(item)
        total_nights += nights

    # Pass 2: If days remain, relax distance constraint (for trips > 3 days)
    if total_nights < request.days:
        for item in ranked:
            if len(chosen) >= 6:
                break
            if item.destination.id in {c.destination.id for c in chosen}:
                continue
            if request.days <= 3 and not _is_geographically_viable(item.destination):
                continue
            nights = stay_nights(item.destination, request.pace)
            remaining = request.days - total_nights
            if remaining <= 0:
                break
            if nights > remaining:
                if remaining >= item.destination.min_nights:
                    nights = remaining
                else:
                    continue
            chosen.append(item)
            total_nights += nights

    # Fill any leftover days with the best remaining fits (respecting min_nights).
    for item in ranked:
        if request.days - total_nights <= 0:
            break
        if item.destination.id in {c.destination.id for c in chosen}:
            continue
        if request.days <= 3 and not _is_geographically_viable(item.destination):
            continue
        remaining = request.days - total_nights
        if item.destination.min_nights <= remaining:
            chosen.append(item)
            total_nights += item.destination.min_nights

    return chosen


def find_suitable_substitutions(
    stop: DestinationRecord,
    request: TripPreferences,
    excluded_ids: set[str],
    max_km: float = 160.0,
    limit: int = 2,
) -> list[tuple[DestinationRecord, str]]:
    """Find catalog substitutions within ~150 km of the replaced stop that match traveller interests.

    Ensures substitutions are geographically coherent and relevant, avoiding
    suggestions like proposing Bengaluru/Mysuru (400+ km away) for Gokarna.
    """
    if stop.lat is None or stop.lng is None:
        return []

    requested_interest_names = [i.value for i in request.interests]
    relevant_cats: set[str] = set()
    for int_name in requested_interest_names:
        relevant_cats.update(INTEREST_CATEGORIES.get(int_name, [int_name]))

    candidates: list[tuple[DestinationRecord, float, int, str]] = []

    for d in all_destinations():
        if d.id in excluded_ids or d.id == stop.id:
            continue
        if not d.has_usable_coords or d.lat is None or d.lng is None:
            continue

        dist_km = _haversine_distance_km(stop, d)
        if dist_km > max_km:
            continue

        cand_cats = set(d.categories) | set(d.interest_tags)
        overlap = cand_cats & relevant_cats
        overlap_count = len(overlap)

        matched_str = ", ".join(sorted(overlap)[:2]) if overlap else (d.categories[0] if d.categories else "scenic")
        reason = (
            f"Alternative in {d.region} (~{int(dist_km)} km from {stop.name}) "
            f"matching your interests in {matched_str}, known for {', '.join(d.highlights[:2])}."
        )

        candidates.append((d, dist_km, overlap_count, reason))

    # Sort candidates: first by interest overlap descending, then by distance ascending
    candidates.sort(key=lambda x: (-x[2], x[1]))

    if not candidates and max_km < 220.0:
        return find_suitable_substitutions(stop, request, excluded_ids, max_km=220.0, limit=limit)

    return [(cand, reason) for cand, dist, overlap, reason in candidates[:limit]]


def find_corridor_candidates(
    stops: list[DestinationRecord],
    request: TripPreferences,
    limit: int = 6,
    max_km: float = 180.0,
) -> list[DestinationRecord]:
    """Find catalog destinations near trip stops to provide as viable candidates to the AI."""
    stop_ids = {s.id for s in stops}
    scored: list[tuple[DestinationRecord, float]] = []

    for d in all_destinations():
        if d.id in stop_ids or not d.has_usable_coords or d.lat is None or d.lng is None:
            continue
        min_dist = min((_haversine_distance_km(s, d) for s in stops if s.lat is not None), default=9999.0)
        if min_dist <= max_km:
            scored.append((d, min_dist))

    scored.sort(key=lambda x: x[1])
    if len(scored) < limit:
        remaining = [
            (d, min((_haversine_distance_km(s, d) for s in stops if s.lat is not None), default=9999.0))
            for d in all_destinations()
            if d.id not in stop_ids and d.id not in {x[0].id for x in scored} and d.has_usable_coords
        ]
        remaining.sort(key=lambda x: x[1])
        scored.extend(remaining)

    return [d for d, _ in scored[:limit]]

