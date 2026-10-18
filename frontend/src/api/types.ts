/**
 * TypeScript mirrors of the FastAPI Pydantic models (backend/app/schemas.py).
 * Keep these in sync when the backend contract changes.
 */

export type BudgetTier = "budget" | "mid" | "luxury";
export type Pace = "relaxed" | "balanced" | "packed";
export type PlannerMode = "auto" | "ai" | "fallback";

export type Interest =
  | "heritage"
  | "nature"
  | "beach"
  | "adventure"
  | "spirituality"
  | "wildlife"
  | "food"
  | "urban"
  | "photography"
  | "temples"
  | "waterfalls"
  | "viewpoints"
  | "shopping"
  | "culture";

export type TravellerType = "solo" | "couple" | "family" | "group" | "senior";
export type TripPriority = "balanced" | "min_cost" | "max_sightseeing" | "min_travel_time";
export type DietaryPreference =
  | "no_preference"
  | "vegetarian"
  | "vegan"
  | "jain"
  | "non_vegetarian";

/** Per-field honesty marker mirroring backend FieldVerification. */
export type FieldVerification = "verified" | "estimated" | "unknown" | "not_applicable";

export type ActivityKind =
  | "arrival"
  | "sightseeing"
  | "food"
  | "travel"
  | "leisure"
  | "departure";

export type ExperienceType =
  | "sightseeing"
  | "heritage_tour"
  | "wildlife_safari"
  | "trekking"
  | "beach"
  | "pilgrimage"
  | "boating"
  | "nature_walk"
  | "food_tour"
  | "photography";

export type DataConfidence = "verified" | "estimated" | "unverified";

export interface InterestMeta {
  value: Interest;
  label: string;
  description: string;
}

export interface DestinationSummary {
  id: string;
  name: string;
  region: string;
  /** null when no reliable source for coordinates yet */
  lat: number | null;
  lng: number | null;
  categories: string[];
  description: string;
  highlights: string[];
}

export interface NearbyDestination {
  destination: DestinationSummary;
  distance_km: number;
}

export interface MetaResponse {
  interests: InterestMeta[];
  budget_tiers: BudgetTier[];
  paces: Pace[];
  start_cities: DestinationSummary[];
  dataset_updated: string;
  example_pace_notes: Record<string, string>;
  experience_types: ExperienceType[];
}

export interface HealthResponse {
  status: "ok";
  service: string;
  version: string;
  environment: string;
  llm_configured: boolean;
  dataset_size: number;
}

export interface PlanRequest {
  interests: Interest[];
  days: number;
  travellers: number;
  budget_tier: BudgetTier;
  pace: Pace;
  start_city: string;
  start_month: number | null;
  planner: PlannerMode;
}

export interface Place {
  destination_id: string;
  name: string;
  lat: number;
  lng: number;
  region: string;
}

export interface DayActivity {
  time: string;
  title: string;
  description: string;
  destination_id: string;
  kind: ActivityKind;
}

export interface DayPlan {
  day: number;
  place: Place;
  /** 1-based day within this stop's stay (multi-day stays are explicit). */
  stay_day: number;
  /** Consecutive days spent at this stop (1 = single-day visit). */
  stay_days: number;
  day_title?: string | null;
  narrative?: string | null;
  activities: DayActivity[];
  travel_tips?: string[];
}

/** A contiguous multi-day stay — one entry per stop, never a duplicate. */
export interface StaySpan {
  destination_id: string;
  name: string;
  first_day: number;
  last_day: number;
  days: number;
}

export interface RouteLeg {
  day: number;
  origin: Place;
  destination: Place;
  distance_km: number;
  duration_hours: number;
  transport: "road";
}

