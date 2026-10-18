import { useState } from "react";
import {
  Landmark,
  Trees,
  Waves,
  Compass,
  Sparkles,
  Bird,
  UtensilsCrossed,
  Building2,
  Camera,
  Calendar,
  Users,
  Wallet,
  ShieldCheck,
  Crown,
  Coffee,
  Scale,
  Zap,
  Cpu,
  Loader2,
  MapPin,
  Church,
  Droplets,
  Mountain,
  ShoppingBag,
  Palette,
} from "lucide-react";
import type { Interest, PlanRequest, BudgetTier, Pace, PlannerMode } from "../../api/types";
import type { MetaResponse } from "../../api/types";
import StartLocationSelector from "./StartLocationSelector";

export const DEFAULT_REQUEST: PlanRequest = {
  interests: ["heritage", "nature"],
  days: 5,
  travellers: 2,
  budget_tier: "mid",
  pace: "balanced",
  start_city: "bengaluru",
  start_month: 12,
  planner: "auto",
};

const MONTHS = [
  { num: 1, name: "January", note: "Cool & pleasant" },
  { num: 2, name: "February", note: "Mild & sunny" },
  { num: 3, name: "March", note: "Warm" },
  { num: 4, name: "April", note: "Summer warmth" },
  { num: 5, name: "May", note: "Pre-monsoon" },
  { num: 6, name: "June", note: "Monsoon begins" },
  { num: 7, name: "July", note: "Lush Western Ghats" },
  { num: 8, name: "August", note: "Active waterfalls" },
  { num: 9, name: "September", note: "Post-monsoon green" },
  { num: 10, name: "October", note: "Festivals & clear skies" },
  { num: 11, name: "November", note: "Peak travel climate" },
  { num: 12, name: "December", note: "Crisp winter season" },
];

const INTEREST_ICONS: Record<Interest, React.ComponentType<{ className?: string }>> = {
  heritage: Landmark,
  nature: Trees,
  beach: Waves,
  adventure: Compass,
  spirituality: Sparkles,
  wildlife: Bird,
  food: UtensilsCrossed,
  urban: Building2,
  photography: Camera,
  temples: Church,
  waterfalls: Droplets,
  viewpoints: Mountain,
  shopping: ShoppingBag,
  culture: Palette,
};

interface Props {
  meta: MetaResponse | null;
  value: PlanRequest;
  onChange: (next: PlanRequest) => void;
  onSubmit: (event: React.FormEvent) => void;
  planning: boolean;
}

