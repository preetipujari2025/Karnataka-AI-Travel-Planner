import { describe, expect, it, vi } from "vitest";
import jsPDF from "jspdf";
import { generateItineraryPDF } from "./pdfGenerator";
import type { GenerateItineraryResponse, TripRequest } from "../api/types";

// Mock doc.save to capture downloaded filename without triggering browser download
(jsPDF.prototype as any).save = vi.fn(function (this: jsPDF, _filename?: string) {
  return this;
});
if ((jsPDF as any).API) {
  (jsPDF as any).API.save = (jsPDF.prototype as any).save;
}

const mockShortPlan: GenerateItineraryResponse = {
  plan_id: "plan-short-1234",
  source: "fallback",
  summary: "A crisp 2-day heritage getaway from Bengaluru to Mysuru palaces and Chamundi Hill.",
  interests: ["heritage", "food"],
  selected_destinations: [
    {
      id: "bengaluru",
      name: "Bengaluru",
      region: "South Karnataka",
      lat: 12.9716,
      lng: 77.5946,
      categories: ["urban", "food"],
      description: "Garden city and cultural capital.",
      highlights: ["Lalbagh", "Bangalore Palace"],
    },
    {
      id: "mysuru",
      name: "Mysuru",
      region: "South Karnataka",
      lat: 12.2958,
      lng: 76.6394,
      categories: ["heritage", "food"],
      description: "City of palaces and silk.",
      highlights: ["Mysore Palace", "Chamundi Hill"],
    },
  ],
  route: [
    {
      day: 1,
      origin: {
        destination_id: "bengaluru",
        name: "Bengaluru",
        lat: 12.9716,
        lng: 77.5946,
        region: "South Karnataka",
      },
      destination: {
        destination_id: "mysuru",
        name: "Mysuru",
        lat: 12.2958,
        lng: 76.6394,
        region: "South Karnataka",
      },
      distance_km: 145,
      duration_hours: 3.2,
      transport: "road",
    },
  ],
  stays: [
    {
      destination_id: "bengaluru",
      name: "Bengaluru",
      first_day: 1,
      last_day: 1,
      days: 1,
    },
    {
      destination_id: "mysuru",
      name: "Mysuru",
      first_day: 2,
      last_day: 2,
      days: 1,
    },
  ],
  itinerary: [
    {
      day: 1,
      place: {
        destination_id: "bengaluru",
        name: "Bengaluru",
        lat: 12.9716,
        lng: 77.5946,
        region: "South Karnataka",
      },
      stay_day: 1,
      stay_days: 1,
      day_title: "Garden City & Silk Trail",
      narrative: "Morning departures with breakfast along Mysore Road.",
      activities: [
        {
          time: "08:00 AM",
          title: "Depart Bengaluru",
          description: "Highway transit via expressway.",
          destination_id: "bengaluru",
          kind: "travel",
        },
        {
          time: "11:30 AM",
          title: "Srirangapatna Fort Stop",
          description: "Historic island fortress of Tipu Sultan.",
          destination_id: "mysuru",
          kind: "sightseeing",
        },
      ],
      travel_tips: ["Carry light cottons and sun hats."],
    },
    {
      day: 2,
      place: {
        destination_id: "mysuru",
        name: "Mysuru",
        lat: 12.2958,
        lng: 76.6394,
        region: "South Karnataka",
      },
      stay_day: 1,
      stay_days: 1,
      day_title: "Royal Mysore Palace Exploration",
      narrative: "Magnificent Indo-Saracenic royal architecture.",
      activities: [
        {
          time: "09:30 AM",
          title: "Mysore Palace Royal Durbar",
          description: "Private residential museum and durbar halls.",
          destination_id: "mysuru",
          kind: "sightseeing",
        },
      ],
      travel_tips: ["Footwear must be deposited outside palace gates."],
    },
  ],
  budget: {
    currency: "INR",
    tier: "mid",
    days: 2,
    travellers: 2,
    stay_food_inr: 8000,
    transport_inr: 6500,
    activities_inr: 600,
    total_inr: 15100,
    per_person_total_inr: 7550,
    unknown_entry_fees: [],
    zero_entry_fees: ["Chamundi Hill Temple"],
    estimate_complete: true,
    excluded_costs_note: null,
  },
  warnings: [],
  practical_tips: ["State highway toll gates accept Fastag."],
};