export interface BudgetBreakdown {
  currency: "INR";
  tier: BudgetTier;
  days: number;
  travellers: number;
  stay_food_inr: number;
  transport_inr: number;
  /** Verified entry fees only — unknown fees are excluded, not counted as zero. */
  activities_inr: number;
  total_inr: number;
  per_person_total_inr: number;
  /** Stops whose entry fee is unverified and EXCLUDED from activities_inr. */
  unknown_entry_fees: string[];
  /** Stops with a confirmed free entry (rupees 0). */
  zero_entry_fees: string[];
  /** False when any selected stop has an unverified entry fee. */
  estimate_complete: boolean;
  /** Plain-text statement of what this estimate leaves out. */
  excluded_costs_note: string | null;
  /** Road-trip extensions (defaults keep classic plans unchanged). */
  detour_transport_inr?: number;
  meals_inr?: number;
  /** Minimum practical budget: same journey, no optional detours. */
  minimum_total_inr?: number | null;
  /** Names of stops whose stay/food cost is unknown and excluded (not zero). */
  unknown_daily_costs?: string[];
  assumptions?: string[];
}

export interface DestinationSuitability {
  destination_id: string;
  destination_name: string;
  explanation: string;
}

export interface SuggestedSubstitution {
  current_destination_id: string;
  current_destination_name: string;
  suggested_destination_id: string;
  suggested_destination_name: string;
  reason: string;
}

export interface PlanResponse {
  plan_id: string;
  source: "ai" | "fallback";
  summary: string;
  interests: Interest[];
  itinerary: DayPlan[];
  selected_destinations: DestinationSummary[];
  route: RouteLeg[];
  /** Explicit stay spans: one entry per stop, even across several days. */
  stays: StaySpan[];
  budget: BudgetBreakdown;
  warnings: string[];
  destination_explanations?: DestinationSuitability[];
  practical_tips?: string[];
  suggested_substitutions?: SuggestedSubstitution[];
  ai_provider?: string | null;
}

export type TransportPreference =
  | "any"
  | "public_transport"
  | "private_cab"
  | "self_drive"
  | "private_car";

export interface TravelDates {
  start_date: string;
  end_date: string;
}

export interface TripRequest extends PlanRequest {
  travel_dates?: TravelDates | null;
  total_budget_inr?: number | null;
  transport_preference?: TransportPreference;
  experience_types?: ExperienceType[];
  final_destination?: string | null;
  departure_time?: string;
  traveller_type?: TravellerType;
  trip_priority?: TripPriority;
  dietary_preference?: DietaryPreference;
  food_preferences?: string[];
  meal_budget_per_day_inr?: number | null;
  nights?: number | null;
}

export interface BudgetFit {
  total_budget_inr?: number | null;
  estimated_total_inr: number;
  within_budget?: boolean | null;
  variance_inr?: number | null;
}

export interface GenerateItineraryResponse extends PlanResponse {
  budget_fit?: BudgetFit;
}

export interface TripChanges {
  days?: number;
  interests?: Interest[];
  experience_types?: ExperienceType[];
  pace?: Pace;
  budget_tier?: BudgetTier;
  transport_preference?: TransportPreference;
  start_month?: number | null;
  total_budget_inr?: number | null;
  final_destination?: string | null;
  departure_time?: string;
  nights?: number | null;
  traveller_type?: TravellerType;
  food_preferences?: string[];
  meal_budget_per_day_inr?: number | null;
  trip_priority?: TripPriority;
}

export interface RegenerateItineraryRequest {
  previous_itinerary: PlanResponse;
  trip: TripRequest;
  changes?: TripChanges | null;
}

export interface RegenerateItineraryResponse extends GenerateItineraryResponse {
  regenerated_from: string;
}

// ---------------------------------------------------------------------------
// Road-trip: real routing, corridor discovery, optional stops, meals
// ---------------------------------------------------------------------------

export interface RouteAlternative {
  distance_km: number;
  duration_hours: number;
  geometry: number[][];
}

export interface RouteInfo {
  origin: Place;
  destination: Place;
  distance_km: number;
  duration_hours: number;
  /** Route polyline as [lat, lng] pairs; empty when unavailable. */
  geometry: number[][];
  /** "osrm" = live road network; "estimated" = labelled local estimate. */
  source: "osrm" | "estimated";
  verified: boolean;
  provider: string | null;
  alternatives: RouteAlternative[];
  retrieved_at: string;
}

