"""Typed Pydantic models for API requests, responses and domain objects."""

from __future__ import annotations

from datetime import date as dt_date, date
from enum import Enum
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


# ---------------------------------------------------------------------------
# Enums (closed vocabularies shared by API, planner and frontend)
# ---------------------------------------------------------------------------


class BudgetTier(str, Enum):
    budget = "budget"
    mid = "mid"
    luxury = "luxury"


class Pace(str, Enum):
    relaxed = "relaxed"
    balanced = "balanced"
    packed = "packed"


class TransportPreference(str, Enum):
    """How the traveller wants to cover intercity distances."""

    any = "any"
    public_transport = "public_transport"
    private_cab = "private_cab"
    self_drive = "self_drive"
    private_car = "private_car"


class DietaryPreference(str, Enum):
    no_preference = "no_preference"
    vegetarian = "vegetarian"
    vegan = "vegan"
    jain = "jain"
    non_vegetarian = "non_vegetarian"


class FamilyPreference(str, Enum):
    with_children = "with_children"
    with_elderly = "with_elderly"


class TravellerType(str, Enum):
    solo = "solo"
    couple = "couple"
    family = "family"
    group = "group"
    senior = "senior"


class TripPriority(str, Enum):
    balanced = "balanced"
    min_cost = "min_cost"
    max_sightseeing = "max_sightseeing"
    min_travel_time = "min_travel_time"


class Interest(str, Enum):
    heritage = "heritage"
    nature = "nature"
    beach = "beach"
    beaches = "beaches"
    adventure = "adventure"
    spirituality = "spirituality"
    spiritual = "spiritual"
    wildlife = "wildlife"
    food = "food"
    urban = "urban"
    photography = "photography"
    temples = "temples"
    waterfalls = "waterfalls"
    viewpoints = "viewpoints"
    shopping = "shopping"
    culture = "culture"
    coffee_hills = "coffee_hills"
    hills = "hills"
    coffee = "coffee"


class ExperiencePreference(str, Enum):
    """Traveller's overarching trip style that shapes destination scoring and itinerary rhythm."""

    relaxed = "relaxed"
    adventure = "adventure"
    cultural = "cultural"
    family = "family"
    solo = "solo"
    couple = "couple"
    luxury = "luxury"
    budget_backpacking = "budget_backpacking"


class ActivityKind(str, Enum):
    arrival = "arrival"
    sightseeing = "sightseeing"
    food = "food"
    travel = "travel"
    leisure = "leisure"
    departure = "departure"


class ExperienceType(str, Enum):
    """Controlled vocabulary of bookable experience types (dataset + filters)."""

    sightseeing = "sightseeing"
    heritage_tour = "heritage_tour"
    wildlife_safari = "wildlife_safari"
    trekking = "trekking"
    beach = "beach"
    pilgrimage = "pilgrimage"
    boating = "boating"
    nature_walk = "nature_walk"
    food_tour = "food_tour"
    photography = "photography"


class DataConfidence(str, Enum):
    """Verification status of a record's checkable facts (coords, fees, season)."""

    verified = "verified"      # backed by a cited source checked on last_verified_on
    estimated = "estimated"    # plausible / commonly cited, but not source-confirmed
    unverified = "unverified"  # no source check yet; treat all numbers as provisional


class FieldVerification(str, Enum):
    """Per-field honesty marker: nothing is ever fabricated to fill a gap."""

    verified = "verified"          # backed by a cited source
    estimated = "estimated"        # plausible default/derivation, not source-confirmed
    unknown = "unknown"            # no reliable information; value is null/empty
    not_applicable = "not_applicable"  # field does not apply to this record


# Rough geographic envelope used to sanity-check coordinates for map display.
KARNATAKA_BOUNDS = {
    "lat_min": 11.5,
    "lat_max": 18.7,
    "lng_min": 73.9,
    "lng_max": 78.9,
}


# ---------------------------------------------------------------------------
# Dataset models
# ---------------------------------------------------------------------------


class DailyCost(BaseModel):
    budget: int = Field(ge=0, description="INR per person per day, budget tier")
    mid: int = Field(ge=0, description="INR per person per day, mid tier")
    luxury: int = Field(ge=0, description="INR per person per day, luxury tier")


class ProvenanceEntry(BaseModel):
    """One source backing a stored record (populated by the ingestion pipeline)."""

    source_id: str
    source_url: Optional[str] = None
    license: Optional[str] = None
    attribution: Optional[str] = None
    retrieved_at: Optional[str] = None
    verification_status: str = Field(
        default="discovered",
        description="discovered | link_only | estimated | verified",
    )


class RecordClass(str, Enum):
    """Where a record came from: hand-curated vs pipeline-imported."""

    curated = "curated"
    imported = "imported"


