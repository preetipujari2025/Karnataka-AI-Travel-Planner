import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bookmark,
  Compass,
  ArrowLeft,
  Clock,
  Trash2,
  FileDown,
  Eye,
  ArrowRight,
} from "lucide-react";
import {
  getSavedTrips,
  removeSavedTrip,
  addSavedTripsListener,
  type SavedTrip,
} from "../lib/savedTrips";
import { getDestinationImage } from "../lib/destinationAssets";
import { formatInr } from "../lib/format";
import { generateItineraryPDF } from "../lib/pdfGenerator";
import ItineraryView from "../components/ItineraryView";
import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";

export default function SavedTripsPage() {
  const navigate = useNavigate();
  const [savedTrips, setSavedTrips] = useState<SavedTrip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<SavedTrip | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);

  useEffect(() => {
    setSavedTrips(getSavedTrips());
    const unsubscribe = addSavedTripsListener(() => {
      setSavedTrips(getSavedTrips());
    });
    return unsubscribe;
  }, []);

  function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (window.confirm("Remove this saved trip from your collection?")) {
      removeSavedTrip(id);
      if (selectedTrip?.id === id) {
        setSelectedTrip(null);
      }
    }
  }

  async function handleDownloadPDF(trip: SavedTrip, e: React.MouseEvent) {
    e.stopPropagation();
    setExportingId(trip.id);
    try {
      await generateItineraryPDF(trip.plan, trip.originalTrip);
    } catch (err) {
      console.error("PDF generation failed:", err);
    } finally {
      setExportingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#fcfbf9] text-[#1b2b22] flex flex-col justify-between selection:bg-[#2d6a4f]/15 selection:text-[#1b2b22]">
      {/* Top Navbar */}
      <Navbar
        health={null}
        onNavigateToDestinations={() => navigate("/#destinations-archive")}
        onNavigateToExperiences={() => navigate("/#experiences")}
        onNavigateToPlanner={() => navigate("/plan")}
        onNavigateToAbout={() => navigate("/#about")}
      />

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 sm:px-10 pt-28 pb-20">
        {/* Back Link & Header */}
        <div className="mb-10">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2d6a4f] hover:text-[#143d2b] transition mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Home</span>
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#2d6a4f]/20 bg-[#eaf4ee] px-3.5 py-1 text-xs font-semibold text-[#1e533c] shadow-xs mb-2">
                <Bookmark className="h-3.5 w-3.5 text-[#2d6a4f]" />
                <span>Local Storage Vault</span>
              </div>
              <h1 className="font-serif text-3xl sm:text-4xl text-[#14231b] font-normal tracking-tight">
                My Saved Trips
              </h1>
              <p className="mt-1 text-sm text-[#35483d] font-normal">
                {savedTrips.length === 0
                  ? "You don't have any saved itineraries yet."
                  : `You have ${savedTrips.length} saved Karnataka journey ${savedTrips.length === 1 ? "plan" : "plans"}.`}
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate("/plan")}
              className="shrink-0 flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#f5a623] to-[#e08713] hover:from-[#e59b20] hover:to-[#cb770c] text-white px-5 py-3 text-xs font-bold uppercase tracking-wider transition shadow-md shadow-[#e08713]/25 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer"
            >
              <Compass className="h-4 w-4" />
              <span>Create New Trip</span>
            </button>
          </div>
        </div>

        {/* Empty State */}
        {savedTrips.length === 0 && (
          <div className="rounded-3xl glass-panel-elevated p-12 sm:p-16 text-center max-w-xl mx-auto border border-[#cbe1d5] shadow-lg">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#eaf4ee] text-[#2d6a4f] mx-auto mb-5 border border-[#c2ded0]">
              <Bookmark className="h-8 w-8" />
            </div>
            <h3 className="font-serif text-2xl font-normal text-[#14231b]">
              No Saved Trips Yet
            </h3>
            <p className="mt-2 text-sm text-[#35483d] leading-relaxed">
              When you generate or explore an itinerary in Karnataka AI Travel Planner, click
              "Save My Plan" to store it here for your upcoming voyage.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => navigate("/plan")}
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#f5a623] to-[#e08713] text-white px-6 py-3 text-xs font-bold uppercase tracking-wider transition shadow-md shadow-[#e08713]/25 hover:shadow-lg cursor-pointer"
              >
                <span>Open Trip Planner</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
              <Link
                to="/"
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-[#c8dec2] bg-white text-[#1e533c] hover:bg-[#eaf4ee] px-6 py-3 text-xs font-semibold uppercase tracking-wider transition"
              >
                <span>Explore Featured Trails</span>
              </Link>
            </div>
          </div>
        )}

        {/* Saved Trips Grid */}
        {savedTrips.length > 0 && !selectedTrip && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {savedTrips.map((trip) => {
              const firstDest = trip.plan.selected_destinations[0];
              const img = getDestinationImage(
                firstDest?.id || "hampi",
                firstDest?.region || "South Karnataka"
              );
              const webp = img.replace(/\.jpg$/, ".webp");

              return (
                <div
                  key={trip.id}
                  onClick={() => setSelectedTrip(trip)}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-3xl glass-panel-elevated border border-[#cbe1d5] shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-[#2d6a4f]/40 cursor-pointer"
                >
                  {/* Image header */}
                  <div className="relative h-48 w-full overflow-hidden bg-[#eef4f0]">
                    <picture>
                      <source srcSet={webp} type="image/webp" />
                      <img
                        src={img}
                        alt={trip.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </picture>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                    <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-white/90 backdrop-blur-md px-2.5 py-1 text-[11px] font-semibold text-[#1e533c] shadow-xs">
                      <Clock className="h-3 w-3 text-[#2d6a4f]" />
                      <span>{trip.plan.budget.days} Days</span>
                    </div>

                    <div className="absolute bottom-3 left-4 right-4 text-white">
                      <span className="text-[10px] uppercase tracking-wider text-amber-300 font-medium">
                        Saved on {new Date(trip.savedAt).toLocaleDateString()}
                      </span>
                      <h3 className="font-serif text-lg font-normal text-white line-clamp-1 mt-0.5">
                        {trip.title}
                      </h3>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      {/* Destinations list */}
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {trip.plan.selected_destinations.slice(0, 4).map((d) => (
                          <span
                            key={d.id}
                            className="rounded-md bg-[#f4f7f5] border border-[#dce9e1] px-2 py-0.5 text-[11px] font-medium text-[#263c30]"
                          >
                            {d.name}
                          </span>
                        ))}
                      </div>

                      {/* Budget summary */}
                      <div className="flex items-center justify-between text-xs py-2.5 border-t border-b border-[#dce9e1]">
                        <span className="text-[#5e7467]">Estimated Total</span>
                        <strong className="text-[#1e533c] font-bold text-sm">
                          {formatInr(trip.plan.budget.total_inr)}
                        </strong>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="mt-5 pt-2 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={(e) => handleDelete(trip.id, e)}
                        className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                        title="Delete saved plan"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={exportingId === trip.id}
                          onClick={(e) => handleDownloadPDF(trip, e)}
                          className="flex items-center gap-1 rounded-xl border border-[#c8dec2] bg-white hover:bg-[#eaf4ee] text-[#1e533c] px-3 py-2 text-xs font-semibold transition"
                          title="Download PDF itinerary"
                        >
                          <FileDown className="h-3.5 w-3.5" />
                          <span>PDF</span>
                        </button>

                        <button
                          type="button"
                          className="flex items-center gap-1 rounded-xl bg-gradient-to-r from-[#f5a623] to-[#e08713] text-white px-3.5 py-2 text-xs font-bold uppercase tracking-wider shadow-xs"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Inspect</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Detailed Full Inspection Mode */}
        {selectedTrip && (
          <div className="space-y-6">
            <button
              type="button"
              onClick={() => setSelectedTrip(null)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2d6a4f] hover:text-[#143d2b] transition"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to all saved trips</span>
            </button>

            <ItineraryView
              plan={selectedTrip.plan}
              originalTrip={selectedTrip.originalTrip}
              onPlanUpdated={(newPlan) => {
                setSelectedTrip({ ...selectedTrip, plan: newPlan });
              }}
            />
          </div>
        )}
      </main>

      <Footer
        onNavigateToDestinations={() => navigate("/#destinations-archive")}
        onNavigateToExperiences={() => navigate("/#experiences")}
        onNavigateToPlanner={() => navigate("/plan")}
        onNavigateToAbout={() => navigate("/#about")}
      />
    </div>
  );
}
