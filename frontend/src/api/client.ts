/**
 * Typed API client for the FastAPI backend.
 *
 * Base URL resolution:
 *  - VITE_API_BASE_URL set   -> calls that origin directly (backend CORS must allow it)
 *  - otherwise               -> same-origin paths, proxied by the Vite dev server
 */

import type {
  DestinationSummary,
  GenerateItineraryResponse,
  HealthResponse,
  MetaResponse,
  NearbyDestination,
  PlanRequest,
  PlanResponse,
  RegenerateItineraryRequest,
  RegenerateItineraryResponse,
  RoadTripPlanRequest,
  RoadTripPlanResponse,
  RouteDiscoveryRequest,
  RouteDiscoveryResponse,
  TripRequest,
} from "./types";

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const DEFAULT_TIMEOUT_MS = 25000;

async function request<T>(path: string, init?: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  if (init?.signal) {
    init.signal.addEventListener("abort", () => controller.abort());
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeoutId);
    if ((error as Error).name === "AbortError") {
      throw new ApiError(408, `Request timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw new ApiError(0, `Cannot reach the API: ${(error as Error).message}`);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const body = (await response.json()) as {
        detail?: unknown;
        error?: { code?: string; message?: string; details?: Array<{ field?: string; message?: string }> };
      };
      if (body.error?.message) {
        if (body.error.details && body.error.details.length > 0) {
          const detailMsgs = body.error.details
            .map((d) => (d.field ? `${d.field}: ${d.message}` : d.message))
            .filter(Boolean)
            .join("; ");
          detail = detailMsgs ? `${body.error.message} (${detailMsgs})` : body.error.message;
        } else {
          detail = body.error.message;
        }
      } else if (typeof body.detail === "string") {
        detail = body.detail;
      }
    } catch {
      // non-JSON error body; keep status text
    }
    throw new ApiError(response.status, detail);
  }
  return (await response.json()) as T;
}

export function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return request<HealthResponse>("/health", { signal });
}

export function fetchMeta(signal?: AbortSignal): Promise<MetaResponse> {
  return request<MetaResponse>("/api/v1/meta", { signal });
}

export function fetchDestinations(
  params?: { interest?: string; region?: string; q?: string; limit?: number },
  signal?: AbortSignal
): Promise<DestinationSummary[]> {
  const query = new URLSearchParams();
  if (params?.interest) query.set("interest", params.interest);
  if (params?.region) query.set("region", params.region);
  if (params?.q) query.set("q", params.q);
  if (params?.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return request<DestinationSummary[]>(`/api/v1/destinations${qs ? `?${qs}` : ""}`, { signal });
}

export function fetchNearbyDestinations(
  lat: number,
  lng: number,
  limit = 5,
  signal?: AbortSignal
): Promise<NearbyDestination[]> {
  return request<NearbyDestination[]>(`/api/v1/destinations/nearby?lat=${lat}&lng=${lng}&limit=${limit}`, { signal });
}

export function createPlan(body: PlanRequest, signal?: AbortSignal): Promise<PlanResponse> {
  return request<PlanResponse>("/api/v1/plans", {
    method: "POST",
    body: JSON.stringify(body),
    signal,
  });
}

export function generateItinerary(body: TripRequest, signal?: AbortSignal): Promise<GenerateItineraryResponse> {
  return request<GenerateItineraryResponse>("/api/itineraries/generate", {
    method: "POST",
    body: JSON.stringify(body),
    signal,
  });
}

export function regenerateItinerary(
  itineraryId: string,
  body: RegenerateItineraryRequest,
  signal?: AbortSignal
): Promise<RegenerateItineraryResponse> {
  return request<RegenerateItineraryResponse>(`/api/itineraries/${itineraryId}/regenerate`, {
    method: "POST",
    body: JSON.stringify(body),
    signal,
  });
}

/** Discover attractions + food stops along the real road corridor. */
export function discoverRoute(
  body: RouteDiscoveryRequest,
  signal?: AbortSignal
): Promise<RouteDiscoveryResponse> {
  return request<RouteDiscoveryResponse>("/api/routes/discover", {
    method: "POST",
    body: JSON.stringify(body),
    signal,
  });
}

/** Build the feasible multi-day plan for the selected stops and meals. */
export function planRoadTrip(
  body: RoadTripPlanRequest,
  signal?: AbortSignal
): Promise<RoadTripPlanResponse> {
  return request<RoadTripPlanResponse>("/api/routes/plan", {
    method: "POST",
    body: JSON.stringify(body),
    signal,
  });
}