class DestinationRecord(BaseModel):
    """One curated entry from the Karnataka destination dataset.

    Optional quality fields default to null/empty so the dataset can carry
    provenance without forcing every record to know everything.
    """

    id: str
    name: str
    region: str
    district: Optional[str] = Field(default=None, description="Karnataka district, when known")
    district_id: Optional[str] = Field(
        default=None,
        description="Stable district slug from the district directory (null = unlinked)",
    )
    record_class: RecordClass = Field(
        default=RecordClass.curated,
        description="curated = hand-checked local record; imported = pipeline-collected external record",
    )
    # Coordinates are optional: null means 'no reliable source yet'.
    lat: Optional[float] = None
    lng: Optional[float] = None
    categories: list[str]
    interest_tags: list[str] = Field(default_factory=list, description="Free-form fine-grained tags")
    experience_types: list[ExperienceType] = Field(default_factory=list)
    is_start_hub: bool = False
    description: str
    highlights: list[str]
    best_months: list[int] = Field(
        default_factory=list,
        description="1-12 months that suit this place; EMPTY = season guidance unknown",
    )
    season_note: Optional[str] = None
    min_nights: int = Field(ge=1, description="Recommended minimum visit duration (nights)")
    typical_nights: int = Field(ge=1, description="Recommended typical visit duration (nights)")
    daily_cost_inr: Optional[DailyCost] = Field(
        default=None,
        description=(
            "Planning estimate per person per day in INR; null = unknown "
            "(excluded from budgets, never assumed to be zero)"
        ),
    )
    entry_fees_inr: Optional[int] = Field(
        default=None, ge=0, description="Estimated main entry fee, INR per person; null = unknown"
    )
    entry_fee_note: Optional[str] = None
    activity_cost_inr: Optional[int] = Field(
        default=None, ge=0, description="Estimated local activity cost, INR per person; null = unknown"
    )
    family_friendly: Optional[bool] = None
    accessibility_notes: Optional[str] = None
    local_dish: Optional[str] = Field(default=None, description="Curated authentic local dish or food specialty")
    best_time_tip: Optional[str] = Field(default=None, description="Curated seasonal or best-time insider tip")
    practical_tip: Optional[str] = Field(default=None, description="Curated practical travel advice unique to destination")
    sources: list[str] = Field(default_factory=list, description="Source URLs supporting checkable facts")
    data_confidence: DataConfidence = DataConfidence.unverified
    last_verified_on: Optional[str] = Field(
        default=None, description="ISO date (YYYY-MM-DD) of the last source check"
    )
    field_verification: dict[str, FieldVerification] = Field(
        default_factory=dict,
        description=(
            "Per-field honesty markers (e.g. {\"entry_fees_inr\": \"unknown\"}). "
            "Absent fields are implied by data_confidence and the value itself."
        ),
    )
    provenance: list[ProvenanceEntry] = Field(
        default_factory=list,
        description="Sources that contributed this record (from the ingestion store)",
    )

    @field_validator("lat")
    @classmethod
    def _validate_lat(cls, value: Optional[float]) -> Optional[float]:
        if value is None:
            return value
        if not -90.0 <= value <= 90.0:
            raise ValueError("latitude must be between -90 and 90")
        return value

    @field_validator("lng")
    @classmethod
    def _validate_lng(cls, value: Optional[float]) -> Optional[float]:
        if value is None:
            return value
        if not -180.0 <= value <= 180.0:
            raise ValueError("longitude must be between -180 and 180")
        return value

    @field_validator("best_months")
    @classmethod
    def _validate_months(cls, value: list[int]) -> list[int]:
        # Empty list is allowed and means 'season guidance not verified yet'.
        for month in value:
            if not 1 <= month <= 12:
                raise ValueError("best_months entries must be 1-12")
        return value

    @field_validator("last_verified_on")
    @classmethod
    def _validate_date(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        parts = value.split("-")
        if len(parts) != 3 or not all(part.isdigit() for part in parts):
            raise ValueError("last_verified_on must be an ISO date YYYY-MM-DD")
        year, month, day = (int(part) for part in parts)
        if not (1 <= month <= 12 and 1 <= day <= 31 and 2000 <= year <= 2100):
            raise ValueError("last_verified_on must be an ISO date YYYY-MM-DD")
        return value

    @property
    def has_usable_coords(self) -> bool:
        return self.lat is not None and self.lng is not None

    @property
    def within_karnataka(self) -> bool:
        if not self.has_usable_coords:
            return False
        return (
            KARNATAKA_BOUNDS["lat_min"] <= float(self.lat) <= KARNATAKA_BOUNDS["lat_max"]
            and KARNATAKA_BOUNDS["lng_min"] <= float(self.lng) <= KARNATAKA_BOUNDS["lng_max"]
        )

    @property
    def is_map_ready(self) -> bool:
        """Usable coordinates inside the Karnataka envelope -> safe to draw on a map."""
        return self.has_usable_coords and self.within_karnataka


class DestinationSummary(BaseModel):
    """Compact destination representation returned to the frontend."""

    id: str
    name: str
    region: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    categories: list[str]
    description: str
    highlights: list[str]
    local_dish: Optional[str] = None
    best_time_tip: Optional[str] = None
    practical_tip: Optional[str] = None


class NearbyDestination(BaseModel):
    """A destination paired with its great-circle distance from a query point."""

    destination: DestinationSummary
    distance_km: float = Field(ge=0)


class District(BaseModel):
    """One of Karnataka's 31 districts from the maintained district directory.

    `id` is this project's stable slug. Official identifiers (Wikidata Q-ID,
    Census/LGD codes) are stored only when verified — null means unverified,
    never unknown-but-guessable.
    """

    id: str
    name: str
    aliases: list[str] = Field(default_factory=list)
    division: Optional[str] = Field(
        default=None, description="Administrative division; null when not source-verified"
    )
    wikidata_qid: Optional[str] = None
    census_2011_code: Optional[str] = None
    lgd_code: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    source_urls: list[str] = Field(default_factory=list)
    verified_on: Optional[str] = None
    notes: Optional[str] = None


class DistrictCoverage(BaseModel):
    """Coverage stats for one district (populated from the ingestion store)."""

    district_id: str
    name: str
    division: Optional[str] = None
    destination_count: int = Field(ge=0)
    attraction_count: int = Field(ge=0)
    categories: list[str] = Field(default_factory=list)
    low_coverage: bool = Field(
        default=False, description="True when the district has no curated destination"
    )


class Attraction(BaseModel):
    """A discovered point of interest (not necessarily a plannable destination).

    Attractions come from external open datasets via the ingestion pipeline;
    `verification_status` distinguishes raw discoveries from checked records.
    """

    id: str
    name: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    district_id: Optional[str] = None
    district: Optional[str] = None
    categories: list[str] = Field(default_factory=list)
    source_kind: RecordClass = RecordClass.imported
    source_ids: list[str] = Field(default_factory=list)
    source_urls: list[str] = Field(default_factory=list)
    license: Optional[str] = None
    attribution: Optional[str] = None
    verification_status: str = "discovered"
    linked_destination_id: Optional[str] = None
    opening_hours: Optional[str] = Field(
        default=None, description="Raw source opening-hours value (e.g. OSM tag); null = unknown"
    )
    typical_visit_minutes: Optional[int] = Field(
        default=None, ge=5, le=1440, description="Suggested visit length when a source provides it"
    )
    retrieved_at: Optional[str] = Field(
        default=None, description="ISO timestamp of when this record was fetched from its source"
    )


class MapMarker(BaseModel):
    """One marker for the map: a plannable destination or a discovered attraction."""

    id: str
    name: str
    lat: float
    lng: float
    kind: Literal["destination", "attraction"]
    source_kind: RecordClass
    categories: list[str] = Field(default_factory=list)
    district_id: Optional[str] = None


class MapMarkersResponse(BaseModel):
    """Map payload with explicit provenance so the UI can distinguish
    locally curated destinations from externally discovered attractions."""

    markers: list[MapMarker]
    destination_count: int = Field(ge=0)
    attraction_count: int = Field(ge=0)
    attribution: list[str] = Field(
        default_factory=list,
        description="Licence attribution strings required by the data sources used",
    )


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------


class TripPreferences(BaseModel):
    """Everything the planner needs to build an itinerary."""

    interests: list[Interest] = Field(
        min_length=1,
        max_length=15,
        description="Traveller interests; drives destination scoring.",
    )
    days: int = Field(default=5, ge=1, le=21, description="Trip length in days")
    nights: Optional[int] = Field(
        default=None,
        ge=0,
        description="Number of nights for the trip; defaults to max(0, days - 1)",
    )
    travellers: int = Field(default=1, ge=1, le=20)
    traveller_type: TravellerType = Field(
        default=TravellerType.couple,
        description="solo, couple, family, group, or senior",
    )
    budget_tier: BudgetTier = BudgetTier.mid
    pace: Pace = Pace.balanced
    start_city: str = Field(default="bengaluru", description="Destination id of the departure city / district")
    final_destination: Optional[str] = Field(
        default=None,
        description="Destination id of the final arrival city / district. If omitted, trip is round-trip or outbound from start_city.",
    )
    departure_time: str = Field(
        default="08:00",
        description="Approximate departure time in 24h format HH:MM (e.g. '08:00')",
    )
    start_month: Optional[int] = Field(
        default=None, ge=1, le=12, description="Travel month (1-12); defaults to current month"
    )
    # Optional traveller preferences (all safe defaults so older clients keep working).
    experience_types: list[ExperienceType] = Field(
        default_factory=list, description="Preferred experience types (bonus, not a hard filter)"
    )
    transport_preference: TransportPreference = TransportPreference.any
    dietary_preference: DietaryPreference = DietaryPreference.no_preference
    food_preferences: list[str] = Field(
        default_factory=list,
        description="Specific cuisine preferences e.g. south_indian, udupi, north_karnataka, coastal",
    )
    meal_budget_per_day_inr: Optional[int] = Field(
        default=None,
        ge=100,
        description="Daily meal budget per person in INR",
    )
    trip_priority: TripPriority = Field(
        default=TripPriority.balanced,
        description="Priority: min_cost, max_sightseeing, min_travel_time, or balanced",
    )
    accessibility_requirements: Optional[str] = Field(
        default=None, max_length=500, description="Free-text accessibility needs"
    )
    family_preference: Optional[FamilyPreference] = None
    experience_preference: Optional[ExperiencePreference] = Field(
        default=None,
        description=(
            "Preferred type of experience: relaxed, adventure, cultural, family, "
            "solo, couple, luxury, budget_backpacking. Directly influences destination scoring & trip profile."
        ),
    )

    total_budget_inr: Optional[int] = Field(
        default=None,
        ge=100,
        le=10_000_000,
        description="Total budget for the whole trip in INR (100 .. 1,00,00,000)",
    )

    @field_validator("experience_preference", mode="before")
    @classmethod
    def _normalise_experience_pref(cls, value: Any) -> Any:
        if value is None:
            return None
        raw = str(getattr(value, "value", value)).strip().lower().replace(" ", "_").replace("-", "_")
        return raw if raw else None

    @field_validator("interests", mode="before")
    @classmethod
    def _normalise_raw_interests(cls, value: Any) -> Any:
        if not isinstance(value, list):
            return value
        normalised = []
        for item in value:
            raw = str(getattr(item, "value", item)).strip().lower()
            if raw in ("coffee/hills", "coffee-hills", "coffee_hills", "hills", "coffee"):
                normalised.append("coffee_hills")
            elif raw in ("beaches", "beach"):
                normalised.append("beaches")
            elif raw in ("spiritual", "spirituality"):
                normalised.append("spiritual")
            else:
                normalised.append(raw)
        return normalised

    @model_validator(mode="after")
    def _derive_nights_and_validate(self) -> "TripPreferences":
        if self.nights is None:
            object.__setattr__(self, "nights", max(0, self.days - 1))

        # Experience preference automatically customizes pace, party, tier and activities
        if self.experience_preference:
            pref = self.experience_preference
            if pref == ExperiencePreference.relaxed:
                if self.pace == Pace.balanced:
                    object.__setattr__(self, "pace", Pace.relaxed)
            elif pref == ExperiencePreference.family:
                object.__setattr__(self, "traveller_type", TravellerType.family)
                if self.family_preference is None:
                    object.__setattr__(self, "family_preference", FamilyPreference.with_children)
            elif pref == ExperiencePreference.solo:
                object.__setattr__(self, "traveller_type", TravellerType.solo)
            elif pref == ExperiencePreference.couple:
                object.__setattr__(self, "traveller_type", TravellerType.couple)
            elif pref == ExperiencePreference.luxury:
                object.__setattr__(self, "budget_tier", BudgetTier.luxury)
            elif pref == ExperiencePreference.budget_backpacking:
                object.__setattr__(self, "budget_tier", BudgetTier.budget)
                if self.transport_preference == TransportPreference.any:
                    object.__setattr__(self, "transport_preference", TransportPreference.public_transport)
            elif pref == ExperiencePreference.adventure:
                exps = list(self.experience_types)
                for et in [ExperienceType.trekking, ExperienceType.wildlife_safari, ExperienceType.boating]:
                    if et not in exps:
                        exps.append(et)
                object.__setattr__(self, "experience_types", exps)
            elif pref == ExperiencePreference.cultural:
                exps = list(self.experience_types)
                for et in [ExperienceType.heritage_tour, ExperienceType.pilgrimage]:
                    if et not in exps:
                        exps.append(et)
                object.__setattr__(self, "experience_types", exps)

        # Budget-driven adjustments: if user specifies a real INR budget, adapt tier/transport
        # when not explicitly forced, ensuring lower rupee budgets produce cheaper plans.
        if self.total_budget_inr is not None and self.days > 0 and self.travellers > 0:
            daily_per_person = self.total_budget_inr / (self.days * self.travellers)
            if self.experience_preference not in (ExperiencePreference.luxury, ExperiencePreference.budget_backpacking):
                if daily_per_person <= 2500:
                    object.__setattr__(self, "budget_tier", BudgetTier.budget)
                    if self.transport_preference == TransportPreference.any:
                        object.__setattr__(self, "transport_preference", TransportPreference.public_transport)
                elif daily_per_person >= 7000:
                    object.__setattr__(self, "budget_tier", BudgetTier.luxury)
                    if self.transport_preference == TransportPreference.any:
                        object.__setattr__(self, "transport_preference", TransportPreference.private_car)
                else:
                    object.__setattr__(self, "budget_tier", BudgetTier.mid)
            elif self.experience_preference == ExperiencePreference.luxury:
                if daily_per_person < 6800:
                    object.__setattr__(self, "budget_tier", BudgetTier.mid)

        return self

    @field_validator("interests")
    @classmethod
    def _dedupe_interests(cls, value: list[Interest]) -> list[Interest]:
        seen: list[Interest] = []
        for item in value:
            if item not in seen:
                seen.append(item)
        if not seen:
            raise ValueError("at least one interest is required")
        return seen

    @field_validator("start_city")
    @classmethod
    def _normalise_start_city(cls, value: str) -> str:
        cleaned = value.strip().lower().replace(" ", "-")
        if not cleaned:
            raise ValueError("start_city must not be empty")
        return cleaned

    @field_validator("final_destination")
    @classmethod
    def _normalise_final_destination(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip().lower().replace(" ", "-")
        return cleaned if cleaned else None

    @field_validator("departure_time")
    @classmethod
    def _validate_departure_time(cls, value: str) -> str:
        cleaned = value.strip()
        parts = cleaned.split(":")
        if len(parts) != 2:
            raise ValueError("departure_time must be HH:MM in 24h format")
        try:
            h, m = int(parts[0]), int(parts[1])
            if not (0 <= h <= 23 and 0 <= m <= 59):
                raise ValueError
        except Exception:
            raise ValueError("departure_time must be a valid 24h time HH:MM")
        return f"{h:02d}:{m:02d}"


class PlanRequest(TripPreferences):
    """POST /api/v1/plans body."""

    planner: Literal["auto", "ai", "fallback"] = Field(
        default="auto",
        description=(
            "'auto' uses the LLM when configured and falls back to the deterministic "
            "planner on any failure; 'ai' forces the LLM (errors if unavailable); "
            "'fallback' forces the deterministic planner."
        ),
    )


class TravelDates(BaseModel):
    """Optional concrete travel dates; validated against `days` in TripRequest."""

    start_date: date
    end_date: date

    @model_validator(mode="after")
    def _check_order(self) -> "TravelDates":
        if self.end_date < self.start_date:
            raise ValueError("end_date must not be before start_date")
        return self


class TripRequest(PlanRequest):
    """POST /api/itineraries/generate body — the full trip request schema."""

    travel_dates: Optional[TravelDates] = Field(
        default=None, description="Optional concrete dates; must span exactly `days` days"
    )
    total_budget_inr: Optional[int] = Field(
        default=None,
        ge=100,
        le=10_000_000,
        description="Total budget for the whole trip in INR (100 .. 1,00,00,000)",
    )

    @model_validator(mode="after")
    def _check_travel_dates(self) -> "TripRequest":
        dates = self.travel_dates
        if dates is None:
            return self
        span = (dates.end_date - dates.start_date).days + 1
        if span != self.days:
            raise ValueError(
                f"travel_dates span {span} days but days={self.days}; they must match"
            )
        if dates.start_date < date.today():
            raise ValueError("travel_dates.start_date must be today or later")
        if self.start_month is None:
            # Derive seasonality from the concrete start date.
            object.__setattr__(self, "start_month", dates.start_date.month)
        elif self.start_month != dates.start_date.month:
            raise ValueError(
                f"start_month ({self.start_month}) does not match travel_dates.start_date "
                f"month ({dates.start_date.month})"
            )
        return self


class TripChanges(BaseModel):
    """Partial overrides for a regenerate call. Only fields present are applied."""

    days: Optional[int] = Field(default=None, ge=1, le=21)
    interests: Optional[list[Interest]] = None
    experience_types: Optional[list[ExperienceType]] = None
    pace: Optional[Pace] = None
    budget_tier: Optional[BudgetTier] = None
    transport_preference: Optional[TransportPreference] = None
    start_month: Optional[int] = Field(default=None, ge=1, le=12)
    total_budget_inr: Optional[int] = Field(default=None, ge=100, le=10_000_000)
    final_destination: Optional[str] = None
    departure_time: Optional[str] = None
    nights: Optional[int] = Field(default=None, ge=0)
    traveller_type: Optional[TravellerType] = None
    food_preferences: Optional[list[str]] = None
    meal_budget_per_day_inr: Optional[int] = Field(default=None, ge=100)
    trip_priority: Optional[TripPriority] = None
    experience_preference: Optional[ExperiencePreference] = None


# ---------------------------------------------------------------------------
# Itinerary / planning response models
# ---------------------------------------------------------------------------


class Place(BaseModel):
    destination_id: str
    name: str
    lat: float
    lng: float
    region: str


class DayActivity(BaseModel):
    time: str = Field(description="24h HH:MM local time")
    title: str
    description: str
    destination_id: str
    kind: ActivityKind


class DayPlan(BaseModel):
    day: int = Field(ge=1)
    place: Place
    stay_day: int = Field(
        default=1, ge=1, description="1-based day within this stop's stay"
    )
    stay_days: int = Field(
        default=1,
        ge=1,
        description="Consecutive days spent at this stop (1 = single-day visit)",
    )
    day_title: Optional[str] = Field(
        default=None, description="Readable day title (e.g. 'Arrival & Heritage of Mysuru')"
    )
    narrative: Optional[str] = Field(
        default=None, description="Personalized day narrative or theme"
    )
    morning_plan: Optional[str] = Field(
        default=None, description="Morning activity / exploration plan"
    )
    afternoon_plan: Optional[str] = Field(
        default=None, description="Afternoon sightseeing / cultural plan"
    )
    evening_plan: Optional[str] = Field(
        default=None, description="Evening leisure / scenic / dining plan"
    )
    travel_time: Optional[str] = Field(
        default=None, description="Travel time between stops or local transit time"
    )
    food_suggestion: Optional[str] = Field(
        default=None, description="Authentic regional dish or dining recommendation"
    )
    local_tip: Optional[str] = Field(
        default=None, description="Insider local advice and practical tips"
    )
    activities: list[DayActivity]
    travel_tips: list[str] = Field(
        default_factory=list, description="Practical travel tips for this day"
    )


class StaySpan(BaseModel):
    """An explicit multi-day stay: a contiguous run of days at one destination.

    A destination appearing on several itinerary days is a stay, not a
    duplicate selection; `stays` in the plan makes that unambiguous.
    """

    destination_id: str
    name: str
    first_day: int = Field(ge=1)
    last_day: int = Field(ge=1)
    days: int = Field(ge=1, description="Number of consecutive days at this stop")

    @model_validator(mode="after")
    def _check_span(self) -> "StaySpan":
        if self.last_day < self.first_day:
            raise ValueError("last_day must not be before first_day")
        if self.days != self.last_day - self.first_day + 1:
            raise ValueError("days must equal last_day - first_day + 1")
        return self


class RouteLeg(BaseModel):
    day: int = Field(ge=1)
    origin: Place
    destination: Place
    distance_km: float = Field(ge=0)
    duration_hours: float = Field(ge=0)
    transport: Literal["road"] = "road"


class BudgetBreakdown(BaseModel):
    currency: Literal["INR"] = "INR"
    tier: BudgetTier
    days: int
    travellers: int
    stay_food_inr: int = Field(description="Accommodation, food and local transport, all travellers")
    stay_inr: int = Field(default=0, description="Accommodation portion in INR")
    food_inr: int = Field(default=0, description="Dining and food portion in INR")
    transport_inr: int = Field(description="Intercity travel between stops, all travellers")
    activities_inr: int = Field(
        description=(
            "VERIFIED entry fees only (all travellers). Unverified fees are "
            "excluded, not counted as zero — see unknown_entry_fees."
        )
    )
    entry_fees_inr: int = Field(default=0, description="Verified sight and attraction entry fees in INR")
    extra_inr: int = Field(default=0, description="Incidental buffer and local activities in INR")
    total_inr: int = Field(ge=0)
    per_person_total_inr: int = Field(ge=0)
    # --- transparency: unknown fees are never silently summed as zero -------
    unknown_entry_fees: list[str] = Field(
        default_factory=list,
        description=(
            "Names of selected stops whose entry fee is unverified and therefore "
            "EXCLUDED from activities_inr (not treated as free)."
        ),
    )
    unknown_daily_costs: list[str] = Field(
        default_factory=list,
        description=(
            "Names of selected stops with no verified daily cost estimate; their "
            "stay/food cost is EXCLUDED from stay_food_inr (not treated as zero)."
        ),
    )
    zero_entry_fees: list[str] = Field(
        default_factory=list,
        description="Names of selected stops with a confirmed no-entry-fee (rupees 0).",
    )
    estimate_complete: bool = Field(
        default=True,
        description="False when any selected stop has an unverified (unknown) entry fee.",
    )
    excluded_costs_note: Optional[str] = Field(
        default=None,
        description="Plain-text statement of what this estimate leaves out.",
    )
    # --- road-trip extensions (defaults keep every classic response unchanged) --
    detour_transport_inr: int = Field(
        default=0,
        ge=0,
        description="Extra transport cost (all travellers) for selected sightseeing detours.",
    )
    meals_inr: int = Field(
        default=0,
        ge=0,
        description="Cost of scheduled meal stops (all travellers); estimated when no price data exists.",
    )
    minimum_total_inr: Optional[int] = Field(
        default=None,
        ge=0,
        description="Minimum practical budget: same journey, no optional detours, budget-tier rates.",
    )
    assumptions: list[str] = Field(
        default_factory=list,
        description="Assumptions behind these figures (rates, meal estimates, bundling).",
    )


class DestinationSuitability(BaseModel):
    destination_id: str
    destination_name: str
    explanation: str


class SuggestedSubstitution(BaseModel):
    current_destination_id: str
    current_destination_name: str
    suggested_destination_id: str
    suggested_destination_name: str
    reason: str


class PlanResponse(BaseModel):
    plan_id: str
    source: Literal["ai", "fallback"]
    planner_label: str = Field(
        default="Smart planner",
        description="Display label indicating planning engine: 'AI-personalized' or 'Smart planner'",
    )
    summary: str
    interests: list[Interest]
    itinerary: list[DayPlan]
    selected_destinations: list[DestinationSummary]
    route: list[RouteLeg]
    stays: list[StaySpan] = Field(
        default_factory=list,
        description=(
            "Explicit stay spans: a destination listed once here may cover several "
            "consecutive itinerary days — that is a multi-day stay, not a duplicate."
        ),
    )
    budget: BudgetBreakdown
    warnings: list[str] = Field(default_factory=list)
    destination_explanations: list[DestinationSuitability] = Field(
        default_factory=list,
        description="Personalized explanations of why each destination suits the traveller",
    )
    practical_tips: list[str] = Field(
        default_factory=list,
        description="Practical travel tips and regional recommendations",
    )
    suggested_substitutions: list[SuggestedSubstitution] = Field(
        default_factory=list,
        description="Approved catalog substitutions suggested by AI",
    )
    ai_provider: Optional[str] = Field(
        default=None,
        description="Name of AI provider used when source is 'ai'",
    )
    why_this_plan: Optional[str] = Field(
        default=None,
        description="Personalized note explaining why this itinerary suits the traveller's interests and budget",
    )
    duration_interest_advice: Optional[str] = Field(
        default=None,
        description="Polite advice when trip duration is too short for chosen interests, suggesting what to drop",
    )

    @model_validator(mode="before")
    @classmethod
    def set_default_planner_label(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if not data.get("planner_label"):
                data["planner_label"] = (
                    "AI-personalized" if data.get("source") == "ai" else "Smart planner"
                )
        return data


class RegenerateItineraryRequest(BaseModel):
    """Stateless regenerate body: the server stores nothing, so the client sends
    the previous itinerary payload back; `trip` carries the preserved constraints
    and `changes` (optional) carries explicit revisions."""

    previous_itinerary: PlanResponse
    trip: TripRequest
    changes: Optional[TripChanges] = None


class BudgetFit(BaseModel):
    """How the estimated cost compares to the traveller's stated total budget."""

    total_budget_inr: Optional[int] = None
    estimated_total_inr: int = Field(ge=0)
    within_budget: Optional[bool] = None
    variance_inr: Optional[int] = Field(
        default=None, description="budget minus estimate; negative means over budget"
    )


class GenerateItineraryResponse(PlanResponse):
    """Structured response of POST /api/itineraries/generate."""

    budget_fit: BudgetFit


class RegenerateItineraryResponse(GenerateItineraryResponse):
    """Structured response of POST /api/itineraries/{id}/regenerate."""

    regenerated_from: str = Field(description="plan_id of the previous itinerary")


class ErrorDetail(BaseModel):
    """Consistent error envelope used by every non-2xx response."""

    code: str
    message: str
    details: Optional[list[dict]] = None


class ErrorResponse(BaseModel):
    error: ErrorDetail


# ---------------------------------------------------------------------------
# Misc endpoint models
# ---------------------------------------------------------------------------


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: str
    version: str
    environment: str
    llm_configured: bool
    dataset_size: int
    districts: int = Field(default=31, description="Districts in the district directory")
    attractions: int = Field(default=0, description="Discovered attractions in the store")
    data_source: Literal["database", "seed"] = Field(
        default="seed",
        description="'database' = populated SQLite store; 'seed' = curated JSON fallback",
    )


class InterestMeta(BaseModel):
    value: Interest
    label: str
    description: str


class MetaResponse(BaseModel):
    interests: list[InterestMeta]
    budget_tiers: list[BudgetTier]
    paces: list[Pace]
    start_cities: list[DestinationSummary]
    dataset_updated: str
    example_pace_notes: dict[str, str]
    experience_types: list[ExperienceType] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Road-trip models: real routing, corridor discovery, optional stops, meals
# ---------------------------------------------------------------------------

DEFAULT_CORRIDOR_RADIUS_KM = 30.0
DEFAULT_MAX_DETOUR_KM = 60.0


class RouteAlternative(BaseModel):
    distance_km: float = Field(ge=0)
    duration_hours: float = Field(ge=0)
    geometry: list[list[float]] = Field(
        default_factory=list, description="Alternative route polyline as [lat, lng] pairs"
    )


class RouteInfo(BaseModel):
    """A road route between origin and destination.

    `source`/`verified` make it unmistakable whether the figures come from a
    real road-network provider or from the deterministic local estimate —
    a route is never presented as verified when it was not fetched.
    """

    origin: Place
    destination: Place
    distance_km: float = Field(ge=0)
    duration_hours: float = Field(ge=0)
    geometry: list[list[float]] = Field(
        default_factory=list, description="Route polyline as [lat, lng] pairs; empty when unavailable"
    )
    source: Literal["osrm", "estimated"]
    verified: bool = Field(description="True only for live road-network results")
    provider: Optional[str] = None
    alternatives: list[RouteAlternative] = Field(default_factory=list)
    retrieved_at: str


class RouteDiscoveryRequest(BaseModel):
    """POST /api/routes/discover body — discover places along a real road route."""

    start_city: str = Field(description="Origin: destination or district id")
    final_destination: str = Field(description="Final destination: destination or district id")
    interests: list[Interest] = Field(default_factory=list)
    pace: Pace = Pace.balanced
    budget_tier: BudgetTier = BudgetTier.mid
    travellers: int = Field(default=2, ge=1, le=20)
    transport_preference: TransportPreference = TransportPreference.private_cab
    days: int = Field(default=2, ge=1, le=21)
    nights: Optional[int] = Field(
        default=None, ge=0, description="Number of nights for the trip; defaults to max(0, days - 1)"
    )
    total_budget_inr: Optional[int] = Field(
        default=None, ge=100, le=10_000_000, description="Total budget for the trip in INR"
    )
    traveller_type: TravellerType = Field(
        default=TravellerType.couple, description="solo, couple, family, group, or senior"
    )
    trip_priority: TripPriority = Field(
        default=TripPriority.balanced, description="min_cost, max_sightseeing, min_travel_time, or balanced"
    )
    departure_date: Optional[dt_date] = None
    departure_time: str = Field(default="08:00", description="24h HH:MM")
    corridor_radius_km: float = Field(
        default=DEFAULT_CORRIDOR_RADIUS_KM, gt=1, le=150, description="Half-width of the search corridor"
    )
    max_detour_km: float = Field(
        default=DEFAULT_MAX_DETOUR_KM, gt=1, le=200, description="Maximum one-way detour from the route"
    )
    allow_backtracking: bool = Field(
        default=False, description="Allow stops behind progress already covered along the route"
    )
    include_meals: bool = True
    dietary_preference: DietaryPreference = DietaryPreference.no_preference
    food_preferences: list[str] = Field(
        default_factory=list,
        description="Cuisine preferences e.g. south_indian, udupi, coastal (source tags only)",
    )
    meal_budget_per_day_inr: Optional[int] = Field(
        default=None, ge=100, description="Per-person daily meal budget; null = use tier default"
    )
    max_candidates: int = Field(default=60, ge=5, le=200)
    refresh: bool = Field(default=False, description="Bypass the discovery cache")

    @field_validator("start_city", "final_destination")
    @classmethod
    def _normalise_ids(cls, value: str) -> str:
        cleaned = value.strip().lower().replace(" ", "-")
        if not cleaned:
            raise ValueError("location id must not be empty")
        return cleaned

    @field_validator("departure_time")
    @classmethod
    def _validate_departure_time(cls, value: str) -> str:
        parts = value.strip().split(":")
        if len(parts) != 2:
            raise ValueError("departure_time must be HH:MM in 24h format")
        h, m = int(parts[0]), int(parts[1])
        if not (0 <= h <= 23 and 0 <= m <= 59):
            raise ValueError("departure_time must be a valid 24h time HH:MM")
        return f"{h:02d}:{m:02d}"

    @model_validator(mode="after")
    def _derive_nights_and_validate(self) -> "RouteDiscoveryRequest":
        if self.nights is None:
            object.__setattr__(self, "nights", max(0, self.days - 1))
        if self.start_city == self.final_destination:
            raise ValueError("start_city and final_destination must be different places")
        return self


class DiscoveredStop(BaseModel):
    """One candidate place found along the route corridor, with grounded metrics."""

    candidate_id: str = Field(description="Stable id: '<source_kind>:<ref_id>'")
    ref_id: str
    source_kind: Literal["curated_destination", "stored_attraction", "openstreetmap"]
    name: str
    categories: list[str] = Field(default_factory=list)
    description: Optional[str] = None
    lat: float
    lng: float
    distance_from_route_km: float = Field(ge=0, description="Straight-line distance to the route polyline")
    detour_km: float = Field(ge=0, description="Extra road km to visit and rejoin the route")
    detour_minutes: float = Field(ge=0, description="Extra driving time for the detour")
    detour_measured: bool = Field(
        default=False, description="True when the detour came from the road provider, not an estimate"
    )
    progress_fraction: float = Field(
        ge=0, le=1, description="Where this stop sits along the route (0=origin, 1=destination)"
    )
    suggested_visit_minutes: Optional[int] = Field(default=None, ge=15, le=600)
    visit_duration_status: FieldVerification = FieldVerification.estimated
    entry_fee_inr: Optional[int] = Field(default=None, ge=0)
    entry_fee_status: FieldVerification = FieldVerification.unknown
    opening_hours: Optional[str] = None
    opening_hours_status: FieldVerification = FieldVerification.unknown
    interests_matched: list[str] = Field(default_factory=list)
    score: float
    reasons: list[str] = Field(default_factory=list, description="Transparent ranking reasons")
    recommended: bool = False
    default_selected: bool = False
    suggested_day: Optional[int] = Field(default=None, ge=1)
    segment_label: Optional[str] = None
    verification_status: str = Field(default="discovered")
    source_urls: list[str] = Field(default_factory=list)
    license: Optional[str] = None
    attribution: Optional[str] = None
    retrieved_at: str


class ExcludedStop(DiscoveredStop):
    exclusion_reason: str


class MealStop(BaseModel):
    """A sourced food stop near the route. Never fabricated: unknown stays unknown."""

    meal_id: str = Field(description="Stable id: 'meal:<osm-or-ref-id>'")
    meal: Literal["breakfast", "lunch", "snack", "dinner"]
    day: int = Field(ge=1)
    name: str
    lat: float
    lng: float
    cuisine_tags: list[str] = Field(default_factory=list)
    distance_from_route_km: float = Field(ge=0)
    detour_km: float = Field(ge=0)
    detour_minutes: float = Field(ge=0)
    expected_arrival: Optional[str] = Field(default=None, description="HH:MM local, when scheduled")
    opening_hours: Optional[str] = Field(default=None, description="Raw source value; null = unknown")
    opening_hours_status: FieldVerification = FieldVerification.unknown
    price_note: Optional[str] = Field(default=None, description="Only when the source provides pricing")
    price_status: FieldVerification = FieldVerification.unknown
    dietary_tags: list[str] = Field(default_factory=list, description="Only from source tags")
    recommended: bool = True
    reason: str = ""
    source_kind: Literal["openstreetmap", "curated_destination", "verified_food_stop"] = "openstreetmap"
    verification_status: str = "discovered"
    source_urls: list[str] = Field(default_factory=list)
    license: Optional[str] = None
    attribution: Optional[str] = None
    retrieved_at: str


class RouteDiscoveryResponse(BaseModel):
    """POST /api/routes/discover result: broad candidates kept separate from selection."""

    discovery_id: str
    request: RouteDiscoveryRequest
    route: RouteInfo
    candidates: list[DiscoveredStop] = Field(description="All corridor candidates that passed filters")
    recommended: list[DiscoveredStop]
    optional_stops: list[DiscoveredStop] = Field(description="Valid candidates not in the default selection")
    excluded: list[ExcludedStop] = Field(description="Rejected candidates, each with a reason")
    meal_stops: list[MealStop] = Field(default_factory=list)
    coverage_note: str = Field(description="Honest statement of discovery coverage")
    providers: list[str] = Field(default_factory=list)
    cached: bool = False
    retrieved_at: str
    warnings: list[str] = Field(default_factory=list)


class ScheduledItem(BaseModel):
    item_type: Literal["departure", "travel", "sightseeing", "meal", "rest", "overnight", "arrival"]
    name: str
    ref_id: Optional[str] = None
    start_time: str = Field(description="HH:MM local")
    end_time: str = Field(description="HH:MM local")
    duration_minutes: int = Field(ge=0)
    detour_km: Optional[float] = None
    verification_status: str = "verified"


class RoadTripDay(BaseModel):
    day: int = Field(ge=1)
    date: Optional[dt_date] = None
    title: Optional[str] = None
    overnight_place: Place
    driving_minutes: int = Field(ge=0)
    schedule: list[ScheduledItem]
    notes: list[str] = Field(default_factory=list)


class RoadTripPlanRequest(BaseModel):
    """POST /api/routes/plan body: the discovery context plus user selections."""

    discovery: RouteDiscoveryRequest
    selected_stop_ids: list[str] = Field(default_factory=list)
    selected_meal_ids: list[str] = Field(default_factory=list)
    total_budget_inr: Optional[int] = Field(default=None, ge=100, le=10_000_000)


class RoadTripPlanResponse(BaseModel):
    plan_id: str
    route: RouteInfo
    days: int = Field(ge=1)
    itinerary: list[RoadTripDay]
    selected_stops: list[DiscoveredStop]
    optional_stops: list[DiscoveredStop] = Field(description="Discovered but unselected — still available")
    meal_stops: list[MealStop] = Field(description="Meal stops included in the schedule")
    rejected_stops: list[ExcludedStop] = Field(description="Selected stops the feasibility planner could not fit")
    budget: BudgetBreakdown
    conflicts: list[str] = Field(
        default_factory=list, description="Time/feasibility conflicts with concrete options to resolve them"
    )
    warnings: list[str] = Field(default_factory=list)
    assumptions: list[str] = Field(default_factory=list)
    providers: list[str] = Field(default_factory=list)
    budget_fit: Optional[BudgetFit] = None