export interface RouteDiscoveryRequest {
  start_city: string;
  final_destination: string;
  interests: Interest[];
  pace: Pace;
  budget_tier: BudgetTier;
  travellers: number;
  transport_preference: TransportPreference;
  days: number;
  nights?: number | null;
  total_budget_inr?: number | null;
  traveller_type?: TravellerType;
  trip_priority?: TripPriority;
  departure_date?: string | null;
  departure_time: string;
  corridor_radius_km: number;
  max_detour_km: number;
  allow_backtracking: boolean;
  include_meals: boolean;
  dietary_preference?: DietaryPreference;
  food_preferences?: string[];
  meal_budget_per_day_inr?: number | null;
  max_candidates: number;
  refresh: boolean;
}

export interface DiscoveredStop {
  candidate_id: string;
  ref_id: string;
  source_kind: "curated_destination" | "stored_attraction" | "openstreetmap";
  name: string;
  categories: string[];
  description: string | null;
  lat: number;
  lng: number;
  distance_from_route_km: number;
  detour_km: number;
  detour_minutes: number;
  /** True when the detour came from the road provider, not an estimate. */
  detour_measured: boolean;
  progress_fraction: number;
  suggested_visit_minutes: number | null;
  visit_duration_status: FieldVerification;
  entry_fee_inr: number | null;
  entry_fee_status: FieldVerification;
  opening_hours: string | null;
  opening_hours_status: FieldVerification;
  interests_matched: string[];
  score: number;
  reasons: string[];
  recommended: boolean;
  default_selected: boolean;
  suggested_day: number | null;
  segment_label: string | null;
  verification_status: string;
  source_urls: string[];
  license: string | null;
  attribution: string | null;
  retrieved_at: string;
}

export interface ExcludedStop extends DiscoveredStop {
  exclusion_reason: string;
}

export interface MealStop {
  meal_id: string;
  meal: "breakfast" | "lunch" | "snack" | "dinner";
  day: number;
  name: string;
  lat: number;
  lng: number;
  cuisine_tags: string[];
  distance_from_route_km: number;
  detour_km: number;
  detour_minutes: number;
  expected_arrival: string | null;
  opening_hours: string | null;
  opening_hours_status: FieldVerification;
  price_note: string | null;
  price_status: FieldVerification;
  dietary_tags: string[];
  recommended: boolean;
  reason: string;
  source_kind: "openstreetmap" | "curated_destination" | "verified_food_stop";
  verification_status: string;
  source_urls: string[];
  license: string | null;
  attribution: string | null;
  retrieved_at: string;
}

export interface RouteDiscoveryResponse {
  discovery_id: string;
  request: RouteDiscoveryRequest;
  route: RouteInfo;
  candidates: DiscoveredStop[];
  recommended: DiscoveredStop[];
  optional_stops: DiscoveredStop[];
  excluded: ExcludedStop[];
  meal_stops: MealStop[];
  coverage_note: string;
  providers: string[];
  cached: boolean;
  retrieved_at: string;
  warnings: string[];
}

export interface ScheduledItem {
  item_type: "departure" | "travel" | "sightseeing" | "meal" | "rest" | "overnight" | "arrival";
  name: string;
  ref_id: string | null;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  detour_km: number | null;
  verification_status: string;
}

export interface RoadTripDay {
  day: number;
  date: string | null;
  title: string | null;
  overnight_place: Place;
  driving_minutes: number;
  schedule: ScheduledItem[];
  notes: string[];
}

export interface RoadTripPlanRequest {
  discovery: RouteDiscoveryRequest;
  selected_stop_ids: string[];
  selected_meal_ids: string[];
  total_budget_inr?: number | null;
}

export interface RoadTripPlanResponse {
  plan_id: string;
  route: RouteInfo;
  days: number;
  itinerary: RoadTripDay[];
  selected_stops: DiscoveredStop[];
  optional_stops: DiscoveredStop[];
  meal_stops: MealStop[];
  rejected_stops: ExcludedStop[];
  budget: BudgetBreakdown;
  conflicts: string[];
  warnings: string[];
  assumptions: string[];
  providers: string[];
  budget_fit: BudgetFit | null;
}
