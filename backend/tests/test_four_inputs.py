"""Tests proving that all four core hackathon inputs are properly utilized and change the result:
1. Interests (heritage, nature, wildlife, beaches, spiritual, food, adventure, coffee/hills)
2. Available time (number of days with sensible bounds 1..21)
3. Budget (rupee amount + tier, with clear warning message when budget is too low)
4. Preferred type of experience (relaxed, adventure, cultural, family, solo, couple, luxury, budget backpacking)
"""

from __future__ import annotations

import pytest
from starlette.testclient import TestClient

from app.main import create_app
from app.schemas import BudgetTier, ExperiencePreference, Interest, Pace, PlanRequest, TripRequest
from app.services.recommendation import select_destinations


@pytest.fixture
def client() -> TestClient:
    return TestClient(create_app())


# ===========================================================================
# 1. INTERESTS TESTS
# ===========================================================================

def test_different_interests_produce_clearly_different_destinations(client: TestClient) -> None:
    """The same start city and duration with different interests must yield distinct destinations."""
    base_payload = {
        "start_city": "bengaluru",
        "days": 4,
        "travellers": 2,
        "budget_tier": "mid",
        "pace": "balanced",
        "planner": "fallback",
    }

    # Heritage trip
    res_heritage = client.post("/api/itineraries/generate", json={**base_payload, "interests": ["heritage"]})
    assert res_heritage.status_code == 200
    heritage_dest_ids = {d["id"] for d in res_heritage.json()["selected_destinations"]}

    # Wildlife trip
    res_wildlife = client.post("/api/itineraries/generate", json={**base_payload, "interests": ["wildlife"]})
    assert res_wildlife.status_code == 200
    wildlife_dest_ids = {d["id"] for d in res_wildlife.json()["selected_destinations"]}

    # Beach trip
    res_beach = client.post("/api/itineraries/generate", json={**base_payload, "interests": ["beach"]})
    assert res_beach.status_code == 200
    beach_dest_ids = {d["id"] for d in res_beach.json()["selected_destinations"]}

    # Coffee & Hills trip
    res_coffee = client.post("/api/itineraries/generate", json={**base_payload, "interests": ["coffee_hills"]})
    assert res_coffee.status_code == 200
    coffee_dest_ids = {d["id"] for d in res_coffee.json()["selected_destinations"]}

    # Adventure trip
    res_adventure = client.post("/api/itineraries/generate", json={**base_payload, "interests": ["adventure"]})
    assert res_adventure.status_code == 200
    adventure_dest_ids = {d["id"] for d in res_adventure.json()["selected_destinations"]}

    # Spiritual trip
    res_spiritual = client.post("/api/itineraries/generate", json={**base_payload, "interests": ["spiritual"]})
    assert res_spiritual.status_code == 200
    spiritual_dest_ids = {d["id"] for d in res_spiritual.json()["selected_destinations"]}

    # Food trip
    res_food = client.post("/api/itineraries/generate", json={**base_payload, "interests": ["food"]})
    assert res_food.status_code == 200
    food_dest_ids = {d["id"] for d in res_food.json()["selected_destinations"]}

    # Verify that each interest selects its characteristic destinations
    assert any(h in heritage_dest_ids for h in ["mysuru", "srirangapatna", "hampi", "belur", "badami"])
    assert any(w in wildlife_dest_ids for w in ["kabini", "bandipur", "ranganathittu", "b-r-hills"])
    assert any(b in beach_dest_ids for b in ["gokarna", "karwar", "udupi", "mangaluru", "murudeshwar"])
    assert any(c in coffee_dest_ids for c in ["chikkamagaluru", "madikeri", "agumbe", "kudremukh"])
    assert any(a in adventure_dest_ids for a in ["dandeli", "kudremukh", "yana"])
    assert any(s in spiritual_dest_ids for s in ["melkote", "udupi", "murudeshwar", "sringeri", "gokarna", "shravanabelagola"])
    assert any(f in food_dest_ids for f in ["bengaluru", "mysuru", "mangaluru", "udupi"])

    # Destinations must be clearly different (not all identical sets)
    assert heritage_dest_ids != wildlife_dest_ids
    assert heritage_dest_ids != beach_dest_ids
    assert wildlife_dest_ids != coffee_dest_ids
    assert beach_dest_ids != coffee_dest_ids
    assert spiritual_dest_ids != adventure_dest_ids
    assert food_dest_ids != wildlife_dest_ids


