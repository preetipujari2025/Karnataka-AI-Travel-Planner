"""Tests verifying itinerary quality improvements across all 6 core criteria:
1. Group nearby places on the same day; never send the traveller across the state in one day.
2. Respect each destination's best season and traveller's travel month.
3. Every day has morning, afternoon, evening plans, travel time, food suggestion, and local tip.
4. Total cost stays within budget when feasible, with 5-way split (stay, food, transport, entry fees, extra).
5. "Why this plan for you" note explicitly mentions the traveller's interests and budget.
6. Polite pacing advice when available days are too few for the chosen interests.

Tests at least 10 distinct inputs:
- Input 1: 1-day trip (Heritage + Food)
- Input 2: 1-day trip with overloaded disparate interests (Heritage, Beach, Wildlife, Coffee/Hills) -> pacing advice
- Input 3: 3-day trip (Coffee/Hills + Nature in Western Ghats)
- Input 4: 3-day trip (Coastal Beaches + Spiritual in Coastal Karnataka)
- Input 5: 7-day trip (Big budget, Luxury tier, Heritage + Nature)
- Input 6: Tiny budget trip (₹1,500 for 3 days) -> clear warning & floor enforcement
- Input 7: Big budget trip (₹75,000 for 3 days) -> stays within budget
- Input 8: Seasonal fit: Month 7 (July monsoon) vs. Month 12 (December winter)
- Input 9: Adventure interest (Dandeli / Kudremukh / Ramanagara)
- Input 10: Wildlife interest (Kabini / Bandipur / Nagarhole)
- Input 11: Spiritual interest (Udupi / Dharmasthala / Sringeri)
- Input 12: Geographic sanity check (no cross-state jumps on short trips)
"""

from __future__ import annotations

import pytest
from starlette.testclient import TestClient

from app.main import create_app
from app.services.destination_service import all_destinations
from app.services.recommendation import score_destination, select_destinations
from app.schemas import DestinationRecord, Interest, Pace, TripRequest, BudgetTier, ExperiencePreference


@pytest.fixture
def client() -> TestClient:
    return TestClient(create_app())


def _assert_daily_schedule_completeness(itinerary: list[dict]) -> None:
    """Verifies that every single day has all required detailed schedule fields."""
    for day in itinerary:
        assert day.get("morning_plan"), f"Day {day.get('day')} is missing morning_plan"
        assert len(day["morning_plan"].strip()) > 5

        assert day.get("afternoon_plan"), f"Day {day.get('day')} is missing afternoon_plan"
        assert len(day["afternoon_plan"].strip()) > 5

        assert day.get("evening_plan"), f"Day {day.get('day')} is missing evening_plan"
        assert len(day["evening_plan"].strip()) > 5

        assert day.get("travel_time"), f"Day {day.get('day')} is missing travel_time"
        assert len(day["travel_time"].strip()) > 0

        assert day.get("food_suggestion"), f"Day {day.get('day')} is missing food_suggestion"
        assert len(day["food_suggestion"].strip()) > 5

        assert day.get("local_tip"), f"Day {day.get('day')} is missing local_tip"
        assert len(day["local_tip"].strip()) > 5


def _assert_budget_split_integrity(budget: dict) -> None:
    """Verifies the 5-way cost split: stay + food + transport + entry_fees + extra == total."""
    stay = budget.get("stay_inr", 0)
    food = budget.get("food_inr", 0)
    transport = budget.get("transport_inr", 0)
    entry_fees = budget.get("entry_fees_inr", 0)
    extra = budget.get("extra_inr", 0)
    total = budget.get("total_inr", 0)

    assert stay >= 0, "stay_inr must be non-negative"
    assert food >= 0, "food_inr must be non-negative"
    assert transport >= 0, "transport_inr must be non-negative"
    assert entry_fees >= 0, "entry_fees_inr must be non-negative"
    assert extra >= 0, "extra_inr must be non-negative"
    assert total > 0, "total_inr must be positive"

    split_sum = stay + food + transport + entry_fees + extra
    assert split_sum == total, f"5-way split sum {split_sum} != total {total}"


