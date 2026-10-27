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
  AlertCircle,
  Sun,
  Sunset,
  Moon,
  Clock,
  Lightbulb,
  Bookmark,
  Check,
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
import { saveTrip, isTripSaved } from "../lib/savedTrips";
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
  arrival: { label: "Arrival", bg: "bg-[#edf4fb] text-[#1e4a7a] border-[#c5daf0]" },
  departure: { label: "Departure", bg: "bg-[#fbf0f0] text-[#8c2e2e] border-[#f0caca]" },
  travel: { label: "Highway Transit", bg: "bg-[#fef7ee] text-[#92400e] border-[#f7ddbf]" },
  sightseeing: { label: "Guided Sights", bg: "bg-[#eaf4ee] text-[#1e533c] border-[#c2ded0]" },
  food: { label: "Dining & Cuisine", bg: "bg-[#fbf4ee] text-[#9a4b1e] border-[#f2dac9]" },
  leisure: { label: "Unwinding", bg: "bg-[#eef8f8] text-[#1b6b6b] border-[#c4e8e8]" },
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
  const [editPace, setEditPace] = useState<Pace>(originalTrip?.pace || "balanced");
  const [editTier, setEditTier] = useState<BudgetTier>(plan.budget.tier);
  const [editTransport, setEditTransport] = useState<TransportPreference>(
    originalTrip?.transport_preference || "private_cab"
  );
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // PDF Export State
  const [isGeneratingPDF, setIsGeneratingPDF] = useState<boolean>(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Saved plan state
  const [isSaved, setIsSaved] = useState<boolean>(() => isTripSaved(plan.plan_id));

  function handleSavePlan() {
    saveTrip(plan, originalTrip);
    setIsSaved(true);
    setStatusNotice("Itinerary saved to My Saved Trips!");
  }

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
      setStatusNotice("Itinerary link copied to clipboard!");
    }
  }

  // Open replace destination modal
  async function handleOpenReplaceModal(index: number, destination: DestinationSummary) {
    setReplaceTargetStop({ index, destination });
    setLoadingAlternatives(true);

    if (destination.lat && destination.lng) {
      try {
        const alternatives = await fetchNearbyDestinations(destination.lat, destination.lng, 6);
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

    if (onPlanUpdated) {
      const updatedDestinations = [...plan.selected_destinations];
      updatedDestinations[replaceTargetStop.index] = newDest;

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
        <div className="rounded-2xl border border-[#c2ded0] bg-[#eaf4ee] p-4 text-xs text-[#1e533c] flex items-start justify-between gap-3 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-[#2d6a4f] shrink-0" />
            <span>{statusNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusNotice(null)}
            className="text-[#2d6a4f] hover:text-[#14231b] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* TRIP OVERVIEW BANNER */}
      <div className="rounded-3xl glass-panel-elevated p-6 sm:p-8 border border-[#cbe1d5] shadow-xl relative overflow-hidden">
        <div className="relative z-10 space-y-6">
          {/* Top Metadata Row: Source & Actions */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-[#dce9e1]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-xl border border-[#c2ded0] bg-[#eaf4ee] px-3 py-1 text-xs uppercase tracking-wider text-[#1e533c] font-semibold flex items-center gap-1.5 shadow-2xs">
                <Sparkles className="h-3 w-3 text-[#2d6a4f]" />
                {plan.planner_label ||
                  (plan.source === "ai" ? "AI-personalized" : "Verified Smart planner")}
              </span>

              <span className="text-xs text-[#5e7467] font-medium">
                Plan ID #{plan.plan_id.slice(0, 8)}
              </span>
            </div>

            {/* Quick Actions Bar */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Save My Plan Button */}
              <button
                type="button"
                id="btn-save-plan"
                onClick={handleSavePlan}
                className="flex items-center gap-1.5 rounded-xl border border-[#c8dec2] bg-white hover:bg-[#eaf4ee] text-[#1e533c] font-semibold px-3.5 py-1.5 text-xs transition shadow-2xs cursor-pointer"
                title="Save this itinerary to My Saved Trips vault"
              >
                {isSaved ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Bookmark className="h-3.5 w-3.5 text-[#2d6a4f]" />
                )}
                <span>{isSaved ? "Saved in My Trips" : "Save My Plan"}</span>
              </button>

              <button
                type="button"
                id="btn-download-pdf-top"
                onClick={handleDownloadPDF}
                disabled={isGeneratingPDF}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#f5a623] to-[#e08713] hover:from-[#e59b20] hover:to-[#cb770c] text-white font-bold px-3.5 py-1.5 text-xs uppercase tracking-wider transition shadow-sm hover:shadow-md disabled:opacity-50 cursor-pointer"
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
                    <span>Download PDF</span>
                  </>
                )}
              </button>

              <button
                type="button"
                id="btn-adjust-constraints"
                onClick={() => setShowEditModal(true)}
                className="flex items-center gap-1.5 rounded-xl border border-[#c8dec2] bg-white hover:bg-[#eaf4ee] px-3 py-1.5 text-xs text-[#263c30] hover:text-[#14231b] transition shadow-2xs cursor-pointer font-medium"
                title="Change preferences & regenerate"
              >
                <Sliders className="h-3.5 w-3.5 text-[#2d6a4f]" />
                <span>Adjust Constraints</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-1.5 rounded-xl border border-[#c8dec2] bg-white hover:bg-[#eaf4ee] px-3 py-1.5 text-xs text-[#263c30] hover:text-[#14231b] transition shadow-2xs cursor-pointer font-medium"
                title="Print or export as PDF"
              >
                <Printer className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Print</span>
              </button>

              <button
                type="button"
                onClick={handleShare}
                className="flex items-center gap-1.5 rounded-xl border border-[#c8dec2] bg-white hover:bg-[#eaf4ee] px-3 py-1.5 text-xs text-[#263c30] hover:text-[#14231b] transition shadow-2xs cursor-pointer font-medium"
                title="Share link"
              >
                <Share2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Share</span>
              </button>

              {onRestartPlanning && (
                <button
                  type="button"
                  onClick={onRestartPlanning}
                  className="flex items-center gap-1.5 rounded-xl border border-[#c8dec2] bg-white hover:bg-[#eaf4ee] px-3 py-1.5 text-xs text-[#5e7467] hover:text-[#14231b] transition shadow-2xs cursor-pointer"
                  title="New trip"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Title & Summary */}
          <div>
            <span className="text-xs uppercase tracking-wider text-[#2d6a4f] font-semibold block mb-1">
              Curated Itinerary
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl font-normal text-[#14231b]">
              {plan.budget.days}-Day Karnataka Voyage
            </h2>
            <p className="mt-2 text-sm text-[#35483d] leading-relaxed max-w-3xl">
              {plan.summary}
            </p>
          </div>

          {/* Why this plan for you note */}
          {plan.why_this_plan && (
            <div id="why-this-plan-card" className="rounded-2xl border border-[#c2ded0] bg-[#eaf4ee] p-4 sm:p-5 relative overflow-hidden shadow-2xs">
              <div className="flex items-start gap-3.5">
                <div className="rounded-xl bg-white border border-[#c2ded0] p-2 text-[#2d6a4f] shrink-0 mt-0.5 shadow-2xs">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <span className="text-xs uppercase tracking-wider text-[#1e533c] font-bold block">
                    Why this plan for you
                  </span>
                  <p className="text-sm text-[#263c30] leading-relaxed">
                    {plan.why_this_plan.replace(/^Why this plan for you:\s*/i, "")}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Duration & Interests Advice Banner */}
          {plan.duration_interest_advice && (
            <div id="duration-interest-advice-banner" className="rounded-2xl border border-[#c5daf0] bg-[#edf4fb] p-4 text-xs text-[#1e4a7a] flex items-start gap-3 shadow-2xs">
              <AlertCircle className="h-5 w-5 text-[#2b6cb0] shrink-0 mt-0.5" />
              <div>
                <strong className="block text-[#1e4a7a] font-bold text-sm mb-1">
                  Trip Pacing Advice: Available Days vs. Selected Interests
                </strong>
                <p className="leading-relaxed text-[#2c5282]">
                  {plan.duration_interest_advice}
                </p>
              </div>
            </div>
          )}

          {/* Quick Specifications Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-[#dce9e1] text-xs">
            <div className="rounded-2xl bg-white border border-[#d8e6de] p-3.5 shadow-2xs">
              <span className="text-[10px] uppercase text-[#5e7467] font-semibold block">
                Starting City
              </span>
              <strong className="text-[#14231b] text-sm capitalize block mt-0.5">
                {plan.selected_destinations[0]?.name || "Karnataka"}
              </strong>
              <span className="text-[11px] text-[#5e7467]">
                {plan.selected_destinations[0]?.region}
              </span>
            </div>

            <div className="rounded-2xl bg-white border border-[#d8e6de] p-3.5 shadow-2xs">
              <span className="text-[10px] uppercase text-[#5e7467] font-semibold block">
                Duration & Party
              </span>
              <strong className="text-[#14231b] text-sm block mt-0.5">
                {plan.budget.days} Days / {plan.budget.days - 1} Nights
              </strong>
              <span className="text-[11px] text-[#5e7467]">
                {plan.budget.travellers} {plan.budget.travellers === 1 ? "Traveller" : "Travellers"}
              </span>
            </div>

            <div className="rounded-2xl bg-white border border-[#d8e6de] p-3.5 shadow-2xs">
              <span className="text-[10px] uppercase text-[#5e7467] font-semibold block">
                Road Routing
              </span>
              <strong className="text-[#14231b] text-sm block mt-0.5">
                {Math.round(totalDistanceKm)} km Highway
              </strong>
              <span className="text-[11px] text-[#5e7467]">
                ~{formatDuration(totalTravelHours)} Transit Time
              </span>
            </div>

            <div className="rounded-2xl bg-white border border-[#d8e6de] p-3.5 shadow-2xs">
              <span className="text-[10px] uppercase text-[#5e7467] font-semibold block">
                Total Estimate
              </span>
              <strong className="text-[#1e533c] font-serif text-lg block mt-0.5 font-bold">
                {formatInr(plan.budget.total_inr)}
              </strong>
              <span className="text-[11px] text-[#5e7467]">
                {formatInr(plan.budget.per_person_total_inr)} / person
              </span>
            </div>
          </div>

          {/* Stays Span Circuit Roadmap */}
          {plan.stays.length > 0 && (
            <div className="pt-2">
              <span className="text-[10px] uppercase tracking-wider text-[#5e7467] font-semibold block mb-2">
                Stay Spans ({plan.stays.length} Consecutive Hubs)
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {plan.stays.map((stay, idx) => (
                  <div key={`${stay.destination_id}-${idx}`} className="flex items-center gap-2">
                    <div className="flex items-center gap-2 rounded-xl border border-[#d8e6de] bg-white px-3 py-1.5 text-xs text-[#263c30] shadow-2xs">
                      <MapPin className="h-3.5 w-3.5 text-[#2d6a4f]" />
                      <span className="font-semibold">{stay.name}</span>
                      <span className="rounded-md bg-[#eaf4ee] px-2 py-0.5 text-[10px] font-semibold text-[#1e533c]">
                        {stay.days} {stay.days === 1 ? "Day" : "Days"}
                      </span>
                    </div>
                    {idx < plan.stays.length - 1 && (
                      <span className="text-[#9ab5a4] font-bold">→</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Practical Trip Tips */}
          {plan.practical_tips && plan.practical_tips.length > 0 && (
            <div className="rounded-2xl border border-[#c2ded0] bg-[#eaf4ee] p-4 text-xs space-y-2">
              <span className="text-[10px] uppercase tracking-wider text-[#1e533c] font-bold block">
                Practical Travel Tips
              </span>
              <ul className="list-disc list-inside space-y-1 text-[#263c30]">
                {plan.practical_tips.map((tip, idx) => (
                  <li key={idx}>{tip}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Curated Suggested Substitutions if available */}
          {plan.suggested_substitutions && plan.suggested_substitutions.length > 0 && (
            <div className="rounded-2xl border border-[#c2ded0] bg-[#eaf4ee] p-4 text-xs space-y-2">
              <span className="text-[10px] uppercase tracking-wider text-[#1e533c] font-bold block">
                Suggested Catalog Substitutions
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                {plan.suggested_substitutions.map((sub, idx) => (
                  <div key={idx} className="rounded-xl border border-[#c2ded0] bg-white p-3 shadow-2xs">
                    <div className="font-semibold text-[#1e533c]">
                      Alternative: {sub.suggested_destination_name} (for {sub.current_destination_name})
                    </div>
                    <div className="text-[#5e7467] text-[11px] mt-0.5 leading-relaxed">
                      {sub.reason}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Over-budget alert banner if budget is too low */}
          {plan.budget_fit && plan.budget_fit.within_budget === false && (
            <div
              id="budget-overage-banner"
              className="rounded-2xl border border-amber-300 bg-[#fef7ee] p-4 text-xs text-[#92400e] flex items-start gap-3 shadow-2xs"
            >
              <AlertCircle className="h-5 w-5 text-[#b45309] shrink-0 mt-0.5" />
              <div>
                <strong className="block text-[#78350f] font-bold text-sm mb-0.5">
                  Budget Alert: Stated Budget Is Too Low for this Journey
                </strong>
                <p className="leading-relaxed text-[#92400e]">
                  Estimated minimum realistic cost is <strong>{formatInr(plan.budget.total_inr)}</strong>, which exceeds your target budget of <strong>{formatInr(plan.budget_fit.total_budget_inr || 0)}</strong> by <strong>{formatInr(Math.abs(plan.budget_fit.variance_inr || 0))}</strong>. Consider shortening the journey, switching to Budget Explorer class, or choosing public transit.
                </p>
              </div>
            </div>
          )}

          {/* Warnings callout if any */}
          {plan.warnings.length > 0 && (
            <div className="rounded-2xl border border-amber-300 bg-[#fef7ee] p-3.5 text-xs text-[#92400e] flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-[#b45309]" />
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
      <div className="flex items-center gap-2 border-b border-[#dce9e1] pb-3">
        <button
          type="button"
          id="tab-btn-itinerary"
          onClick={() => setActiveTab("itinerary")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs uppercase tracking-wider font-semibold transition cursor-pointer ${
            activeTab === "itinerary"
              ? "bg-[#2d6a4f] text-white shadow-xs"
              : "bg-white text-[#263c30] border border-[#d2e2d8] hover:bg-[#eaf4ee]"
          }`}
        >
          <Calendar className="h-3.5 w-3.5" />
          <span>Day-by-Day Timeline</span>
        </button>

        <button
          type="button"
          id="tab-btn-map"
          onClick={() => setActiveTab("map")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs uppercase tracking-wider font-semibold transition cursor-pointer ${
            activeTab === "map"
              ? "bg-[#2d6a4f] text-white shadow-xs"
              : "bg-white text-[#263c30] border border-[#d2e2d8] hover:bg-[#eaf4ee]"
          }`}
        >
          <Compass className="h-3.5 w-3.5" />
          <span>Interactive Route Map</span>
        </button>

        <button
          type="button"
          id="tab-btn-budget"
          onClick={() => setActiveTab("budget")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs uppercase tracking-wider font-semibold transition cursor-pointer ${
            activeTab === "budget"
              ? "bg-[#2d6a4f] text-white shadow-xs"
              : "bg-white text-[#263c30] border border-[#d2e2d8] hover:bg-[#eaf4ee]"
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
            const webpImage = destImage.replace(/\.jpg$/, ".webp");
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
                className={`group rounded-3xl border transition-all duration-300 overflow-hidden glass-panel-elevated ${
                  isHighlighted
                    ? "border-[#2d6a4f] shadow-xl ring-2 ring-[#2d6a4f]/20"
                    : "border-[#cbe1d5] hover:border-[#2d6a4f]/40 shadow-md"
                }`}
              >
                {/* Visual Destination Header Banner */}
                <div className="relative h-48 sm:h-56 w-full overflow-hidden bg-[#eef4f0]">
                  <picture>
                    <source srcSet={webpImage} type="image/webp" />
                    <img
                      src={destImage}
                      alt={day.place.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                    />
                  </picture>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />

                  {/* Top Badges Row */}
                  <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                    <span className="rounded-full bg-white/90 backdrop-blur-md px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-[#1e533c] shadow-xs">
                      Day {day.day} • Stop #{dayIndex + 1}
                    </span>

                    {/* Stay span indicator if multi-day */}
                    {day.stay_days > 1 && (
                      <span className="rounded-full bg-white/90 backdrop-blur-md px-3 py-1 text-xs font-medium text-[#263c30] shadow-xs">
                        Stay Day {day.stay_day} of {day.stay_days}
                      </span>
                    )}
                  </div>

                  {/* Destination Title on Banner */}
                  <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between text-white">
                    <div>
                      <span className="text-xs uppercase text-amber-300 tracking-wider flex items-center gap-1.5 font-semibold">
                        <MapPin className="h-3 w-3" />
                        {day.place.region}
                      </span>
                      <h3 className="font-serif text-2xl sm:text-3xl font-normal text-white mt-0.5">
                        {day.place.name}
                      </h3>
                      {day.day_title && (
                        <p className="text-xs text-amber-200/90 mt-1">
                          {day.day_title}
                        </p>
                      )}
                    </div>

                    {/* Replace Stop Action */}
                    {destinationSummary && (
                      <button
                        type="button"
                        onClick={() => handleOpenReplaceModal(dayIndex, destinationSummary)}
                        className="rounded-xl border border-white/30 bg-black/50 hover:bg-black/70 px-3 py-1.5 text-xs text-white transition backdrop-blur-xs cursor-pointer font-medium"
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
                    <div className="rounded-2xl border border-[#c2ded0] bg-[#eaf4ee] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5 text-[#1e533c] font-semibold">
                        <Car className="h-4 w-4 shrink-0 text-[#2d6a4f]" />
                        <span>
                          Highway Transit: {transitLeg.origin.name} → {transitLeg.destination.name}
                        </span>
                      </div>
                      <div className="text-[#35483d]">
                        <strong className="text-[#14231b]">{transitLeg.distance_km} km</strong> road route (~
                        {formatDuration(transitLeg.duration_hours)})
                      </div>
                    </div>
                  )}

                  {/* Recommendation Rationale / Destination Explanation */}
                  <div className="rounded-2xl border border-[#d8e6de] bg-white p-4 text-xs shadow-2xs">
                    <span className="text-[10px] uppercase tracking-wider text-[#5e7467] font-semibold block mb-1">
                      {plan.source === "ai" ? "Personalization Rationale" : "Curated Rationale"}
                    </span>
                    <p className="text-[#263c30] leading-relaxed">
                      {plan.destination_explanations?.find(
                        (e) => e.destination_id === day.place.destination_id
                      )?.explanation || rationale}
                    </p>
                    {day.narrative && (
                      <p className="mt-2 text-[#475f51] italic font-serif">
                        "{day.narrative}"
                      </p>
                    )}
                  </div>

                  {/* Daily Plan Schedule: Morning, Afternoon, Evening & Travel Time */}
                  {(day.morning_plan || day.afternoon_plan || day.evening_plan || day.travel_time) && (
                    <div className="rounded-2xl border border-[#d8e6de] bg-white p-5 space-y-4 shadow-2xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#eaf2ec] pb-3">
                        <span className="text-xs uppercase tracking-wider text-[#1e533c] font-bold flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5 text-[#2d6a4f]" />
                          Daily Itinerary Schedule
                        </span>
                        {day.travel_time && (
                          <span className="text-[11px] text-[#263c30] bg-[#eaf4ee] border border-[#c2ded0] px-2.5 py-0.5 rounded-full flex items-center gap-1.5 font-medium">
                            <Car className="h-3 w-3 text-[#2d6a4f]" />
                            {day.travel_time}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                        {day.morning_plan && (
                          <div className="rounded-xl border border-[#cbe1d5] bg-[#f8faf8] p-3.5 space-y-1">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1e533c]">
                              <Sun className="h-3.5 w-3.5 text-amber-600" />
                              <span>Morning Plan</span>
                            </div>
                            <p className="text-xs text-[#35483d] leading-relaxed">
                              {day.morning_plan}
                            </p>
                          </div>
                        )}

                        {day.afternoon_plan && (
                          <div className="rounded-xl border border-[#cbe1d5] bg-[#f8faf8] p-3.5 space-y-1">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#b45309]">
                              <Sunset className="h-3.5 w-3.5 text-[#d97706]" />
                              <span>Afternoon Plan</span>
                            </div>
                            <p className="text-xs text-[#35483d] leading-relaxed">
                              {day.afternoon_plan}
                            </p>
                          </div>
                        )}

                        {day.evening_plan && (
                          <div className="rounded-xl border border-[#cbe1d5] bg-[#f8faf8] p-3.5 space-y-1">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1e4a7a]">
                              <Moon className="h-3.5 w-3.5 text-indigo-600" />
                              <span>Evening Plan</span>
                            </div>
                            <p className="text-xs text-[#35483d] leading-relaxed">
                              {day.evening_plan}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Regional Food Suggestion & Local Insider Tip Cards */}
                  {(day.food_suggestion || day.local_tip) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {day.food_suggestion && (
                        <div className="rounded-2xl border border-[#c2ded0] bg-[#eaf4ee] p-4 flex items-start gap-3">
                          <div className="p-2 rounded-xl bg-white border border-[#c2ded0] text-[#1e533c] shrink-0 shadow-2xs">
                            <UtensilsCrossed className="h-4 w-4" />
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-[10px] uppercase tracking-wider text-[#1e533c] font-bold block">
                              Authentic Food Suggestion
                            </span>
                            <p className="text-xs text-[#263c30] leading-relaxed">
                              {day.food_suggestion}
                            </p>
                          </div>
                        </div>
                      )}

                      {day.local_tip && (
                        <div className="rounded-2xl border border-[#c5daf0] bg-[#edf4fb] p-4 flex items-start gap-3">
                          <div className="p-2 rounded-xl bg-white border border-[#c5daf0] text-[#1e4a7a] shrink-0 shadow-2xs">
                            <Lightbulb className="h-4 w-4" />
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-[10px] uppercase tracking-wider text-[#1e4a7a] font-bold block">
                              Local Insider Tip
                            </span>
                            <p className="text-xs text-[#2c5282] leading-relaxed">
                              {day.local_tip}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Day Travel Tips */}
                  {(() => {
                    const distinctTravelTips = (day.travel_tips || []).filter(
                      (tip) => tip.trim().toLowerCase() !== (day.local_tip || "").trim().toLowerCase()
                    );
                    if (distinctTravelTips.length === 0) return null;
                    return (
                      <div className="rounded-2xl border border-[#d8e6de] bg-white p-4 text-xs shadow-2xs">
                        <span className="text-[10px] uppercase tracking-wider text-[#5e7467] block mb-1.5 font-semibold">
                          Day Practical Notes
                        </span>
                        <ul className="list-disc list-inside space-y-1 text-[#263c30]">
                          {distinctTravelTips.map((tip, tipIdx) => (
                            <li key={tipIdx}>{tip}</li>
                          ))}
                        </ul>
                      </div>
                    );
                  })()}

                  {/* Ordered Activities Schedule */}
                  <div>
                    <span className="text-xs uppercase tracking-wider text-[#5e7467] block mb-3 font-semibold">
                      Schedule & Sights
                    </span>

                    <div className="space-y-3">
                      {day.activities.map((act, actIndex) => {
                        const Icon = KIND_ICONS[act.kind] || Eye;
                        const badgeInfo = KIND_BADGES[act.kind] || {
                          label: act.kind,
                          bg: "bg-[#eaf4ee] text-[#1e533c] border-[#c2ded0]",
                        };

                        return (
                          <div
                            key={`${act.time}-${actIndex}`}
                            className="flex items-start gap-4 p-4 rounded-2xl border border-[#d8e6de] bg-white shadow-2xs hover:border-[#2d6a4f]/30 transition"
                          >
                            {/* Time */}
                            <div className="w-16 shrink-0 text-xs font-semibold text-[#b45309] pt-0.5 font-mono">
                              {act.time}
                            </div>

                            {/* Kind Badge Icon */}
                            <div
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${badgeInfo.bg}`}
                            >
                              <Icon className="h-4 w-4" />
                            </div>

                            {/* Details */}
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-sm font-semibold text-[#14231b]">
                                  {act.title}
                                </h4>
                                <span className="rounded-full bg-[#f4f7f5] border border-[#dce9e1] px-2.5 py-0.5 text-[10px] font-medium text-[#263c30]">
                                  {badgeInfo.label}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-[#35483d] leading-relaxed">
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
              }}
            />
          </div>

          {/* Quick Stop Waypoint Switcher */}
          <div className="rounded-2xl border border-[#cbe1d5] bg-white p-4 flex flex-wrap items-center gap-3 shadow-xs">
            <span className="text-xs uppercase text-[#5e7467] font-semibold">Waypoints:</span>
            {plan.selected_destinations.map((stop, idx) => (
              <button
                key={stop.id}
                type="button"
                onClick={() => setSelectedStopIndex(idx)}
                className={`rounded-xl px-3.5 py-1.5 text-xs transition cursor-pointer font-medium ${
                  selectedStopIndex === idx
                    ? "bg-[#2d6a4f] text-white font-bold shadow-xs"
                    : "bg-[#f4f7f5] text-[#263c30] border border-[#dce9e1] hover:bg-white"
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
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-900 flex items-center justify-between gap-3 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
            <span>PDF Export Notice: {pdfError}</span>
          </div>
          <button
            type="button"
            onClick={() => setPdfError(null)}
            className="text-red-700 hover:text-red-950 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* EXPORT & ACTION CARD */}
      <div className="rounded-3xl glass-panel-elevated border border-[#cbe1d5] p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-lg relative overflow-hidden">
        <div className="space-y-1 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <FileDown className="h-4 w-4 text-[#2d6a4f]" />
            <span className="text-xs uppercase tracking-wider text-[#1e533c] font-bold">
              Print-Ready Travel Document
            </span>
          </div>
          <h3 className="font-serif text-xl sm:text-2xl text-[#14231b] font-normal">
            Take Your Karnataka Journey With You
          </h3>
          <p className="text-xs text-[#35483d] max-w-xl font-normal leading-relaxed">
            Export a comprehensive multi-page document featuring day-by-day schedules, route waypoints, verified budget breakdowns, transparency disclaimers, and local travel tips.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 shrink-0">
          <button
            type="button"
            id="btn-download-pdf-bottom"
            onClick={handleDownloadPDF}
            disabled={isGeneratingPDF}
            className="flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-[#f5a623] to-[#e08713] hover:from-[#e59b20] hover:to-[#cb770c] text-white font-bold px-6 py-3.5 text-xs uppercase tracking-wider transition-all duration-200 shadow-md shadow-[#e08713]/25 hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-50 cursor-pointer"
          >
            {isGeneratingPDF ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-white" />
                <span>Generating PDF...</span>
              </>
            ) : (
              <>
                <FileDown className="h-4 w-4 text-white" />
                <span>Download Itinerary PDF</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleSavePlan}
            className="flex items-center gap-2 rounded-xl border border-[#c8dec2] bg-white hover:bg-[#eaf4ee] text-[#1e533c] px-4 py-3.5 text-xs font-semibold uppercase tracking-wider transition shadow-2xs cursor-pointer"
            title="Save to My Saved Trips"
          >
            {isSaved ? <Check className="h-4 w-4 text-emerald-600" /> : <Bookmark className="h-4 w-4" />}
            <span>{isSaved ? "Saved" : "Save Plan"}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 rounded-xl border border-[#c8dec2] bg-white hover:bg-[#eaf4ee] px-4 py-3.5 text-xs uppercase text-[#263c30] hover:text-[#14231b] transition shadow-2xs cursor-pointer font-semibold"
            title="Print or export via system print dialog"
          >
            <Printer className="h-4 w-4" />
            <span>Print</span>
          </button>

          <button
            type="button"
            onClick={handleShare}
            className="flex items-center gap-2 rounded-xl border border-[#c8dec2] bg-white hover:bg-[#eaf4ee] px-4 py-3.5 text-xs uppercase text-[#263c30] hover:text-[#14231b] transition shadow-2xs cursor-pointer font-semibold"
            title="Share itinerary link"
          >
            <Share2 className="h-4 w-4" />
            <span>Share</span>
          </button>
        </div>
      </div>

      {/* MODAL 1: Adjust Constraints & Regenerate */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl border border-[#cbe1d5] bg-white p-6 sm:p-8 space-y-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-[#dce9e1]">
              <div className="flex items-center gap-2">
                <Sliders className="h-5 w-5 text-[#2d6a4f]" />
                <h3 className="font-serif text-xl font-normal text-[#14231b]">
                  Adjust Trip Constraints
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="text-[#5e7467] hover:text-[#14231b] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Pace Override */}
            <div className="space-y-2">
              <label className="text-xs uppercase text-[#35483d] font-semibold block">
                Travel Pace
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["relaxed", "balanced", "packed"] as Pace[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setEditPace(p)}
                    className={`rounded-xl py-2.5 px-2 text-xs uppercase capitalize border transition cursor-pointer font-medium ${
                      editPace === p
                        ? "border-[#2d6a4f] bg-[#2d6a4f] text-white font-bold shadow-xs"
                        : "border-[#d8e6de] bg-[#f8faf8] text-[#35483d] hover:bg-white"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Budget Tier Override */}
            <div className="space-y-2">
              <label className="text-xs uppercase text-[#35483d] font-semibold block">
                Comfort Class Tier
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["budget", "mid", "luxury"] as BudgetTier[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setEditTier(t)}
                    className={`rounded-xl py-2.5 px-2 text-xs uppercase capitalize border transition cursor-pointer font-medium ${
                      editTier === t
                        ? "border-[#2d6a4f] bg-[#2d6a4f] text-white font-bold shadow-xs"
                        : "border-[#d8e6de] bg-[#f8faf8] text-[#35483d] hover:bg-white"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Transport Preference */}
            <div className="space-y-2">
              <label className="text-xs uppercase text-[#35483d] font-semibold block">
                Transport Preference
              </label>
              <select
                value={editTransport}
                onChange={(e) => setEditTransport(e.target.value as TransportPreference)}
                className="w-full rounded-xl border border-[#c8dec2] bg-white px-3.5 py-2.5 text-xs text-[#14231b] focus:border-[#2d6a4f] focus:outline-hidden"
              >
                <option value="private_cab">Private Cab & Chauffeur</option>
                <option value="self_drive">Self-Drive Rental</option>
                <option value="public_transport">Public Transit & Rail</option>
                <option value="any">Flexible / Any</option>
              </select>
            </div>

            {/* Confirmation & Submit */}
            <div className="pt-4 border-t border-[#dce9e1] flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="text-xs uppercase text-[#5e7467] hover:text-[#14231b] cursor-pointer font-medium"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isRegenerating}
                onClick={handleApplyRegeneration}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#f5a623] to-[#e08713] hover:from-[#e59b20] hover:to-[#cb770c] text-white px-6 py-2.5 text-xs font-bold uppercase tracking-wider transition shadow-sm hover:shadow-md disabled:opacity-50 cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl border border-[#cbe1d5] bg-white p-6 sm:p-8 space-y-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-[#dce9e1]">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-[#2d6a4f] font-bold block">
                  Alternative Hubs
                </span>
                <h3 className="font-serif text-xl font-normal text-[#14231b]">
                  Replace {replaceTargetStop.destination.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReplaceTargetStop(null)}
                className="text-[#5e7467] hover:text-[#14231b] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-[#35483d] leading-relaxed">
              Select a geographically sensible alternative in the same region to preserve
              realistic driving connections.
            </p>

            {loadingAlternatives ? (
              <div className="py-8 flex items-center justify-center gap-2 text-xs text-[#5e7467]">
                <Loader2 className="h-4 w-4 animate-spin text-[#2d6a4f]" />
                <span>Finding nearby destinations...</span>
              </div>
            ) : nearbyAlternatives.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#5e7467] border border-dashed border-[#cbe1d5] rounded-2xl">
                No direct nearby alternative found within close proximity.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {nearbyAlternatives.map((alt) => (
                  <button
                    key={alt.destination.id}
                    type="button"
                    onClick={() => handleConfirmReplace(alt.destination)}
                    className="w-full flex items-center justify-between p-3.5 rounded-2xl border border-[#d8e6de] bg-[#f8faf8] hover:bg-[#eaf4ee] hover:border-[#2d6a4f]/40 text-left transition cursor-pointer"
                  >
                    <div>
                      <strong className="text-sm text-[#14231b] block">
                        {alt.destination.name}
                      </strong>
                      <span className="text-[11px] text-[#5e7467]">
                        {alt.destination.region} • {alt.destination.highlights.slice(0, 2).join(", ")}
                      </span>
                    </div>

                    <div className="text-right shrink-0 ml-3">
                      <span className="text-xs font-semibold text-[#1e533c] block">
                        {Math.round(alt.distance_km)} km away
                      </span>
                      <span className="text-[10px] text-[#5e7467] uppercase font-bold">
                        Select
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="pt-4 border-t border-[#dce9e1] flex justify-end">
              <button
                type="button"
                onClick={() => setReplaceTargetStop(null)}
                className="text-xs uppercase text-[#5e7467] hover:text-[#14231b] cursor-pointer font-medium"
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