def test_interest_aliases_and_multi_select(client: TestClient) -> None:
    """Aliases like 'beaches', 'spiritual', 'coffee/hills' must be accepted and combined."""
    payload = {
        "start_city": "bengaluru",
        "days": 5,
        "travellers": 2,
        "interests": ["beaches", "spiritual", "coffee/hills"],
        "planner": "fallback",
    }
    response = client.post("/api/itineraries/generate", json=payload)
    assert response.status_code == 200
    data = response.json()
    selected_ids = {d["id"] for d in data["selected_destinations"]}
    # Combined interests should match coastal/spiritual/hill destinations
    assert len(selected_ids) >= 2


# ===========================================================================
# 2. AVAILABLE TIME (DAYS) TESTS
# ===========================================================================

@pytest.mark.parametrize("trip_days", [1, 2, 5, 8, 14, 21])
def test_available_time_strictly_controls_itinerary_length(client: TestClient, trip_days: int) -> None:
    """The itinerary length must equal the requested days exactly for valid durations."""
    payload = {
        "start_city": "bengaluru",
        "days": trip_days,
        "travellers": 2,
        "interests": ["heritage", "nature"],
        "planner": "fallback",
    }
    response = client.post("/api/itineraries/generate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["itinerary"]) == trip_days
    assert data["budget"]["days"] == trip_days
    # Day numbers must be 1..trip_days
    day_numbers = [d["day"] for d in data["itinerary"]]
    assert day_numbers == list(range(1, trip_days + 1))


def test_available_time_bounds_rejection(client: TestClient) -> None:
    """Durations below 1 or exceeding 21 must be rejected with 422."""
    base = {"start_city": "bengaluru", "travellers": 2, "interests": ["heritage"]}
    
    # 0 days is invalid
    res_zero = client.post("/api/itineraries/generate", json={**base, "days": 0})
    assert res_zero.status_code == 422
    assert res_zero.json()["error"]["code"] == "request_validation_error"

    # Negative days is invalid
    res_neg = client.post("/api/itineraries/generate", json={**base, "days": -3})
    assert res_neg.status_code == 422

    # Exceeding sensible maximum (>21) is rejected
    res_too_long = client.post("/api/itineraries/generate", json={**base, "days": 25})
    assert res_too_long.status_code == 422


# ===========================================================================
# 3. BUDGET TESTS (TIER + REAL INR AMOUNT + WARNING IF TOO LOW)
# ===========================================================================

def test_lower_budget_tier_gives_strictly_cheaper_plans(client: TestClient) -> None:
    """Budget Explorer tier must cost less than Mid-Range, which must cost less than Royal Luxury."""
    base_payload = {
        "start_city": "bengaluru",
        "days": 5,
        "travellers": 2,
        "interests": ["heritage", "nature"],
        "pace": "balanced",
        "planner": "fallback",
    }

    res_budget = client.post("/api/itineraries/generate", json={**base_payload, "budget_tier": "budget"})
    assert res_budget.status_code == 200
    cost_budget = res_budget.json()["budget"]["total_inr"]

    res_mid = client.post("/api/itineraries/generate", json={**base_payload, "budget_tier": "mid"})
    assert res_mid.status_code == 200
    cost_mid = res_mid.json()["budget"]["total_inr"]

    res_luxury = client.post("/api/itineraries/generate", json={**base_payload, "budget_tier": "luxury"})
    assert res_luxury.status_code == 200
    cost_luxury = res_luxury.json()["budget"]["total_inr"]

    assert cost_budget < cost_mid < cost_luxury, (
        f"Budget ({cost_budget}) must be < Mid ({cost_mid}) < Luxury ({cost_luxury})"
    )


def test_lower_real_rupee_budget_gives_cheaper_plan(client: TestClient) -> None:
    """When a traveller specifies a lower real rupee budget (total_budget_inr),
    the system must adapt and produce a plan that is cheaper."""
    base_payload = {
        "start_city": "bengaluru",
        "days": 4,
        "travellers": 2,
        "interests": ["heritage"],
        "planner": "fallback",
    }

    # Higher budget (₹70,000)
    res_high = client.post(
        "/api/itineraries/generate",
        json={**base_payload, "total_budget_inr": 70000},
    )
    assert res_high.status_code == 200
    cost_high = res_high.json()["budget"]["total_inr"]

    # Lower budget (₹20,000)
    res_low = client.post(
        "/api/itineraries/generate",
        json={**base_payload, "total_budget_inr": 20000},
    )
    assert res_low.status_code == 200
    cost_low = res_low.json()["budget"]["total_inr"]

    assert cost_low < cost_high, (
        f"Lower budget plan ({cost_low}) must be cheaper than higher budget plan ({cost_high})"
    )
    # The lower budget plan must fit within the specified ₹20,000
    assert cost_low <= 20000
    assert res_low.json()["budget_fit"]["within_budget"] is True


def test_clear_message_when_budget_is_too_low(client: TestClient) -> None:
    """When a stated INR budget is insufficient, show a clear message stating the overage."""
    # A 5-day trip for 2 people with only ₹3,000 budget is impossible
    payload = {
        "start_city": "bengaluru",
        "days": 5,
        "travellers": 2,
        "interests": ["heritage"],
        "budget_tier": "budget",
        "total_budget_inr": 3000,
        "planner": "fallback",
    }
    response = client.post("/api/itineraries/generate", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["budget_fit"]["within_budget"] is False
    assert data["budget_fit"]["variance_inr"] < 0

    # Must have a clear warning message in warnings list (exactly one, no duplicate)
    budget_warnings = [w for w in data["warnings"] if "Budget Warning" in w]
    assert len(budget_warnings) == 1, f"Expected exactly 1 Budget Warning, got {budget_warnings}"
    warning_text = budget_warnings[0]
    assert "exceeds your total budget INR 3000" in warning_text


def test_budget_within_target_when_sufficient(client: TestClient) -> None:
    """When a stated INR budget is generous, within_budget is True with positive variance."""
    payload = {
        "start_city": "bengaluru",
        "days": 3,
        "travellers": 2,
        "interests": ["heritage"],
        "budget_tier": "mid",
        "total_budget_inr": 100000,
        "planner": "fallback",
    }
    response = client.post("/api/itineraries/generate", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["budget_fit"]["within_budget"] is True
    assert data["budget_fit"]["variance_inr"] > 0
    # No over-budget warning
    assert not any("Budget Warning" in w for w in data["warnings"])


# ===========================================================================
# 4. PREFERRED TYPE OF EXPERIENCE TESTS
# ===========================================================================

@pytest.mark.parametrize(
    "exp_style,expected_feature",
    [
        ("adventure", "adventure"),
        ("cultural", "heritage"),
        ("family", "family"),
        ("relaxed", "relaxed"),
        ("solo", "solo"),
        ("couple", "couple"),
        ("luxury", "luxury"),
        ("budget_backpacking", "budget"),
    ],
)
def test_preferred_experience_type_changes_plan(client: TestClient, exp_style: str, expected_feature: str) -> None:
    """Each preferred experience style must customize the trip parameters and destination scoring."""
    payload = {
        "start_city": "bengaluru",
        "days": 4,
        "travellers": 2,
        "interests": ["nature", "heritage", "adventure", "food"],
        "experience_preference": exp_style,
        "planner": "fallback",
    }
    response = client.post("/api/itineraries/generate", json=payload)
    assert response.status_code == 200
    data = response.json()

    if exp_style == "relaxed":
        # Relaxed sets relaxed pace (1.5x stay length, fewer hops)
        assert data["stays"] is not None
        # Must have longer stays
        max_stay = max(s["days"] for s in data["stays"])
        assert max_stay >= 2

    elif exp_style == "adventure":
        # Adventure includes outdoor stops
        selected_cats = {c for d in data["selected_destinations"] for c in d["categories"]}
        assert "adventure" in selected_cats or "nature" in selected_cats

    elif exp_style == "cultural":
        selected_cats = {c for d in data["selected_destinations"] for c in d["categories"]}
        assert "heritage" in selected_cats or "spiritual" in selected_cats

    elif exp_style == "family":
        # Family stops are family friendly
        dest_names = [d["name"] for d in data["selected_destinations"]]
        assert any(n in ["Mysuru (Mysore)", "Ranganathittu Bird Sanctuary", "Bannerghatta", "Bengaluru"] for n in dest_names)

    elif exp_style == "solo":
        # Solo emphasizes solo hubs with cafes and culture
        dest_ids = {d["id"] for d in data["selected_destinations"]}
        assert any(s in dest_ids for s in ["mysuru", "bengaluru", "udupi", "gokarna", "hampi"])

    elif exp_style == "couple":
        # Couple emphasizes scenic romantic stays (hills, beach, coffee)
        dest_ids = {d["id"] for d in data["selected_destinations"]}
        assert any(c in dest_ids for c in ["madikeri", "chikkamagaluru", "kudremukh", "gokarna", "kabini", "agumbe"])

    elif exp_style == "luxury":
        assert data["budget"]["tier"] == "luxury"

    elif exp_style == "budget_backpacking":
        assert data["budget"]["tier"] == "budget"
