import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchHealth, generateItinerary } from "../api/client";
import type { HealthResponse, PlanRequest, GenerateItineraryResponse, TripRequest } from "../api/types";
import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";
import HeroSection from "../components/hero/HeroSection";
import QuickPlannerSection from "../components/home/QuickPlannerSection";
import TrailsShowcase from "../components/trails/TrailsShowcase";
import SeasonalHighlights from "../components/home/SeasonalHighlights";
import DestinationExplorer from "../components/destinations/DestinationExplorer";
import AIPlanningIntro from "../components/home/AIPlanningIntro";
import SampleItineraryCard from "../components/home/SampleItineraryCard";
import ItineraryView from "../components/ItineraryView";
import { AlertCircle } from "lucide-react";
import type { TrailTheme } from "../lib/trailsData";

export default function HomePage() {
  const navigate = useNavigate();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [plan, setPlan] = useState<GenerateItineraryResponse | null>(null);
  const [planning, setPlanning] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [lastRequest, setLastRequest] = useState<PlanRequest | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  function checkHealth() {
    setIsRetrying(true);
    fetchHealth()
      .then((data) => {
        setHealth(data);
        setLoadError(null);
      })
      .catch((error: Error) => {
        setHealth(null);
        setLoadError(error.message);
      })
      .finally(() => {
        setIsRetrying(false);
      });
  }

  useEffect(() => {
    const controller = new AbortController();
    fetchHealth(controller.signal)
      .then(setHealth)
      .catch((error: Error) => {
        if (!controller.signal.aborted) {
          setHealth(null);
          setLoadError(error.message);
        }
      });
    return () => controller.abort();
  }, []);

  async function handleQuickPlan(req: PlanRequest) {
    setPlanning(true);
    setPlanError(null);
    setLastRequest(req);
    try {
      const response = await generateItinerary(req as TripRequest);
      setPlan(response);
      setTimeout(() => {
        const resultsEl = document.getElementById("home-plan-results");
        if (resultsEl) {
          resultsEl.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);
    } catch (error) {
      try {
        const fallbackResponse = await generateItinerary({
          ...(req as TripRequest),
          planner: "fallback",
        });
        setPlan(fallbackResponse);
        setTimeout(() => {
          const resultsEl = document.getElementById("home-plan-results");
          if (resultsEl) {
            resultsEl.scrollIntoView({ behavior: "smooth" });
          }
        }, 100);
      } catch (fallbackErr) {
        setPlan(null);
        setPlanError((fallbackErr as Error).message);
      }
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

  function handleSelectTrail(trail: TrailTheme) {
    navigate("/plan", {
      state: {
        days: trail.durationDays,
        interests: trail.interests,
        budget_tier: trail.budgetTier,
        pace: trail.pace,
        start_city: trail.startCity,
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
    <div className="relative min-h-screen bg-[#FFFBF2] text-[#1B2B27] flex flex-col justify-between selection:bg-[#F2A93B]/25 selection:text-[#1B2B27]">
      {/* Navigation */}
      <Navbar
        health={health}
        onNavigateToDestinations={() => scrollToSection("destinations-archive")}
        onNavigateToExperiences={() => scrollToSection("experiences")}
        onNavigateToPlanner={() => navigate("/plan")}
        onNavigateToAbout={() => scrollToSection("about")}
      />

      <main className="flex-1 w-full">
        {/* 1. Split Hero Section (Premium Editorial Split Layout with Moving Car) */}
        <HeroSection
          onCreateItinerary={() => navigate("/plan")}
          onExploreKarnataka={() => scrollToSection("quick-planner")}
        />

        {/* Load Error Alert if backend unreachable */}
        {loadError && (
          <div className="max-w-7xl mx-auto px-6 sm:px-10 mt-6">
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
                <span>
                  Backend service is currently offline ({loadError}). Offline deterministic mode with verified destinations is active.
                </span>
              </div>
              <button
                type="button"
                onClick={checkHealth}
                disabled={isRetrying}
                className="rounded-xl bg-[#2d6a4f] text-white px-3.5 py-1.5 text-xs font-semibold hover:bg-[#1e533c] transition shrink-0 cursor-pointer disabled:opacity-50"
              >
                {isRetrying ? "Retrying..." : "Try again"}
              </button>
            </div>
          </div>
        )}

        {/* 2. "Plan in 30 seconds" Quick Planner */}
        <QuickPlannerSection
          onQuickGenerate={handleQuickPlan}
          isPlanning={planning}
        />

        {/* Dynamic Plan Results Container (if user generated directly from Quick Planner) */}
        {(plan || planError) && (
          <section id="home-plan-results" className="py-10 px-6 sm:px-10 max-w-7xl mx-auto w-full scroll-mt-24">
            {planError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block">Planning Notice</span>
                  <span className="text-xs text-red-700 mt-1 block">{planError}</span>
                </div>
              </div>
            )}

            {plan && (
              <div className="space-y-6">
                <div className="text-center max-w-2xl mx-auto mb-6">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#2d6a4f]">Generated Itinerary</span>
                  <h3 className="font-serif text-3xl text-[#14231b] mt-1">Your Custom Karnataka Circuit</h3>
                </div>
                <ItineraryView
                  plan={plan}
                  originalTrip={lastRequest as TripRequest}
                  onPlanUpdated={setPlan}
                />
              </div>
            )}
          </section>
        )}

        {/* 3. Featured trails as big image cards with parallax (Hampi heritage, Coorg coffee, Western Ghats waterfalls, Karavali coast) */}
        <TrailsShowcase onSelectTrail={handleSelectTrail} />

        {/* Seasonal Intelligence: "Best time to visit this month", "Trip of the week", "Surprise me" */}
        <SeasonalHighlights />

        {/* 4. Destination explorer with search and region filters */}
        <DestinationExplorer onSelectStartCity={handleSelectStartCity} />

        {/* 5. "How it works" in 3 steps */}
        <AIPlanningIntro />

        {/* 6. Sample itinerary preview card */}
        <SampleItineraryCard />
      </main>

      {/* 7. Calm footer */}
      <Footer
        onNavigateToDestinations={() => scrollToSection("destinations-archive")}
        onNavigateToExperiences={() => scrollToSection("experiences")}
        onNavigateToPlanner={() => navigate("/plan")}
        onNavigateToAbout={() => scrollToSection("about")}
      />
    </div>
  );
}