# ===========================================================================
# INPUT 1: 1-Day Trip (Heritage + Food)
# ===========================================================================
def test_input_1_single_day_heritage_and_food(client: TestClient) -> None:
    payload = {
        "start_city": "bengaluru",
        "days": 1,
        "travellers": 1,
        "interests": ["heritage", "food"],
        "budget_tier": "mid",
        "total_budget_inr": 4000,
        "pace": "balanced",
        "planner": "fallback",
    }
    res = client.post("/api/itineraries/generate", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert len(data["itinerary"]) == 1
    _assert_daily_schedule_completeness(data["itinerary"])
    _assert_budget_split_integrity(data["budget"])

    # Why this plan note
    why = data.get("why_this_plan", "")
    assert "heritage" in why.lower() or "food" in why.lower()
    assert "4,000" in why or "4000" in why or "mid" in why.lower()

    # Budget fit
    assert data["budget"]["total_inr"] <= 4000
    assert data["budget_fit"]["within_budget"] is True


# ===========================================================================
# INPUT 2: 1-Day Trip with Overloaded Interests -> Pacing Advice
# ===========================================================================
def test_input_2_single_day_overloaded_interests_pacing_advice(client: TestClient) -> None:
    payload = {
        "start_city": "bengaluru",
        "days": 1,
        "travellers": 1,
        "interests": ["heritage", "beach", "wildlife", "coffee_hills"],
        "budget_tier": "budget",
        "total_budget_inr": 2500,
        "pace": "packed",
        "planner": "fallback",
    }
    res = client.post("/api/itineraries/generate", json=payload)
    assert res.status_code == 200
    data = res.json()

    advice = data.get("duration_interest_advice")
    assert advice is not None and len(advice) > 0
    # Advice should politely mention that 1 day is tight and suggest what to focus on / drop
    advice_lower = advice.lower()
    assert "1 day" in advice_lower or "ambitious" in advice_lower or "focus" in advice_lower or "drop" in advice_lower

    # Warning list should also include the pacing advice
    assert any("Pacing Advice" in w for w in data.get("warnings", []))


# ===========================================================================
# INPUT 3: 3-Day Trip (Coffee/Hills + Nature in Western Ghats)
# ===========================================================================
def test_input_3_three_day_coffee_and_hills_nature(client: TestClient) -> None:
    payload = {
        "start_city": "bengaluru",
        "days": 3,
        "travellers": 2,
        "interests": ["coffee_hills", "nature"],
        "budget_tier": "mid",
        "total_budget_inr": 18000,
        "pace": "relaxed",
        "planner": "fallback",
    }
    res = client.post("/api/itineraries/generate", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert len(data["itinerary"]) == 3
    _assert_daily_schedule_completeness(data["itinerary"])
    _assert_budget_split_integrity(data["budget"])

    # Destinations should be coffee/hill/nature hubs (e.g. Chikkamagaluru, Madikeri/Coorg, Agumbe, Sakleshpur)
    dest_ids = {d["id"] for d in data["selected_destinations"]}
    assert any(c in dest_ids for c in ["chikkamagaluru", "madikeri", "coorg", "sakleshpur", "agumbe", "kudremukh"])

    # Why this plan note
    why = data.get("why_this_plan", "")
    assert "coffee" in why.lower() or "nature" in why.lower()


# ===========================================================================
# INPUT 4: 3-Day Trip (Coastal Beaches + Spiritual)
# ===========================================================================
def test_input_4_three_day_coastal_beaches_and_spiritual(client: TestClient) -> None:
    payload = {
        "start_city": "mangaluru",
        "days": 3,
        "travellers": 2,
        "interests": ["beach", "spiritual"],
        "budget_tier": "mid",
        "total_budget_inr": 16000,
        "pace": "balanced",
        "planner": "fallback",
    }
    res = client.post("/api/itineraries/generate", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert len(data["itinerary"]) == 3
    _assert_daily_schedule_completeness(data["itinerary"])
    _assert_budget_split_integrity(data["budget"])

    # Coastal destinations (e.g. Udupi, Gokarna, Murudeshwar, Mangaluru)
    dest_ids = {d["id"] for d in data["selected_destinations"]}
    assert any(c in dest_ids for c in ["udupi", "gokarna", "murudeshwar", "mangaluru", "karwar"])

    # Food suggestion should include coastal or local delicacies
    food_suggestions = [day["food_suggestion"].lower() for day in data["itinerary"]]
    assert any(
        any(k in f for k in ["dosa", "goli baje", "fish", "curry", "thali", "udupi", "coastal", "ghee roast"])
        for f in food_suggestions
    )


# ===========================================================================
# INPUT 5: 7-Day Trip (Big Budget, Luxury Tier, Heritage + Nature)
# ===========================================================================
def test_input_5_seven_day_luxury_heritage_and_nature(client: TestClient) -> None:
    payload = {
        "start_city": "bengaluru",
        "days": 7,
        "travellers": 2,
        "interests": ["heritage", "nature"],
        "budget_tier": "luxury",
        "total_budget_inr": 90000,
        "pace": "balanced",
        "experience_preference": "luxury",
        "planner": "fallback",
    }
    res = client.post("/api/itineraries/generate", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert len(data["itinerary"]) == 7
    _assert_daily_schedule_completeness(data["itinerary"])
    _assert_budget_split_integrity(data["budget"])

    assert data["budget"]["total_inr"] <= 90000
    assert data["budget_fit"]["within_budget"] is True

    why = data.get("why_this_plan", "")
    assert "luxury" in why.lower()
    assert "heritage" in why.lower() or "nature" in why.lower()


# ===========================================================================
# INPUT 6: Tiny Budget Trip -> Warning & Floor Enforcement
# ===========================================================================
def test_input_6_tiny_budget_warning_and_floor(client: TestClient) -> None:
    payload = {
        "start_city": "bengaluru",
        "days": 3,
        "travellers": 2,
        "interests": ["heritage"],
        "budget_tier": "budget",
        "total_budget_inr": 1500,  # ₹1,500 for 3 days for 2 people is unfeasible
        "pace": "balanced",
        "planner": "fallback",
    }
    res = client.post("/api/itineraries/generate", json=payload)
    assert res.status_code == 200
    data = res.json()

    # Within budget must be False
    assert data["budget_fit"]["within_budget"] is False
    assert data["budget"]["total_inr"] > 1500

    # Warning message must clearly explain the budget issue
    warnings = data.get("warnings", [])
    assert any("Budget Warning" in w and "exceeds" in w for w in warnings)

    # 5-way split integrity must still hold cleanly
    _assert_budget_split_integrity(data["budget"])


# ===========================================================================
# INPUT 7: Big Budget Trip -> Stays Within Budget
# ===========================================================================
def test_input_7_big_budget_stays_within_ceiling(client: TestClient) -> None:
    payload = {
        "start_city": "bengaluru",
        "days": 3,
        "travellers": 2,
        "interests": ["nature", "food"],
        "budget_tier": "luxury",
        "total_budget_inr": 70000,
        "pace": "relaxed",
        "planner": "fallback",
    }
    res = client.post("/api/itineraries/generate", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["budget"]["total_inr"] <= 70000
    assert data["budget_fit"]["within_budget"] is True
    _assert_budget_split_integrity(data["budget"])


# ===========================================================================
# INPUT 8: Seasonal Fit (July Monsoon vs. December Winter)
# ===========================================================================
def test_input_8_seasonal_fit_monsoon_vs_winter() -> None:
    dests = all_destinations()
    gokarna = next(d for d in dests if d.id == "gokarna")
    jog_falls = next((d for d in dests if "jog" in d.id or "jog" in d.name.lower()), None)

    # Gokarna: best in winter (Oct-Mar), off-season in July monsoon
    req_beach = TripRequest(start_city="mangaluru", days=3, interests=[Interest.beach])
    score_gokarna_jul = score_destination(gokarna, req_beach, 7).score
    score_gokarna_dec = score_destination(gokarna, req_beach, 12).score
    assert score_gokarna_dec > score_gokarna_jul, "Gokarna in December winter must outscore July monsoon"

    if jog_falls:
        # Jog Falls / Waterfalls peak in monsoon/post-monsoon (August-December) vs dry summer (April)
        req_nature = TripRequest(start_city="shivamogga", days=3, interests=[Interest.nature])
        score_jog_sep = score_destination(jog_falls, req_nature, 9).score
        score_jog_apr = score_destination(jog_falls, req_nature, 4).score
        assert score_jog_sep > score_jog_apr, "Jog Falls in September monsoon must outscore dry April summer"


# ===========================================================================
# INPUT 9: Adventure Interest
# ===========================================================================
def test_input_9_adventure_interest(client: TestClient) -> None:
    payload = {
        "start_city": "hubballi",
        "days": 2,
        "travellers": 2,
        "interests": ["adventure"],
        "budget_tier": "mid",
        "total_budget_inr": 12000,
        "pace": "packed",
        "planner": "fallback",
    }
    res = client.post("/api/itineraries/generate", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert len(data["itinerary"]) == 2
    _assert_daily_schedule_completeness(data["itinerary"])
    _assert_budget_split_integrity(data["budget"])

    why = data.get("why_this_plan", "")
    assert "adventure" in why.lower()

    # Destination categories should include adventure or nature
    all_cats = {c for d in data["selected_destinations"] for c in d["categories"]}
    assert "adventure" in all_cats or "nature" in all_cats


# ===========================================================================
# INPUT 10: Wildlife Interest
# ===========================================================================
def test_input_10_wildlife_interest(client: TestClient) -> None:
    payload = {
        "start_city": "mysuru",
        "days": 2,
        "travellers": 2,
        "interests": ["wildlife"],
        "budget_tier": "mid",
        "total_budget_inr": 14000,
        "pace": "balanced",
        "planner": "fallback",
    }
    res = client.post("/api/itineraries/generate", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert len(data["itinerary"]) == 2
    _assert_daily_schedule_completeness(data["itinerary"])
    _assert_budget_split_integrity(data["budget"])

    dest_ids = {d["id"] for d in data["selected_destinations"]}
    assert any(w in dest_ids for w in ["kabini", "bandipur", "nagarhole", "mysuru", "ranganathittu", "bannerghatta"])

    why = data.get("why_this_plan", "")
    assert "wildlife" in why.lower()


# ===========================================================================
# INPUT 11: Spiritual Interest
# ===========================================================================
def test_input_11_spiritual_interest(client: TestClient) -> None:
    payload = {
        "start_city": "mangaluru",
        "days": 2,
        "travellers": 2,
        "interests": ["spiritual"],
        "budget_tier": "budget",
        "total_budget_inr": 8000,
        "pace": "relaxed",
        "planner": "fallback",
    }
    res = client.post("/api/itineraries/generate", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert len(data["itinerary"]) == 2
    _assert_daily_schedule_completeness(data["itinerary"])
    _assert_budget_split_integrity(data["budget"])

    all_cats = {c for d in data["selected_destinations"] for c in d["categories"]}
    assert "spiritual" in all_cats or "heritage" in all_cats


# ===========================================================================
# INPUT 12: Geographic Sanity Check (No cross-state jumps on short trips)
# ===========================================================================
def test_input_12_no_cross_state_hops_on_short_trips(client: TestClient) -> None:
    """Short trips (<= 3 days) must never send travellers across the state."""
    for days in [1, 2, 3]:
        payload = {
            "start_city": "bengaluru",
            "days": days,
            "travellers": 2,
            "interests": ["heritage", "nature"],
            "budget_tier": "mid",
            "pace": "balanced",
            "planner": "fallback",
        }
        res = client.post("/api/itineraries/generate", json=payload)
        assert res.status_code == 200
        data = res.json()

        for leg in data.get("route", []):
            dist = leg.get("distance_km", 0)
            # Legs between consecutive stops on short trips must not cross the whole state
            assert dist <= 250, f"{days}-day trip had leg of {dist} km from {leg['origin']['name']} to {leg['destination']['name']}"
