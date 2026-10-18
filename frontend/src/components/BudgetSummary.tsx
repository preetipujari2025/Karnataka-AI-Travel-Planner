import { Wallet, Bed, Car, Ticket, AlertCircle, CheckCircle2, TrendingUp, TrendingDown } from "lucide-react";
import type { BudgetBreakdown, BudgetFit } from "../api/types";
import { formatInr } from "../lib/format";

interface BudgetSummaryProps {
  budget: BudgetBreakdown;
  budgetFit?: BudgetFit;
}

export default function BudgetSummary({ budget, budgetFit }: BudgetSummaryProps) {
  const categories = [
    {
      key: "stay_food_inr" as const,
      label: "Stays, Dining & Local Transit",
      desc: "Accommodation + 3 meals daily + in-town transport",
      icon: Bed,
      amount: budget.stay_food_inr,
    },
    {
      key: "transport_inr" as const,
      label: "Intercity Highway Travel",
      desc: "Fuel, road tolls or bus/train fares between hubs",
      icon: Car,
      amount: budget.transport_inr,
    },
    {
      key: "activities_inr" as const,
      label: "Verified Entry Fees & Sights",
      desc: "Monuments, parks, safaris & guided access",
      icon: Ticket,
      amount: budget.activities_inr,
    },
  ];

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0a0f18] p-6 sm:p-8 shadow-2xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-amber-400 mb-1">
            <Wallet className="h-3.5 w-3.5" />
            <span>Verifiable Cost Transparency</span>
          </div>
          <h3 className="font-serif text-2xl font-normal text-white">
            Trip Budget Breakdown
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-white/10 bg-white/5 px-3 py-1 text-xs font-mono uppercase text-amber-300">
            {budget.tier} Class
          </span>
          <span className="text-xs text-slate-400 font-mono">
            {budget.days} Days · {budget.travellers} {budget.travellers === 1 ? "Traveller" : "Travellers"}
          </span>
        </div>
      </div>

      {/* Main Totals & Budget Fit Grid */}
      <div className="my-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Estimated Cost */}
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
          <span className="text-xs uppercase font-mono tracking-wider text-slate-400 block">
            Estimated Total Cost
          </span>
          <div className="font-serif text-3xl font-bold text-amber-300 mt-1">
            {formatInr(budget.total_inr)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1 font-light">
            All {budget.travellers} {budget.travellers === 1 ? "traveller" : "travellers"} combined
          </p>
        </div>

        {/* Per-Person Cost */}
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
          <span className="text-xs uppercase font-mono tracking-wider text-slate-400 block">
            Cost Per Traveller
          </span>
          <div className="font-serif text-3xl font-bold text-white mt-1">
            {formatInr(budget.per_person_total_inr)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1 font-light">
            Includes stay, food, intercity transit & tickets
          </p>
        </div>

        {/* Budget Comparison / Fit (from Backend values) */}
        {budgetFit && budgetFit.total_budget_inr ? (
          <div
            className={`rounded-xl border p-5 ${
              budgetFit.within_budget
                ? "border-emerald-500/30 bg-emerald-500/10"
                : "border-amber-500/30 bg-amber-500/10"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-mono tracking-wider text-slate-300">
                Budget Target Fit
              </span>
              {budgetFit.within_budget ? (
                <TrendingDown className="h-4 w-4 text-emerald-400" />
              ) : (
                <TrendingUp className="h-4 w-4 text-amber-400" />
              )}
            </div>

            <div
              className={`font-serif text-3xl font-bold mt-1 ${
                budgetFit.within_budget ? "text-emerald-300" : "text-amber-300"
              }`}
            >
              {budgetFit.variance_inr && budgetFit.variance_inr >= 0
                ? `+${formatInr(budgetFit.variance_inr)}`
                : `-${formatInr(Math.abs(budgetFit.variance_inr || 0))}`}
            </div>

            <p className="text-[11px] text-slate-300 mt-1">
              {budgetFit.within_budget
                ? `Under stated budget (${formatInr(budgetFit.total_budget_inr)})`
                : `Exceeds target budget (${formatInr(budgetFit.total_budget_inr)})`}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <span className="text-xs uppercase font-mono tracking-wider text-slate-400 block">
              Budget Completeness
            </span>
            <div className="font-serif text-2xl font-bold text-slate-200 mt-1">
              {budget.estimate_complete ? "Fully Verified" : "Provisional"}
            </div>
            <p className="text-[11px] text-slate-400 mt-1 font-light">
              {budget.estimate_complete ? "All entry fees verified" : "Excludes unverified sight fees"}
            </p>
          </div>
        )}
      </div>

      {/* Itemised Category Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {categories.map((cat) => {
          const Icon = cat.icon;
          return (
            <div
              key={cat.key}
              className="rounded-xl border border-white/5 bg-white/[0.02] p-4 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center gap-2 text-slate-300 mb-1">
                  <Icon className="h-4 w-4 text-amber-400" />
                  <span className="text-xs font-semibold">{cat.label}</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-tight font-light">{cat.desc}</p>
              </div>
              <div className="mt-4 pt-3 border-t border-white/5 font-serif text-lg font-bold text-white">
                {formatInr(cat.amount)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Assumptions & Accuracy Disclosures */}
      {!budget.estimate_complete ? (
        <div className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1 text-xs">
              <span className="font-bold text-amber-300">
                Transparent Data Disclosure: Excluded Costs
              </span>
              {budget.excluded_costs_note && (
                <p className="text-slate-300 font-light">{budget.excluded_costs_note}</p>
              )}
              {budget.unknown_entry_fees.length > 0 && (
                <p className="text-slate-400">
                  Stops with unverified entry fees:{" "}
                  <strong className="text-slate-300">{budget.unknown_entry_fees.join(", ")}</strong>.
                </p>
              )}
              {budget.zero_entry_fees.length > 0 && (
                <p className="text-slate-400">
                  Confirmed free admission stops:{" "}
                  <strong className="text-slate-300">{budget.zero_entry_fees.join(", ")}</strong>.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-6 flex items-center gap-2 text-xs text-emerald-400 font-mono">
          <CheckCircle2 className="h-4 w-4" />
          <span>All selected destination fees in this itinerary have been independently verified.</span>
        </div>
      )}
    </div>
  );
}
