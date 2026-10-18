import { describe, expect, it } from "vitest";
import type {
  DiscoveredStop,
  MealStop,
  RouteDiscoveryResponse,
} from "../api/types";
import {
  defaultSelectedMealIds,
  defaultSelectedStopIds,
  groupMealsByDay,
  groupStopsByDay,
  verificationLabel,
} from "./roadtrip";

function stop(overrides: Partial<DiscoveredStop>): DiscoveredStop {
  return {
    candidate_id: overrides.candidate_id ?? "c1",
    ref_id: "r1",
    source_kind: "openstreetmap",
    name: "Test Fort",
    categories: ["heritage"],
    description: null,
    lat: 12,
    lng: 76,
    distance_from_route_km: 5,
    detour_km: 10,
    detour_minutes: 15,
    detour_measured: true,
    progress_fraction: 0.5,
    suggested_visit_minutes: 60,
    visit_duration_status: "estimated",
    entry_fee_inr: null,
    entry_fee_status: "unknown",
    opening_hours: null,
    opening_hours_status: "unknown",
    interests_matched: [],
    score: 50,
    reasons: [],
    recommended: false,
    default_selected: false,
    suggested_day: null,
    segment_label: null,
    verification_status: "estimated",
    source_urls: [],
    license: null,
    attribution: null,
    retrieved_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function meal(overrides: Partial<MealStop>): MealStop {
  return {
    meal_id: overrides.meal_id ?? "m1",
    meal: overrides.meal ?? "lunch",
    day: overrides.day ?? 1,
    name: "Test Dhaba",
    lat: 12,
    lng: 76,
    cuisine_tags: [],
    distance_from_route_km: 1,
    detour_km: 2,
    detour_minutes: 3,
    expected_arrival: null,
    opening_hours: null,
    opening_hours_status: "unknown",
    price_note: null,
    price_status: "unknown",
    dietary_tags: [],
    recommended: true,
    reason: "near midday waypoint",
    source_kind: "openstreetmap",
    verification_status: "verified",
    source_urls: [],
    license: null,
    attribution: null,
    retrieved_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function discovery(
  overrides: Partial<RouteDiscoveryResponse>
): RouteDiscoveryResponse {
  return {
    discovery_id: "d1",
    request: {} as RouteDiscoveryResponse["request"],
    route: {} as RouteDiscoveryResponse["route"],
    candidates: [],
    recommended: [],
    optional_stops: [],
    excluded: [],
    meal_stops: [],
    coverage_note: "",
    providers: [],
    cached: false,
    retrieved_at: "",
    warnings: [],
    ...overrides,
  };
}

describe("groupStopsByDay", () => {
  it("groups by suggested day and orders stops along the route", () => {
    const groups = groupStopsByDay([
      stop({ candidate_id: "late", suggested_day: 2, progress_fraction: 0.8 }),
      stop({ candidate_id: "early", suggested_day: 1, progress_fraction: 0.2 }),
      stop({ candidate_id: "middle", suggested_day: 1, progress_fraction: 0.45 }),
    ]);
    expect([...groups.keys()]).toEqual([1, 2]);
    expect(groups.get(1)!.map((s) => s.candidate_id)).toEqual(["early", "middle"]);
  });

  it("treats missing suggested_day as day 1", () => {
    const groups = groupStopsByDay([stop({ suggested_day: null })]);
    expect(groups.get(1)).toHaveLength(1);
  });
});

describe("groupMealsByDay", () => {
  it("orders meals breakfast → lunch → dinner within a day", () => {
    const groups = groupMealsByDay([
      meal({ meal_id: "d", meal: "dinner" }),
      meal({ meal_id: "b", meal: "breakfast" }),
      meal({ meal_id: "l", meal: "lunch" }),
      meal({ meal_id: "x", meal: "snack", day: 2 }),
    ]);
    expect(groups.get(1)!.map((m) => m.meal_id)).toEqual(["b", "l", "d"]);
    expect([...groups.keys()]).toEqual([1, 2]);
  });
});

describe("default selections", () => {
  it("picks only default_selected candidates", () => {
    const d = discovery({
      candidates: [
        stop({ candidate_id: "a", default_selected: true }),
        stop({ candidate_id: "b", default_selected: false }),
      ],
    });
    expect(defaultSelectedStopIds(d)).toEqual(["a"]);
  });

  it("keeps at most one recommended meal per day and slot", () => {
    const d = discovery({
      meal_stops: [
        meal({ meal_id: "l1", meal: "lunch", day: 1 }),
        meal({ meal_id: "l2", meal: "lunch", day: 1 }),
        meal({ meal_id: "d1", meal: "dinner", day: 1 }),
        meal({ meal_id: "n1", meal: "lunch", day: 2, recommended: false }),
      ],
    });
    expect(defaultSelectedMealIds(d).sort()).toEqual(["d1", "l1"]);
  });
});

describe("verificationLabel", () => {
  it("maps honesty markers to readable text", () => {
    expect(verificationLabel("verified")).toBe("verified");
    expect(verificationLabel("not_applicable")).toBe("not applicable");
  });
});
