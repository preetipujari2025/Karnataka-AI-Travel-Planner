/**
 * Pure display helpers for the road-trip planner — dependency free so they
 * are easy to unit test.
 */

import type {
  DestinationSummary,
  DiscoveredStop,
  FieldVerification,
  MealStop,
  RoadTripPlanResponse,
  RouteDiscoveryResponse,
} from "../api/types";

/** Groups candidate stops by their suggested day, keeping score order within a day. */
export function groupStopsByDay(stops: DiscoveredStop[]): Map<number, DiscoveredStop[]> {
  const groups = new Map<number, DiscoveredStop[]>();
  for (const stop of stops) {
    const day = stop.suggested_day ?? 1;
    const bucket = groups.get(day) ?? [];
    bucket.push(stop);
    groups.set(day, bucket);
  }
  for (const [, list] of groups) {
    list.sort((a, b) => a.progress_fraction - b.progress_fraction);
  }
  return new Map([...groups.entries()].sort((a, b) => a[0] - b[0]));
}

/** Groups meal stops by day then returns them in meal order of the eating window. */
export function groupMealsByDay(meals: MealStop[]): Map<number, MealStop[]> {
  const order = ["breakfast", "snack", "lunch", "dinner"];
  const groups = new Map<number, MealStop[]>();
  for (const meal of meals) {
    const bucket = groups.get(meal.day) ?? [];
    bucket.push(meal);
    groups.set(meal.day, bucket);
  }
  for (const [, list] of groups) {
    list.sort((a, b) => order.indexOf(a.meal) - order.indexOf(b.meal));
  }
  return new Map([...groups.entries()].sort((a, b) => a[0] - b[0]));
}

/** Human label for the per-field honesty markers. */
export function verificationLabel(status: FieldVerification): string {
  switch (status) {
    case "verified":
      return "verified";
    case "estimated":
      return "estimated";
    case "unknown":
      return "unknown";
    case "not_applicable":
      return "not applicable";
  }
}

/** Default stop selection from a discovery response — respects provider recommendations. */
export function defaultSelectedStopIds(discovery: RouteDiscoveryResponse): string[] {
  return discovery.candidates.filter((c) => c.default_selected).map((c) => c.candidate_id);
}

/** Default meal selection: one recommended stop per day/slot when available. */
export function defaultSelectedMealIds(discovery: RouteDiscoveryResponse): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const meal of discovery.meal_stops) {
    if (meal.recommended && !seen.has(`${meal.day}:${meal.meal}`)) {
      seen.add(`${meal.day}:${meal.meal}`);
      ids.push(meal.meal_id);
    }
  }
  return ids;
}

/** Converts a planned road trip into map-friendly stop summaries. */
export function buildMapStops(plan: RoadTripPlanResponse): DestinationSummary[] {
  const stops: DestinationSummary[] = [
    {
      id: plan.route.origin.destination_id,
      name: plan.route.origin.name,
      region: plan.route.origin.region || "Origin",
      lat: plan.route.origin.lat,
      lng: plan.route.origin.lng,
      categories: ["start"],
      description: "Trip origin",
      highlights: [],
    },
  ];
  for (const stop of plan.selected_stops) {
    stops.push({
      id: stop.candidate_id,
      name: stop.name,
      region: stop.segment_label || stop.categories[0] || "En-route stop",
      lat: stop.lat,
      lng: stop.lng,
      categories: stop.categories,
      description: stop.description ?? "",
      highlights: stop.reasons.slice(0, 3),
    });
  }
  for (const meal of plan.meal_stops) {
    stops.push({
      id: meal.meal_id,
      name: meal.name,
      region: `${meal.meal} · Day ${meal.day}`,
      lat: meal.lat,
      lng: meal.lng,
      categories: ["food"],
      description: meal.reason,
      highlights: meal.cuisine_tags,
    });
  }
  stops.push({
    id: plan.route.destination.destination_id,
    name: plan.route.destination.name,
    region: plan.route.destination.region || "Destination",
    lat: plan.route.destination.lat,
    lng: plan.route.destination.lng,
    categories: ["end"],
    description: "Trip final destination",
    highlights: [],
  });
  return stops;
}
