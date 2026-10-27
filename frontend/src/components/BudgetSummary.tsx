import { Wallet, Bed, Car, Ticket, AlertCircle, CheckCircle2, TrendingUp, TrendingDown, UtensilsCrossed, Sparkles } from "lucide-react";
import type { BudgetBreakdown, BudgetFit } from "../api/types";
import { formatInr } from "../lib/format";

interface BudgetSummaryProps {
  budget: BudgetBreakdown;
  budgetFit?: BudgetFit;
}

export default function BudgetSummary({ budget, budgetFit }: BudgetSummaryProps) {
  const stayAmount = budget.stay_inr ?? Math.round(budget.stay_food_inr * 0.52);
  const foodAmount = budget.food_inr ?? Math.round(budget.stay_food_inr * 0.32);
  const transportAmount = budget.transport_inr;
  const entryFeesAmount = budget.entry_fees_inr ?? budget.activities_inr;
  const extraAmount = budget.extra_inr ?? Math.max(0, budget.total_inr - (stayAmount + foodAmount + transportAmount + entryFeesAmount));

  const categories = [
    {
      key: "stay",
      label: "Stay & Accommodation",
      desc: "Hotels, homestays or resorts",
      icon: Bed,
      amount: stayAmount,
    },
    {
      key: "food",
      label: "Food & Dining",
      desc: "3 regional meals daily + coffee",
      icon: UtensilsCrossed,
      amount: foodAmount,
    },
    {
      key: "transport",
      label: "Transport & Transit",
      desc: "Highway routes + local transit",
      icon: Car,
      amount: transportAmount,
    },
    {
      key: "entry_fees",
      label: "Entry Fees & Monuments",
      desc: "Verified monument & reserve tickets",
      icon: Ticket,
      amount: entryFeesAmount,
    },
    {
      key: "extra",
      label: "Extra & Incidentals",
      desc: "Local guide, shopping & buffer",
      icon: Sparkles,
      amount: extraAmount,
    },
  ];

  return (
    <div className="rounded-3xl glass-panel-elevated p-6 sm:p-8 border border-[#cbe1d5] shadow-lg">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#dce9e1]">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#2d6a4f] mb-1">
            <Wallet className="h-3.5 w-3.5" />
            <span>Verifiable Cost Transparency</span>
          </div>
          <h3 className="font-serif text-2xl font-normal text-[#14231b]">
            Trip Budget Breakdown
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-xl border border-[#c2ded0] bg-[#eaf4ee] px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#1e533c]">
            {budget.tier} Class
          </span>
          <span className="text-xs text-[#526a5c] font-medium">
            {budget.days} Days · {budget.travellers} {budget.travellers === 1 ? "Traveller" : "Travellers"}
          </span>
        </div>
      </div>

      {/* Main Totals & Budget Fit Grid */}
      <div className="my-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Estimated Cost */}
        <div className="rounded-2xl border border-[#d8e6de] bg-white p-5 shadow-xs">
          <span className="text-xs uppercase tracking-wider text-[#5e7467] font-semibold block">
            Estimated Total Cost
          </span>
          <div className="font-serif text-3xl font-bold text-[#1e533c] mt-1">
            {formatInr(budget.total_inr)}
          </div>
          <p className="text-[11px] text-[#5e7467] mt-1">
            All {budget.travellers} {budget.travellers === 1 ? "traveller" : "travellers"} combined
          </p>
        </div>

        {/* Per-Person Cost */}
        <div className="rounded-2xl border border-[#d8e6de] bg-white p-5 shadow-xs">
          <span className="text-xs uppercase tracking-wider text-[#5e7467] font-semibold block">
            Cost Per Traveller
          </span>
          <div className="font-serif text-3xl font-bold text-[#14231b] mt-1">
            {formatInr(budget.per_person_total_inr)}
          </div>
          <p className="text-[11px] text-[#5e7467] mt-1">
            Includes stay, food, intercity transit & tickets
          </p>
        </div>

        {/* Budget Comparison / Fit (from Backend values) */}
        {budgetFit && budgetFit.total_budget_inr ? (
          <div
            className={`rounded-2xl border p-5 shadow-xs ${
              budgetFit.within_budget
                ? "border-[#c2ded0] bg-[#eaf4ee]"
                : "border-amber-300 bg-[#fef7ee]"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider font-semibold text-[#35483d]">
                Budget Target Fit
              </span>
              {budgetFit.within_budget ? (
                <TrendingDown className="h-4 w-4 text-[#2d6a4f]" />
              ) : (
                <TrendingUp className="h-4 w-4 text-[#b45309]" />
              )}
            </div>

            <div
              className={`font-serif text-3xl font-bold mt-1 ${
                budgetFit.within_budget ? "text-[#1e533c]" : "text-[#b45309]"
              }`}
            >
              {budgetFit.variance_inr && budgetFit.variance_inr >= 0
                ? `+${formatInr(budgetFit.variance_inr)}`
                : `-${formatInr(Math.abs(budgetFit.variance_inr || 0))}`}
            </div>

            <p className="text-[11px] text-[#5e7467] mt-1">
              {budgetFit.within_budget
                ? `Under stated budget (${formatInr(budgetFit.total_budget_inr)})`
                : `Exceeds target budget (${formatInr(budgetFit.total_budget_inr)})`}
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-[#d8e6de] bg-white p-5 shadow-xs">
            <span className="text-xs uppercase tracking-wider text-[#5e7467] font-semibold block">
              Budget Completeness
            </span>
            <div className="font-serif text-2xl font-bold text-[#1e533c] mt-1">
              {budget.estimate_complete ? "Fully Verified" : "Provisional"}
            </div>
            <p className="text-[11px] text-[#5e7467] mt-1">
              {budget.estimate_complete ? "All entry fees verified" : "Excludes unverified sight fees"}
            </p>
          </div>
        )}
      </div>

      {/* Clear message if budget is too low */}
      {budgetFit && budgetFit.within_budget === false && (
        <div id="budget-summary-too-low-alert" className="my-6 rounded-2xl border border-amber-300 bg-[#fef7ee] p-4 text-xs text-[#92400e] flex items-start gap-3 shadow-xs">
          <AlertCircle className="h-5 w-5 text-[#b45309] shrink-0 mt-0.5" />
          <div>
            <strong className="block text-[#78350f] font-bold text-sm mb-1">
              Budget Notice: Stated Budget is Lower than Baseline Costs
            </strong>
            <p className="leading-relaxed text-[#92400e]">
              Your stated budget of <strong>{formatInr(budgetFit.total_budget_inr || 0)}</strong> is lower than estimated costs of <strong>{formatInr(budget.total_inr)}</strong> (by <strong>{formatInr(Math.abs(budgetFit.variance_inr || 0))}</strong>). 
              To bring the trip within budget, consider switching to Budget Explorer tier or shortening the itinerary.
            </p>
          </div>
        </div>
      )}

      {/* Itemised 5-Way Cost Split Category Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {categories.map((cat) => {
          const Icon = cat.icon;
          return (
            <div
              key={cat.key}
              className="rounded-2xl border border-[#d8e6de] bg-white/90 p-4 flex flex-col justify-between shadow-xs transition hover:border-[#2d6a4f]/30"
            >
              <div>
                <div className="flex items-center gap-2 text-[#14231b] mb-1">
                  <Icon className="h-4 w-4 text-[#2d6a4f]" />
                  <span className="text-xs font-semibold">{cat.label}</span>
                </div>
                <p className="text-[11px] text-[#5e7467] leading-tight">{cat.desc}</p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#eaf2ec] font-serif text-lg font-bold text-[#1e533c]">
                {formatInr(cat.amount)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Assumptions & Accuracy Disclosures */}
      {!budget.estimate_complete ? (
        <div className="mt-6 rounded-2xl border border-[#cbe1d5] bg-[#f8faf8] p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-4 w-4 text-[#2d6a4f] shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1 text-xs">
              <span className="font-semibold text-[#14231b]">
                Transparent Data Disclosure: Excluded Costs
              </span>
              {budget.excluded_costs_note && (
                <p className="text-[#35483d]">{budget.excluded_costs_note}</p>
              )}
              {budget.unknown_entry_fees.length > 0 && (
                <p className="text-[#5e7467]">
                  Stops with unverified entry fees:{" "}
                  <strong className="text-[#14231b]">{budget.unknown_entry_fees.join(", ")}</strong>.
                </p>
              )}
              {budget.zero_entry_fees.length > 0 && (
                <p className="text-[#5e7467]">
                  Confirmed free admission stops:{" "}
                  <strong className="text-[#14231b]">{budget.zero_entry_fees.join(", ")}</strong>.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-6 flex items-center gap-2 text-xs text-[#1e533c] font-medium">
          <CheckCircle2 className="h-4 w-4 text-[#2d6a4f]" />
          <span>All selected destination fees in this itinerary have been independently verified.</span>
        </div>
      )}
    </div>
  );
}
