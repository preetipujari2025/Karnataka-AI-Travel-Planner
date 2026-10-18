import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BedDouble,
  Car,
  Coffee,
  Download,
  Flag,
  Moon,
  MapPin,
  Sun,
  UtensilsCrossed,
} from "lucide-react";
import type { RoadTripPlanResponse, ScheduledItem } from "../../api/types";
import { buildMapStops } from "../../lib/roadtrip";
import { formatInr } from "../../lib/format";
import { generateRoadTripPDF } from "../../lib/pdfGenerator";
import MapView from "../MapView";

interface RoadTripViewProps {
  plan: RoadTripPlanResponse;
}

const ITEM_META: Record<
  ScheduledItem["item_type"],
  { icon: React.ComponentType<{ className?: string }>; label: string; tone: string }
> = {
  departure: { icon: Flag, label: "Departure", tone: "text-emerald-300" },
  travel: { icon: Car, label: "Driving", tone: "text-slate-300" },
  sightseeing: { icon: MapPin, label: "Visit", tone: "text-amber-300" },
  meal: { icon: UtensilsCrossed, label: "Meal", tone: "text-orange-300" },
  rest: { icon: Coffee, label: "Rest", tone: "text-sky-300" },
  overnight: { icon: BedDouble, label: "Overnight", tone: "text-indigo-300" },
  arrival: { icon: Sun, label: "Arrival", tone: "text-emerald-300" },
};

