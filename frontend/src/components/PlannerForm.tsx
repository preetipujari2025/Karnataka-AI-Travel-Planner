import type { Interest, PlanRequest } from "../api/types";
import type { MetaResponse } from "../api/types";

export const DEFAULT_REQUEST: PlanRequest = {
  interests: ["heritage", "nature"],
  days: 5,
  travellers: 2,
  budget_tier: "mid",
  pace: "balanced",
  start_city: "bengaluru",
  start_month: 12,
  planner: "auto",
  total_budget_inr: 45000,
  experience_preference: "cultural",
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const TIER_LABELS: Record<string, string> = {
  budget: "Budget (hostels, buses)",
  mid: "Mid-range (3-star, cabs)",
  luxury: "Luxury (resorts, private car)",
};

const PLANNER_LABELS: Record<string, string> = {
  auto: "Auto (AI when available)",
  ai: "Force AI (errors if unavailable)",
  fallback: "Force deterministic fallback",
};

interface Props {
  meta: MetaResponse | null;
  value: PlanRequest;
  onChange: (next: PlanRequest) => void;
  onSubmit: (event: React.FormEvent) => void;
  planning: boolean;
}

function Fieldset({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {legend}
      </legend>
      {children}
    </fieldset>
  );
}

export default function PlannerForm({ meta, value, onChange, onSubmit, planning }: Props) {
  function toggleInterest(interest: Interest) {
    const has = value.interests.includes(interest);
    const interests = has
      ? value.interests.filter((i) => i !== interest)
      : [...value.interests, interest];
    onChange({ ...value, interests: interests.length ? interests : value.interests });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex h-fit flex-col gap-5 rounded-lg border border-slate-200 bg-white p-5"
    >
      <Fieldset legend="Interests">
        <div className="flex flex-wrap gap-2">
          {(meta?.interests ?? []).map((interest) => {
            const active = value.interests.includes(interest.value);
            return (
              <button
                key={interest.value}
                type="button"
                title={interest.description}
                onClick={() => toggleInterest(interest.value)}
                className={`rounded-full border px-3 py-1 text-sm transition ${
                  active
                    ? "border-teal-600 bg-teal-600 text-white"
                    : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
                }`}
              >
                {interest.label}
              </button>
            );
          })}
          {!meta && <span className="text-sm text-slate-400">Loading options…</span>}
        </div>
      </Fieldset>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Days</span>
          <input
            type="number"
            min={1}
            max={21}
            value={value.days}
            onChange={(e) => onChange({ ...value, days: Number(e.target.value) })}
            className="rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Travellers</span>
          <input
            type="number"
            min={1}
            max={20}
            value={value.travellers}
            onChange={(e) => onChange({ ...value, travellers: Number(e.target.value) })}
            className="rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
      </div>

      <Fieldset legend="Budget tier">
        <div className="flex flex-col gap-1">
          {(meta?.budget_tiers ?? ["budget", "mid", "luxury"]).map((tier) => (
            <label key={tier} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="budget_tier"
                value={tier}
                checked={value.budget_tier === tier}
                onChange={() => onChange({ ...value, budget_tier: tier })}
              />
              {TIER_LABELS[tier] ?? tier}
            </label>
          ))}
        </div>
      </Fieldset>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">Total Budget (INR)</span>
        <input
          type="number"
          min={1000}
          max={10000000}
          step={1000}
          value={value.total_budget_inr || 45000}
          onChange={(e) => onChange({ ...value, total_budget_inr: Number(e.target.value) })}
          className="rounded-md border border-slate-300 px-3 py-2"
        />
        {(() => {
          const minDaily = value.budget_tier === "luxury" ? 7000 : value.budget_tier === "mid" ? 2500 : 1200;
          const minTotal = (value.days || 1) * (value.travellers || 1) * minDaily;
          if ((value.total_budget_inr || 45000) < minTotal) {
            return (
              <span className="text-xs text-amber-600 font-medium">
                ⚠️ Budget warning: ₹{(value.total_budget_inr || 45000).toLocaleString("en-IN")} is low for a {value.days}-day trip for {value.travellers} people (min est: ₹{minTotal.toLocaleString("en-IN")}).
              </span>
            );
          }
          return null;
        })()}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">Preferred Type of Experience</span>
        <select
          value={value.experience_preference || "cultural"}
          onChange={(e) => onChange({ ...value, experience_preference: e.target.value as any })}
          className="rounded-md border border-slate-300 px-3 py-2"
        >
          <option value="cultural">Cultural</option>
          <option value="adventure">Adventure</option>
          <option value="relaxed">Relaxed</option>
          <option value="family">Family</option>
          <option value="solo">Solo</option>
          <option value="couple">Couple</option>
          <option value="luxury">Luxury</option>
          <option value="budget_backpacking">Budget Backpacking</option>
        </select>
      </label>

      <Fieldset legend="Travel style">
        <div className="flex flex-col gap-1">
          {(meta?.paces ?? ["relaxed", "balanced", "packed"]).map((pace) => (
            <label key={pace} className="flex items-start gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="pace"
                value={pace}
                checked={value.pace === pace}
                onChange={() => onChange({ ...value, pace })}
                className="mt-1"
              />
              <span>
                <span className="font-medium capitalize">{pace}</span>
                {meta && (
                  <span className="block text-xs text-slate-500">
                    {meta.example_pace_notes[pace] ?? ""}
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>
      </Fieldset>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Start city</span>
          <select
            value={value.start_city}
            onChange={(e) => onChange({ ...value, start_city: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-2"
          >
            {(meta?.start_cities ?? [{ id: "bengaluru", name: "Bengaluru" }]).map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Month</span>
          <select
            value={value.start_month ?? ""}
            onChange={(e) =>
              onChange({ ...value, start_month: e.target.value ? Number(e.target.value) : null })
            }
            className="rounded-md border border-slate-300 px-3 py-2"
          >
            <option value="">Auto (this month)</option>
            {MONTHS.map((label, index) => (
              <option key={label} value={index + 1}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">Planner</span>
        <select
          value={value.planner}
          onChange={(e) =>
            onChange({ ...value, planner: e.target.value as PlanRequest["planner"] })
          }
          className="rounded-md border border-slate-300 px-3 py-2"
        >
          {(meta ? Object.keys(PLANNER_LABELS) : ["auto", "fallback"]).map((mode) => (
            <option key={mode} value={mode}>
              {PLANNER_LABELS[mode]}
            </option>
          ))}
        </select>
      </label>

      <button
        type="submit"
        disabled={planning || !meta}
        className="rounded-md bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {planning ? "Planning…" : "Generate itinerary"}
      </button>
    </form>
  );
}
