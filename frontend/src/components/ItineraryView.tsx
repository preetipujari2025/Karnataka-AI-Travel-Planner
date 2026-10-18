import { useState } from "react";
import {
  Calendar,
  MapPin,
  Car,
  Sparkles,
  PlaneLanding,
  PlaneTakeoff,
  Eye,
  UtensilsCrossed,
  Coffee,
  Printer,
  Share2,
  AlertTriangle,
  Compass,
  RotateCcw,
  Sliders,
  Wallet,
  X,
  Loader2,
  Info,
  FileDown,
} from "lucide-react";
import { generateItineraryPDF } from "../lib/pdfGenerator";
import type {
  ActivityKind,
  DestinationSummary,
  GenerateItineraryResponse,
  NearbyDestination,
  Pace,
  BudgetTier,
  TransportPreference,
  TripChanges,
  TripRequest,
} from "../api/types";
import { formatInr, formatDuration } from "../lib/format";
import { getDestinationImage, getRecommendationRationale } from "../lib/destinationAssets";
import { fetchNearbyDestinations, regenerateItinerary } from "../api/client";
import BudgetSummary from "./BudgetSummary";
import MapView from "./MapView";

interface ItineraryViewProps {
  plan: GenerateItineraryResponse;
  originalTrip?: TripRequest;
  onPlanUpdated?: (newPlan: GenerateItineraryResponse) => void;
  onRestartPlanning?: () => void;
}

const KIND_ICONS: Record<ActivityKind, React.ComponentType<{ className?: string }>> = {
  arrival: PlaneLanding,
  departure: PlaneTakeoff,
  travel: Car,
  sightseeing: Eye,
  food: UtensilsCrossed,
  leisure: Coffee,
};

