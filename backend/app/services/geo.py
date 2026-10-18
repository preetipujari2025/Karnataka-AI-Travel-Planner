"""Geospatial helpers for route-corridor analysis.

Pure functions over [lat, lng] point lists. Projection uses a local
equirectangular approximation (accurate at the few-tens-of-km scale a
corridor check needs) on top of the existing haversine primitives.
"""

from __future__ import annotations

import math

from app.services.routing import EARTH_RADIUS_KM, haversine_coords


def _to_xy(lat: float, lng: float, ref_lat: float) -> tuple[float, float]:
    """Project to local tangent-plane km (x east, y north) around ref_lat."""
    x = math.radians(lng) * EARTH_RADIUS_KM * math.cos(math.radians(ref_lat))
    y = math.radians(lat) * EARTH_RADIUS_KM
    return x, y


def polyline_length_km(points: list[list[float]]) -> float:
    total = 0.0
    for a, b in zip(points, points[1:]):
        total += haversine_coords(a[0], a[1], b[0], b[1])
    return total


def project_onto_polyline(
    lat: float, lng: float, points: list[list[float]]
) -> tuple[float, float]:
    """Distance (km) from a point to a polyline and its progress fraction.

    Returns (distance_km, progress) with progress in 0..1 along cumulative
    polyline length. Degenerate polylines (<2 points) measure straight-line
    distance to the first point with progress 0.
    """
    if len(points) < 2:
        if not points:
            return 0.0, 0.0
        return haversine_coords(lat, lng, points[0][0], points[0][1]), 0.0

    best_dist = math.inf
    best_progress = 0.0
    cumulative = 0.0

    for (a_lat, a_lng), (b_lat, b_lng) in zip(points, points[1:]):
        ref_lat = (a_lat + b_lat) / 2.0
        ax, ay = _to_xy(a_lat, a_lng, ref_lat)
        bx, by = _to_xy(b_lat, b_lng, ref_lat)
        # Re-project the query point in the same local frame for segment math.
        qx, qy = _to_xy(lat, lng, ref_lat)
        seg_len = math.hypot(bx - ax, by - ay)
        if seg_len <= 1e-9:
            t = 0.0
        else:
            t = ((qx - ax) * (bx - ax) + (qy - ay) * (by - ay)) / (seg_len * seg_len)
            t = max(0.0, min(1.0, t))
        cx, cy = ax + t * (bx - ax), ay + t * (by - ay)
        dist = math.hypot(qx - cx, qy - cy)
        if dist < best_dist:
            best_dist = dist
            seg_start_km = cumulative
            best_progress = seg_start_km + t * seg_len
        cumulative += haversine_coords(a_lat, a_lng, b_lat, b_lng)

    total = polyline_length_km(points)
    progress = best_progress / total if total > 0 else 0.0
    return best_dist, max(0.0, min(1.0, progress))


def point_at_progress(points: list[list[float]], fraction: float) -> tuple[float, float]:
    """Interpolate the (lat, lng) at a given progress fraction (0..1) along a polyline."""
    if not points:
        raise ValueError("cannot interpolate an empty polyline")
    if len(points) == 1:
        return float(points[0][0]), float(points[0][1])

    fraction = max(0.0, min(1.0, fraction))
    total = polyline_length_km(points)
    if total <= 0:
        return float(points[0][0]), float(points[0][1])

    target_km = fraction * total
    walked = 0.0
    for a, b in zip(points, points[1:]):
        seg = haversine_coords(a[0], a[1], b[0], b[1])
        if walked + seg >= target_km or seg <= 1e-9:
            t = 0.0 if seg <= 1e-9 else (target_km - walked) / seg
            return (
                a[0] + t * (b[0] - a[0]),
                a[1] + t * (b[1] - a[1]),
            )
        walked += seg
    return float(points[-1][0]), float(points[-1][1])
