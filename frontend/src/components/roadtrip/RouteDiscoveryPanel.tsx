import { useMemo } from "react";
import {
  ArrowRightLeft,
  Clock,
  Coffee,
  Info,
  MapPin,
  RefreshCw,
  Star,
  ThumbsDown,
  Ticket,
  Map as MapIcon,
} from "lucide-react";
import type {
  DiscoveredStop,
  FieldVerification,
  MealStop,
  RouteDiscoveryResponse,
} from "../../api/types";
import {
  buildDiscoveryMapStops,
  defaultSelectedMealIds,
  defaultSelectedStopIds,
  groupMealsByDay,
  groupStopsByDay,
  verificationLabel,
} from "../../lib/roadtrip";
import { formatInr } from "../../lib/format";
import { getDestinationImage } from "../../lib/destinationAssets";
import MapView from "../MapView";

interface RouteDiscoveryPanelProps {
  discovery: RouteDiscoveryResponse;
  selectedStopIds: string[];
  selectedMealIds: string[];
  onSelectionChange: (stopIds: string[], mealIds: string[]) => void;
  isPlanning: boolean;
  onPlan: () => void;
  onRefresh: () => void;
}

function VerificationPill({ label, status }: { label: string; status: string }) {
  const tone =
    status === "verified"
      ? "bg-emerald-500/15 text-emerald-300 border-emerald-400/30"
      : status === "estimated"
        ? "bg-amber-500/15 text-amber-300 border-amber-400/30"
        : "bg-slate-500/15 text-slate-300 border-slate-400/30";
  return (
    <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-mono ${tone}`}>
      {label}: {verificationLabel(status as FieldVerification)}
    </span>
  );
}

function DetourNote({ stop }: { stop: DiscoveredStop }) {
  return (
    <span className="text-[11px] text-slate-400">
      <ArrowRightLeft className="mr-1 inline h-3 w-3 text-amber-400" />
      +{stop.detour_km.toFixed(1)} km / ~{Math.round(stop.detour_minutes)} min
      {!stop.detour_measured && (
        <span className="ml-1 rounded bg-amber-500/10 px-1 font-mono text-[10px] text-amber-300">
          estimated
        </span>
      )}
      <span className="ml-1 text-slate-500">({stop.distance_from_route_km.toFixed(1)} km off corridor)</span>
    </span>
  );
}

function StopRow({
  stop,
  checked,
  onToggle,
}: {
  stop: DiscoveredStop;
  checked: boolean;
  onToggle: () => void;
}) {
  const imageUrl = getDestinationImage(stop.ref_id, stop.categories[0]);

  return (
    <label
      className={`flex cursor-pointer flex-col gap-2 rounded-xl border p-4 transition shadow-sm ${
        checked
          ? "border-[#2d6a4f] bg-[#eef5f1]"
          : "border-[#d8e6de] bg-white hover:border-[#2d6a4f]/30"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <input
            type="checkbox"
            checked={checked}
            onChange={onToggle}
            className="mt-1 h-4 w-4 shrink-0 accent-[#2d6a4f]"
          />
          {imageUrl && (
            <img
              src={imageUrl}
              alt={stop.name}
              className="h-12 w-12 rounded-lg object-cover border border-[#d8e6de] shrink-0 hidden sm:block"
              loading="lazy"
            />
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-[#1b2b22]">{stop.name}</span>
              {stop.recommended && (
                <span className="flex items-center gap-1 rounded-md border border-[#e08713]/30 bg-[#fff9ed] px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide text-[#8c5000]">
                  <Star className="h-3 w-3 text-[#e08713]" /> recommended
                </span>
              )}
              <span className="rounded-md bg-[#f4f7f5] px-1.5 py-0.5 text-[10px] font-mono text-[#556b60]">
                {stop.source_kind.replace(/_/g, " ")}
              </span>
              <span className="rounded-md bg-[#e8f1ec] px-1.5 py-0.5 text-[10px] font-mono text-[#2d6a4f]">
                score {stop.score.toFixed(0)}/100
              </span>
            </div>
            {stop.description && (
              <p className="mt-1 line-clamp-2 text-xs text-[#556b60]">{stop.description}</p>
            )}
          </div>
        </div>
        {typeof stop.suggested_day === "number" && (
          <span className="shrink-0 rounded-lg bg-[#f4f7f5] px-2 py-1 text-[10px] font-mono uppercase text-[#2d6a4f] font-semibold">
            {stop.segment_label || `Day ${stop.suggested_day}`}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pl-7">
        <DetourNote stop={stop} />
        {stop.suggested_visit_minutes != null && (
          <span className="flex items-center gap-1 text-[11px] text-[#556b60]">
            <Clock className="h-3 w-3 text-[#e08713]" />
            ~{stop.suggested_visit_minutes} min visit
          </span>
        )}
        {stop.entry_fee_status === "verified" && stop.entry_fee_inr != null ? (
          <span className="flex items-center gap-1 text-[11px] text-[#2d6a4f] font-medium">
            <Ticket className="h-3 w-3" />
            {stop.entry_fee_inr === 0 ? "Free entry" : formatInr(stop.entry_fee_inr)}
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[11px] text-[#556b60]">
            <Ticket className="h-3 w-3" /> fee {verificationLabel(stop.entry_fee_status)}
          </span>
        )}
        {stop.opening_hours && (
          <span className="text-[11px] text-[#556b60]">🕒 {stop.opening_hours}</span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 pl-7">
        <VerificationPill label="hours" status={stop.opening_hours_status} />
        <VerificationPill label="fee" status={stop.entry_fee_status} />
        <VerificationPill label="visit" status={stop.visit_duration_status} />
      </div>

      {stop.reasons.length > 0 && (
        <ul className="space-y-0.5 pl-7 text-[11px] text-[#556b60]">
          {stop.reasons.slice(0, 3).map((reason, idx) => (
            <li key={idx}>• {reason}</li>
          ))}
        </ul>
      )}
      {stop.attribution && (
        <p className="pl-7 text-[10px] font-mono text-[#8da397]">
          {stop.attribution}
          {stop.license ? ` · ${stop.license}` : ""}
        </p>
      )}
    </label>
  );
}

function MealRow({
  meal,
  checked,
  onToggle,
}: {
  meal: MealStop;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition shadow-sm ${
        checked
          ? "border-[#2d6a4f] bg-[#eef5f1]"
          : "border-[#d8e6de] bg-white hover:border-[#2d6a4f]/30"
      }`}
    >
      <input type="checkbox" checked={checked} onChange={onToggle} className="mt-0.5 h-4 w-4 accent-[#2d6a4f]" />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-[#1b2b22]">{meal.name}</span>
          <span className="rounded-md bg-[#f4f7f5] px-1.5 py-0.5 text-[10px] font-mono uppercase text-[#2d6a4f] font-medium">
            {meal.meal}
          </span>
          {meal.expected_arrival && (
            <span className="text-[10px] font-mono text-[#556b60]">~{meal.expected_arrival}</span>
          )}
        </div>
        <p className="mt-0.5 text-[11px] text-[#556b60]">
          <MapPin className="mr-1 inline h-3 w-3 text-[#e08713]" />
          {meal.distance_from_route_km.toFixed(1)} km from route · prices{" "}
          {verificationLabel(meal.price_status)}
          {meal.dietary_tags.length > 0 && ` · ${meal.dietary_tags.join(", ")}`}
          {meal.cuisine_tags.length > 0 && ` · ${meal.cuisine_tags.join(", ")}`}
        </p>
        <p className="mt-0.5 text-[11px] text-[#556b60]">{meal.reason}</p>
      </div>
    </label>
  );
}

export default function RouteDiscoveryPanel({
  discovery,
  selectedStopIds,
  selectedMealIds,
  onSelectionChange,
  isPlanning,
  onPlan,
  onRefresh,
}: RouteDiscoveryPanelProps) {
  const dayGroups = useMemo(() => groupStopsByDay(discovery.candidates), [discovery]);
  const mealGroups = useMemo(() => groupMealsByDay(discovery.meal_stops), [discovery]);
  const selectedStops = new Set(selectedStopIds);
  const selectedMeals = new Set(selectedMealIds);

  const mapStops = useMemo(
    () => buildDiscoveryMapStops(discovery, selectedStopIds, selectedMealIds),
    [discovery, selectedStopIds, selectedMealIds]
  );
  const routeLegs = useMemo(
    () => [
      {
        day: 1,
        origin: discovery.route.origin,
        destination: discovery.route.destination,
        distance_km: discovery.route.distance_km,
        duration_hours: discovery.route.duration_hours,
        transport: "road" as const,
      },
    ],
    [discovery]
  );

  function toggleStop(candidateId: string) {
    const next = new Set(selectedStopIds);
    if (next.has(candidateId)) next.delete(candidateId);
    else next.add(candidateId);
    onSelectionChange([...next], selectedMealIds);
  }

  function toggleMeal(mealId: string) {
    const next = new Set(selectedMealIds);
    if (next.has(mealId)) next.delete(mealId);
    else next.add(mealId);
    onSelectionChange(selectedStopIds, [...next]);
  }

  return (
    <div className="space-y-8">
      {/* Route summary strip */}
      <div className="rounded-2xl border border-[#d8e6de] bg-white/95 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-serif text-xl text-[#1b2b22]">
              {discovery.route.origin.name}
              <ArrowRightLeft className="mx-2 inline h-4 w-4 text-[#e08713]" />
              {discovery.route.destination.name}
            </h3>
            <p className="mt-1 text-xs text-[#556b60]">
              {discovery.route.distance_km.toFixed(0)} km · ~{discovery.route.duration_hours.toFixed(1)}h driving
              {" · "}
              <span
                className={
                  discovery.route.verified ? "text-[#2d6a4f] font-medium" : "text-[#e08713] font-medium"
                }
              >
                {discovery.route.verified
                  ? `live road route via ${discovery.route.provider ?? "OSRM"}`
                  : "estimated corridor (routing provider unavailable)"}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-[#f4f7f5] px-2.5 py-1 font-mono text-[10px] uppercase text-[#556b60]">
              {discovery.cached ? "cached" : "fresh"} · {discovery.providers.join(", ") || "local data only"}
            </span>
            <button
              type="button"
              onClick={onRefresh}
              className="flex items-center gap-1.5 rounded-lg border border-[#d8e6de] bg-white px-3 py-1.5 text-xs text-[#2d6a4f] transition hover:bg-[#eef5f1]"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Re-discover
            </button>
          </div>
        </div>
        <p className="mt-3 flex items-start gap-2 text-[11px] text-[#556b60]">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#2d6a4f]" />
          {discovery.coverage_note}
        </p>
        {discovery.warnings.length > 0 && (
          <ul className="mt-2 space-y-1">
            {discovery.warnings.map((w, idx) => (
              <li key={idx} className="text-[11px] text-[#8c5000]">⚠ {w}</li>
            ))}
          </ul>
        )}
      </div>

      {/* Route Corridor Map */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#2d6a4f]">
            <MapIcon className="h-4 w-4" /> Route Corridor Map (Road Geometry &amp; Candidate Stops)
          </h4>
          <span className="text-[11px] font-mono text-[#556b60]">
            {discovery.candidates.length} stops · {discovery.meal_stops.length} meal options
          </span>
        </div>
        <div className="h-[360px] rounded-2xl overflow-hidden border border-[#d8e6de] shadow-sm">
          <MapView
            stops={mapStops}
            route={routeLegs}
            geometry={discovery.route.geometry as [number, number][]}
            geometryVerified={discovery.route.verified}
          />
        </div>
      </section>

      {/* Candidate stops grouped by day */}
      <section>
        <h4 className="mb-3 text-xs font-mono uppercase tracking-widest text-[#2d6a4f]">
          Candidate stops ({discovery.candidates.length}) — pick what you want
        </h4>
        {dayGroups.size === 0 ? (
          <div className="rounded-xl border border-dashed border-[#cbe1d5] bg-white/50 p-6 text-center text-sm text-[#556b60]">
            No verifiable stops were found near this corridor. Try widening the corridor radius or
            adding more interests — nothing has been invented to fill this list.
          </div>
        ) : (
          <div className="space-y-6">
            {[...dayGroups.entries()].map(([day, stops]) => (
              <div key={day}>
                <p className="mb-2 text-[11px] font-mono uppercase tracking-wider text-[#556b60]">
                  {stops[0]?.segment_label || `Day ${day} segment`} ({stops.length} candidate
                  {stops.length === 1 ? "" : "s"})
                </p>
                <div className="grid gap-3 lg:grid-cols-2">
                  {stops.map((stop) => (
                    <StopRow
                      key={stop.candidate_id}
                      stop={stop}
                      checked={selectedStops.has(stop.candidate_id)}
                      onToggle={() => toggleStop(stop.candidate_id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Meals */}
      {mealGroups.size > 0 && (
        <section>
          <h4 className="mb-3 flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#2d6a4f]">
            <Coffee className="h-4 w-4 text-[#e08713]" /> Meal stops near the route
          </h4>
          <p className="mb-3 text-[11px] text-[#556b60]">
            Names come from OpenStreetMap food POIs. Availability, hours and prices are not
            guaranteed — check before relying on them.
          </p>
          <div className="space-y-4">
            {[...mealGroups.entries()].map(([day, meals]) => (
              <div key={day}>
                <p className="mb-2 text-[11px] font-mono uppercase tracking-wider text-[#556b60]">
                  Day {day}
                </p>
                <div className="grid gap-2 lg:grid-cols-2">
                  {meals.map((meal) => (
                    <MealRow
                      key={meal.meal_id}
                      meal={meal}
                      checked={selectedMeals.has(meal.meal_id)}
                      onToggle={() => toggleMeal(meal.meal_id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Excluded */}
      {discovery.excluded.length > 0 && (
        <section>
          <h4 className="mb-3 flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#556b60]">
            <ThumbsDown className="h-4 w-4 text-[#8da397]" /> Considered but excluded ({discovery.excluded.length})
          </h4>
          <div className="space-y-2">
            {discovery.excluded.map((stop) => (
              <div key={stop.candidate_id} className="rounded-lg border border-[#e2ece5] bg-[#f8faf9] px-4 py-2.5">
                <span className="text-xs font-semibold text-[#1b2b22]">{stop.name}</span>
                <p className="mt-0.5 text-[11px] text-[#556b60]">{stop.exclusion_reason}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Plan action */}
      <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#d8e6de] bg-white/95 p-4 backdrop-blur-md shadow-xl">
        <p className="text-xs text-[#556b60]">
          <span className="font-semibold text-[#2d6a4f]">{selectedStopIds.length}</span> stop
          {selectedStopIds.length === 1 ? "" : "s"} and{" "}
          <span className="font-semibold text-[#2d6a4f]">{selectedMealIds.length}</span> meal
          {selectedMealIds.length === 1 ? "" : "s"} selected. The scheduler will reject anything
          that does not fit with a clear reason.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() =>
              onSelectionChange(defaultSelectedStopIds(discovery), defaultSelectedMealIds(discovery))
            }
            className="rounded-lg border border-[#d8e6de] px-3 py-2 text-xs text-[#556b60] hover:text-[#1b2b22] hover:bg-[#f4f7f5]"
          >
            Reset to recommended
          </button>
          <button
            type="button"
            onClick={onPlan}
            disabled={isPlanning}
            className="flex items-center gap-2 rounded-xl bg-[#2d6a4f] hover:bg-[#23533e] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition disabled:opacity-50 shadow-md shadow-[#2d6a4f]/20 cursor-pointer"
          >
            {isPlanning ? "Scheduling…" : "Build my road trip →"}
          </button>
        </div>
      </div>
    </div>
  );
}