const KIND_BADGES: Record<ActivityKind, { label: string; bg: string }> = {
  arrival: { label: "Arrival", bg: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30" },
  departure: { label: "Departure", bg: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
  travel: { label: "Highway Transit", bg: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  sightseeing: { label: "Guided Sights", bg: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  food: { label: "Dining & Cuisine", bg: "bg-orange-500/15 text-orange-300 border-orange-500/30" },
  leisure: { label: "Unwinding", bg: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30" },
};

export default function ItineraryView({
  plan,
  originalTrip,
  onPlanUpdated,
  onRestartPlanning,
}: ItineraryViewProps) {
  const [activeTab, setActiveTab] = useState<"itinerary" | "map" | "budget">("itinerary");
  const [selectedStopIndex, setSelectedStopIndex] = useState<number | null>(null);

  // Edit / Regenerate Modal State
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [editPace, setEditPace] = useState<Pace>(plan.budget.tier ? "balanced" : "balanced");
  const [editTier, setEditTier] = useState<BudgetTier>(plan.budget.tier);
  const [editTransport, setEditTransport] = useState<TransportPreference>(
    originalTrip?.transport_preference || "private_cab"
  );
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // PDF Export State
  const [isGeneratingPDF, setIsGeneratingPDF] = useState<boolean>(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  async function handleDownloadPDF() {
    setIsGeneratingPDF(true);
    setPdfError(null);
    try {
      const filename = await generateItineraryPDF(plan, originalTrip);
      setStatusNotice(`Itinerary PDF ready and downloaded (${filename}).`);
    } catch (err) {
      const msg = (err as Error).message || "Could not generate PDF";
      setPdfError(msg);
      setStatusNotice(`PDF export error: ${msg}`);
    } finally {
      setIsGeneratingPDF(false);
    }
  }

  // Destination Replacement Modal State
  const [replaceTargetStop, setReplaceTargetStop] = useState<{
    index: number;
    destination: DestinationSummary;
  } | null>(null);
  const [nearbyAlternatives, setNearbyAlternatives] = useState<NearbyDestination[]>([]);
  const [loadingAlternatives, setLoadingAlternatives] = useState<boolean>(false);

  const totalDistanceKm = plan.route.reduce((sum, leg) => sum + leg.distance_km, 0);
  const totalTravelHours = plan.route.reduce((sum, leg) => sum + leg.duration_hours, 0);

  function handlePrint() {
    window.print();
  }

  function handleShare() {
    if (navigator.share) {
      navigator
        .share({
          title: `Karnataka Trails: ${plan.selected_destinations.map((d) => d.name).join(" → ")}`,
          text: plan.summary,
          url: window.location.href,
        })
        .catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert("Itinerary link copied to clipboard!");
    }
  }

  // Open replace destination modal
  async function handleOpenReplaceModal(index: number, destination: DestinationSummary) {
    setReplaceTargetStop({ index, destination });
    setLoadingAlternatives(true);

    if (destination.lat && destination.lng) {
      try {
        const alternatives = await fetchNearbyDestinations(destination.lat, destination.lng, 6);
        // Exclude the current destination itself
        const filtered = alternatives.filter(
          (alt) => alt.destination.id !== destination.id
        );
        setNearbyAlternatives(filtered);
      } catch {
        setNearbyAlternatives([]);
      } finally {
        setLoadingAlternatives(false);
      }
    } else {
      setLoadingAlternatives(false);
      setNearbyAlternatives([]);
    }
  }

  // Confirm replacement
  async function handleConfirmReplace(newDest: DestinationSummary) {
    if (!replaceTargetStop) return;

    setStatusNotice(
      `Replaced ${replaceTargetStop.destination.name} with ${newDest.name}. Route updated based on regional road connectivity.`
    );
    setReplaceTargetStop(null);

    // If caller provided onPlanUpdated, update state
    if (onPlanUpdated) {
      const updatedDestinations = [...plan.selected_destinations];
      updatedDestinations[replaceTargetStop.index] = newDest;

      // Update itinerary place references
      const updatedItinerary = plan.itinerary.map((day) => {
        if (day.place.destination_id === replaceTargetStop.destination.id) {
          return {
            ...day,
            place: {
              ...day.place,
              destination_id: newDest.id,
              name: newDest.name,
              region: newDest.region,
              lat: newDest.lat ?? day.place.lat,
              lng: newDest.lng ?? day.place.lng,
            },
          };
        }
        return day;
      });

      onPlanUpdated({
        ...plan,
        selected_destinations: updatedDestinations,
        itinerary: updatedItinerary,
      });
    }
  }

  // Regenerate plan with modified constraints
  async function handleApplyRegeneration() {
    if (!originalTrip) return;

    setIsRegenerating(true);
    setStatusNotice(null);

    const changes: TripChanges = {
      pace: editPace,
      budget_tier: editTier,
      transport_preference: editTransport,
    };

    try {
      const response = await regenerateItinerary(plan.plan_id, {
        previous_itinerary: plan,
        trip: originalTrip,
        changes,
      });

      setShowEditModal(false);
      setStatusNotice(
        `Itinerary regenerated successfully with ${editPace} pace and ${editTier} class.`
      );

      if (onPlanUpdated) {
        onPlanUpdated(response);
      }
    } catch (err) {
      setStatusNotice(
        `Regeneration notice: ${(err as Error).message || "Could not regenerate plan"}`
      );
    } finally {
      setIsRegenerating(false);
    }
  }

  return (
    <div id="plan-results" className="space-y-8 scroll-mt-24">
      {/* Status or Validation Message */}
      {statusNotice && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-xs text-amber-200 flex items-start justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-amber-400 shrink-0" />
            <span>{statusNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusNotice(null)}
            className="text-amber-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* TRIP OVERVIEW BANNER */}
      <div className="rounded-2xl border border-white/10 bg-[#0a0f18] p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Subtle ambient glow */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6">
          {/* Top Metadata Row: Source & Actions */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-white/10">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-amber-400/30 bg-amber-400/15 px-3 py-1 text-[11px] font-mono uppercase tracking-wider text-amber-300 font-semibold flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-amber-400" />
                {plan.source === "ai"
                  ? `AI Personalized (${plan.ai_provider || "AI Model"})`
                  : "Deterministic Fallback Planner"}
              </span>

              <span className="text-xs font-mono text-slate-500">
                Plan ID #{plan.plan_id.slice(0, 8)}
              </span>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                id="btn-download-pdf-top"
                onClick={handleDownloadPDF}
                disabled={isGeneratingPDF}
                className="flex items-center gap-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold px-3.5 py-1.5 text-xs font-mono uppercase tracking-wider transition shadow-md shadow-amber-400/20 disabled:opacity-50"
                title="Download complete print-ready PDF"
              >
                {isGeneratingPDF ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Preparing PDF...</span>
                  </>
                ) : (
                  <>
                    <FileDown className="h-3.5 w-3.5" />
                    <span>Download Itinerary PDF</span>
                  </>
                )}
              </button>

              <button
                type="button"
                id="btn-adjust-constraints"
                onClick={() => setShowEditModal(true)}
                className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 px-3 py-1.5 text-xs font-mono uppercase text-slate-200 transition"
                title="Change preferences & regenerate"
              >
                <Sliders className="h-3.5 w-3.5 text-amber-400" />
                <span>Adjust Constraints</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 px-3 py-1.5 text-xs font-mono uppercase text-slate-300 hover:text-white transition"
                title="Print or export as PDF"
              >
                <Printer className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Print</span>
              </button>

              <button
                type="button"
                onClick={handleShare}
                className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 px-3 py-1.5 text-xs font-mono uppercase text-slate-300 hover:text-white transition"
                title="Share link"
              >
                <Share2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Share</span>
              </button>

              {onRestartPlanning && (
                <button
                  type="button"
                  onClick={onRestartPlanning}
                  className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 px-3 py-1.5 text-xs font-mono uppercase text-slate-400 hover:text-white transition"
                  title="New trip"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Title & Summary */}
          <div>
            <span className="text-xs font-mono uppercase tracking-widest text-amber-400 block mb-1">
              Curated Itinerary
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl font-normal text-white">
              {plan.budget.days}-Day Karnataka Voyage
            </h2>
            <p className="mt-2 text-sm text-slate-300 font-light leading-relaxed max-w-3xl">
              {plan.summary}
            </p>
          </div>

          {/* Quick Specifications Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-white/5 text-xs">
            <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3">
              <span className="text-[10px] font-mono uppercase text-slate-500 block">
                Starting City
              </span>
              <strong className="text-white text-sm capitalize block mt-0.5">
                {plan.selected_destinations[0]?.name || "Karnataka"}
              </strong>
              <span className="text-[11px] text-slate-400">
                {plan.selected_destinations[0]?.region}
              </span>
            </div>

            <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3">
              <span className="text-[10px] font-mono uppercase text-slate-500 block">
                Duration & Party
              </span>
              <strong className="text-white text-sm block mt-0.5">
                {plan.budget.days} Days / {plan.budget.days - 1} Nights
              </strong>
              <span className="text-[11px] text-slate-400">
                {plan.budget.travellers} {plan.budget.travellers === 1 ? "Traveller" : "Travellers"}
              </span>
            </div>

            <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3">
              <span className="text-[10px] font-mono uppercase text-slate-500 block">
                Road Routing
              </span>
              <strong className="text-white text-sm block mt-0.5">
                {Math.round(totalDistanceKm)} km Highway
              </strong>
              <span className="text-[11px] text-slate-400">
                ~{formatDuration(totalTravelHours)} Transit Time
              </span>
            </div>

            <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3">
              <span className="text-[10px] font-mono uppercase text-slate-500 block">
                Total Estimate
              </span>
              <strong className="text-amber-300 font-serif text-lg block mt-0.5">
                {formatInr(plan.budget.total_inr)}
              </strong>
              <span className="text-[11px] text-slate-400">
                {formatInr(plan.budget.per_person_total_inr)} / person
              </span>
            </div>
          </div>

          {/* Stays Span Circuit Roadmap */}
          {plan.stays.length > 0 && (
            <div className="pt-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block mb-2">
                Stay Spans ({plan.stays.length} Consecutive Hubs)
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {plan.stays.map((stay, idx) => (
                  <div key={`${stay.destination_id}-${idx}`} className="flex items-center gap-2">
                    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200">
                      <MapPin className="h-3.5 w-3.5 text-amber-400" />
                      <span className="font-medium">{stay.name}</span>
                      <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-mono text-amber-300">
                        {stay.days} {stay.days === 1 ? "Day" : "Days"}
                      </span>
                    </div>
                    {idx < plan.stays.length - 1 && (
                      <span className="text-slate-600 font-mono">→</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Practical Trip Tips if available */}
          {plan.practical_tips && plan.practical_tips.length > 0 && (
            <div className="rounded-xl border border-sky-400/20 bg-sky-400/5 p-4 text-xs space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-sky-400 font-semibold block">
                Practical Travel Tips
              </span>
              <ul className="list-disc list-inside space-y-1 text-slate-300 font-light">
                {plan.practical_tips.map((tip, idx) => (
                  <li key={idx}>{tip}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Curated Suggested Substitutions if available */}
          {plan.suggested_substitutions && plan.suggested_substitutions.length > 0 && (
            <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-xs space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-semibold block">
                Suggested Catalog Substitutions
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                {plan.suggested_substitutions.map((sub, idx) => (
                  <div key={idx} className="rounded-lg border border-emerald-400/10 bg-black/20 p-2.5">
                    <div className="font-semibold text-emerald-300">
                      Alternative: {sub.suggested_destination_name} (for {sub.current_destination_name})
                    </div>
                    <div className="text-slate-400 text-[11px] mt-0.5 font-light leading-relaxed">
                      {sub.reason}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warnings callout if any */}
          {plan.warnings.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-300 flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="space-y-1">
                {plan.warnings.map((w) => (
                  <div key={w} className="leading-relaxed">
                    {w}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* VIEW TABS: Day-by-Day Schedule, Interactive Map & Route, Budget Breakdown */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-3">
        <button
          type="button"
          id="tab-btn-itinerary"
          onClick={() => setActiveTab("itinerary")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-mono uppercase tracking-wider transition ${
            activeTab === "itinerary"
              ? "bg-amber-400 text-slate-950 font-bold"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Calendar className="h-3.5 w-3.5" />
          <span>Day-by-Day Timeline</span>
        </button>

        <button
          type="button"
          id="tab-btn-map"
          onClick={() => setActiveTab("map")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-mono uppercase tracking-wider transition ${
            activeTab === "map"
              ? "bg-amber-400 text-slate-950 font-bold"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Compass className="h-3.5 w-3.5" />
          <span>Interactive Route Map</span>
        </button>

        <button
          type="button"
          id="tab-btn-budget"
          onClick={() => setActiveTab("budget")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-mono uppercase tracking-wider transition ${
            activeTab === "budget"
              ? "bg-amber-400 text-slate-950 font-bold"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Wallet className="h-3.5 w-3.5" />
          <span>Cost Transparency</span>
        </button>
      </div>

      {/* TAB 1: Day-by-Day Detailed Itinerary */}
      {activeTab === "itinerary" && (
        <div className="space-y-8">
          {plan.itinerary.map((day, dayIndex) => {
            const transitLeg = plan.route.find((leg) => leg.day === day.day);
            const destinationSummary = plan.selected_destinations.find(
              (d) => d.id === day.place.destination_id || d.name === day.place.name
            );
            const destImage = getDestinationImage(day.place.name);
            const rationale = getRecommendationRationale(
              day.place.name,
              day.place.region,
              destinationSummary?.categories
            );
            const isHighlighted = selectedStopIndex === dayIndex;

            return (
              <article
                key={day.day}
                id={`day-card-${day.day}`}
                className={`group rounded-2xl border transition-all duration-300 overflow-hidden bg-[#0a0f18] ${
                  isHighlighted
                    ? "border-amber-400 shadow-2xl shadow-amber-500/10 ring-1 ring-amber-400"
                    : "border-white/10 hover:border-white/25 shadow-xl"
                }`}
              >
                {/* Visual Destination Header Banner */}
                <div className="relative h-48 sm:h-56 w-full overflow-hidden">
                  <img
                    src={destImage}
                    alt={day.place.name}
                    className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f18] via-[#0a0f18]/40 to-transparent" />

                  {/* Top Badges Row */}
                  <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                    <span className="rounded-md border border-white/20 bg-black/60 px-3 py-1 text-xs font-mono font-bold uppercase tracking-wider text-amber-300 backdrop-blur">
                      Day {day.day} • Stop #{dayIndex + 1}
                    </span>

                    {/* Stay span indicator if multi-day */}
                    {day.stay_days > 1 && (
                      <span className="rounded-md border border-white/15 bg-black/60 px-2.5 py-1 text-[11px] font-mono text-slate-300 backdrop-blur">
                        Stay Day {day.stay_day} of {day.stay_days}
                      </span>
                    )}
                  </div>

                  {/* Destination Title on Banner */}
                  <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
                    <div>
                      <span className="text-xs font-mono uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
                        <MapPin className="h-3 w-3" />
                        {day.place.region}
                      </span>
                      <h3 className="font-serif text-2xl sm:text-3xl font-normal text-white mt-0.5">
                        {day.place.name}
                      </h3>
                      {day.day_title && (
                        <p className="text-xs font-mono text-amber-300/80 mt-1">
                          {day.day_title}
                        </p>
                      )}
                    </div>

                    {/* Replace Stop Action */}
                    {destinationSummary && (
                      <button
                        type="button"
                        onClick={() => handleOpenReplaceModal(dayIndex, destinationSummary)}
                        className="rounded-lg border border-white/20 bg-black/60 hover:bg-black/90 px-3 py-1.5 text-xs font-mono text-amber-300 hover:text-white transition backdrop-blur"
                        title="Explore and swap with nearby destination"
                      >
                        Replace Stop
                      </button>
                    )}
                  </div>
                </div>

                {/* Day Content Body */}
                <div className="p-6 sm:p-8 space-y-6">
                  {/* Highway Transit Callout if moving to a new destination */}
                  {transitLeg && (
                    <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5 text-amber-300">
                        <Car className="h-4 w-4 shrink-0" />
                        <span className="font-mono">
                          Highway Transit: {transitLeg.origin.name} → {transitLeg.destination.name}
                        </span>
                      </div>
                      <div className="font-mono text-slate-300">
                        <strong>{transitLeg.distance_km} km</strong> road route (~
                        {formatDuration(transitLeg.duration_hours)})
                      </div>
                    </div>
                  )}

                  {/* Recommendation Rationale / Destination Explanation */}
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-xs">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block mb-1">
                      {plan.source === "ai" ? "AI Personalization Rationale" : "Curated Rationale"}
                    </span>
                    <p className="text-slate-300 font-light leading-relaxed">
                      {plan.destination_explanations?.find(
                        (e) => e.destination_id === day.place.destination_id
                      )?.explanation || rationale}
                    </p>
                    {day.narrative && (
                      <p className="mt-2 text-slate-400 italic font-serif">
                        "{day.narrative}"
                      </p>
                    )}
                  </div>

                  {/* Day Travel Tips */}
                  {day.travel_tips && day.travel_tips.length > 0 && (
                    <div className="rounded-xl border border-sky-400/20 bg-sky-400/5 p-4 text-xs">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-sky-400 block mb-1.5 font-semibold">
                        Day Practical Notes
                      </span>
                      <ul className="list-disc list-inside space-y-1 text-slate-300">
                        {day.travel_tips.map((tip, tipIdx) => (
                          <li key={tipIdx}>{tip}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Ordered Activities Schedule */}
                  <div>
                    <span className="text-xs font-mono uppercase tracking-wider text-slate-400 block mb-3 font-semibold">
                      Schedule & Sights
                    </span>

                    <div className="space-y-3">
                      {day.activities.map((act, actIndex) => {
                        const Icon = KIND_ICONS[act.kind] || Eye;
                        const badgeInfo = KIND_BADGES[act.kind] || {
                          label: act.kind,
                          bg: "bg-slate-500/20 text-slate-300 border-slate-500/30",
                        };

                        return (
                          <div
                            key={`${act.time}-${actIndex}`}
                            className="flex items-start gap-4 p-4 rounded-xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] transition"
                          >
                            {/* Time */}
                            <div className="w-16 shrink-0 font-mono text-xs font-semibold text-amber-400 pt-0.5">
                              {act.time}
                            </div>

                            {/* Kind Badge Icon */}
                            <div
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${badgeInfo.bg}`}
                            >
                              <Icon className="h-4 w-4" />
                            </div>

                            {/* Details */}
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-sm font-semibold text-white">
                                  {act.title}
                                </h4>
                                <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] font-mono uppercase text-slate-400">
                                  {badgeInfo.label}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-slate-300 font-light leading-relaxed">
                                {act.description}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* TAB 2: Interactive Route Map with Stop Selection */}
      {activeTab === "map" && (
        <div className="space-y-4">
          <div className="h-[550px] w-full">
            <MapView
              stops={plan.selected_destinations}
              route={plan.route}
              selectedStopIndex={selectedStopIndex}
              onSelectStop={(idx) => {
                setSelectedStopIndex(idx);
                // Also scroll to day card if switching to itinerary tab
              }}
            />
          </div>

          {/* Quick Stop Waypoint Switcher */}
          <div className="rounded-xl border border-white/10 bg-[#0a0f18] p-4 flex flex-wrap items-center gap-3">
            <span className="text-xs font-mono uppercase text-slate-500">Waypoints:</span>
            {plan.selected_destinations.map((stop, idx) => (
              <button
                key={stop.id}
                type="button"
                onClick={() => setSelectedStopIndex(idx)}
                className={`rounded-lg px-3 py-1.5 text-xs font-mono transition ${
                  selectedStopIndex === idx
                    ? "bg-amber-400 text-slate-950 font-bold"
                    : "bg-white/5 text-slate-300 hover:text-white"
                }`}
              >
                #{idx + 1} {stop.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: Category-wise Budget Panel */}
      {activeTab === "budget" && (
        <BudgetSummary budget={plan.budget} budgetFit={plan.budget_fit} />
      )}

      {/* PDF Error Alert */}
      {pdfError && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-950/40 p-4 text-xs text-rose-200 flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>PDF Export Failed: {pdfError}</span>
          </div>
          <button
            type="button"
            onClick={() => setPdfError(null)}
            className="text-rose-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* EXPORT & ACTION CARD */}
      <div className="rounded-2xl border border-white/10 bg-[#0a0f18] p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl relative overflow-hidden">
        <div className="space-y-1 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <FileDown className="h-4 w-4 text-amber-400" />
            <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold">
              Print-Ready Travel Document
            </span>
          </div>
          <h3 className="font-serif text-xl sm:text-2xl text-white font-normal">
            Take Your Karnataka Journey With You
          </h3>
          <p className="text-xs text-slate-400 max-w-xl font-light">
            Export a comprehensive multi-page document featuring day-by-day schedules, route waypoints, verified budget breakdowns, transparency disclaimers, and local travel tips.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 shrink-0">
          <button
            type="button"
            id="btn-download-pdf-bottom"
            onClick={handleDownloadPDF}
            disabled={isGeneratingPDF}
            className="flex items-center gap-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold px-6 py-3.5 text-xs font-mono uppercase tracking-wider transition-all duration-200 shadow-xl shadow-amber-400/25 hover:scale-[1.02] disabled:opacity-50"
          >
            {isGeneratingPDF ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
                <span>Generating PDF...</span>
              </>
            ) : (
              <>
                <FileDown className="h-4 w-4 text-slate-950" />
                <span>Download Itinerary PDF</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 px-4 py-3.5 text-xs font-mono uppercase text-slate-300 hover:text-white transition"
            title="Print or export via system print dialog"
          >
            <Printer className="h-4 w-4" />
            <span>Print</span>
          </button>

          <button
            type="button"
            onClick={handleShare}
            className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 px-4 py-3.5 text-xs font-mono uppercase text-slate-300 hover:text-white transition"
            title="Share itinerary link"
          >
            <Share2 className="h-4 w-4" />
            <span>Share</span>
          </button>
        </div>
      </div>

      {/* MODAL 1: Adjust Constraints & Regenerate */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0a0f18] p-6 sm:p-8 space-y-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Sliders className="h-5 w-5 text-amber-400" />
                <h3 className="font-serif text-xl font-normal text-white">
                  Adjust Trip Constraints
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Pace Override */}
            <div className="space-y-2">
              <label className="text-xs font-mono uppercase text-slate-300 block">
                Travel Pace
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["relaxed", "balanced", "packed"] as Pace[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setEditPace(p)}
                    className={`rounded-lg py-2.5 px-2 text-xs font-mono uppercase capitalize border transition ${
                      editPace === p
                        ? "border-amber-400 bg-amber-400/20 text-white font-bold"
                        : "border-white/10 bg-white/5 text-slate-400 hover:text-white"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Budget Tier Override */}
            <div className="space-y-2">
              <label className="text-xs font-mono uppercase text-slate-300 block">
                Comfort Class Tier
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["budget", "mid", "luxury"] as BudgetTier[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setEditTier(t)}
                    className={`rounded-lg py-2.5 px-2 text-xs font-mono uppercase capitalize border transition ${
                      editTier === t
                        ? "border-amber-400 bg-amber-400/20 text-white font-bold"
                        : "border-white/10 bg-white/5 text-slate-400 hover:text-white"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Transport Preference */}
            <div className="space-y-2">
              <label className="text-xs font-mono uppercase text-slate-300 block">
                Transport Preference
              </label>
              <select
                value={editTransport}
                onChange={(e) => setEditTransport(e.target.value as TransportPreference)}
                className="w-full rounded-lg border border-white/10 bg-slate-900 px-3.5 py-2.5 text-xs text-white focus:border-amber-400 focus:outline-none"
              >
                <option value="private_cab">Private Cab & Chauffeur</option>
                <option value="self_drive">Self-Drive Rental</option>
                <option value="public_transport">Public Transit & Rail</option>
                <option value="any">Flexible / Any</option>
              </select>
            </div>

            {/* Confirmation & Submit */}
            <div className="pt-4 border-t border-white/10 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="text-xs font-mono uppercase text-slate-400 hover:text-white"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isRegenerating}
                onClick={handleApplyRegeneration}
                className="flex items-center gap-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 px-6 py-2.5 text-xs font-bold uppercase tracking-wider transition disabled:opacity-50"
              >
                {isRegenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Regenerating...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4" />
                    <span>Regenerate Itinerary</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Replace Destination with Nearby Alternatives */}
      {replaceTargetStop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0a0f18] p-6 sm:p-8 space-y-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 block">
                  Alternative Hubs
                </span>
                <h3 className="font-serif text-xl font-normal text-white">
                  Replace {replaceTargetStop.destination.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReplaceTargetStop(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 font-light leading-relaxed">
              Select a geographically sensible alternative in the same region to preserve
              realistic driving connections.
            </p>

            {loadingAlternatives ? (
              <div className="py-8 flex items-center justify-center gap-2 text-xs text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
                <span>Finding nearby destinations...</span>
              </div>
            ) : nearbyAlternatives.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 border border-dashed border-white/10 rounded-xl">
                No direct nearby alternative found within close proximity.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {nearbyAlternatives.map((alt) => (
                  <button
                    key={alt.destination.id}
                    type="button"
                    onClick={() => handleConfirmReplace(alt.destination)}
                    className="w-full flex items-center justify-between p-3.5 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.06] hover:border-amber-400/40 text-left transition"
                  >
                    <div>
                      <strong className="text-sm text-white block">
                        {alt.destination.name}
                      </strong>
                      <span className="text-[11px] text-slate-400">
                        {alt.destination.region} • {alt.destination.highlights.slice(0, 2).join(", ")}
                      </span>
                    </div>

                    <div className="text-right shrink-0 ml-3">
                      <span className="text-xs font-mono text-amber-400 block">
                        {Math.round(alt.distance_km)} km away
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono uppercase">
                        Select
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="pt-4 border-t border-white/10 flex justify-end">
              <button
                type="button"
                onClick={() => setReplaceTargetStop(null)}
                className="text-xs font-mono uppercase text-slate-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
