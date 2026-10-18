import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchHealth, fetchMeta, createPlan } from "../api/client";
import type { HealthResponse, MetaResponse, PlanRequest, PlanResponse } from "../api/types";
import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";
import HeroSection from "../components/hero/HeroSection";
import JourneyShowcase, { type JourneyArchetype } from "../components/home/JourneyShowcase";
import DestinationDiscovery, { type FeaturedDestination } from "../components/home/DestinationDiscovery";
import AIPlanningIntro from "../components/home/AIPlanningIntro";
import PlannerForm, { DEFAULT_REQUEST } from "../components/planner/PlannerForm";
import ItineraryView from "../components/ItineraryView";
import DestinationExplorer from "../components/destinations/DestinationExplorer";
import { AlertCircle, Compass, Sparkles, ArrowRight } from "lucide-react";

export default function HomePage() {
  const navigate = useNavigate();
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [request, setRequest] = useState<PlanRequest>(DEFAULT_REQUEST);
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [planning, setPlanning] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchMeta(controller.signal)
      .then(setMeta)
      .catch((error: Error) => {
        if (!controller.signal.aborted) setLoadError(error.message);
      });
    fetchHealth(controller.signal)
      .then(setHealth)
      .catch(() => setHealth(null));
    return () => controller.abort();
  }, []);

  async function handlePlan(event: React.FormEvent) {
    event.preventDefault();
    setPlanning(true);
    setPlanError(null);
    try {
      const response = await createPlan(request);
      setPlan(response);
      setTimeout(() => {
        const resultsEl = document.getElementById("plan-results");
        if (resultsEl) {
          resultsEl.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);
    } catch (error) {
      setPlan(null);
      setPlanError((error as Error).message);
    } finally {
      setPlanning(false);
    }
  }

  function scrollToSection(id: string) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  }

  function handleSelectJourney(journey: JourneyArchetype) {
    navigate("/plan", {
      state: {
        days: journey.durationDays,
        interests: journey.interests,
        budget_tier: journey.budgetTier,
        pace: journey.pace,
        start_city: journey.startCity,
      },
    });
  }

  function handleSelectFeaturedDestination(dest: FeaturedDestination) {
    navigate("/plan", {
      state: {
        start_city: dest.cityHubId,
      },
    });
  }

  function handleSelectStartCity(cityId: string) {
    navigate("/plan", {
      state: {
        start_city: cityId,
      },
    });
  }

  return (
    <div className="relative min-h-screen bg-[#070b12] text-slate-100 flex flex-col justify-between selection:bg-amber-500/30 selection:text-amber-200">
      {/* Section A: Navigation */}
      <Navbar
        health={health}
        onNavigateToDestinations={() => scrollToSection("destinations-archive")}
        onNavigateToExperiences={() => scrollToSection("experiences")}
        onNavigateToPlanner={() => navigate("/plan")}
        onNavigateToAbout={() => scrollToSection("about")}
      />

      {/* Section B: Hero Section */}
      <HeroSection
        onCreateItinerary={() => navigate("/plan")}
        onExploreKarnataka={() => scrollToSection("experiences")}
      />

      {/* Section C: Second Cinematic Section — Journey Archetypes */}
      <JourneyShowcase onSelectJourney={handleSelectJourney} />

      {/* Section D: Destination Discovery — Large Visual Destination Cards */}
      <DestinationDiscovery
        onSelectDestination={handleSelectFeaturedDestination}
        onExploreAll={() => scrollToSection("destinations-archive")}
      />

      {/* Section E: AI Planning Introduction & Interactive Planner Callout */}
      <section id="planner" className="relative py-28 px-6 sm:px-10 max-w-7xl mx-auto w-full scroll-mt-20">
        <AIPlanningIntro />

        {/* Guided Builder Banner CTA */}
        <div className="mb-12 rounded-2xl border border-amber-400/30 bg-gradient-to-r from-amber-500/15 via-amber-400/5 to-transparent p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-amber-400 mb-2">
              <Sparkles className="h-4 w-4" />
              <span>Dedicated Guided Journey Builder</span>
            </div>
            <h3 className="font-serif text-2xl sm:text-3xl font-normal text-white">
              Launch the Interactive Karnataka Trip Planner
            </h3>
            <p className="mt-2 text-sm text-slate-300 font-light max-w-xl">
              Prefer a guided step-by-step experience? Select your starting hub, precise calendar
              dates, travel party, specific INR budget, and transport style.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate("/plan")}
            className="shrink-0 flex items-center gap-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 px-7 py-3.5 text-xs font-bold uppercase tracking-wider transition-all duration-200 shadow-xl shadow-amber-400/20 hover:scale-[1.02]"
          >
            <span>Open Guided Builder</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {/* Load Error Alert if backend unreachable */}
        {loadError && (
          <div className="mb-8 rounded-xl border border-red-500/30 bg-red-950/40 p-4 text-xs text-red-200 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
            <span>
              Could not connect to FastAPI metadata ({loadError}). Ensure backend is active on :8000.
            </span>
          </div>
        )}

        {/* Working Quick Planner & Results */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-5 w-full">
            <PlannerForm
              meta={meta}
              value={request}
              onChange={setRequest}
              onSubmit={handlePlan}
              planning={planning}
            />
          </div>

          <div className="lg:col-span-7 w-full flex flex-col gap-6">
            {planError && (
              <div className="rounded-xl border border-red-500/30 bg-red-950/40 p-5 text-sm text-red-200 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Planning Generation Notice</span>
                  <span className="text-xs text-red-300 mt-1 block">{planError}</span>
                </div>
              </div>
            )}

            {!plan && !planError && (
              <div className="flex flex-col items-center justify-center rounded-xl border border-white/10 bg-[#0a0f18] p-12 sm:p-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/5 text-amber-400 mb-5">
                  <Compass className="h-7 w-7" />
                </div>
                <h3 className="font-serif text-2xl font-normal text-white">
                  Ready to Build Your Itinerary
                </h3>
                <p className="mt-3 text-xs sm:text-sm text-slate-300 max-w-md leading-relaxed font-light">
                  Fine-tune your preferences on the left and select{" "}
                  <strong className="text-amber-300">"Generate Karnataka Itinerary"</strong>, or
                  use the guided builder above for concrete travel dates and exact INR budget matching.
                </p>
              </div>
            )}

            {plan && <ItineraryView plan={plan} />}
          </div>
        </div>
      </section>

      {/* Complete Verified Destinations Archive */}
      <DestinationExplorer onSelectStartCity={handleSelectStartCity} />

      {/* Section F: Footer */}
      <Footer
        onNavigateToDestinations={() => scrollToSection("discover")}
        onNavigateToExperiences={() => scrollToSection("experiences")}
        onNavigateToPlanner={() => navigate("/plan")}
        onNavigateToAbout={() => scrollToSection("about")}
      />
    </div>
  );
}
