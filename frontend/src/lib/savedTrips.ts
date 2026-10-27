import type { GenerateItineraryResponse, TripRequest } from "../api/types";

export interface SavedTrip {
  id: string;
  savedAt: string;
  title: string;
  plan: GenerateItineraryResponse;
  originalTrip?: TripRequest;
}

const STORAGE_KEY = "karnataka_saved_trips_v1";
const EVENT_NAME = "karnataka_saved_trips_updated";

export function getSavedTrips(): SavedTrip[] {
  if (typeof window === "undefined" || !window.localStorage) {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("Failed to read saved trips from localStorage", err);
    return [];
  }
}

export function saveTrip(
  plan: GenerateItineraryResponse,
  originalTrip?: TripRequest,
  customTitle?: string
): SavedTrip {
  const current = getSavedTrips();
  const title =
    customTitle ||
    plan.summary ||
    `${plan.budget.days}-Day Karnataka Journey (${plan.selected_destinations.map((d) => d.name).slice(0, 3).join(", ")})`;

  // Check if already saved with same plan_id
  const existingIndex = current.findIndex((t) => t.plan.plan_id === plan.plan_id);
  const newEntry: SavedTrip = {
    id: existingIndex >= 0 ? current[existingIndex].id : `saved_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    savedAt: new Date().toISOString(),
    title,
    plan,
    originalTrip,
  };

  let updated: SavedTrip[];
  if (existingIndex >= 0) {
    updated = [...current];
    updated[existingIndex] = newEntry;
  } else {
    updated = [newEntry, ...current];
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  } catch (err) {
    console.error("Failed to write saved trip to localStorage", err);
  }

  return newEntry;
}

export function removeSavedTrip(id: string): void {
  const current = getSavedTrips();
  const updated = current.filter((t) => t.id !== id && t.plan.plan_id !== id);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  } catch (err) {
    console.error("Failed to remove saved trip from localStorage", err);
  }
}

export function isTripSaved(planId: string): boolean {
  const current = getSavedTrips();
  return current.some((t) => t.plan.plan_id === planId || t.id === planId);
}

export function addSavedTripsListener(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => callback();
  window.addEventListener(EVENT_NAME, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(EVENT_NAME, handler);
    window.removeEventListener("storage", handler);
  };
}
