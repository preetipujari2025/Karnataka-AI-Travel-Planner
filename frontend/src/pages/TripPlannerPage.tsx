import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Compass,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Calendar,
  Users,
  Wallet,
  Car,
  Scale,
  Landmark,
  Trees,
  Waves,
  UtensilsCrossed,
  Bird,
  Flame,
  Camera,
  AlertCircle,
  Church,
  Droplets,
  Mountain,
  ShoppingBag,
  Flag,
  CarFront,
  Loader2,
  Edit3,
  MapPin,
  Clock,
  Coffee,
  Zap,
  Route,
} from "lucide-react";
import { fetchHealth, fetchMeta, generateItinerary } from "../api/client";
import type {
  HealthResponse,
  MetaResponse,
  Interest,
  Pace,
  BudgetTier,
  TransportPreference,
  TripRequest,
  GenerateItineraryResponse,
  ExperienceType,
} from "../api/types";
import { formatInr } from "../lib/format";
import ItineraryView from "../components/ItineraryView";
import StartLocationSelector from "../components/planner/StartLocationSelector";

type ExperiencePreference =
  | "relaxed"
  | "adventure"
  | "cultural"
  | "family"
  | "solo"
  | "couple"
  | "luxury"
  | "budget_backpacking";

const EXPERIENCE_OPTIONS: Array<{
  id: ExperiencePreference;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  experienceTypes: ExperienceType[];
}> = [
  {
    id: "relaxed",
    title: "Relaxed Escape",
    desc: "Unhurried mornings, scenic stays, and uncrowded nature trails.",
    icon: Coffee,
    experienceTypes: ["nature_walk", "sightseeing"],
  },
  {
    id: "adventure",
    title: "Adventure & Outdoors",
    desc: "Western Ghats trekking, river rafting, and wildlife safaris.",
    icon: Compass,
    experienceTypes: ["trekking", "wildlife_safari", "boating"],
  },
  {
    id: "cultural",
    title: "Cultural Exploration",
    desc: "Ancient architecture, royal dynasties, temple mathas, and local arts.",
    icon: Landmark,
    experienceTypes: ["heritage_tour", "pilgrimage"],
  },
  {
    id: "family",
    title: "Family Trip",
    desc: "Comfortable pacing, gentle sights, safe transport, and varied activities.",
    icon: Users,
    experienceTypes: ["sightseeing", "nature_walk"],
  },
  {
    id: "solo",
    title: "Solo Discovery",
    desc: "Walkable backpacker hubs, cafes, culture, and flexible exploration.",
    icon: MapPin,
    experienceTypes: ["sightseeing", "food_tour", "nature_walk"],
  },
  {
    id: "couple",
    title: "Romantic Couple",
    desc: "Misty coffee estates, sunset coves, and serene riverside sanctuaries.",
    icon: Sparkles,
    experienceTypes: ["sightseeing", "nature_walk", "boating"],
  },
  {
    id: "luxury",
    title: "Royal Luxury",
    desc: "Heritage palace resorts, 5-star lodges, and private chauffeured travel.",
    icon: Flame,
    experienceTypes: ["sightseeing", "heritage_tour", "wildlife_safari"],
  },
  {
    id: "budget_backpacking",
    title: "Budget Backpacking",
    desc: "Homestays, hostels, minimal sight fees, and public transport routes.",
    icon: Wallet,
    experienceTypes: ["sightseeing", "nature_walk", "trekking"],
  },
];

const INTEREST_OPTIONS: Array<{
  id: Interest | "culture";
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  backendValue: Interest;
}> = [
  { id: "heritage", label: "Heritage", icon: Landmark, backendValue: "heritage" },
  { id: "nature", label: "Nature", icon: Trees, backendValue: "nature" },
  { id: "coffee_hills", label: "Coffee & Hills", icon: Coffee, backendValue: "coffee_hills" },
  { id: "beach", label: "Beaches", icon: Waves, backendValue: "beach" },
  { id: "food", label: "Food", icon: UtensilsCrossed, backendValue: "food" },
  { id: "wildlife", label: "Wildlife", icon: Bird, backendValue: "wildlife" },
  { id: "adventure", label: "Adventure", icon: Compass, backendValue: "adventure" },
  { id: "spirituality", label: "Spirituality", icon: Flame, backendValue: "spirituality" },
  { id: "culture", label: "Culture", icon: Camera, backendValue: "culture" },
  { id: "temples", label: "Temples", icon: Church, backendValue: "temples" },
  { id: "waterfalls", label: "Waterfalls", icon: Droplets, backendValue: "waterfalls" },
  { id: "viewpoints", label: "Viewpoints", icon: Mountain, backendValue: "viewpoints" },
  { id: "shopping", label: "Shopping", icon: ShoppingBag, backendValue: "shopping" },
];