function ScheduleRow({ item }: { item: ScheduledItem }) {
  const meta = ITEM_META[item.item_type] ?? ITEM_META.travel;
  const Icon = meta.icon;
  return (
    <div className="flex items-start gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3.5 py-2.5">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${meta.tone}`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <span className="font-mono text-[11px] text-amber-300">
            {item.start_time}–{item.end_time}
          </span>
          <span className="text-sm font-semibold text-white">{item.name}</span>
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
            {meta.label} · {item.duration_minutes} min
          </span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[11px] text-slate-500">
          {item.detour_km != null && item.detour_km > 0 && (
            <span>+{item.detour_km.toFixed(1)} km detour</span>
          )}
          {item.verification_status && item.verification_status !== "not_applicable" && (
            <span className="font-mono">{item.verification_status}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RoadTripView({ plan }: RoadTripViewProps) {
  const [downloading, setDownloading] = useState(false);
  const mapStops = useMemo(() => buildMapStops(plan), [plan]);
  const routeLegs = useMemo(
    () => [
      {
        day: 1,
        origin: plan.route.origin,
        destination: plan.route.destination,
        distance_km: plan.route.distance_km,
        duration_hours: plan.route.duration_hours,
        transport: "road" as const,
      },
    ],
    [plan]
  );

  async function handleDownload() {
    setDownloading(true);
    try {
      await generateRoadTripPDF(plan);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Header strip */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl text-white">
            {plan.route.origin.name} → {plan.route.destination.name}
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {plan.days} days · {plan.route.distance_km.toFixed(0)} km main route (
            {plan.route.verified ? `live via ${plan.route.provider ?? "OSRM"}` : "estimated corridor"})
            {" · "}Plan #{plan.plan_id.slice(0, 8)}
          </p>
        </div>
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-950 transition hover:bg-amber-300 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {downloading ? "Preparing…" : "Download PDF"}
        </button>
      </div>

      {/* Conflicts and rejections */}
      {(plan.conflicts.length > 0 || plan.rejected_stops.length > 0) && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-200">
            <AlertTriangle className="h-4 w-4" /> Scheduling conflicts
          </h3>
          {plan.rejected_stops.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {plan.rejected_stops.map((stop) => (
                <li key={stop.candidate_id} className="text-xs text-amber-100/90">
                  <strong>{stop.name}</strong> — {stop.exclusion_reason}
                </li>
              ))}
            </ul>
          )}
          {plan.conflicts.map((c, idx) => (
            <p key={idx} className="mt-2 text-xs text-amber-100/80">
              {c}
            </p>
          ))}
        </div>
      )}

      {/* Map */}
      <div className="h-[420px]">
        <MapView
          stops={mapStops}
          route={routeLegs}
          geometry={plan.route.geometry as [number, number][]}
          geometryVerified={plan.route.verified}
        />
      </div>

      {/* Day-by-day schedule */}
      <section>
        <h3 className="mb-4 text-xs font-mono uppercase tracking-widest text-amber-400">
          Day-by-day schedule
        </h3>
        <div className="space-y-5">
          {plan.itinerary.map((day) => (
            <div key={day.day} className="rounded-2xl border border-white/10 bg-[#0a0f18] p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-serif text-lg text-white">
                    Day {day.day}
                    {day.date ? ` · ${day.date}` : ""}
                  </span>
                  {day.title && <span className="ml-3 text-xs text-slate-400">{day.title}</span>}
                </div>
                <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
                  <span className="flex items-center gap-1">
                    <Car className="h-3.5 w-3.5 text-amber-400" />
                    {Math.floor(day.driving_minutes / 60)}h {day.driving_minutes % 60}m driving
                  </span>
                  <span className="flex items-center gap-1">
                    <Moon className="h-3.5 w-3.5 text-indigo-300" />
                    {day.overnight_place.name}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                {day.schedule.map((item, idx) => (
                  <ScheduleRow key={idx} item={item} />
                ))}
              </div>
              {day.notes.length > 0 && (
                <ul className="mt-3 space-y-1 border-t border-white/5 pt-3">
                  {day.notes.map((note, idx) => (
                    <li key={idx} className="text-[11px] text-slate-500">
                      • {note}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Budget */}
      <section className="rounded-2xl border border-white/10 bg-[#0a0f18] p-6">
        <h3 className="mb-4 text-xs font-mono uppercase tracking-widest text-amber-400">
          Budget — arithmetic from verified data only
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-white/5 p-4">
            <p className="text-[10px] font-mono uppercase text-slate-500">Main route transport</p>
            <p className="mt-1 font-serif text-xl text-white">{formatInr(plan.budget.transport_inr)}</p>
          </div>
          <div className="rounded-xl bg-white/5 p-4">
            <p className="text-[10px] font-mono uppercase text-slate-500">Stop detours</p>
            <p className="mt-1 font-serif text-xl text-white">
              {formatInr(plan.budget.detour_transport_inr ?? 0)}
            </p>
          </div>
          <div className="rounded-xl bg-white/5 p-4">
            <p className="text-[10px] font-mono uppercase text-slate-500">Stay &amp; food (overnights)</p>
            <p className="mt-1 font-serif text-xl text-white">{formatInr(plan.budget.stay_food_inr)}</p>
          </div>
          <div className="rounded-xl bg-white/5 p-4">
            <p className="text-[10px] font-mono uppercase text-slate-500">Meals on the road</p>
            <p className="mt-1 font-serif text-xl text-white">{formatInr(plan.budget.meals_inr ?? 0)}</p>
          </div>
          <div className="rounded-xl bg-white/5 p-4">
            <p className="text-[10px] font-mono uppercase text-slate-500">Verified entry fees</p>
            <p className="mt-1 font-serif text-xl text-white">{formatInr(plan.budget.activities_inr)}</p>
          </div>
          <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/5 p-4">
            <p className="text-[10px] font-mono uppercase text-emerald-300">Minimum practical total</p>
            <p className="mt-1 font-serif text-xl text-emerald-200">
              {plan.budget.minimum_total_inr != null ? formatInr(plan.budget.minimum_total_inr) : "—"}
            </p>
            <p className="mt-1 text-[10px] text-slate-500">same trip without optional detours</p>
          </div>
          <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-4">
            <p className="text-[10px] font-mono uppercase text-amber-300">Recommended total</p>
            <p className="mt-1 font-serif text-xl text-white">{formatInr(plan.budget.total_inr)}</p>
            <p className="mt-1 text-[10px] text-slate-400">
              {formatInr(plan.budget.per_person_total_inr)} per person
            </p>
          </div>
          {plan.budget_fit?.total_budget_inr != null && (
            <div
              className={`rounded-xl border p-4 ${
                plan.budget_fit.within_budget
                  ? "border-emerald-400/30 bg-emerald-400/5"
                  : "border-red-400/30 bg-red-400/5"
              }`}
            >
              <p className="text-[10px] font-mono uppercase text-slate-400">
                Your budget {formatInr(plan.budget_fit.total_budget_inr)}
              </p>
              <p
                className={`mt-1 font-serif text-xl ${
                  plan.budget_fit.within_budget ? "text-emerald-200" : "text-red-200"
                }`}
              >
                {plan.budget_fit.within_budget
                  ? `Fits · ${formatInr(Math.abs(plan.budget_fit.variance_inr ?? 0))} spare`
                  : `Over by ${formatInr(Math.abs(plan.budget_fit.variance_inr ?? 0))}`}
              </p>
            </div>
          )}
        </div>

        {!plan.budget.estimate_complete && (
          <p className="mt-4 flex items-start gap-2 text-[11px] text-amber-300/90">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {plan.budget.excluded_costs_note ??
              "Some costs are not verified and are excluded — they are not counted as zero."}
          </p>
        )}
        {plan.budget.unknown_entry_fees.length > 0 && (
          <p className="mt-2 text-[11px] text-slate-500">
            Fees unknown (excluded): {plan.budget.unknown_entry_fees.join(", ")}
          </p>
        )}
        {(plan.budget.unknown_daily_costs ?? []).length > 0 && (
          <p className="mt-1 text-[11px] text-slate-500">
            Stay costs unknown (excluded): {plan.budget.unknown_daily_costs?.join(", ")}
          </p>
        )}
        {plan.budget.assumptions && plan.budget.assumptions.length > 0 && (
          <ul className="mt-3 space-y-1 border-t border-white/5 pt-3">
            {plan.budget.assumptions.map((a, idx) => (
              <li key={idx} className="text-[11px] text-slate-500">
                • {a}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Warnings, assumptions, providers */}
      <section className="rounded-2xl border border-white/10 bg-[#0a0f18] p-6">
        <h3 className="mb-3 text-xs font-mono uppercase tracking-widest text-slate-400">
          Honest data notes
        </h3>
        {plan.warnings.length > 0 && (
          <ul className="mb-3 space-y-1">
            {plan.warnings.map((w, idx) => (
              <li key={idx} className="text-[11px] text-amber-300/90">⚠ {w}</li>
            ))}
          </ul>
        )}
        {plan.assumptions.length > 0 && (
          <ul className="mb-3 space-y-1">
            {plan.assumptions.map((a, idx) => (
              <li key={idx} className="text-[11px] text-slate-500">• {a}</li>
            ))}
          </ul>
        )}
        <p className="text-[10px] font-mono text-slate-600">
          Providers: {plan.providers.join(", ") || "local curated dataset"} · Stop/meal data may be
          under ODbL — attribution shown per stop in the selection panel.
        </p>
      </section>
    </div>
  );
}
