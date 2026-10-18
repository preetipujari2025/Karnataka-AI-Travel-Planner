import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { DestinationSummary, RouteLeg } from "../api/types";
import { formatDuration } from "../lib/format";

interface MapViewProps {
  stops: DestinationSummary[];
  route: RouteLeg[];
  /** Real road polyline as [lat, lng] pairs — drawn instead of dashed hops. */
  geometry?: [number, number][] | null;
  /** True when the geometry came from a live routing provider. */
  geometryVerified?: boolean;
  selectedStopIndex?: number | null;
  onSelectStop?: (index: number) => void;
}

export default function MapView({
  stops,
  route,
  geometry = null,
  geometryVerified = false,
  selectedStopIndex = null,
  onSelectStop,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  const totalDistance = route.reduce((acc, leg) => acc + leg.distance_km, 0);
  const totalHours = route.reduce((acc, leg) => acc + leg.duration_hours, 0);

  useEffect(() => {
    if (!containerRef.current || stops.length === 0) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(containerRef.current, {
      scrollWheelZoom: false,
      zoomControl: true,
    });
    mapInstanceRef.current = map;

    // OpenStreetMap tile layer
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    const bounds: L.LatLngExpression[] = [];
    const markers: L.Marker[] = [];

    // Filter mappable records (valid lat/lng)
    const mappable = stops.filter(
      (stop): stop is DestinationSummary & { lat: number; lng: number } =>
        typeof stop.lat === "number" && typeof stop.lng === "number"
    );

    mappable.forEach((stop, index) => {
      const position: L.LatLngExpression = [stop.lat, stop.lng];
      bounds.push(position);

      const isSelected = selectedStopIndex === index;

      const marker = L.marker(position, {
        icon: L.divIcon({
          className: "",
          html: `
            <div class="relative flex items-center justify-center">
              ${
                isSelected
                  ? '<span class="absolute -inset-2 rounded-full bg-amber-400/40 animate-ping"></span>'
                  : ""
              }
              <div class="flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                isSelected
                  ? "border-amber-300 bg-amber-400 text-slate-950 font-extrabold shadow-lg shadow-amber-400/50 scale-110"
                  : "border-white bg-[#0f172a] text-amber-400 font-bold shadow-md shadow-black"
              } text-xs transition-transform cursor-pointer">
                ${index + 1}
              </div>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        }),
      }).addTo(map);

      marker.on("click", () => {
        if (onSelectStop) onSelectStop(index);
      });

      marker.bindPopup(
        `<div style="font-family: system-ui; padding: 6px; color: #0f172a; min-width: 160px;">
          <div style="font-size: 11px; font-weight: 700; color: #d97706; text-transform: uppercase;">Stop ${
            index + 1
          } • ${stop.region}</div>
          <strong style="font-size: 15px; color: #0f172a; display: block; margin-top: 2px;">${
            stop.name
          }</strong>
          <p style="font-size: 12px; margin: 6px 0 0; color: #475569; line-height: 1.4;">${
            stop.description
          }</p>
        </div>`
      );

      markers.push(marker);
    });

    markersRef.current = markers;

    // Draw route if legs are returned (or the real road polyline when available)
    if (geometry && geometry.length >= 2) {
      L.polyline(geometry as L.LatLngExpression[], {
        color: "#f59e0b",
        weight: 4,
        opacity: 0.9,
      }).addTo(map);
    } else if (route.length > 0) {
      const path: L.LatLngExpression[] = [];
      route.forEach((leg) => {
        path.push([leg.origin.lat, leg.origin.lng]);
        path.push([leg.destination.lat, leg.destination.lng]);
      });

      L.polyline(path, {
        color: "#f59e0b",
        weight: 3.5,
        dashArray: "6 6",
        opacity: 0.9,
      }).addTo(map);
    }

    if (bounds.length > 1) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40] });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 8);
    }

    const timer = window.setTimeout(() => map.invalidateSize(), 150);

    return () => {
      window.clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [stops, route, geometry, selectedStopIndex, onSelectStop]);

  // Pan to selected stop if changed
  useEffect(() => {
    if (
      selectedStopIndex !== null &&
      selectedStopIndex !== undefined &&
      stops[selectedStopIndex] &&
      mapInstanceRef.current
    ) {
      const stop = stops[selectedStopIndex];
      if (typeof stop.lat === "number" && typeof stop.lng === "number") {
        mapInstanceRef.current.panTo([stop.lat, stop.lng], {
          animate: true,
          duration: 0.8,
        });
        const marker = markersRef.current[selectedStopIndex];
        if (marker) {
          marker.openPopup();
        }
      }
    }
  }, [selectedStopIndex, stops]);

  return (
    <div className="relative h-full w-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-[#0b1120]">
      <div ref={containerRef} className="h-full w-full dark-leaflet-tiles" aria-label="Trip route map" />

      {/* Map Route Metadata Overlay Pill */}
      <div className="absolute top-4 left-4 z-[400] flex flex-wrap items-center gap-2 rounded-xl glass-panel px-3.5 py-2 text-xs backdrop-blur-md border border-white/10 shadow-lg">
        <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
        <span className="font-mono text-slate-300">
          {geometry && geometry.length >= 2
            ? `${geometryVerified ? "Live road route" : "Estimated route corridor"} • ${stops.length} stops`
            : route.length > 0
            ? `Road Corridors (Approximate connections • Driving: ${Math.round(totalDistance)} km, ~${formatDuration(totalHours)})`
            : "Approximate Direct Connections (Straight lines)"}
        </span>
        <span className="text-slate-500">•</span>
        <span className="text-slate-400">{stops.length} Waypoints</span>
      </div>

      {/* Interactive Hint */}
      <div className="absolute bottom-3 right-3 z-[400] hidden sm:block rounded-lg bg-black/70 px-2.5 py-1 text-[10px] font-mono text-slate-400 backdrop-blur">
        Click waypoint to inspect itinerary stop
      </div>
    </div>
  );
}
