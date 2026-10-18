"""Routing logic: geodesic distance, travel-time estimates and stop ordering.

Deterministic: haversine distance scaled by a road factor, then a speed model.
"""

from __future__ import annotations

import math

from app.schemas import DestinationRecord, Pace, RouteLeg, StaySpan, TransportPreference
from app.services.recommendation import stay_nights

EARTH_RADIUS_KM = 6371.0088
ROAD_FACTOR = 1.25  # straight line -> road distance
BUFFER_HOURS = 0.5  # check-in, boarding, city exits
# Door-to-door public transport is modelled as slower than a private vehicle.
PUBLIC_TRANSPORT_SLOWDOWN = 1.3


def haversine_coords(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in km between two lat/lng points."""
    phi1, lambda1, phi2, lambda2 = (
        math.radians(lat1),
        math.radians(lng1),
        math.radians(lat2),
        math.radians(lng2),
    )
    dlat = phi2 - phi1
    dlon = lambda2 - lambda1
    h = math.sin(dlat / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlon / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(h))


def haversine_km(a: DestinationRecord, b: DestinationRecord) -> float:
    if not a.has_usable_coords or not b.has_usable_coords:
        raise ValueError(
            f"cannot route between destinations without coordinates: {a.id} -> {b.id}"
        )
    return haversine_coords(float(a.lat), float(a.lng), float(b.lat), float(b.lng))


def road_distance_km(a: DestinationRecord, b: DestinationRecord) -> float:
    return round(haversine_km(a, b) * ROAD_FACTOR, 1)


def travel_hours(
    distance_km: float, transport: TransportPreference = TransportPreference.any
) -> float:
    """Simple speed model: slower on short hops, faster on long hauls.

    Public transport adds 30% door-to-door time (bus/train transfers).
    """
    speed = 45.0 if distance_km < 150 else 60.0
    hours = distance_km / speed + BUFFER_HOURS
    if transport is TransportPreference.public_transport:
        hours *= PUBLIC_TRANSPORT_SLOWDOWN
    return round(hours, 1)


def leg_for_day(
    day: int,
    origin: DestinationRecord,
    destination: DestinationRecord,
    transport: TransportPreference = TransportPreference.any,
) -> RouteLeg:
    distance = road_distance_km(origin, destination)
    return RouteLeg(
        day=day,
        origin=_place(origin),
        destination=_place(destination),
        distance_km=distance,
        duration_hours=travel_hours(distance, transport),
        transport="road",
    )


def _place(destination: DestinationRecord):
    from app.schemas import Place

    if not destination.has_usable_coords:
        raise ValueError(f"destination '{destination.id}' has no coordinates for a Place")
    return Place(
        destination_id=destination.id,
        name=destination.name,
        lat=float(destination.lat),
        lng=float(destination.lng),
        region=destination.region,
    )


def nearest_neighbor_order(destinations: list[DestinationRecord], start: DestinationRecord) -> list[DestinationRecord]:
    """Greedy nearest-neighbour tour starting (and ending conceptually) at `start`."""
    remaining = [d for d in destinations if d.id != start.id]
    order: list[DestinationRecord] = [start]
    current = start
    while remaining:
        remaining.sort(key=lambda d: (haversine_km(current, d), d.id))
        current = remaining.pop(0)
        order.append(current)
    return order


def assign_nights(order: list[DestinationRecord], days: int, pace: Pace) -> list[tuple[int, DestinationRecord]]:
    """Assign each trip day (1..days) to a destination in `order`.

    Every stop gets at least one night, preferred stays come from the pace model,
    and leftover days go to the highest-preference stops in order.
    """
    if not order:
        raise ValueError("order must not be empty")
    if days < 1:
        raise ValueError("days must be >= 1")

    allocation = {d.id: 0 for d in order}
    preferred = {d.id: stay_nights(d, pace) for d in order}

    # Pass 1: everyone at least 1 day (capped by remaining days).
    remaining = days
    for d in order:
        if remaining <= 0:
            break
        allocation[d.id] = 1
        remaining -= 1

    # Pass 2: grow stops towards their preferred stay, in tour order.
    for d in order:
        if remaining <= 0:
            break
        while remaining > 0 and allocation[d.id] < preferred[d.id]:
            allocation[d.id] += 1
            remaining -= 1

    # Pass 3: leftover days go to the first stops (they are the anchor/hub stops).
    for d in order:
        if remaining <= 0:
            break
        allocation[d.id] += 1
        remaining -= 1

    schedule: list[tuple[int, DestinationRecord]] = []
    for day in range(1, days + 1):
        # Walk the allocation in order.
        cumulative = 0
        placed = False
        for d in order:
            cumulative += allocation[d.id]
            if day <= cumulative:
                schedule.append((day, d))
                placed = True
                break
        if not placed:
            schedule.append((day, order[-1]))
    return schedule


def build_stay_spans(nightly_plan: list[tuple[int, DestinationRecord]]) -> list[StaySpan]:
    """Collapse a day allocation into contiguous stay spans.

    Consecutive days at the same destination form ONE stay (a multi-day visit),
    so a destination repeated across days is never mistaken for a duplicate
    selection. Non-contiguous reappearance of a destination is a routing bug
    and raises — a road trip cannot teleport back to a previously left stop.
    """
    if not nightly_plan:
        return []
    spans: list[StaySpan] = []
    closed_ids: set[str] = set()
    for day, destination in nightly_plan:
        if spans and spans[-1].destination_id == destination.id:
            current = spans[-1]
            spans[-1] = current.model_copy(
                update={"last_day": day, "days": current.days + 1}
            )
        else:
            if spans:
                # The span we are leaving is now closed for good.
                closed_ids.add(spans[-1].destination_id)
            if destination.id in closed_ids:
                raise ValueError(
                    f"destination '{destination.id}' reappears after being left "
                    f"(non-contiguous stay) — itinerary stops are inconsistent"
                )
            spans.append(
                StaySpan(
                    destination_id=destination.id,
                    name=destination.name,
                    first_day=day,
                    last_day=day,
                    days=1,
                )
            )
    return spans


def build_legs(
    nightly_plan: list[tuple[int, DestinationRecord]],
    transport: TransportPreference = TransportPreference.any,
) -> list[RouteLeg]:
    """A leg on every day where the overnight destination changes."""
    legs: list[RouteLeg] = []
    previous: DestinationRecord | None = None
    for day, destination in nightly_plan:
        if previous is not None and previous.id != destination.id:
            legs.append(leg_for_day(day, previous, destination, transport))
        previous = destination
    return legs
