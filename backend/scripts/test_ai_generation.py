"""Script to test real AI generation with Gemini or Mock provider.

Tests:
1. Generate 5 different itineraries with AI enabled (different interests, days, budgets).
2. Check the AI only uses places from our 38 curated destinations. Reject and fall back if it invents places.
3. Check the AI's day plans respect the budget and the number of days.
4. Verify label 'AI-personalized' on success, and 'Smart planner' on fallback.
5. Print a Before (Fallback) vs After (AI) itinerary comparison.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.config import get_settings
from app.data.loader import all_destinations
from app.schemas import PlanRequest
from app.services.planner import create_plan

CURATED_DESTINATIONS = {d.id: d for d in all_destinations()}


def run_checks(plan_response, request: PlanRequest, label: str):
    print(f"\n{'='*70}")
    print(f"VERIFYING: {label}")
    print(f"{'='*70}")
    print(f"Plan ID: {plan_response.plan_id}")
    print(f"Source: {plan_response.source}")
    print(f"Planner Label: {plan_response.planner_label}")
    print(f"AI Provider: {plan_response.ai_provider or 'None'}")
    print(f"Requested Days: {request.days} | Itinerary Days: {len(plan_response.itinerary)}")
    print(f"Total Budget: INR {request.total_budget_inr or 'flexible'} | Estimated Cost: INR {plan_response.budget.total_inr}")

    # Check 1: Day count matches exactly
    assert len(plan_response.itinerary) == request.days, (
        f"Day count mismatch: requested {request.days}, got {len(plan_response.itinerary)}"
    )
    print("  [PASS] Day count matches requested days.")

    # Check 2: Only 38 curated destinations are used
    for day_plan in plan_response.itinerary:
        dest_id = day_plan.place.destination_id
        assert dest_id in CURATED_DESTINATIONS, (
            f"Destination '{dest_id}' on day {day_plan.day} is not in 38 curated destinations!"
        )
    print(f"  [PASS] All {len(plan_response.itinerary)} days use valid destinations from the 38 curated hubs.")

    # Check 3: Check substitutions only use curated destinations
    for sub in plan_response.suggested_substitutions:
        assert sub.suggested_destination_id in CURATED_DESTINATIONS, (
            f"Substitution '{sub.suggested_destination_id}' not in 38 curated hubs!"
        )
    print("  [PASS] All suggested substitutions reference verified curated hubs.")

    # Check 4: Budget check
    if request.total_budget_inr:
        within_budget = plan_response.budget.total_inr <= request.total_budget_inr
        variance = request.total_budget_inr - plan_response.budget.total_inr
        status = f"within budget (+INR {variance:,})" if within_budget else f"exceeds budget (-INR {abs(variance):,})"
        print(f"  [INFO] Budget assessment: {status}")

    # Check 5: Label verification
    if plan_response.source == "ai":
        assert plan_response.planner_label == "AI-personalized", (
            f"Expected 'AI-personalized', got '{plan_response.planner_label}'"
        )
        print("  [PASS] Correct label: 'AI-personalized'.")
    else:
        assert plan_response.planner_label == "Smart planner", (
            f"Expected 'Smart planner', got '{plan_response.planner_label}'"
        )
        print("  [PASS] Correct label: 'Smart planner'.")


def main():
    settings = get_settings()
    print("AI Configuration Status:")
    print(f"  Provider: {settings.ai_provider}")
    print(f"  Model: {settings.ai_model}")
    print(f"  Base URL: {settings.ai_base_url}")
    print(f"  Timeout: {settings.ai_timeout_seconds}s")
    print(f"  LLM Configured: {settings.llm_configured}")

    test_trips = [
        {
            "name": "Trip 1: Heritage & History Explorer",
            "req": PlanRequest(
                interests=["heritage"],
                days=3,
                travellers=2,
                budget_tier="budget",
                pace="balanced",
                start_city="bengaluru",
                start_month=11,
                total_budget_inr=20000,
                planner="auto",
            ),
        },
        {
            "name": "Trip 2: Wildlife Safari & Nature Immersion",
            "req": PlanRequest(
                interests=["wildlife", "nature"],
                days=4,
                travellers=2,
                budget_tier="mid",
                pace="relaxed",
                start_city="mysuru",
                start_month=12,
                total_budget_inr=45000,
                planner="auto",
            ),
        },
        {
            "name": "Trip 3: Coastal Beaches & Gastronomy",
            "req": PlanRequest(
                interests=["beach", "food"],
                days=5,
                travellers=3,
                budget_tier="mid",
                pace="balanced",
                start_city="mangaluru",
                start_month=1,
                total_budget_inr=55000,
                planner="auto",
            ),
        },
        {
            "name": "Trip 4: Coffee Hills & Mountain Mist",
            "req": PlanRequest(
                interests=["coffee_hills", "nature"],
                days=3,
                travellers=2,
                budget_tier="luxury",
                pace="relaxed",
                start_city="bengaluru",
                start_month=10,
                total_budget_inr=65000,
                planner="auto",
            ),
        },
        {
            "name": "Trip 5: Spiritual Trails & Architectural Wonders",
            "req": PlanRequest(
                interests=["spiritual", "heritage"],
                days=6,
                travellers=4,
                budget_tier="mid",
                pace="balanced",
                start_city="hubballi",
                start_month=2,
                total_budget_inr=75000,
                planner="auto",
            ),
        },
    ]

    print(f"\nTesting 5 different itineraries (AI enabled: {settings.llm_configured})...")
    results = []
    for item in test_trips:
        req = item["req"]
        print(f"\n--> Generating: {item['name']} ({req.days} days, budget INR {req.total_budget_inr})...")
        plan = create_plan(req)
        run_checks(plan, req, item["name"])
        results.append((item["name"], req, plan))

    # Before / After Comparison for Trip 1
    sample_req = test_trips[0]["req"]
    print("\n" + "#"*70)
    print("BEFORE / AFTER COMPARISON: FALLBACK (SMART) vs AI-PERSONALIZED")
    print("#"*70)

    # 1. Fallback planner version
    fallback_req = sample_req.model_copy(update={"planner": "fallback"})
    fallback_plan = create_plan(fallback_req)

    # 2. AI planner version (from results[0])
    ai_plan = results[0][2]

    print("\n--- [BEFORE: FALLBACK / SMART PLANNER] ---")
    print(f"Label: {fallback_plan.planner_label} (Source: {fallback_plan.source})")
    print(f"Summary:\n{fallback_plan.summary}\n")
    for d in fallback_plan.itinerary:
        print(f"  Day {d.day} ({d.place.name}): {d.day_title}")
        print(f"    Morning: {d.morning_plan}")
        print(f"    Afternoon: {d.afternoon_plan}")
        print(f"    Evening: {d.evening_plan}")

    print("\n--- [AFTER: AI-PERSONALIZED PLANNER] ---")
    print(f"Label: {ai_plan.planner_label} (Source: {ai_plan.source})")
    print(f"Summary:\n{ai_plan.summary}\n")
    for d in ai_plan.itinerary:
        print(f"  Day {d.day} ({d.place.name}): {d.day_title}")
        if d.narrative:
            print(f"    Narrative: {d.narrative}")
        for act in d.activities[:3]:
            print(f"    {act.time} - {act.title}: {act.description}")

    if ai_plan.destination_explanations:
        print("\nAI Destination Explanations:")
        for exp in ai_plan.destination_explanations:
            print(f"  • {exp.destination_name}: {exp.explanation}")


if __name__ == "__main__":
    main()