const TRANSPORT_OPTIONS: Array<{
  id: TransportPreference;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: "private_cab",
    label: "Private Cab & Chauffeur",
    desc: "Maximum flexibility on scenic Ghat roads and coastal routes.",
    icon: Car,
  },
  {
    id: "self_drive",
    label: "Self-Drive Rental",
    desc: "Independent exploration at your own schedule.",
    icon: Compass,
  },
  {
    id: "private_car",
    label: "Own Private Car",
    desc: "Your vehicle — costs are billed per car, not per person.",
    icon: CarFront,
  },
  {
    id: "public_transport",
    label: "Public Transit & Rail",
    desc: "Scenic KSRTC buses and South Western Railway lines.",
    icon: Clock,
  },
  {
    id: "any",
    label: "Flexible / Any Transport",
    desc: "Let the planner decide the best transit method.",
    icon: Sparkles,
  },
];

export default function TripPlannerPage() {
  const location = useLocation();

  // Navigation state / initial presets
  const initialParams = (location.state as Partial<TripRequest>) || {};

  // Form State
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [startCity, setStartCity] = useState<string>(initialParams.start_city || "bengaluru");
  const [finalDestination, setFinalDestination] = useState<string>(
    initialParams.final_destination || ""
  );
  const [departureTime, setDepartureTime] = useState<string>(
    initialParams.departure_time || "08:00"
  );
  const [days, setDays] = useState<number>(initialParams.days || 5);
  const [useConcreteDates, setUseConcreteDates] = useState<boolean>(false);
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14); // 2 weeks out default
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState<string>("");
  const [travellers, setTravellers] = useState<number>(initialParams.travellers || 2);
  const [interests, setInterests] = useState<Interest[]>(
    initialParams.interests || ["heritage", "nature"]
  );
  const [experiencePref, setExperiencePref] = useState<ExperiencePreference>("cultural");
  const [pace, setPace] = useState<Pace>(initialParams.pace || "balanced");
  const [budgetTier, setBudgetTier] = useState<BudgetTier>(initialParams.budget_tier || "mid");
  const [totalBudgetInr, setTotalBudgetInr] = useState<number>(50000);
  const [transportPref, setTransportPref] = useState<TransportPreference>(
    initialParams.transport_preference || "private_cab"
  );
  const [plannerMode, setPlannerMode] = useState<"auto" | "ai" | "fallback">("auto");

  // Server state
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [loadingStage, setLoadingStage] = useState<string>("");
  const [generatedPlan, setGeneratedPlan] = useState<GenerateItineraryResponse | null>(null);
  const [lastTripRequest, setLastTripRequest] = useState<TripRequest | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync end date when start date or days change
  useEffect(() => {
    if (!startDate) return;
    try {
      const start = new Date(startDate);
      if (!isNaN(start.getTime())) {
        const end = new Date(start);
        end.setDate(end.getDate() + days - 1);
        setEndDate(end.toISOString().split("T")[0]);
      }
    } catch {
      // fallback
    }
  }, [startDate, days]);

  // Load backend metadata & health probe
  useEffect(() => {
    const controller = new AbortController();
    fetchMeta(controller.signal)
      .then(setMeta)
      .catch(() => {});
    fetchHealth(controller.signal)
      .then(setHealth)
      .catch(() => {});
    return () => controller.abort();
  }, []);

  function toggleInterest(interest: Interest) {
    if (interests.includes(interest)) {
      if (interests.length > 1) {
        setInterests(interests.filter((i) => i !== interest));
      }
    } else {
      if (interests.length < 9) {
        setInterests([...interests, interest]);
      }
    }
  }

  async function handleGenerateJourney() {
    setIsGenerating(true);
    setErrorMessage(null);

    // Dynamic loading messages
    setLoadingStage("Querying verified Karnataka destinations & 31 districts...");
    const t1 = setTimeout(() => {
      setLoadingStage("Calculating real road distances and highway transit hours...");
    }, 900);
    const t2 = setTimeout(() => {
      setLoadingStage("Sequencing multi-day stay spans and curated activities...");
    }, 1800);
    const t3 = setTimeout(() => {
      setLoadingStage("Validating entry fees and verifying Indian Rupee budget breakdown...");
    }, 2700);

    const expOption = EXPERIENCE_OPTIONS.find((e) => e.id === experiencePref);

    const tripPayload: TripRequest = {
      start_city: startCity,
      days,
      final_destination: finalDestination || null,
      departure_time: departureTime,
      travellers,
      budget_tier: budgetTier,
      pace,
      interests,
      experience_preference: experiencePref,
      planner: plannerMode,
      total_budget_inr: totalBudgetInr > 0 ? totalBudgetInr : null,
      transport_preference: transportPref,
      experience_types: expOption?.experienceTypes || [],
      travel_dates:
        useConcreteDates && startDate && endDate
          ? { start_date: startDate, end_date: endDate }
          : null,
      start_month: useConcreteDates && startDate ? new Date(startDate).getMonth() + 1 : null,
    };

    try {
      const planResponse = await generateItinerary(tripPayload);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      setLastTripRequest(tripPayload);
      setGeneratedPlan(planResponse);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      // Silently fall back to deterministic Smart planner so user never sees an error
      try {
        setLoadingStage("Finalizing verified itinerary with Smart planner...");
        const fallbackPayload: TripRequest = { ...tripPayload, planner: "fallback" };
        const fallbackResponse = await generateItinerary(fallbackPayload);
        setLastTripRequest(fallbackPayload);
        setGeneratedPlan(fallbackResponse);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (fallbackErr) {
        setErrorMessage((fallbackErr as Error).message || "Unable to generate plan. Please try again.");
      }
    } finally {
      setIsGenerating(false);
    }
  }

  // Calculated per-person, per-day, and minimum viable values for clear UI display
  const perPersonTotal = Math.round(totalBudgetInr / (travellers || 1));
  const perPersonPerDay = Math.round(perPersonTotal / (days || 1));
  const minDailyPerPerson = budgetTier === "luxury" ? 7000 : budgetTier === "mid" ? 2500 : 1200;
  const minRecommendedBudget = (days || 1) * (travellers || 1) * minDailyPerPerson;
  const isBudgetTooLow = totalBudgetInr < minRecommendedBudget;

  return (
    <div className="min-h-screen bg-[#fcfbf9] text-[#1b2b22] flex flex-col justify-between selection:bg-[#2d6a4f]/20 selection:text-[#1b2b22]">
      {/* Top Guided Navigation Bar */}
      <nav className="sticky top-0 z-50 border-b border-[#e2ece5] bg-[#fcfbf9]/95 px-6 py-4 backdrop-blur-md shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#2d6a4f] hover:text-[#1b2b22] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Karnataka Trails AI</span>
          </Link>

          {/* Stepper Progress (when in form mode) */}
          {!generatedPlan && (
            <div className="hidden sm:flex items-center gap-6">
              {[
                { num: 1, label: "Foundation" },
                { num: 2, label: "Passions" },
                { num: 3, label: "Pacing & Budget" },
                { num: 4, label: "Review" },
              ].map((step) => (
                <button
                  key={step.num}
                  type="button"
                  onClick={() => {
                    if (step.num < currentStep) setCurrentStep(step.num);
                  }}
                  className={`flex items-center gap-2 text-xs font-mono uppercase tracking-wider transition-colors ${
                    currentStep === step.num
                      ? "text-[#2d6a4f] font-bold"
                      : currentStep > step.num
                      ? "text-[#476052] hover:text-[#1b2b22]"
                      : "text-[#94a39b] cursor-not-allowed"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                      currentStep === step.num
                        ? "bg-[#2d6a4f] text-white"
                        : currentStep > step.num
                        ? "bg-[#e8f1ec] text-[#2d6a4f]"
                        : "border border-[#d8e6de] text-[#94a39b]"
                    }`}
                  >
                    {step.num}
                  </span>
                  <span>{step.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* System Engine Health Indicator */}
          <div className="flex items-center gap-4">
            <Link
              to="/road-trip"
              className="hidden sm:flex items-center gap-1.5 rounded-lg border border-[#d8e6de] bg-white px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider text-[#2d6a4f] transition hover:border-[#2d6a4f]/40 hover:bg-[#eef5f1]"
            >
              <Route className="h-3.5 w-3.5" />
              Road Trip
            </Link>
            <div className="flex items-center gap-2 text-[11px] font-mono text-[#556b60]">
              <span
                className={`h-2 w-2 rounded-full ${
                  health?.status === "ok" ? "bg-[#2d6a4f] shadow-sm shadow-[#2d6a4f]/40" : "bg-[#e08713]"
                }`}
              />
              <span className="hidden md:inline">
                {health?.status === "ok" ? "All 31 Districts Active" : "Connecting"}
              </span>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Guided Builder Container */}
      <main className={`mx-auto w-full px-4 sm:px-6 py-8 sm:py-12 flex-1 ${generatedPlan ? "max-w-6xl" : "max-w-4xl"}`}>
        {/* If Itinerary is Generated, Display Results */}
        {generatedPlan ? (
          <div className="animate-in fade-in duration-500">
            <ItineraryView
              plan={generatedPlan}
              originalTrip={lastTripRequest || undefined}
              onPlanUpdated={setGeneratedPlan}
              onRestartPlanning={() => setGeneratedPlan(null)}
            />
          </div>
        ) : isGenerating ? (
          /* Loading State */
          <div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-8">
            <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-[#2d6a4f]/10 border border-[#2d6a4f]/25 mb-8">
              <Loader2 className="h-10 w-10 text-[#2d6a4f] animate-spin" />
            </div>

            <h2 className="font-serif text-2xl sm:text-3xl font-normal text-[#1b2b22]">
              Synthesizing Your Journey
            </h2>
            <p className="mt-3 font-mono text-xs uppercase tracking-wider text-[#2d6a4f] animate-pulse">
              {loadingStage}
            </p>
            <p className="mt-4 text-xs text-[#556b60] max-w-md font-light leading-relaxed">
              Connecting road networks across verified Karnataka destinations and 31 districts, verifying
              seasonal suitability, and validating itemized costs.
            </p>
          </div>
        ) : (
          /* Guided Form Steps */
          <div className="space-y-10 animate-in fade-in duration-300">
            {/* Error Notice */}
            {errorMessage && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-medium">Generation Error</strong>
                  <span>{errorMessage}</span>
                </div>
              </div>
            )}

            {/* STEP 1: Foundation (Where & When) */}
            {currentStep === 1 && (
              <div className="space-y-8">
                <div>
                  <span className="text-xs uppercase font-mono tracking-widest text-[#2d6a4f] block mb-1">
                    Step 01 of 04 • Foundation
                  </span>
                  <h1 className="font-serif text-3xl sm:text-4xl font-normal text-[#1b2b22]">
                    Where will your journey begin?
                  </h1>
                  <p className="mt-2 text-sm text-[#556b60] font-light">
                    Select your departure hub and trip duration.
                  </p>
                </div>

                {/* Starting Hub City */}
                <div className="space-y-3">
                  <label className="text-xs font-mono uppercase tracking-wider text-[#2d6a4f] flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-[#e08713]" />
                    Starting Hub / District Headquarters
                  </label>
                  <StartLocationSelector
                    id="step1-start-city"
                    value={startCity}
                    onChange={setStartCity}
                    cities={meta?.start_cities ?? []}
                  />
                </div>

                {/* Final Destination (optional) + Departure Time */}
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-end">
                  <div className="space-y-3">
                    <label className="text-xs font-mono uppercase tracking-wider text-[#2d6a4f] flex items-center gap-2">
                      <Flag className="h-4 w-4 text-[#e08713]" />
                      Final Destination (Optional)
                    </label>
                    <StartLocationSelector
                      id="step1-final-destination"
                      value={finalDestination || startCity}
                      onChange={setFinalDestination}
                      cities={meta?.start_cities ?? []}
                    />
                    <p className="text-[11px] text-[#556b60]">
                      Ending somewhere specific? The planner will anchor the route there. Leave
                      unset to let the planner pick the loop.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono uppercase tracking-wider text-[#2d6a4f] flex items-center gap-2">
                      <Clock className="h-4 w-4 text-[#e08713]" />
                      Departure Time
                    </label>
                    <input
                      id="step1-departure-time"
                      type="time"
                      value={departureTime}
                      onChange={(e) => setDepartureTime(e.target.value)}
                      className="w-full sm:w-36 rounded-xl border border-[#d8e6de] bg-white px-3.5 py-3 text-sm text-[#1b2b22] focus:border-[#2d6a4f] focus:outline-none shadow-sm"
                    />
                  </div>
                </div>

                {/* Duration in Days */}
                <div className="space-y-4 rounded-2xl border border-[#d8e6de] bg-white/95 p-6 shadow-sm">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-mono uppercase tracking-wider text-[#2d6a4f] flex items-center gap-2">
                      <Clock className="h-4 w-4 text-[#e08713]" />
                      Trip Duration
                    </label>
                    <span className="font-serif text-2xl font-bold text-[#2d6a4f]">
                      {days} {days === 1 ? "Day" : "Days"}
                    </span>
                  </div>

                  <input
                    type="range"
                    min={1}
                    max={21}
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value))}
                    className="w-full accent-[#2d6a4f] cursor-pointer h-2 bg-[#e2ece5] rounded-lg"
                  />

                  {/* Duration Presets */}
                  <div className="flex flex-wrap gap-2 pt-2">
                    {[
                      { d: 3, label: "Weekend (3d)" },
                      { d: 5, label: "Classic (5d)" },
                      { d: 7, label: "One Week (7d)" },
                      { d: 10, label: "In-Depth (10d)" },
                      { d: 14, label: "Grand Tour (14d)" },
                    ].map((preset) => (
                      <button
                        key={preset.d}
                        type="button"
                        onClick={() => setDays(preset.d)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-mono transition ${
                          days === preset.d
                            ? "bg-[#2d6a4f] text-white font-bold shadow-sm"
                            : "bg-[#f4f7f5] text-[#556b60] hover:text-[#1b2b22] hover:bg-[#e8f1ec]"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Specific Travel Dates (Optional) */}
                <div className="rounded-2xl border border-[#d8e6de] bg-white/95 p-6 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-[#e08713]" />
                      <span className="text-xs font-mono uppercase tracking-wider text-[#2d6a4f]">
                        Concrete Travel Dates (Optional)
                      </span>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer text-xs text-[#556b60]">
                      <input
                        type="checkbox"
                        checked={useConcreteDates}
                        onChange={(e) => setUseConcreteDates(e.target.checked)}
                        className="rounded border-[#d8e6de] accent-[#2d6a4f] h-4 w-4"
                      />
                      <span>Set calendar dates</span>
                    </label>
                  </div>

                  {useConcreteDates && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-mono text-[#556b60] uppercase">
                          Departure Date
                        </span>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="w-full rounded-lg border border-[#d8e6de] bg-white px-3.5 py-2.5 text-xs text-[#1b2b22] focus:border-[#2d6a4f] focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-mono text-[#556b60] uppercase">
                          Return Date ({days} days)
                        </span>
                        <input
                          type="date"
                          value={endDate}
                          disabled
                          className="w-full rounded-lg border border-[#e2ece5] bg-[#f8faf9] px-3.5 py-2.5 text-xs text-[#8da397] cursor-not-allowed"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Number of Travellers */}
                <div className="space-y-3 rounded-2xl border border-[#d8e6de] bg-white/95 p-6 shadow-sm">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-mono uppercase tracking-wider text-[#2d6a4f] flex items-center gap-2">
                      <Users className="h-4 w-4 text-[#e08713]" />
                      Number of Travellers
                    </label>
                    <span className="font-serif text-xl font-bold text-[#2d6a4f]">
                      {travellers} {travellers === 1 ? "Person" : "People"}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-3 pt-2">
                    {[
                      { count: 1, label: "Solo" },
                      { count: 2, label: "Couple" },
                      { count: 4, label: "Family (4)" },
                      { count: 6, label: "Group (6+)" },
                    ].map((opt) => (
                      <button
                        key={opt.count}
                        type="button"
                        onClick={() => setTravellers(opt.count)}
                        className={`flex flex-col items-center justify-center py-3 rounded-xl border transition ${
                          travellers === opt.count
                            ? "border-[#2d6a4f] bg-[#eef5f1] text-[#2d6a4f] font-bold shadow-sm"
                            : "border-[#e2ece5] bg-white text-[#556b60] hover:border-[#2d6a4f]/30 hover:text-[#1b2b22]"
                        }`}
                      >
                        <span className="text-sm font-bold">{opt.count}</span>
                        <span className="text-[10px] text-[#556b60]">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Continue button */}
                <div className="flex justify-end pt-4">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="flex items-center gap-2 rounded-xl bg-[#2d6a4f] hover:bg-[#23533e] text-white px-6 py-3 text-xs font-bold uppercase tracking-wider transition shadow-md shadow-[#2d6a4f]/20 cursor-pointer"
                  >
                    <span>Continue to Passions</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: Interests & Experience Preference */}
            {currentStep === 2 && (
              <div className="space-y-8">
                <div>
                  <span className="text-xs uppercase font-mono tracking-widest text-[#2d6a4f] block mb-1">
                    Step 02 of 04 • Passions & Style
                  </span>
                  <h1 className="font-serif text-3xl sm:text-4xl font-normal text-[#1b2b22]">
                    What draws you to Karnataka?
                  </h1>
                  <p className="mt-2 text-sm text-[#556b60] font-light">
                    Select your core interests and preferred style of experience.
                  </p>
                </div>

                {/* Interests Chips */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-mono uppercase tracking-wider text-[#2d6a4f]">
                      Core Interests (Select 1 to 9)
                    </label>
                    <span className="text-xs font-mono text-[#2d6a4f] font-semibold">
                      {interests.length} selected
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {INTEREST_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      const active = interests.includes(opt.backendValue);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => toggleInterest(opt.backendValue)}
                          className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
                            active
                              ? "border-[#2d6a4f] bg-[#eef5f1] text-[#1b2b22] shadow-sm"
                              : "border-[#e2ece5] bg-white text-[#556b60] hover:border-[#2d6a4f]/30 hover:text-[#1b2b22]"
                          }`}
                        >
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                              active ? "bg-[#2d6a4f] text-white" : "bg-[#f4f7f5] text-[#2d6a4f]"
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <span className="text-xs font-medium">{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Experience Preference Cards */}
                <div className="space-y-3 pt-2">
                  <label className="text-xs font-mono uppercase tracking-wider text-[#2d6a4f]">
                    Experience Preference
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {EXPERIENCE_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      const active = experiencePref === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setExperiencePref(opt.id)}
                          className={`flex flex-col text-left p-4 rounded-xl border transition-all ${
                            active
                              ? "border-[#2d6a4f] bg-[#eef5f1] text-[#1b2b22] shadow-sm"
                              : "border-[#e2ece5] bg-white text-[#556b60] hover:border-[#2d6a4f]/30 hover:text-[#1b2b22]"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            <Icon className={`h-4 w-4 ${active ? "text-[#2d6a4f]" : "text-[#556b60]"}`} />
                            <span className="text-xs font-bold text-[#1b2b22]">{opt.title}</span>
                          </div>
                          <p className="text-[11px] text-[#556b60] leading-relaxed">{opt.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Navigation Row */}
                <div className="flex items-center justify-between pt-6 border-t border-[#e2ece5]">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#556b60] hover:text-[#1b2b22] transition"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="flex items-center gap-2 rounded-xl bg-[#2d6a4f] hover:bg-[#23533e] text-white px-6 py-3 text-xs font-bold uppercase tracking-wider transition shadow-md shadow-[#2d6a4f]/20 cursor-pointer"
                  >
                    <span>Continue to Pacing & Budget</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Pacing, Transport & Investment */}
            {currentStep === 3 && (
              <div className="space-y-8">
                <div>
                  <span className="text-xs uppercase font-mono tracking-widest text-[#2d6a4f] block mb-1">
                    Step 03 of 04 • Pacing & Investment
                  </span>
                  <h1 className="font-serif text-3xl sm:text-4xl font-normal text-[#1b2b22]">
                    How do you prefer to travel?
                  </h1>
                  <p className="mt-2 text-sm text-[#556b60] font-light">
                    Balance your transit rhythm, comfort level, and target INR budget.
                  </p>
                </div>

                {/* Travel Pace */}
                <div className="space-y-3">
                  <label className="text-xs font-mono uppercase tracking-wider text-[#2d6a4f] flex items-center gap-2">
                    <Scale className="h-4 w-4 text-[#e08713]" />
                    Travel Pace
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      {
                        p: "relaxed" as Pace,
                        title: "Relaxed",
                        desc: "1 main area per day, unhurried mornings",
                        icon: Coffee,
                      },
                      {
                        p: "balanced" as Pace,
                        title: "Balanced",
                        desc: "2-3 sights per day with morning transit",
                        icon: Scale,
                      },
                      {
                        p: "packed" as Pace,
                        title: "Intensive",
                        desc: "Maximum coverage, sunrise departures",
                        icon: Zap,
                      },
                    ].map((item) => {
                      const active = pace === item.p;
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.p}
                          type="button"
                          onClick={() => setPace(item.p)}
                          className={`flex flex-col text-left p-4 rounded-xl border transition ${
                            active
                              ? "border-[#2d6a4f] bg-[#eef5f1] text-[#1b2b22] shadow-sm"
                              : "border-[#e2ece5] bg-white text-[#556b60] hover:border-[#2d6a4f]/30 hover:text-[#1b2b22]"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Icon className={`h-4 w-4 ${active ? "text-[#2d6a4f]" : "text-[#556b60]"}`} />
                            <span className="text-xs font-bold text-[#1b2b22]">{item.title}</span>
                          </div>
                          <span className="text-[11px] text-[#556b60] leading-relaxed">{item.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Transport Preference */}
                <div className="space-y-3">
                  <label className="text-xs font-mono uppercase tracking-wider text-[#2d6a4f] flex items-center gap-2">
                    <Car className="h-4 w-4 text-[#e08713]" />
                    Transport Preference
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {TRANSPORT_OPTIONS.map((item) => {
                      const active = transportPref === item.id;
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setTransportPref(item.id)}
                          className={`flex items-start gap-3 p-4 rounded-xl border text-left transition ${
                            active
                              ? "border-[#2d6a4f] bg-[#eef5f1] text-[#1b2b22] shadow-sm"
                              : "border-[#e2ece5] bg-white text-[#556b60] hover:border-[#2d6a4f]/30 hover:text-[#1b2b22]"
                          }`}
                        >
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                              active ? "bg-[#2d6a4f] text-white" : "bg-[#f4f7f5] text-[#2d6a4f]"
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-[#1b2b22] block">{item.label}</span>
                            <span className="text-[11px] text-[#556b60] leading-tight mt-0.5 block">
                              {item.desc}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Total Budget in INR & Budget Tier */}
                <div className="space-y-4 rounded-2xl border border-[#d8e6de] bg-white/95 p-6 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <label className="text-xs font-mono uppercase tracking-wider text-[#2d6a4f] flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-[#e08713]" />
                      Total Trip Budget (INR)
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#2d6a4f] font-mono text-sm font-bold">₹</span>
                        <input
                          id="budget-inr-input"
                          type="number"
                          min={1000}
                          max={10000000}
                          step={1000}
                          value={totalBudgetInr || ""}
                          onChange={(e) => setTotalBudgetInr(Math.max(0, Number(e.target.value)))}
                          className="w-36 rounded-xl border border-[#d8e6de] bg-white pl-7 pr-3 py-1.5 text-sm font-bold font-mono text-[#2d6a4f] focus:border-[#2d6a4f] focus:outline-none shadow-sm"
                          placeholder="Amount"
                        />
                      </div>
                      <span className="font-serif text-2xl font-bold text-[#2d6a4f] hidden sm:inline">
                        {formatInr(totalBudgetInr)}
                      </span>
                    </div>
                  </div>

                  <input
                    type="range"
                    min={1000}
                    max={300000}
                    step={1000}
                    value={totalBudgetInr}
                    onChange={(e) => setTotalBudgetInr(Number(e.target.value))}
                    className="w-full accent-[#2d6a4f] cursor-pointer h-2 bg-[#e2ece5] rounded-lg"
                  />

                  {/* Preset quick budget chips */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {[
                      { amt: 10000, label: "₹10K" },
                      { amt: 25000, label: "₹25K" },
                      { amt: 50000, label: "₹50K" },
                      { amt: 100000, label: "₹1 Lakh" },
                      { amt: 200000, label: "₹2 Lakhs" },
                    ].map((chip) => (
                      <button
                        key={chip.amt}
                        type="button"
                        onClick={() => setTotalBudgetInr(chip.amt)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-mono transition ${
                          totalBudgetInr === chip.amt
                            ? "bg-[#2d6a4f] text-white font-bold shadow-sm"
                            : "bg-[#f4f7f5] text-[#556b60] hover:text-[#1b2b22] hover:bg-[#e8f1ec]"
                        }`}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>

                  {/* Real Breakdown Display */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-[#556b60] border-t border-[#e2ece5]">
                    <span>
                      Share per person:{" "}
                      <strong className="text-[#1b2b22]">{formatInr(perPersonTotal)}</strong>
                    </span>
                    <span>
                      Average daily spend:{" "}
                      <strong className="text-[#1b2b22]">{formatInr(perPersonPerDay)} / day</strong>
                    </span>
                  </div>

                  {/* Clear warning message if budget is too low */}
                  {isBudgetTooLow && (
                    <div
                      id="budget-too-low-warning"
                      className="rounded-xl border border-[#e08713]/40 bg-[#fff9ed] p-3.5 text-xs text-[#8c5000] flex items-start gap-2.5 animate-in fade-in"
                    >
                      <AlertCircle className="h-4 w-4 text-[#e08713] shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-[#8c5000] block">
                          Budget Warning: ₹{formatInr(totalBudgetInr)} may be too low for this trip
                        </span>
                        <span className="text-[#6d3e00] text-[11px] block mt-0.5 leading-relaxed">
                          A {days}-day trip for {travellers} {travellers === 1 ? "traveller" : "travellers"} in {budgetTier} class typically requires at least {formatInr(minRecommendedBudget)} (approx. {formatInr(minDailyPerPerson)}/person/day for stays, meals and travel). You can proceed, but our system will flag overages if minimum realistic expenses exceed your target.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Budget Tier Selector */}
                  <div className="pt-3">
                    <span className="text-[11px] font-mono uppercase text-[#556b60] block mb-2 font-medium">
                      Preferred Comfort Class
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { tier: "budget" as BudgetTier, label: "Budget Explorer" },
                        { tier: "mid" as BudgetTier, label: "Mid-Range Comfort" },
                        { tier: "luxury" as BudgetTier, label: "Royal Luxury" },
                      ].map((t) => (
                        <button
                          key={t.tier}
                          type="button"
                          onClick={() => setBudgetTier(t.tier)}
                          className={`rounded-lg py-2 px-1 text-center text-xs font-medium border transition ${
                            budgetTier === t.tier
                              ? "border-[#2d6a4f] bg-[#2d6a4f] text-white font-bold shadow-sm"
                              : "border-[#e2ece5] bg-[#f4f7f5] text-[#556b60] hover:text-[#1b2b22] hover:bg-[#e8f1ec]"
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Navigation Row */}
                <div className="flex items-center justify-between pt-6 border-t border-[#e2ece5]">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#556b60] hover:text-[#1b2b22] transition"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCurrentStep(4)}
                    className="flex items-center gap-2 rounded-xl bg-[#2d6a4f] hover:bg-[#23533e] text-white px-6 py-3 text-xs font-bold uppercase tracking-wider transition shadow-md shadow-[#2d6a4f]/20 cursor-pointer"
                  >
                    <span>Review Journey Plan</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: Review Summary & Confirmation */}
            {currentStep === 4 && (
              <div className="space-y-8">
                <div>
                  <span className="text-xs uppercase font-mono tracking-widest text-[#2d6a4f] block mb-1">
                    Step 04 of 04 • Summary & Confirmation
                  </span>
                  <h1 className="font-serif text-3xl sm:text-4xl font-normal text-[#1b2b22]">
                    Review Your Preferences
                  </h1>
                  <p className="mt-2 text-sm text-[#556b60] font-light">
                    Ensure these parameters reflect your intended Karnataka journey before we generate
                    the complete route.
                  </p>
                </div>

                {/* Summary Card with Edit Actions */}
                <div className="rounded-2xl border border-[#d8e6de] bg-white/95 p-6 sm:p-8 space-y-6 shadow-sm">
                  {/* Row 1: Origin & Duration */}
                  <div className="flex items-start justify-between pb-5 border-b border-[#e2ece5]">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-[#556b60] block">
                        Origin & Duration
                      </span>
                      <div className="font-serif text-lg font-bold text-[#1b2b22] mt-0.5">
                        {startCity.toUpperCase()} • {days} Days ({travellers}{" "}
                        {travellers === 1 ? "Traveller" : "Travellers"})
                      </div>
                      {useConcreteDates && startDate && (
                        <div className="text-xs text-[#556b60] mt-0.5">
                          Dates: {startDate} to {endDate}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="text-xs font-mono text-[#2d6a4f] hover:underline flex items-center gap-1 font-semibold"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>Edit</span>
                    </button>
                  </div>

                  {/* Row 2: Selected Passions & Style */}
                  <div className="flex items-start justify-between pb-5 border-b border-[#e2ece5]">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-[#556b60] block mb-2">
                        Passions & Style
                      </span>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {interests.map((i) => (
                          <span
                            key={i}
                            className="rounded-md border border-[#2d6a4f]/30 bg-[#eef5f1] px-2.5 py-0.5 text-xs text-[#2d6a4f] font-medium capitalize"
                          >
                            {i}
                          </span>
                        ))}
                      </div>
                      <div className="text-xs text-[#556b60]">
                        Experience Style:{" "}
                        <strong className="text-[#1b2b22] capitalize">
                          {experiencePref.replace("_", " ")}
                        </strong>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setCurrentStep(2)}
                      className="text-xs font-mono text-[#2d6a4f] hover:underline flex items-center gap-1 font-semibold"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>Edit</span>
                    </button>
                  </div>

                  {/* Row 3: Pacing, Transport & Budget */}
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-[#556b60] block">
                        Pacing & Investment
                      </span>
                      <div className="font-serif text-lg font-bold text-[#1b2b22] mt-0.5">
                        {formatInr(totalBudgetInr)}{" "}
                        <span className="text-xs text-[#556b60] font-sans font-normal">
                          ({budgetTier} tier • {pace} pace)
                        </span>
                      </div>
                      <div className="text-xs text-[#556b60] mt-1">
                        Transport:{" "}
                        <strong className="text-[#1b2b22] capitalize">
                          {transportPref.replace("_", " ")}
                        </strong>
                      </div>
                      {isBudgetTooLow && (
                        <div className="mt-2 text-[11px] text-[#8c5000] bg-[#fff9ed] border border-[#e08713]/30 rounded-lg p-2 flex items-center gap-1.5">
                          <AlertCircle className="h-3.5 w-3.5 text-[#e08713] shrink-0" />
                          <span>
                            Budget Notice: Target INR is low for a {days}-day trip for {travellers} in {budgetTier} class (typical min: {formatInr(minRecommendedBudget)}).
                          </span>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setCurrentStep(3)}
                      className="text-xs font-mono text-[#2d6a4f] hover:underline flex items-center gap-1 font-semibold"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>Edit</span>
                    </button>
                  </div>
                </div>

                {/* Planner Engine Mode Toggle */}
                <div className="rounded-2xl border border-[#d8e6de] bg-white/95 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                  <div>
                    <span className="text-xs font-mono uppercase tracking-wider text-[#2d6a4f] block font-semibold">
                      Planning Engine
                    </span>
                    <span className="text-xs text-[#556b60] font-light block mt-0.5">
                      Auto selects the AI engine with deterministic fallback guarantees.
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {[
                      { mode: "auto" as const, label: "Auto" },
                      { mode: "fallback" as const, label: "Deterministic" },
                      { mode: "ai" as const, label: "AI Only" },
                    ].map((m) => (
                      <button
                        key={m.mode}
                        type="button"
                        onClick={() => setPlannerMode(m.mode)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-mono uppercase transition ${
                          plannerMode === m.mode
                            ? "bg-[#2d6a4f] text-white font-bold shadow-sm"
                            : "bg-[#f4f7f5] text-[#556b60] hover:text-[#1b2b22] hover:bg-[#e8f1ec]"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Navigation and Main Action */}
                <div className="flex items-center justify-between pt-6 border-t border-[#e2ece5]">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#556b60] hover:text-[#1b2b22] transition"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleGenerateJourney}
                    className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-[#e08713] to-[#c77207] hover:from-[#d17a0b] hover:to-[#b86603] text-white px-8 py-4 text-xs font-bold uppercase tracking-wider transition-all duration-200 shadow-xl shadow-[#e08713]/25 hover:scale-[1.02] cursor-pointer"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>Generate My Journey</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Subtle Footer */}
      <footer className="border-t border-[#e2ece5] bg-white/70 py-6 text-center text-xs text-[#556b60] font-mono">
        Karnataka Trails AI • 38 Curated Hubs • Verified Geodata & Distance Graph
      </footer>
    </div>
  );
}
