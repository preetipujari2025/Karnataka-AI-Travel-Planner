import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  Sparkles,
  Sun,
  Dice5,
  ArrowRight,
  MapPin,
  Clock,
  Compass,
  ChevronRight,
  TrendingUp,
  X,
} from "lucide-react";
import {
  MONTH_NAMES,
  getDestinationsForMonth,
  getTripOfTheWeek,
  getRandomTripIdea,
  type TripIdea,
} from "../../lib/destinationsData";
import { getDestinationImage } from "../../lib/destinationAssets";

export default function SeasonalHighlights() {
  const navigate = useNavigate();

  // Current month: 1..12 (e.g. October = 10)
  const currentMonthNum = new Date().getMonth() + 1;
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonthNum);
  const [surpriseModalIdea, setSurpriseModalIdea] = useState<TripIdea | null>(null);

  const tripOfTheWeek = getTripOfTheWeek();
  const destinationsThisMonth = getDestinationsForMonth(selectedMonth);

  function handleSurpriseMe() {
    const idea = getRandomTripIdea();
    setSurpriseModalIdea(idea);
  }

  function handlePlanTripIdea(idea: TripIdea) {
    navigate("/plan", {
      state: {
        days: idea.durationDays,
        start_city: idea.startCity,
        budget_tier: idea.budgetTier,
        interests: idea.interests,
      },
    });
  }

  return (
    <section className="relative py-16 px-6 sm:px-10 max-w-7xl mx-auto w-full">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-10">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#2d6a4f]/20 bg-[#eaf4ee] px-3.5 py-1 text-xs font-semibold text-[#1e533c] shadow-xs mb-3">
            <Sun className="h-3.5 w-3.5 text-amber-600" />
            <span className="uppercase tracking-wider text-[11px]">Seasonal Intelligence</span>
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl text-[#14231b] font-normal tracking-tight">
            Karnataka This Season
          </h2>
          <p className="mt-2 text-sm sm:text-base text-[#35483d] font-normal max-w-xl">
            Real climate calendars, curated weekly highlights, and spontaneous getaway inspirations.
          </p>
        </div>

        {/* Spontaneous Surprise Me Button */}
        <button
          type="button"
          id="surprise-me-btn"
          onClick={handleSurpriseMe}
          className="shrink-0 flex items-center gap-2.5 rounded-xl border border-[#d97706]/40 bg-gradient-to-r from-[#fef7ee] to-[#fbf2e3] hover:from-[#fdf1e0] hover:to-[#f9e9d2] text-[#92400e] px-5 py-3 text-xs font-bold uppercase tracking-wider transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 cursor-pointer"
        >
          <Dice5 className="h-4 w-4 text-[#d97706]" />
          <span>Surprise Me</span>
          <Sparkles className="h-3.5 w-3.5 text-[#d97706]" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* 1. "Best Time to Visit This Month" Card (Col 7) */}
        <div className="lg:col-span-7 flex flex-col justify-between rounded-3xl glass-panel-elevated p-6 sm:p-8 border border-[#cbe1d5] shadow-lg">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-[#dce9e1]">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eaf4ee] text-[#1e533c] border border-[#c2ded0]">
                  <Calendar className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-serif text-xl sm:text-2xl font-normal text-[#14231b]">
                    Best Time to Visit in {MONTH_NAMES[selectedMonth - 1]}
                  </h3>
                  <span className="text-xs text-[#5e7467]">
                    {destinationsThisMonth.length} destinations in peak condition
                  </span>
                </div>
              </div>

              {/* Month selector dropdown */}
              <div className="flex items-center gap-1.5">
                <label htmlFor="month-select" className="text-xs text-[#526a5c] font-medium hidden sm:inline">
                  Change Month:
                </label>
                <select
                  id="month-select"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="rounded-xl border border-[#c8dec2] bg-white px-3 py-1.5 text-xs font-semibold text-[#14231b] shadow-2xs focus:border-[#2d6a4f] focus:outline-hidden cursor-pointer"
                >
                  {MONTH_NAMES.map((m, idx) => (
                    <option key={m} value={idx + 1}>
                      {m} {idx + 1 === currentMonthNum ? "(Now)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Curated list of destinations in peak season */}
            <div className="mt-5 space-y-3 max-h-72 overflow-y-auto pr-1">
              {destinationsThisMonth.slice(0, 4).map((dest) => {
                const img = getDestinationImage(dest.id, dest.region);
                const webp = img.replace(/\.jpg$/, ".webp");
                return (
                  <div
                    key={dest.id}
                    className="flex items-center justify-between gap-4 rounded-2xl bg-white/80 border border-[#d8e8de] p-3.5 transition hover:bg-white hover:border-[#2d6a4f]/30 hover:shadow-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <picture className="shrink-0">
                        <source srcSet={webp} type="image/webp" />
                        <img
                          src={img}
                          alt={dest.name}
                          loading="lazy"
                          className="h-12 w-12 rounded-xl object-cover border border-[#cbe1d5]"
                        />
                      </picture>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-sm text-[#14231b] truncate">{dest.name}</h4>
                          <span className="text-[10px] font-medium text-[#2d6a4f] bg-[#eaf4ee] px-2 py-0.5 rounded-full">
                            {dest.region}
                          </span>
                        </div>
                        <p className="text-xs text-[#526a5c] truncate mt-0.5">{dest.season_note}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        navigate("/plan", {
                          state: { start_city: dest.id },
                        })
                      }
                      className="shrink-0 flex items-center gap-1 rounded-lg border border-[#c8dec2] bg-white hover:bg-[#eaf4ee] text-[#1e533c] px-3 py-1.5 text-xs font-semibold transition cursor-pointer"
                    >
                      <span>Explore</span>
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[#dce9e1] flex items-center justify-between text-xs text-[#526a5c]">
            <span>
              <strong className="text-[#14231b]">Verified Weather:</strong> High humidity and extreme heat months automatically filtered.
            </span>
            <button
              type="button"
              onClick={() => navigate("/plan")}
              className="text-[#1e533c] hover:text-[#14231b] font-semibold underline underline-offset-2 flex items-center gap-1 cursor-pointer"
            >
              <span>Build {MONTH_NAMES[selectedMonth - 1]} Itinerary</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* 2. "Trip of the Week" Card (Col 5) */}
        <div className="lg:col-span-5 flex flex-col justify-between rounded-3xl glass-panel-elevated p-6 sm:p-8 border border-[#cbe1d5] shadow-lg">
          <div>
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#dce9e1]">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#b45309]">
                  Trip of the Week
                </span>
              </div>
              <span className="text-xs text-[#526a5c] font-medium">Curated Itinerary</span>
            </div>

            {/* Visual Thumbnail */}
            <div className="mt-5 relative h-40 w-full overflow-hidden rounded-2xl">
              <picture>
                <source srcSet={tripOfTheWeek.image.replace(/\.jpg$/, ".webp")} type="image/webp" />
                <img
                  src={tripOfTheWeek.image}
                  alt={tripOfTheWeek.title}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </picture>
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-3 left-4 right-4 text-white">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">
                  {tripOfTheWeek.region}
                </span>
                <h4 className="font-serif text-lg font-normal leading-tight text-white mt-0.5">
                  {tripOfTheWeek.title}
                </h4>
              </div>
            </div>

            <p className="mt-4 text-xs sm:text-sm text-[#35483d] leading-relaxed">
              {tripOfTheWeek.description}
            </p>

            {/* Quick Specs */}
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="flex items-center gap-1 rounded-lg bg-[#f4f7f5] px-2.5 py-1 text-[#263c30] border border-[#dce9e1]">
                <Clock className="h-3 w-3 text-[#2d6a4f]" />
                <span>{tripOfTheWeek.durationDays} Days</span>
              </span>
              <span className="flex items-center gap-1 rounded-lg bg-[#f4f7f5] px-2.5 py-1 text-[#263c30] border border-[#dce9e1]">
                <MapPin className="h-3 w-3 text-[#2d6a4f]" />
                <span className="capitalize">{tripOfTheWeek.startCity} start</span>
              </span>
              <span className="flex items-center gap-1 rounded-lg bg-[#f4f7f5] px-2.5 py-1 text-[#263c30] border border-[#dce9e1]">
                <TrendingUp className="h-3 w-3 text-[#2d6a4f]" />
                <span className="capitalize">{tripOfTheWeek.budgetTier} class</span>
              </span>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[#dce9e1]">
            <button
              type="button"
              onClick={() => handlePlanTripIdea(tripOfTheWeek)}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#f5a623] to-[#e08713] hover:from-[#e59b20] hover:to-[#cb770c] text-white py-3 text-xs font-bold uppercase tracking-wider transition shadow-md shadow-[#e08713]/25 hover:shadow-lg cursor-pointer"
            >
              <Compass className="h-3.5 w-3.5" />
              <span>Plan This Trip</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Surprise Me Modal */}
      {surpriseModalIdea && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="relative max-w-lg w-full rounded-3xl glass-panel-elevated bg-white/95 p-6 sm:p-8 border border-[#cbe1d5] shadow-2xl">
            <button
              type="button"
              onClick={() => setSurpriseModalIdea(null)}
              className="absolute top-5 right-5 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#b45309] mb-3">
              <Sparkles className="h-4 w-4" />
              <span>Surprise Trip Suggestion</span>
            </div>

            <div className="relative h-44 w-full overflow-hidden rounded-2xl mb-4">
              <picture>
                <source srcSet={surpriseModalIdea.image.replace(/\.jpg$/, ".webp")} type="image/webp" />
                <img
                  src={surpriseModalIdea.image}
                  alt={surpriseModalIdea.title}
                  className="h-full w-full object-cover"
                />
              </picture>
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-3 left-4 text-white">
                <span className="text-[11px] font-semibold text-amber-300 uppercase tracking-wider">
                  {surpriseModalIdea.region}
                </span>
                <h3 className="font-serif text-xl font-normal text-white">{surpriseModalIdea.title}</h3>
              </div>
            </div>

            <p className="text-sm text-[#35483d] leading-relaxed mb-4">
              {surpriseModalIdea.description}
            </p>

            <div className="space-y-1.5 mb-6 text-xs text-[#526a5c]">
              <div>
                <strong>Highlights:</strong> {surpriseModalIdea.destinations.join(" → ")}
              </div>
              <div>
                <strong>Starting Hub:</strong> <span className="capitalize">{surpriseModalIdea.startCity}</span>
              </div>
              <div>
                <strong>Pace:</strong> {surpriseModalIdea.durationDays} Days · {surpriseModalIdea.budgetTier} comfort
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSurpriseModalIdea(null)}
                className="flex-1 rounded-xl border border-slate-300 bg-white py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const idea = surpriseModalIdea;
                  setSurpriseModalIdea(null);
                  handlePlanTripIdea(idea);
                }}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#f5a623] to-[#e08713] text-white py-2.5 text-xs font-bold uppercase tracking-wider transition shadow-md shadow-[#e08713]/25 hover:shadow-lg cursor-pointer"
              >
                <span>Plan This Now</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