export default function PlannerForm({ meta, value, onChange, onSubmit, planning }: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  function toggleInterest(interest: Interest) {
    const has = value.interests.includes(interest);
    let interests: Interest[];
    if (has) {
      interests = value.interests.filter((i) => i !== interest);
      // Ensure at least one interest remains selected
      if (interests.length === 0) return;
    } else {
      interests = [...value.interests, interest];
    }
    onChange({ ...value, interests });
  }

  const interestList = meta?.interests ?? [
    { value: "heritage", label: "Heritage", description: "Forts, temples, ruins and museums" },
    { value: "nature", label: "Nature", description: "Hills, waterfalls, forests and trails" },
    { value: "beach", label: "Beach", description: "Coast, islands and seaside towns" },
    { value: "adventure", label: "Adventure", description: "Rafting, trekking and jungle activities" },
    { value: "spirituality", label: "Spirituality", description: "Temples, mathas and pilgrim towns" },
    { value: "wildlife", label: "Wildlife", description: "Safaris and birding" },
    { value: "food", label: "Food", description: "Regional cuisine and café culture" },
    { value: "urban", label: "Urban", description: "City life, markets and nightlife" },
    { value: "photography", label: "Photography", description: "Scenic and photogenic spots" },
  ];

  return (
    <form
      id="ai-planner-form"
      onSubmit={onSubmit}
      className="flex flex-col gap-8 rounded-3xl glass-panel-elevated p-6 sm:p-8 border-white/10 shadow-2xl relative"
    >
      {/* Form Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-amber-400 font-semibold mb-1">
            <Cpu className="h-3.5 w-3.5" />
            <span>Itinerary Parameters</span>
          </div>
          <h2 className="font-display text-2xl font-bold text-white">
            Personalise Your Karnataka Journey
          </h2>
        </div>
        <div className="text-xs text-slate-400">
          Selected: <span className="font-bold text-amber-400">{value.days} Days</span> •{" "}
          <span className="font-bold text-amber-400">{value.travellers} Travellers</span>
        </div>
      </div>

      {/* 1. Traveller Interests */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
            1. Core Travel Interests <span className="text-amber-400">*</span>
          </label>
          <span className="text-[11px] text-slate-400">
            {value.interests.length} selected (multi-choice)
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {interestList.map((interest) => {
            const active = value.interests.includes(interest.value as Interest);
            const Icon = INTEREST_ICONS[interest.value as Interest] || Sparkles;
            return (
              <button
                key={interest.value}
                type="button"
                onClick={() => toggleInterest(interest.value as Interest)}
                title={interest.description}
                className={`group flex items-center gap-2.5 rounded-xl border p-3 text-left transition-all duration-200 ${
                  active
                    ? "border-amber-400/80 bg-amber-400/15 text-white shadow-lg shadow-amber-500/10"
                    : "border-white/10 bg-white/5 text-slate-400 hover:border-white/20 hover:text-slate-200"
                }`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                    active ? "bg-amber-400 text-slate-950 font-bold" : "bg-white/10 text-slate-300 group-hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold truncate leading-tight">
                    {interest.label}
                  </span>
                  <span className="text-[10px] text-slate-500 truncate group-hover:text-slate-400">
                    {interest.description.split(",")[0]}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Days & Travellers Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
        {/* Days Slider */}
        <div className="flex flex-col gap-3 rounded-2xl glass-panel p-4 border-white/5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-amber-400" />
              Duration
            </span>
            <span className="text-base font-extrabold text-amber-400 font-display">
              {value.days} {value.days === 1 ? "Day" : "Days"}
            </span>
          </div>

          <input
            type="range"
            min={1}
            max={21}
            value={value.days}
            onChange={(e) => onChange({ ...value, days: Number(e.target.value) })}
            className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
          />

          <div className="flex items-center justify-between gap-1 mt-1">
            {[3, 5, 7, 10, 14].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => onChange({ ...value, days: d })}
                className={`rounded-md px-2 py-0.5 text-[10px] font-semibold transition ${
                  value.days === d
                    ? "bg-amber-400 text-slate-950"
                    : "bg-white/5 text-slate-400 hover:text-white hover:bg-white/10"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        {/* Travellers Counter */}
        <div className="flex flex-col gap-3 rounded-2xl glass-panel p-4 border-white/5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-amber-400" />
              Party Size
            </span>
            <span className="text-base font-extrabold text-amber-400 font-display">
              {value.travellers} {value.travellers === 1 ? "Traveller" : "Travellers"}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2 mt-1">
            {[
              { count: 1, label: "Solo" },
              { count: 2, label: "Couple" },
              { count: 4, label: "Family" },
              { count: 6, label: "Group" },
            ].map((p) => (
              <button
                key={p.count}
                type="button"
                onClick={() => onChange({ ...value, travellers: p.count })}
                className={`flex flex-col items-center justify-center rounded-xl py-2 px-1 border transition-all ${
                  value.travellers === p.count
                    ? "border-amber-400 bg-amber-400/20 text-white font-bold"
                    : "border-white/5 bg-white/5 text-slate-400 hover:border-white/20 hover:text-white"
                }`}
              >
                <span className="text-xs font-bold">{p.count}</span>
                <span className="text-[10px] text-slate-400">{p.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Budget Tier */}
      <div className="flex flex-col gap-3">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
          <Wallet className="h-3.5 w-3.5 text-amber-400" />
          Budget Class & Comfort
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              tier: "budget" as BudgetTier,
              label: "Budget Explorer",
              desc: "Homestays, hostels & public transport",
              icon: Wallet,
            },
            {
              tier: "mid" as BudgetTier,
              label: "Mid-Range Comfort",
              desc: "3-star boutique hotels & private cabs",
              icon: ShieldCheck,
            },
            {
              tier: "luxury" as BudgetTier,
              label: "Royal Luxury",
              desc: "Heritage resorts & private chauffeur",
              icon: Crown,
            },
          ].map((item) => {
            const active = value.budget_tier === item.tier;
            const Icon = item.icon;
            return (
              <button
                key={item.tier}
                type="button"
                onClick={() => onChange({ ...value, budget_tier: item.tier })}
                className={`flex flex-col text-left p-3.5 rounded-2xl border transition-all ${
                  active
                    ? "border-amber-400 bg-amber-400/15 text-white shadow-lg shadow-amber-500/10"
                    : "border-white/5 bg-white/5 text-slate-400 hover:border-white/20 hover:text-slate-200"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`h-4 w-4 ${active ? "text-amber-400" : "text-slate-400"}`} />
                  <span className="text-xs font-bold text-white">{item.label}</span>
                </div>
                <span className="text-[11px] text-slate-400 leading-tight">{item.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Pace Selector */}
      <div className="flex flex-col gap-3">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
          <Scale className="h-3.5 w-3.5 text-amber-400" />
          Travel Rhythm & Pace
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              pace: "relaxed" as Pace,
              label: "Relaxed",
              desc: "1 main area per day, unhurried stays",
              icon: Coffee,
            },
            {
              pace: "balanced" as Pace,
              label: "Balanced",
              desc: "2-3 sights per day with scenic drives",
              icon: Scale,
            },
            {
              pace: "packed" as Pace,
              label: "Intensive",
              desc: "Maximum coverage, early starts",
              icon: Zap,
            },
          ].map((item) => {
            const active = value.pace === item.pace;
            const Icon = item.icon;
            return (
              <button
                key={item.pace}
                type="button"
                onClick={() => onChange({ ...value, pace: item.pace })}
                className={`flex flex-col text-left p-3.5 rounded-2xl border transition-all ${
                  active
                    ? "border-amber-400 bg-amber-400/15 text-white shadow-lg shadow-amber-500/10"
                    : "border-white/5 bg-white/5 text-slate-400 hover:border-white/20 hover:text-slate-200"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`h-4 w-4 ${active ? "text-amber-400" : "text-slate-400"}`} />
                  <span className="text-xs font-bold text-white">{item.label}</span>
                </div>
                <span className="text-[11px] text-slate-400 leading-tight">{item.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Start City & Departure Month */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Departure Hub */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-amber-400" />
            Starting Hub / District
          </label>
          <StartLocationSelector
            id="planner-start-city"
            value={value.start_city}
            onChange={(id) => onChange({ ...value, start_city: id })}
            cities={meta?.start_cities ?? []}
          />
        </div>

        {/* Departure Month */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-amber-400" />
            Departure Month
          </label>
          <select
            value={value.start_month ?? 12}
            onChange={(e) => onChange({ ...value, start_month: Number(e.target.value) })}
            className="w-full rounded-xl border border-white/10 bg-slate-900/90 px-3.5 py-3 text-xs text-white focus:border-amber-400 focus:outline-none"
          >
            {MONTHS.map((m) => (
              <option key={m.num} value={m.num} className="bg-slate-900 text-white">
                {m.name} — {m.note}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Advanced Toggle (Planner Mode) */}
      <div className="pt-2 border-t border-white/5">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs font-semibold text-slate-400 hover:text-amber-400 flex items-center gap-1.5 transition-colors"
        >
          <span>{showAdvanced ? "Hide Engine Settings" : "Engine Settings (Auto / AI / Fallback)"}</span>
        </button>

        {showAdvanced && (
          <div className="mt-3 p-4 rounded-xl bg-black/40 border border-white/5 flex flex-col gap-2">
            <label className="text-xs font-semibold text-slate-300">
              Planning Engine Mode
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                { mode: "auto" as PlannerMode, label: "Auto (Recommended)", desc: "AI when available, deterministic fallback" },
                { mode: "fallback" as PlannerMode, label: "Deterministic Only", desc: "Instant algorithmic routing" },
                { mode: "ai" as PlannerMode, label: "Force AI", desc: "Require LLM completion" },
              ].map((m) => (
                <button
                  key={m.mode}
                  type="button"
                  onClick={() => onChange({ ...value, planner: m.mode })}
                  className={`p-2.5 rounded-lg border text-left text-xs transition ${
                    value.planner === m.mode
                      ? "border-amber-400 bg-amber-400/20 text-white font-bold"
                      : "border-white/5 bg-white/5 text-slate-400 hover:text-white"
                  }`}
                >
                  <div className="font-semibold">{m.label}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{m.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={planning}
        className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-300 py-4 text-sm font-extrabold uppercase tracking-widest text-slate-950 shadow-2xl shadow-amber-500/30 transition-all duration-300 hover:scale-[1.01] hover:shadow-amber-500/50 disabled:opacity-50 disabled:pointer-events-none"
      >
        {planning ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Orchestrating Itinerary...</span>
          </>
        ) : (
          <>
            <Sparkles className="h-5 w-5 transition-transform duration-300 group-hover:rotate-12" />
            <span>Generate Karnataka Itinerary</span>
          </>
        )}
      </button>
    </form>
  );
}
