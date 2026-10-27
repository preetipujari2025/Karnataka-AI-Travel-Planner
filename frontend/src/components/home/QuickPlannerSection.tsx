import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  Wallet,
  Compass,
  ArrowRight,
  Sparkles,
  Check,
  MapPin,
  Clock,
  Coffee,
  Waves,
  Landmark,
  Trees,
  Utensils,
  Flame,
} from "lucide-react";
import type { BudgetTier, Interest, Pace, PlanRequest } from "../../api/types";

interface QuickPlannerSectionProps {
  onQuickGenerate: (req: PlanRequest) => void;
  isPlanning?: boolean;
}

const INTEREST_OPTIONS: Array<{ id: Interest; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "heritage", label: "Heritage", icon: Landmark },
  { id: "nature", label: "Nature", icon: Trees },
  { id: "beach", label: "Beaches", icon: Waves },
  { id: "food", label: "Regional Food", icon: Utensils },
  { id: "coffee_hills", label: "Coffee Hills", icon: Coffee },
  { id: "adventure", label: "Adventure", icon: Flame },
];

export default function QuickPlannerSection({
  onQuickGenerate,
  isPlanning = false,
}: QuickPlannerSectionProps) {
  const navigate = useNavigate();

  const [days, setDays] = useState<number>(4);
  const [budgetTier, setBudgetTier] = useState<BudgetTier>("mid");
  const [selectedInterests, setSelectedInterests] = useState<Interest[]>(["heritage", "nature"]);
  const [pace, setPace] = useState<Pace>("balanced");
  const [startCity, setStartCity] = useState<string>("bengaluru");

  function toggleInterest(interest: Interest) {
    setSelectedInterests((prev) =>
      prev.includes(interest)
        ? prev.length > 1
          ? prev.filter((i) => i !== interest)
          : prev
        : [...prev, interest]
    );
  }

  function handleQuickSubmit(e: React.FormEvent) {
    e.preventDefault();
    const req: PlanRequest = {
      start_city: startCity,
      days,
      interests: selectedInterests,
      budget_tier: budgetTier,
      pace,
      travellers: 2,
      start_month: new Date().getMonth() + 1,
      planner: "auto",
    };
    onQuickGenerate(req);
  }

  function handleOpenFullBuilder() {
    navigate("/plan", {
      state: {
        days,
        budget_tier: budgetTier,
        interests: selectedInterests,
        pace,
        start_city: startCity,
      },
    });
  }

  return (
    <section id="quick-planner" className="relative py-16 px-6 sm:px-10 max-w-7xl mx-auto w-full scroll-mt-24">
      {/* Quick Planner Header */}
      <div className="relative mb-8 text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#F2A93B]/30 bg-[#FDEBD8]/70 px-4 py-1.5 text-xs font-semibold text-[#1B2B27] shadow-xs mb-3">
          <Sparkles className="h-3.5 w-3.5 text-[#F2A93B]" />
          <span>Plan in 30 Seconds</span>
        </div>
        <h2 className="font-serif text-3xl sm:text-4xl text-[#1B2B27] font-normal tracking-tight">
          Where would you like Karnataka to take you?
        </h2>
        <p className="mt-2 text-sm sm:text-base text-[#536B63] font-normal leading-relaxed">
          Select your duration, comfort level, and favourite themes. Our graph engine instantly builds a feasible circuit with genuine road transit.
        </p>
      </div>

      {/* Main Glass Card Form */}
      <div className="rounded-3xl glass-panel-elevated p-6 sm:p-10 border border-[#F2A93B]/20 shadow-xl">
        <form onSubmit={handleQuickSubmit} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* 1. Starting Hub */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#263c30]">
                <MapPin className="h-3.5 w-3.5 text-[#2d6a4f]" />
                <span>1. Starting City</span>
              </label>
              <div className="relative">
                <select
                  value={startCity}
                  onChange={(e) => setStartCity(e.target.value)}
                  className="w-full rounded-xl border border-[#c8dec2] bg-white/95 px-3.5 py-2.5 text-sm font-medium text-[#14231b] shadow-xs focus:border-[#2d6a4f] focus:outline-hidden focus:ring-2 focus:ring-[#2d6a4f]/20 transition cursor-pointer"
                >
                  <option value="bengaluru">Bengaluru (Capital & Flights)</option>
                  <option value="mysuru">Mysuru (Heritage Gateway)</option>
                  <option value="hubballi">Hubballi (North Karnataka)</option>
                  <option value="mangaluru">Mangaluru (Coastal Highway)</option>
                  <option value="belagavi">Belagavi (Upper Western Ghats)</option>
                </select>
              </div>
              <p className="text-[11px] text-[#5e7467]">Airport & rail connectivity</p>
            </div>

            {/* 2. Duration (Days) */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#263c30]">
                <Calendar className="h-3.5 w-3.5 text-[#2d6a4f]" />
                <span>2. Duration</span>
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[2, 3, 5, 7].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setDays(num)}
                    className={`py-2 text-xs font-semibold rounded-lg border transition cursor-pointer ${
                      days === num
                        ? "bg-[#F2A93B] text-white border-[#F2A93B] shadow-xs"
                        : "bg-white/80 text-[#1B2B27] border-[#FDEBD8] hover:border-[#F2A93B]/50 hover:bg-white"
                    }`}
                  >
                    {num}d
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-[#536B63]">
                {days <= 3 ? "Weekend / Short getaway" : days <= 5 ? "Comfortable trail" : "Comprehensive circuit"}
              </p>
            </div>

            {/* 3. Budget Tier */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#1B2B27]">
                <Wallet className="h-3.5 w-3.5 text-[#F2A93B]" />
                <span>3. Comfort Level</span>
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: "budget", label: "Budget" },
                  { id: "mid", label: "Mid-tier" },
                  { id: "luxury", label: "Luxury" },
                ].map((tier) => (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => setBudgetTier(tier.id as BudgetTier)}
                    className={`py-2 text-xs font-semibold rounded-lg border transition cursor-pointer ${
                      budgetTier === tier.id
                        ? "bg-[#F2A93B] text-white border-[#F2A93B] shadow-xs"
                        : "bg-white/80 text-[#1B2B27] border-[#FDEBD8] hover:border-[#F2A93B]/50 hover:bg-white"
                    }`}
                  >
                    {tier.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-[#536B63]">
                {budgetTier === "budget"
                  ? "~₹1,500/day per person"
                  : budgetTier === "mid"
                  ? "~₹3,800/day per person"
                  : "~₹8,500+/day heritage stays"}
              </p>
            </div>

            {/* 4. Travel Pace */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#1B2B27]">
                <Clock className="h-3.5 w-3.5 text-[#F2A93B]" />
                <span>4. Travel Pace</span>
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: "relaxed", label: "Relaxed" },
                  { id: "balanced", label: "Balanced" },
                  { id: "packed", label: "Active" },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPace(p.id as Pace)}
                    className={`py-2 text-xs font-semibold rounded-lg border transition cursor-pointer ${
                      pace === p.id
                        ? "bg-[#F2A93B] text-white border-[#F2A93B] shadow-xs"
                        : "bg-white/80 text-[#1B2B27] border-[#FDEBD8] hover:border-[#F2A93B]/50 hover:bg-white"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-[#536B63]">
                {pace === "relaxed" ? "Longer stays, unhurried" : pace === "balanced" ? "1-2 key sights daily" : "Maximum highlights"}
              </p>
            </div>
          </div>

          {/* Interests Pills */}
          <div className="space-y-3 pt-2 border-t border-[#FDEBD8]">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#1B2B27]">
              Select What You Love (Pick 1 or more)
            </label>
            <div className="flex flex-wrap gap-2.5">
              {INTEREST_OPTIONS.map((item) => {
                const Icon = item.icon;
                const isSelected = selectedInterests.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleInterest(item.id)}
                    className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-medium transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? "bg-[#1F7A7A] text-white shadow-xs border border-[#1F7A7A]"
                        : "bg-white/80 text-[#2C3E38] border border-[#FDEBD8] hover:border-[#1F7A7A]/40 hover:bg-white"
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${isSelected ? "text-amber-200" : "text-[#1F7A7A]"}`} />
                    <span>{item.label}</span>
                    {isSelected && <Check className="h-3 w-3 ml-0.5 text-white" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-[#FDEBD8]">
            <div className="text-xs text-[#536B63]">
              <span className="font-semibold text-[#1F7A7A]">Zero fake booking hooks:</span> Real Indian Rupee prices and genuine highway driving hours.
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleOpenFullBuilder}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-xl border border-[#1F7A7A]/30 bg-white/80 hover:bg-white text-[#1F7A7A] px-5 py-3 text-xs font-semibold uppercase tracking-wider transition hover:border-[#1F7A7A]/60 cursor-pointer"
              >
                <span>Full Wizard</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>

              <button
                type="submit"
                disabled={isPlanning}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-[#F2A93B] via-[#E59828] to-[#D98C1E] hover:from-[#E59828] hover:to-[#C67B13] text-white px-7 py-3 text-xs font-bold uppercase tracking-wider transition shadow-md shadow-[#F2A93B]/25 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer disabled:opacity-60"
              >
                <Compass className={`h-4 w-4 ${isPlanning ? "animate-spin" : ""}`} />
                <span>{isPlanning ? "Crafting Journey..." : "Plan in 30 Seconds"}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}
