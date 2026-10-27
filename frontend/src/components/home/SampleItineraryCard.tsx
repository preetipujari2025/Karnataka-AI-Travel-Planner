import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Wallet,
  ArrowRight,
  Bookmark,
  Check,
  Eye,
} from "lucide-react";

export default function SampleItineraryCard() {
  const navigate = useNavigate();
  const [savedSample, setSavedSample] = useState(false);

  function handleCustomize() {
    navigate("/plan", {
      state: {
        days: 3,
        start_city: "bengaluru",
        budget_tier: "mid",
        interests: ["nature", "food", "coffee_hills"],
        pace: "balanced",
      },
    });
  }

  return (
    <section className="py-16 px-6 sm:px-10 max-w-7xl mx-auto w-full">
      <div className="text-center max-w-2xl mx-auto mb-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#2d6a4f]/20 bg-[#eaf4ee] px-3.5 py-1 text-xs font-semibold text-[#1e533c] shadow-xs mb-3">
          <Eye className="h-3.5 w-3.5 text-[#2d6a4f]" />
          <span>Sample Itinerary</span>
        </div>
        <h2 className="font-serif text-3xl sm:text-4xl text-[#14231b] font-normal tracking-tight">
          Sample Itinerary Preview
        </h2>
        <p className="mt-2 text-sm sm:text-base text-[#35483d] font-normal">
          Here is what a generated journey looks like: concrete daily schedules, real highway driving hours, and transparent Indian Rupee estimates.
        </p>
      </div>

      <div className="rounded-3xl glass-panel-elevated border border-[#cbe1d5] shadow-xl overflow-hidden max-w-4xl mx-auto">
        {/* Banner with Image and Headline */}
        <div className="relative h-64 sm:h-72 w-full overflow-hidden bg-[#eaf2ec]">
          <picture>
            <source srcSet="/images/coorg.webp" type="image/webp" />
            <img
              src="/images/coorg.jpg"
              alt="Misty coffee plantations in Coorg"
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </picture>
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />

          <div className="absolute bottom-6 left-6 right-6 text-white flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-300 uppercase tracking-wider mb-1">
                <span>3-Day Highland Trail</span>
                <span>•</span>
                <span>Bengaluru → Coorg Circuit</span>
              </div>
              <h3 className="font-serif text-2xl sm:text-3xl font-normal text-white">
                Misty Coffee Highlands & Waterfalls
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-full bg-white/20 backdrop-blur-md px-3.5 py-1 text-xs font-medium text-white border border-white/30">
                Mid-tier Comfort
              </span>
              <span className="rounded-full bg-emerald-500/20 backdrop-blur-md px-3.5 py-1 text-xs font-medium text-emerald-200 border border-emerald-400/30">
                Verified Costs
              </span>
            </div>
          </div>
        </div>

        {/* Card Body: Timeline & Budget Preview */}
        <div className="p-6 sm:p-10 space-y-8">
          {/* 3 Days Timeline Preview */}
          <div className="space-y-6">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#263c30] pb-2 border-b border-[#dce9e1]">
              Daily Journey Plan
            </h4>

            {/* Day 1 */}
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2d6a4f] text-white text-xs font-bold shadow-xs">
                  1
                </span>
                <span className="w-0.5 flex-1 bg-[#cce0d4] my-1" />
              </div>
              <div className="flex-1 pb-4">
                <div className="flex items-center justify-between">
                  <h5 className="font-serif text-lg font-normal text-[#14231b]">
                    Bengaluru to Madikeri · Coffee Country Gateway
                  </h5>
                  <span className="text-xs text-[#5e7467] font-mono">250 km • 5h 15m</span>
                </div>
                <p className="mt-1 text-xs sm:text-sm text-[#35483d] leading-relaxed">
                  Morning highway transit via Mysuru expressway. Afternoon check-in at coffee estate homestay, followed by Abbey Falls cascade walk and sunset at Raja's Seat.
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2 text-[11px] text-[#2d6a4f]">
                  <span className="bg-[#eaf4ee] px-2.5 py-0.5 rounded-md border border-[#c2ded0]">
                    ☕ Fresh Arabica plantation walk
                  </span>
                  <span className="bg-[#eaf4ee] px-2.5 py-0.5 rounded-md border border-[#c2ded0]">
                    🍛 Kodava Pandi curry & Akki Roti
                  </span>
                </div>
              </div>
            </div>

            {/* Day 2 */}
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2d6a4f] text-white text-xs font-bold shadow-xs">
                  2
                </span>
                <span className="w-0.5 flex-1 bg-[#cce0d4] my-1" />
              </div>
              <div className="flex-1 pb-4">
                <div className="flex items-center justify-between">
                  <h5 className="font-serif text-lg font-normal text-[#14231b]">
                    Madikeri Exploration & Dubare Elephant Sanctuary
                  </h5>
                  <span className="text-xs text-[#5e7467] font-mono">55 km local transit</span>
                </div>
                <p className="mt-1 text-xs sm:text-sm text-[#35483d] leading-relaxed">
                  Dawn birdsong walk on the plantation. River-crossing to Dubare elephant reserve, followed by Tibetan Golden Temple (Namdroling Monastery) at Bylakuppe.
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2 text-[11px] text-[#2d6a4f]">
                  <span className="bg-[#eaf4ee] px-2.5 py-0.5 rounded-md border border-[#c2ded0]">
                    🐘 Dubare Cauvery riverbank
                  </span>
                  <span className="bg-[#eaf4ee] px-2.5 py-0.5 rounded-md border border-[#c2ded0]">
                    ⛩️ Namdroling Monastery murals
                  </span>
                </div>
              </div>
            </div>

            {/* Day 3 */}
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2d6a4f] text-white text-xs font-bold shadow-xs">
                  3
                </span>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h5 className="font-serif text-lg font-normal text-[#14231b]">
                    Mandalpatti Peak Ridge & Scenic Return Drive
                  </h5>
                  <span className="text-xs text-[#5e7467] font-mono">270 km • 5h 45m</span>
                </div>
                <p className="mt-1 text-xs sm:text-sm text-[#35483d] leading-relaxed">
                  Jeep trail to Mandalpatti panoramic ridge overlooking Western Ghats mist. Coffee bean procurement at local estates, then smooth return drive to Bengaluru hub.
                </p>
              </div>
            </div>
          </div>

          {/* Budget Widget Preview */}
          <div className="rounded-2xl bg-[#f8faf8] border border-[#dce9e1] p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#dce9e1]">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-[#2d6a4f]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#14231b]">
                  Transparent INR Budget (2 Travellers · 3 Days)
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs text-[#5e7467]">Estimated Total: </span>
                <span className="text-lg font-bold text-[#1e533c]">₹16,200</span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-white p-3 rounded-xl border border-[#e2ece5]">
                <span className="text-[#5e7467] block">Homestay & Lodging</span>
                <strong className="text-[#14231b] text-sm">₹7,200</strong>
                <span className="text-[10px] text-[#5e7467] block mt-0.5">2 nights estate stay</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-[#e2ece5]">
                <span className="text-[#5e7467] block">Food & Regional Dining</span>
                <strong className="text-[#14231b] text-sm">₹3,400</strong>
                <span className="text-[10px] text-[#5e7467] block mt-0.5">3 meals daily + coffee</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-[#e2ece5]">
                <span className="text-[#5e7467] block">Private Cab Transit</span>
                <strong className="text-[#14231b] text-sm">₹4,800</strong>
                <span className="text-[10px] text-[#5e7467] block mt-0.5">Fuel & expressway tolls</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-[#e2ece5]">
                <span className="text-[#5e7467] block">Monuments & Activities</span>
                <strong className="text-[#14231b] text-sm">₹800</strong>
                <span className="text-[10px] text-[#5e7467] block mt-0.5">Entry tickets & boat fee</span>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-[#dce9e1]">
            <div className="text-xs text-[#5e7467]">
              Want to adjust days, pace, or transport? Launch the planner with these settings.
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setSavedSample(true)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 rounded-xl border border-[#c8dec2] bg-white hover:bg-[#eaf4ee] text-[#1e533c] px-4 py-2.5 text-xs font-semibold transition cursor-pointer"
              >
                {savedSample ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Bookmark className="h-3.5 w-3.5" />}
                <span>{savedSample ? "Saved to My Trips!" : "Save Preview"}</span>
              </button>

              <button
                type="button"
                onClick={handleCustomize}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#f5a623] to-[#e08713] hover:from-[#e59b20] hover:to-[#cb770c] text-white px-6 py-2.5 text-xs font-bold uppercase tracking-wider transition shadow-md shadow-[#e08713]/25 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer"
              >
                <span>Customize This Plan</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
