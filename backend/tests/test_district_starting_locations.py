"""Tests for starting locations covering all 31 Karnataka districts and major transit hubs."""

import pytest
from starlette.testclient import TestClient

from app.data.districts import all_districts
from app.data.loader import get_destination, start_hubs
from app.main import app
from app.schemas import BudgetTier, Pace, PlanRequest
from app.services.planner import PlanValidationError, create_plan


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def test_meta_endpoint_includes_all_31_districts_and_hubs(client: TestClient) -> None:
    """Ensure GET /api/v1/meta provides all 31 districts and transit hubs."""
    response = client.get("/api/v1/meta")
    assert response.status_code == 200
    data = response.json()
    start_cities = data.get("start_cities", [])
    assert len(start_cities) >= 31

    city_ids = {c["id"] for c in start_cities}
    # Check that major hubs exist
    for hub in ["bengaluru", "mysuru", "mangaluru", "hubballi"]:
        assert hub in city_ids

    # Check that every district is accounted for (either as hub or district HQ)
    districts = all_districts()
    assert len(districts) == 31
    for d in districts:
        assert d.id in city_ids or any(d.id in c["id"] for c in start_cities)


def test_all_31_districts_have_valid_starting_coordinates() -> None:
    """Every district headquarters must have valid coordinates within Karnataka."""
    districts = all_districts()
    assert len(districts) == 31

    for d in districts:
        dest = get_destination(d.id)
        assert dest is not None, f"Destination not resolvable for district: {d.id}"
        assert dest.has_usable_coords, f"District {d.id} lacks coordinates"
        assert dest.within_karnataka, f"District {d.id} coordinates {dest.lat}, {dest.lng} outside Karnataka"


@pytest.mark.parametrize("district", all_districts(), ids=lambda d: d.id)
def test_every_district_generates_valid_itinerary(district) -> None:
    """Every single one of Karnataka's 31 districts must produce a valid 3-day itinerary."""
    req = PlanRequest(
        interests=["heritage"],
        days=3,
        travellers=2,
        budget_tier=BudgetTier.mid,
        pace=Pace.balanced,
        start_city=district.id,
        planner="fallback",
    )
    plan = create_plan(req)
    assert plan is not None
    assert plan.plan_id
    assert len(plan.itinerary) == 3
    # First day must be anchored in the chosen start city or its district hub
    first_day = plan.itinerary[0]
    assert first_day.day == 1
    aliases_lower = [a.lower() for a in district.aliases]
    assert (
        first_day.place.destination_id == district.id
        or district.id in first_day.place.destination_id
        or first_day.place.destination_id in aliases_lower
    )

    # Budget must be calculated and greater than 0
    assert plan.budget.total_inr > 0
    assert plan.budget.stay_food_inr > 0

    # Route legs must have valid distances without self-loops
    for leg in plan.route:
        assert leg.distance_km > 0
        assert leg.origin.destination_id != leg.destination.destination_id


def test_invalid_start_city_raises_validation_error() -> None:
    """Unknown start city should fail fast with a clear error."""
    req = PlanRequest(
        interests=["nature"],
        days=3,
        travellers=2,
        start_city="nonexistent-fantasy-location",
        planner="fallback",
    )
    with pytest.raises(PlanValidationError) as exc_info:
        create_plan(req)
    assert "Unknown start_city" in str(exc_info.value)