const mockLongAIPlan: GenerateItineraryResponse = {
  plan_id: "plan-long-ai-987654",
  source: "ai",
  ai_provider: "gpt-4o-mini",
  summary:
    "An extensive 7-day archaeological and cultural expedition spanning central and northern Karnataka heritage capitals.",
  interests: ["heritage", "photography", "adventure"],
  selected_destinations: [
    {
      id: "bengaluru",
      name: "Bengaluru",
      region: "South Karnataka",
      lat: 12.9716,
      lng: 77.5946,
      categories: ["urban"],
      description: "Starting hub",
      highlights: ["Kempegowda Int'l"],
    },
    {
      id: "chitradurga",
      name: "Chitradurga",
      region: "Central Karnataka",
      lat: 14.2251,
      lng: 76.398,
      categories: ["heritage"],
      description: "Seven-walled fort",
      highlights: ["Chitradurga Fort"],
    },
    {
      id: "hampi",
      name: "Hampi",
      region: "Kalyana Karnataka",
      lat: 15.335,
      lng: 76.46,
      categories: ["heritage"],
      description: "UNESCO World Heritage Site",
      highlights: ["Virupaksha", "Stone Chariot"],
    },
    {
      id: "badami",
      name: "Badami",
      region: "Kittur Karnataka",
      lat: 15.9187,
      lng: 75.6766,
      categories: ["heritage"],
      description: "Chalukyan rock-cut caves",
      highlights: ["Cave Temples", "Agastya Lake"],
    },
  ],
  route: [
    {
      day: 1,
      origin: { destination_id: "bengaluru", name: "Bengaluru", lat: 12.97, lng: 77.59, region: "South" },
      destination: { destination_id: "chitradurga", name: "Chitradurga", lat: 14.22, lng: 76.39, region: "Central" },
      distance_km: 202,
      duration_hours: 4.0,
      transport: "road",
    },
    {
      day: 2,
      origin: { destination_id: "chitradurga", name: "Chitradurga", lat: 14.22, lng: 76.39, region: "Central" },
      destination: { destination_id: "hampi", name: "Hampi", lat: 15.33, lng: 76.46, region: "Kalyana" },
      distance_km: 148,
      duration_hours: 3.2,
      transport: "road",
    },
    {
      day: 5,
      origin: { destination_id: "hampi", name: "Hampi", lat: 15.33, lng: 76.46, region: "Kalyana" },
      destination: { destination_id: "badami", name: "Badami", lat: 15.91, lng: 75.67, region: "Kittur" },
      distance_km: 139,
      duration_hours: 3.1,
      transport: "road",
    },
  ],
  stays: [
    { destination_id: "chitradurga", name: "Chitradurga", first_day: 1, last_day: 1, days: 1 },
    { destination_id: "hampi", name: "Hampi", first_day: 2, last_day: 4, days: 3 },
    { destination_id: "badami", name: "Badami", first_day: 5, last_day: 7, days: 3 },
  ],
  itinerary: Array.from({ length: 7 }, (_, i) => ({
    day: i + 1,
    place: {
      destination_id: i < 2 ? "chitradurga" : i < 5 ? "hampi" : "badami",
      name: i < 2 ? "Chitradurga" : i < 5 ? "Hampi" : "Badami",
      lat: 15.0,
      lng: 76.0,
      region: "Karnataka",
    },
    stay_day: (i % 3) + 1,
    stay_days: 3,
    day_title: `Expedition Day ${i + 1}`,
    narrative: `Comprehensive exploratory journey across historical monuments and natural rock landscapes for Day ${i + 1}.`,
    activities: [
      {
        time: "09:00 AM",
        title: `Morning Sightseeing Site ${i + 1}`,
        description: `Detailed guided tour of archaeological remnants, temple complexes, and stone carvings.`,
        destination_id: "hampi",
        kind: "sightseeing",
      },
      {
        time: "01:00 PM",
        title: "Local Culinary Lunch",
        description: "Traditional North Karnataka Jolada Rotti meal.",
        destination_id: "hampi",
        kind: "food",
      },
      {
        time: "04:30 PM",
        title: "Sunset Viewpoint",
        description: "Panoramic dusk views across boulder hills.",
        destination_id: "hampi",
        kind: "leisure",
      },
    ],
    travel_tips: ["Hydrate frequently; afternoon heat can be intense."],
  })),
  budget: {
    currency: "INR",
    tier: "luxury",
    days: 7,
    travellers: 3,
    stay_food_inr: 58000,
    transport_inr: 29000,
    activities_inr: 2400,
    total_inr: 89400,
    per_person_total_inr: 29800,
    unknown_entry_fees: ["Chitradurga Outer Watchtower", "Agastya Gorge Boating"],
    zero_entry_fees: ["Hampi Hemakuta Hill"],
    estimate_complete: false,
    excluded_costs_note:
      "2 attraction entrance fees unverified in state gazetteer and excluded from total.",
  },
  warnings: ["High summer temperatures in Badami and Hampi between March and May."],
  practical_tips: [
    "Hire ASI certified guides with official photo ID badges.",
    "Carry cash as cellular connectivity can be intermittent around cave complexes.",
  ],
};

describe("generateItineraryPDF", () => {
  it("successfully generates PDF for short itinerary with default filename", async () => {
    const filename = await generateItineraryPDF(mockShortPlan);
    expect(filename).toBe("Karnataka-Trip-Itinerary-2Days-Bengaluru.pdf");
  });

  it("handles custom filename option cleanly", async () => {
    const customFilename = "Custom-Karnataka-Tour.pdf";
    const result = await generateItineraryPDF(mockShortPlan, undefined, {
      filename: customFilename,
    });
    expect(result).toBe(customFilename);
  });

  it("handles long multi-page itineraries spanning 7 days with AI provider badge and unknown fees disclaimer", async () => {
    const tripReq: TripRequest = {
      interests: ["heritage", "photography", "adventure"],
      days: 7,
      travellers: 3,
      budget_tier: "luxury",
      pace: "balanced",
      start_city: "Bengaluru",
      start_month: 11,
      planner: "ai",
      travel_dates: {
        start_date: "2026-11-10",
        end_date: "2026-11-16",
      },
      transport_preference: "private_cab",
    };

    const filename = await generateItineraryPDF(mockLongAIPlan, tripReq);
    expect(filename).toBe("Karnataka-Trip-Itinerary-7Days-Bengaluru.pdf");
  });

  it("never mutates or recalculates budget numbers from the backend", async () => {
    // Clone and verify budget remains untouched
    const originalTotal = mockShortPlan.budget.total_inr;
    const originalPerPerson = mockShortPlan.budget.per_person_total_inr;

    await generateItineraryPDF(mockShortPlan);

    expect(mockShortPlan.budget.total_inr).toBe(originalTotal);
    expect(mockShortPlan.budget.per_person_total_inr).toBe(originalPerPerson);
  });
});
