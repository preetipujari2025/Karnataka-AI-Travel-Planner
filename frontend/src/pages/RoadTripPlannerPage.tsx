import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Compass,
  Loader2,
  MapPin,
  Route as RouteIcon,
  Search,
  AlertCircle,
} from "lucide-react";
import { discoverRoute, fetchMeta, planRoadTrip } from "../api/client";
import type {
  Interest,
  MetaResponse,
  Pace,
  BudgetTier,
  TransportPreference,
  DietaryPreference,
  RoadTripPlanResponse,
  RouteDiscoveryResponse,
  TravellerType,
  TripPriority,
} from "../api/types";
import StartLocationSelector from "../components/planner/StartLocationSelector";
import RouteDiscoveryPanel from "../components/roadtrip/RouteDiscoveryPanel";
import RoadTripView from "../components/roadtrip/RoadTripView";
import { defaultSelectedMealIds, defaultSelectedStopIds } from "../lib/roadtrip";

type Stage = "form" | "discovering" | "selecting" | "planning" | "planned";

const INTEREST_CHOICES: Array<{ value: Interest; label: string }> = [
  { value: "heritage", label: "Heritage" },
  { value: "temples", label: "Temples" },
  { value: "nature", label: "Nature" },
  { value: "waterfalls", label: "Waterfalls" },
  { value: "viewpoints", label: "Viewpoints" },
  { value: "wildlife", label: "Wildlife" },
  { value: "beach", label: "Beaches" },
  { value: "adventure", label: "Adventure" },
  { value: "spirituality", label: "Spirituality" },
  { value: "culture", label: "Culture" },
  { value: "food", label: "Food" },
  { value: "photography", label: "Photography" },
  { value: "shopping", label: "Shopping" },
  { value: "urban", label: "Urban" },
];

export default function RoadTripPlannerPage() {
  const [meta, setMeta] = useState<MetaResponse | null>(null);

  // Form state
  const [startCity, setStartCity] = useState("bengaluru");
  const [finalDestination, setFinalDestination] = useState("mysuru");
  const [departureDate, setDepartureDate] = useState("");
  const [departureTime, setDepartureTime] = useState("08:00");
  const [days, setDays] = useState(2);
  const [nights, setNights] = useState(1);
  const [travellers, setTravellers] = useState(2);
  const [travellerType, setTravellerType] = useState<TravellerType>("couple");
  const [tripPriority, setTripPriority] = useState<TripPriority>("balanced");
  const [budgetTier, setBudgetTier] = useState<BudgetTier>("mid");
  const [pace, setPace] = useState<Pace>("balanced");
  const [transport, setTransport] = useState<TransportPreference>("self_drive");
  const [interests, setInterests] = useState<Interest[]>(["heritage", "nature", "temples"]);
  const [cornerRadiusKm, setCornerRadiusKm] = useState(30);
  const [maxDetourKm, setMaxDetourKm] = useState(40);
  const [includeMeals, setIncludeMeals] = useState(true);
  const [dietary, setDietary] = useState<DietaryPreference>("no_preference");
  const [mealBudgetPerDayInr, setMealBudgetPerDayInr] = useState<number | "">("");
  const [totalBudgetInr, setTotalBudgetInr] = useState(0);

  // Flow state
  const [stage, setStage] = useState<Stage>("form");
  const [discovery, setDiscovery] = useState<RouteDiscoveryResponse | null>(null);
  const [selectedStopIds, setSelectedStopIds] = useState<string[]>([]);
  const [selectedMealIds, setSelectedMealIds] = useState<string[]>([]);
  const [plan, setPlan] = useState<RoadTripPlanResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchMeta(controller.signal)
      .then(setMeta)
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const cities = meta?.start_cities ?? [];

  const discoveryRequest = useMemo(() => {
    const daysInt = Math.max(1, Math.round(days));
    const nightsInt =
      typeof nights === "number" && !isNaN(nights) ? Math.max(0, nights) : Math.max(0, daysInt - 1);
    return {
      start_city: startCity,
      final_destination: finalDestination,
      interests,
      pace,
      budget_tier: budgetTier,
      travellers,
      traveller_type: travellerType,
      trip_priority: tripPriority,
      transport_preference: transport,
      days: daysInt,
      nights: nightsInt,
      total_budget_inr: totalBudgetInr > 0 ? totalBudgetInr : null,
      departure_date: departureDate || null,
      departure_time: departureTime,
      corridor_radius_km: cornerRadiusKm,
      max_detour_km: maxDetourKm,
      allow_backtracking: false,
      include_meals: includeMeals,
      dietary_preference: dietary,
      food_preferences: [],
      meal_budget_per_day_inr: mealBudgetPerDayInr ? Number(mealBudgetPerDayInr) : null,
      max_candidates: 40,
      refresh: false,
    };
  }, [
    startCity,
    finalDestination,
    interests,
    pace,
    budgetTier,
    travellers,
    travellerType,
    tripPriority,
    transport,
    days,
    nights,
    totalBudgetInr,
    departureDate,
    departureTime,
    cornerRadiusKm,
    maxDetourKm,
    includeMeals,
    dietary,
    mealBudgetPerDayInr,
  ]);

  const sameJourney =
    discovery !== null &&
    discovery.request.start_city === discoveryRequest.start_city &&
    discovery.request.final_destination === discoveryRequest.final_destination &&
    discovery.request.days === discoveryRequest.days;

  function toggleInterest(value: Interest) {
    setInterests((prev) =>
      prev.includes(value)
        ? prev.length > 1
          ? prev.filter((i) => i !== value)
          : prev
        : [...prev, value]
    );
  }

  async function handleDiscover(refresh = false) {
    if (startCity === finalDestination) {
      setErrorMessage("Pick two different places — origin and destination must differ.");
      return;
    }
    setStage("discovering");
    setErrorMessage(null);
    try {
      const response = await discoverRoute({ ...discoveryRequest, refresh });
      setDiscovery(response);
      setSelectedStopIds(defaultSelectedStopIds(response));
      setSelectedMealIds(defaultSelectedMealIds(response));
      setPlan(null);
      setStage("selecting");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setErrorMessage((err as Error).message || "Route discovery failed.");
      setStage("form");
    }
  }

  async function handlePlan() {
    if (!discovery) return;
    setStage("planning");
    setErrorMessage(null);
    try {
      const response = await planRoadTrip({
        discovery: discoveryRequest,
        selected_stop_ids: selectedStopIds,
        selected_meal_ids: selectedMealIds,
        total_budget_inr: totalBudgetInr > 0 ? totalBudgetInr : null,
      });
      setPlan(response);
      setStage("planned");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setErrorMessage((err as Error).message || "Planning failed.");
      setStage("selecting");
    }
  }

  const busy = stage === "discovering" || stage === "planning";

  return (
    <div className="min-h-screen bg-[#070b12] text-slate-100">
      {/* Top nav */}
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#070b12]/92 px-6 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-slate-300 hover:text-amber-400 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Karnataka Trails AI</span>
          </Link>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-amber-400">
            <RouteIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Road Trip Planner</span>
          </div>
          <Link
            to="/plan"
            className="text-xs font-mono uppercase tracking-widest text-slate-300 hover:text-amber-400 transition-colors"
          >
            Classic Planner
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-6 py-10 space-y-8">
        {/* Error notice */}
        {errorMessage && (
          <div className="rounded-xl border border-red-500/30 bg-red-950/40 p-4 text-xs text-red-200 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-medium">Something went wrong</strong>
              <span>{errorMessage}</span>
            </div>
          </div>
        )}

        {/* Journey form — always visible */}
        <section className="rounded-2xl border border-white/10 bg-[#0a0f18] p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-serif text-2xl text-white">Plan a road trip between any two places</h1>
              <p className="mt-1 text-xs text-slate-400">
                We trace the real road, find verified stops along the corridor, and schedule only
                what fits. Nothing is invented.
              </p>
            </div>
            {stage !== "form" && stage !== "discovering" && (
              <button
                type="button"
                onClick={() => setStage("form")}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:text-white"
              >
                Edit journey
              </button>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-amber-400" /> Starting point
              </label>
              <StartLocationSelector
                id="roadtrip-start"
                value={startCity}
                onChange={setStartCity}
                cities={cities}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Compass className="h-3.5 w-3.5 text-amber-400" /> Final destination
              </label>
              <StartLocationSelector
                id="roadtrip-destination"
                value={finalDestination}
                onChange={setFinalDestination}
                cities={cities}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-amber-400" /> Departure date (optional)
              </label>
              <input
                type="date"
                value={departureDate}
                onChange={(e) => setDepartureDate(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2.5 text-xs text-white focus:border-amber-400 focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-amber-400" /> Departure time
              </label>
              <input
                type="time"
                value={departureTime}
                onChange={(e) => setDepartureTime(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2.5 text-xs text-white focus:border-amber-400 focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-slate-400">
                <span>Days ({days})</span>
                <span className="text-amber-400/80">{nights} {nights === 1 ? "night" : "nights"}</span>
              </div>
              <input
                type="range"
                min={1}
                max={14}
                value={days}
                onChange={(e) => {
                  const d = Number(e.target.value);
                  setDays(d);
                  setNights(Math.max(0, d - 1));
                }}
                className="w-full accent-amber-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                Travellers ({travellers})
              </label>
              <input
                type="range"
                min={1}
                max={10}
                value={travellers}
                onChange={(e) => setTravellers(Number(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Traveller Group</label>
              <select
                value={travellerType}
                onChange={(e) => setTravellerType(e.target.value as TravellerType)}
                className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2.5 text-xs text-white focus:border-amber-400 focus:outline-none"
              >
                <option value="solo">Solo traveller</option>
                <option value="couple">Couple</option>
                <option value="family">Family (kids friendly)</option>
                <option value="group">Group of friends</option>
                <option value="senior">Senior citizens</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Priority Goal</label>
              <select
                value={tripPriority}
                onChange={(e) => setTripPriority(e.target.value as TripPriority)}
                className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2.5 text-xs text-white focus:border-amber-400 focus:outline-none"
              >
                <option value="balanced">Balanced itinerary</option>
                <option value="min_cost">Minimum cost (budget focus)</option>
                <option value="max_sightseeing">Maximum sightseeing</option>
                <option value="min_travel_time">Fast route (minimal detour)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Pace</label>
              <div className="flex gap-1.5">
                {(["relaxed", "balanced", "packed"] as Pace[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPace(p)}
                    className={`flex-1 rounded-lg px-2 py-2 text-[11px] font-mono capitalize transition ${
                      pace === p
                        ? "bg-amber-400 text-slate-950 font-bold"
                        : "bg-white/5 text-slate-400 hover:text-white"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Tier</label>
              <div className="flex gap-1.5">
                {(["budget", "mid", "luxury"] as BudgetTier[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setBudgetTier(t)}
                    className={`flex-1 rounded-lg px-2 py-2 text-[11px] font-mono capitalize transition ${
                      budgetTier === t
                        ? "bg-amber-400 text-slate-950 font-bold"
                        : "bg-white/5 text-slate-400 hover:text-white"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Transport</label>
              <select
                value={transport}
                onChange={(e) => setTransport(e.target.value as TransportPreference)}
                className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2.5 text-xs text-white focus:border-amber-400 focus:outline-none"
              >
                <option value="self_drive">Self-drive rental</option>
                <option value="private_car">Own private car</option>
                <option value="private_cab">Private cab</option>
                <option value="public_transport">Public transport</option>
                <option value="any">Any</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                Diet
              </label>
              <select
                value={dietary}
                onChange={(e) => setDietary(e.target.value as DietaryPreference)}
                className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2.5 text-xs text-white focus:border-amber-400 focus:outline-none"
              >
                <option value="no_preference">No preference</option>
                <option value="vegetarian">Vegetarian</option>
                <option value="vegan">Vegan</option>
                <option value="jain">Jain</option>
                <option value="non_vegetarian">Non-vegetarian</option>
              </select>
            </div>
          </div>

          {/* Interests */}
          <div className="space-y-2">
            <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
              Interests (drives what gets discovered)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {INTEREST_CHOICES.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleInterest(opt.value)}
                  className={`rounded-lg px-3 py-1.5 text-[11px] font-mono transition ${
                    interests.includes(opt.value)
                      ? "bg-amber-400 text-slate-950 font-bold"
                      : "bg-white/5 text-slate-400 hover:text-white"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Advanced corridor controls */}
          <details className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs text-slate-400">
            <summary className="cursor-pointer font-mono uppercase tracking-wider text-slate-300">
              Corridor &amp; meal settings
            </summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <span className="text-[11px] font-mono">
                  Corridor width: ±{cornerRadiusKm} km from the road
                </span>
                <input
                  type="range"
                  min={5}
                  max={80}
                  step={5}
                  value={cornerRadiusKm}
                  onChange={(e) => setCornerRadiusKm(Number(e.target.value))}
                  className="w-full accent-amber-400"
                />
              </div>
              <div className="space-y-1.5">
                <span className="text-[11px] font-mono">
                  Max detour per stop: {maxDetourKm} km
                </span>
                <input
                  type="range"
                  min={5}
                  max={120}
                  step={5}
                  value={maxDetourKm}
                  onChange={(e) => setMaxDetourKm(Number(e.target.value))}
                  className="w-full accent-amber-400"
                />
              </div>
              <div className="space-y-1.5">
                <span className="text-[11px] font-mono">
                  Meal budget (₹/person/day)
                </span>
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={mealBudgetPerDayInr}
                  onChange={(e) => setMealBudgetPerDayInr(e.target.value ? Number(e.target.value) : "")}
                  placeholder="Auto by tier"
                  className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-xs text-white focus:border-amber-400 focus:outline-none"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer mt-5">
                <input
                  type="checkbox"
                  checked={includeMeals}
                  onChange={(e) => setIncludeMeals(e.target.checked)}
                  className="h-4 w-4 accent-amber-400"
                />
                <span>Find meal stops near the route</span>
              </label>
            </div>
          </details>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                Total budget (₹, optional)
              </label>
              <input
                type="number"
                min={0}
                step={1000}
                value={totalBudgetInr || ""}
                onChange={(e) => setTotalBudgetInr(Number(e.target.value) || 0)}
                placeholder="e.g. 25000"
                className="w-32 rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => handleDiscover(stage === "selecting" || stage === "planned")}
              disabled={busy}
              className="flex items-center gap-2 rounded-lg bg-amber-400 px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-950 transition hover:bg-amber-300 disabled:opacity-50"
            >
              {stage === "discovering" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              {stage === "discovering" ? "Tracing the road…" : "Discover stops on this route"}
            </button>
          </div>

          {sameJourney && (stage === "selecting" || stage === "planning" || stage === "planned") && (
            <p className="text-[11px] text-slate-500">
              Showing results for this exact journey. Change the places or days and press discover
              again to refresh.
            </p>
          )}
          {!sameJourney && discovery && (stage === "selecting" || stage === "planned") && (
            <p className="text-[11px] text-amber-300">
              ⚠ You edited the journey — the stops below are stale until you re-run discovery.
            </p>
          )}
        </section>

        {/* Busy state */}
        {stage === "discovering" && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-[#0a0f18] p-10 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
            <p className="text-sm text-slate-300">
              Tracing the real road and scanning the corridor for verifiable stops…
            </p>
            <p className="text-[11px] text-slate-500">
              Live routing lookups can take 10–30 seconds on the first request.
            </p>
          </div>
        )}

        {/* Selection stage */}
        {discovery && (stage === "selecting" || stage === "planning") && (
          <>
            {stage === "planning" && (
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0a0f18] p-5 text-sm text-slate-300">
                <Loader2 className="h-5 w-5 animate-spin text-amber-400" />
                Fitting your picks into a feasible day-by-day schedule…
              </div>
            )}
            <RouteDiscoveryPanel
              discovery={discovery}
              selectedStopIds={selectedStopIds}
              selectedMealIds={selectedMealIds}
              onSelectionChange={(stops, meals) => {
                setSelectedStopIds(stops);
                setSelectedMealIds(meals);
              }}
              isPlanning={stage === "planning"}
              onPlan={handlePlan}
              onRefresh={() => handleDiscover(true)}
            />
          </>
        )}

        {/* Planned stage */}
        {plan && stage === "planned" && (
          <>
            <RoadTripView plan={plan} />
            <div className="flex justify-center pb-8">
              <button
                type="button"
                onClick={() => setStage("selecting")}
                className="rounded-lg border border-white/10 px-4 py-2 text-xs text-slate-300 hover:text-white"
              >
                ← Adjust stops and re-plan
              </button>
            </div>
          </>
        )}

        {/* Empty state on the form stage */}
        {stage === "form" && !discovery && (
          <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-sm text-slate-400">
            Choose an origin and destination — for example Bengaluru → Hampi or Belagavi →
            Chikkamagaluru — and we will discover what is genuinely worth stopping for along the
            way.
          </div>
        )}
      </main>
    </div>
  );
}
