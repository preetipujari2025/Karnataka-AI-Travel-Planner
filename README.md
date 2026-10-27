# Karnataka AI Travel Planner & Road-Trip Navigator

A production-ready, full-stack travel planner and road-trip engine for Karnataka, India. Built to generate personalized, constraint-aware itineraries based on a traveller's **interests, available time, real budget, group size, pace, dietary preferences, and travel style**.

Combines a **deterministic geographic optimization engine**, **SQLite database covering all 31 Karnataka districts**, **live road-corridor routing (OSRM + Overpass)**, and **optional LLM narrative personalization (Google Gemini / OpenAI)** with automatic smart fallbacks.

---

## Table of Contents

1. [Project Overview & Problem Statement](#project-overview--problem-statement)
2. [Implemented Features](#implemented-features)
3. [Architecture & Technology Stack](#architecture--technology-stack)
4. [Database & Tourism Data Coverage](#database--tourism-data-coverage)
5. [API Endpoints](#api-endpoints)
6. [Windows Setup & Run Instructions](#windows-setup--run-instructions)
7. [Environment Variables & Configuration](#environment-variables--configuration)
8. [Testing & Quality Verification](#testing--quality-verification)
9. [Test Counts & Results](#test-counts--results)
10. [External Providers, Data Provenance & Limitations](#external-providers-data-provenance--limitations)

---

## Project Overview & Problem Statement

### The Problem
Generic AI travel tools often hallucinate non-existent attractions, propose geographically impossible travel days (e.g. driving across the Western Ghats in two hours), omit realistic meal and rest stops, and pad budget figures to arbitrarily match whatever number the user entered.

### The Solution
Karnataka AI Travel Planner solves this with a multi-layered approach:
- **Math & Geography First**: Route feasibility, driving durations, stay spans, and cost calculations are handled by deterministic Python modules before the LLM is ever called.
- **Honest Budget Calculation**: Accommodation, food, fuel/transit, entry fees, and incidental buffers are calculated from verified local rates. Costs are never artificially padded to match the budget.
- **District-Wide Coverage**: Backed by a curated database spanning all 31 Karnataka revenue districts, featuring authentic local dishes, best-time advice, and practical tips.
- **Live Road-Trip Corridor Discovery**: Dynamically traces road routes between any Karnataka towns, identifies candidate detour stops within a configurable corridor buffer (15–25 km), ranks detour options, and pinpoints verified highway meal stops.
- **Graceful Fallbacks**: If the AI provider is unconfigured, rate-limited, or unavailable, the system transparently serves a complete, high-quality deterministic itinerary without crashing.

---

## Implemented Features

### 1. Personalized Trip Planner (`/plan`)
- **Multi-Day Itinerary Generation**: Day-by-day scheduling for trips from 1 to 21 days with custom pace models (`relaxed`, `balanced`, `packed`).
- **Destination Scoring & Selection**: Multi-factor scoring prioritizing traveller interests (Heritage, Nature, Coffee & Hills, Wildlife, Beaches, Spirituality, Food, Adventure, Urban, Photography).
- **Multi-Day Stay Spans (`StaySpan`)**: Consecutive days in a destination are modeled as a single stay rather than duplicate selections.
- **Proximity-Based Catalog Substitutions**: Suggests alternative destinations within ~150 km matching the traveller's interests (e.g. Dandeli, Yana, or Murudeshwar for Gokarna—never statewide jumps like Bengaluru or Mysuru).
- **Curated Regional Gastronomy**: Every day recommends authentic regional cuisine (e.g. Belagavi Kunda and Jolada Rotti, Kumta Karavali thali with Neer Dosa, Madikeri Pandi curry, or Davanagere Benne Dosa).
- **Highway Lunch Stops**: Automatic 12:30 PM meal stops on intercity travel days.
- **Context-Sensitive Tips**: Dress codes and temple etiquette appear only when visiting spiritual monuments.

### 2. Road-Trip Corridor Discovery & Planning (`/roadtrip`)
- **Dynamic Route Discovery (`POST /api/routes/discover`)**: Traces real road routes between any pair of Karnataka hubs using OSRM geometry.
- **Corridor Candidate Detours**: Identifies attractions and towns along the highway corridor within a 15–25 km buffer.
- **Detour Scoring & Ranking**: Evaluates deviation distance, additional driving time, and thematic relevance to recommend viable stops.
- **Interactive Detour Selection**: Travellers can inspect detour details, view photos/highlights, and toggle optional stops on/off before generating their plan.
- **Highway Meal Discovery**: Discovers restaurants, dhabas, and vegetarian thali spots along highway corridors using Overpass POI data with verified fallback stops.
- **Multi-Day Road Trip Planning (`POST /api/routes/plan`)**: Generates an end-to-end driving schedule with morning/afternoon/evening slots, driving legs, and automatic overnight stay allocation when daily driving exceeds safe limits (5–6 hours/day).

### 3. Transparent Budgeting Engine
- **Honest 5-Way Split**:
  $$\text{Total} = \text{Stay} + \text{Food} + \text{Transport} + \text{Entry Fees} + \text{Incidental Extra}$$
- **Zero Padding**: Total cost is always the authentic sum of its components and is never copied or reverse-engineered from the user's budget input.
- **Verified Entry Fees**: Distinguishes verified fees from unverified fees (`unknown_entry_fees`), which are excluded from the total rather than falsely counted as ₹0.
- **Dynamic Tier Adaptation**: Adapts tier selection based on daily budget per person (e.g. ₹10,000 budget selects Budget tier with public transit; ₹25,000 selects Mid-Range; ₹60,000 selects Luxury with private cab).

### 4. Interactive Maps & Visuals
- **Leaflet & OpenStreetMap**: Interactive map with route polylines, start/end markers, overnight stay pins, and candidate detour waypoints.
- **Accurate Photo Matching**: Only destinations with dedicated, verified photography display their own images; all other destinations use a high-resolution neutral Karnataka landscape to prevent displaying incorrect named locations.

### 5. PDF Export & Offline Saved Trips
- **PDF Generation**: Generates clean, downloadable, printable travel itineraries with day-by-day schedules, route summaries, and cost breakdowns via `jsPDF` and `html2canvas`.
- **Saved Trips (`/saved`)**: Client-side trip bookmarking using `localStorage` for offline review.

---

## Architecture & Technology Stack

```
                          ┌───────────────────────────────────┐
                          │   React 19 + Vite Frontend        │
                          │   (TypeScript, Tailwind CSS v4)   │
                          └─────────────────┬─────────────────┘
                                            │ HTTP / JSON
                                            ▼
                          ┌───────────────────────────────────┐
                          │   FastAPI Backend (Python 3.13)   │
                          │   (Pydantic v2 validation)        │
                          └─────────────────┬─────────────────┘
                                            │
         ┌────────────────────────┬─────────┴──────────────┬────────────────────────┐
         ▼                        ▼                        ▼                        ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│ SQLite Database  │    │ Routing & Places │    │ AI Engine        │    │ Pure Fallback    │
│ karnataka_       │    │ OSRM / Overpass  │    │ Gemini 2.0 Flash │    │ Planner &        │
│ tourism.db       │    │ & Local Geo Calc │    │ / OpenAI / Mock  │    │ Budget Engine    │
│ (31 districts)   │    │ (Haversine km)   │    │ (AIPersonalize)  │    │ (Deterministic)  │
└──────────────────┘    └──────────────────┘    └──────────────────┘    └──────────────────┘
```

| Component | Technology | Role |
|---|---|---|
| **Frontend Framework** | React 19, TypeScript, Vite 7 | Fast single-page application with type safety |
| **Styling** | Tailwind CSS v4, Lucide React icons | Responsive UI with clean cards and itinerary views |
| **Mapping** | Leaflet 1.9, React-Leaflet, OpenStreetMap | Interactive corridor, waypoint, and route rendering |
| **Document Export** | jsPDF 4.2, html2canvas | Client-side itinerary PDF compilation and download |
| **Backend Framework** | Python 3.10+ (tested on 3.13), FastAPI | High-performance async/threaded API server |
| **Data Validation** | Pydantic v2, `pydantic-settings` | Strict schema validation and error reporting |
| **Database** | SQLite 3 (`karnataka_tourism.db`) | 31 districts, 67 destinations, 32 attractions, route cache |
| **AI Personalization**| Google Gemini (`gemini-2.0-flash`), OpenAI, or `mock` | Structured narrative generation and activity details |
| **Road Routing** | OSRM (`router.project-osrm.org`) + Haversine fallback | Driving distance, duration, and road corridor geometry |
| **POI Discovery** | Overpass API (`overpass-api.de`) + Curated stops | Candidate stops and highway restaurant discovery |

---

## Database & Tourism Data Coverage

The application is backed by a local SQLite database located at `backend/app/data/karnataka_tourism.db` (seeded and managed via `backend/app/data/store.py` and `backend/app/ingest/pipeline.py`).

### Current Database Inventory

| Table | Row Count | Description |
|---|---|---|
| `districts` | **31** | Complete administrative coverage of all 31 Karnataka revenue districts |
| `destinations` | **67** | Curated 38 benchmark tourist hubs + expanded district travel centers |
| `attractions` | **32** | Verified point-of-interest entries linked to districts and categories |
| `route_cache` | **23+** | Cached OSRM highway corridor polylines and durations for fast lookup |
| `ingestion_logs` | **3** | Audit log tracking dataset seeding and pipeline updates |

### Curated Benchmark Dataset (38 Core Destinations)
Every curated benchmark destination includes verified coordinates, administrative revenue division, verified entry fees (or explicitly marked unknown), typical and minimum stay nights, seasonal visit recommendations, and:
- **`local_dish`**: Specific authentic cuisine unique to that destination.
- **`best_time_tip`**: Seasonal and time-of-day advice.
- **`practical_tip`**: Unique local advice (dress code, parking, footwear, trail gear).

---

## API Endpoints

All error responses use the standard envelope: `{"error": {"code": "...", "message": "...", "details": [...]}}`.

### System & Metadata
| Method | Path | Summary | Description |
|---|---|---|---|
| `GET` | `/api/health` | Health check | Returns status, version, dataset size (38), district count (31), attraction count, and LLM configuration status |
| `GET` | `/health` | Legacy health check | Backward-compatible alias for monitoring services |
| `GET` | `/api/meta` | Form metadata | Returns supported interests, budget tiers, paces, experience types, and all 31 starting hubs |

### Catalog & Explorer
| Method | Path | Summary | Description |
|---|---|---|---|
| `GET` | `/api/destinations` | List destinations | Paginated destination catalogue. Supports filtering by `interest`, `region`, `experience`, `category`, and `q`/`search` |
| `GET` | `/api/destinations/{id}` | Destination detail | Full destination record, verified entry fees, tips, and coordinates |
| `GET` | `/api/destinations/nearby`| Nearby destinations | Finds destinations within a radius (`max_km`) of given `lat`/`lng` coordinates |
| `GET` | `/api/districts` | District coverage | Returns all 31 districts with destination counts and coverage status |
| `GET` | `/api/attractions` | List attractions | Discovered and verified attractions, filterable by `district_id` |
| `GET` | `/api/map/markers` | Map markers | All destination and attraction markers with OpenStreetMap attribution |

### Itinerary Planning
| Method | Path | Summary | Description |
|---|---|---|---|
| `POST` | `/api/itineraries/generate` | Generate itinerary | Creates a personalized multi-day itinerary with stay spans and budget fit |
| `POST` | `/api/itineraries/{id}/regenerate` | Stateless regenerate | Revises a previous itinerary with modified constraints (re-rolls activities) |
| `POST` | `/api/v1/plans` | Legacy plan endpoint | Preserved for existing automated tests and legacy callers |

### Road-Trip Discovery & Planning
| Method | Path | Summary | Description |
|---|---|---|---|
| `POST` | `/api/routes/discover` | Corridor discovery | Traces road route between origin & destination, returns corridor polyline, candidate detour stops, and meal options |
| `POST` | `/api/routes/plan` | Road-trip planner | Schedules selected candidate stops into a feasible multi-day road trip with driving times and overnight stays |

---

## Windows Setup & Run Instructions

### Prerequisites
- **Python**: 3.10+ (tested on Python 3.13)
- **Node.js**: 20.19+ or 22+ with `npm`
- **PowerShell**: Windows PowerShell 5.1 or PowerShell 7+

### Option A: Quickstart (Single Command for Full Stack) — Recommended

Start both the FastAPI backend (`http://localhost:8000`) and Vite frontend (`http://localhost:5173`) concurrently:

```powershell
# From the repository root:
npm run dev

# Or using the PowerShell launch script:
.\start-all.ps1

# Or on CMD / double-click:
.\start-all.bat
```

Both servers run concurrently with color-coded logs (`[backend]` and `[frontend]`). Press `CTRL+C` to stop both.

---

### Option B: Separate PowerShell Terminals

#### Terminal 1: Backend Setup & Run

```powershell
cd backend

# Create virtual environment
python -m venv .venv

# Activate virtual environment
.\.venv\Scripts\Activate.ps1

# Upgrade pip and install dependencies
python -m pip install --upgrade pip
pip install -r requirements-dev.txt

# Create .env from template if not present
if (-not (Test-Path .env)) { Copy-Item .env.example .env }

# Run FastAPI backend with auto-reload
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
- API Docs: `http://localhost:8000/docs`
- Health Endpoint: `http://localhost:8000/api/health`

#### Terminal 2: Frontend Setup & Run

```powershell
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```
- Web Application: `http://localhost:5173/`

---

## Environment Variables & Configuration

Configuration is loaded via Pydantic Settings in `backend/app/config.py`, checking `backend/.env`, root `.env`, and local environment variables.

### Backend Environment Variables (`backend/.env`)

| Variable | Type | Default | Description |
|---|---|---|---|
| `CORS_ORIGINS` | string | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated allowed frontend origins |
| `AI_PROVIDER` | string | `gemini` | Configurable AI provider: `gemini` (default), `openai`, or `mock` |
| `AI_API_KEY` | string | `""` | Gemini or OpenAI API key. **Leave empty to use deterministic Smart planner** |
| `AI_BASE_URL` | string | `https://generativelanguage.googleapis.com/v1beta/openai` | Base URL for the OpenAI-compatible completions endpoint |
| `AI_MODEL` | string | `gemini-2.0-flash` | Model identifier (e.g. `gemini-2.0-flash`, `gemini-1.5-flash`, `gpt-4o-mini`) |
| `AI_TIMEOUT_SECONDS` | float | `20.0` | Maximum wait time for LLM generation before falling back |
| `ROUTING_ENABLED` | bool | `true` | When `true`, enables live OSRM/Overpass lookups; `false` uses deterministic haversine |
| `OSRM_BASE_URL` | string | `https://router.project-osrm.org` | Road-routing server endpoint |
| `OVERPASS_BASE_URL` | string | `https://overpass-api.de/api/interpreter` | Overpass API server for highway POI/dining discovery |

> **Offline & Zero-Key Testing**:
> - Setting `AI_PROVIDER=mock` enables testing the complete AI personalization pipeline locally without an API key or network access.
> - Setting `AI_API_KEY=""` runs the deterministic Smart planner with complete destination-specific content.

### Frontend Environment Variables (`frontend/.env`)

| Variable | Type | Default | Description |
|---|---|---|---|
| `VITE_API_BASE_URL` | string | `""` (empty) | Backend base URL. Leave empty to use Vite's dev-server proxy (`/api -> :8000`) |

---

## Testing & Quality Verification

Run all test suites and quality gates from your terminal:

```powershell
# Run all backend and frontend tests from root:
npm run test:all

# Run backend tests only:
npm run test:backend

# Run frontend tests only:
npm run test

# Run frontend TypeScript type checking:
npm run typecheck

# Run frontend production build:
npm run build
```

---

## Test Counts & Results

All automated test suites pass with **100% success rate**.

### Backend Pytest Suite: 276 Tests Passed

```text
platform win32 -- Python 3.13.12, pytest-8.4.2
=========================== 276 passed in 48.19s ===========================
```

#### Test Suite Breakdown

| Test File | Test Count | Focus Area |
|---|---|---|
| `test_ai_service.py` | 53 | AI providers, token limits, rate-limit retries, error sanitization, mock provider |
| `test_roadtrip.py` | 22 | Corridor projection, candidate detour ranking, meal discovery, driving pace |
| `test_itinerary_consistency.py` | 25 | Invariant checks, stay span continuity, leg agreement, fee transparency |
| `test_destination_service.py` | 20 | Filter queries, spatial search, nearby coordinates, category filtering |
| `test_destination_data.py` | 18 | Data loader schema validation, coordinate bounds, duplicate detection |
| `test_itineraries_api.py` | 16 | Stateless generation, constraints, regeneration, bad budget detection |
| `test_roadtrip_crashproof.py` | 15 | Live and edge-case route pairs, OSM failure degradation, missing inputs |
| `test_four_inputs.py` | 14 | Proves interests, days, budget, and travel style dynamically change plans |
| `test_ingest_and_store.py` | 13 | SQLite database seeding, upsert idempotency, 31-district coverage |
| `test_itinerary_quality.py` | 12 | Pacing advice, multi-day stay coherence, budget floors, seasonal fit |
| `test_api_endpoints.py` | 12 | REST endpoint responses, pagination, error envelope compliance |
| `test_services.py` | 9 | Haversine distance, transport cost floors, nearest-neighbor ordering |
| `test_planning.py` | 8 | Orchestration, fallback behavior when AI fails, forced AI 503 error |
| `test_destinations.py` | 7 | Destination listing, search query parameter aliases (`q` and `search`) |
| `test_district_starting_locations.py` | 7 | Resolving all 31 district headquarters as valid itinerary origin hubs |
| `test_health.py` | 3 | Health check response fields, dataset size, Swagger docs availability |
| **Total** | **276** | **All 276 passed** |

### Frontend Vitest Suite: 21 Tests Passed

```text
RUN v3.2.7 frontend
 ✓ src/lib/destinationAssets.test.ts (3 tests)
 ✓ src/lib/roadtrip.test.ts (6 tests)
 ✓ src/lib/format.test.ts (8 tests)
 ✓ src/lib/pdfGenerator.test.ts (4 tests)

Test Files  4 passed (4)
Tests       21 passed (21)
```

### TypeScript Typecheck & Production Build
- **Typecheck (`tsc --noEmit`)**: **0 errors**.
- **Production Build (`vite build`)**: **Clean build in 56.80s** with optimized chunks for Leaflet, html2canvas, and jsPDF.

### Mocked vs Live Verification Distinction
- **Automated Test Suites (Pytest & Vitest)**: Run with network mocks and disabled external network requests (`conftest.py`) to ensure deterministic, fast, offline test runs.
- **Live Provider Verification**: Real Gemini calls can be made at runtime by supplying `AI_API_KEY` in `backend/.env`. Dedicated live verification script:
  ```powershell
  & "backend/.venv/Scripts/python.exe" backend/scripts/test_ai_generation.py
  ```

---

## External Providers, Data Provenance & Limitations

### 1. External Provider Limitations
- **OSRM Public Demo Server (`router.project-osrm.org`)**: Subject to rate limits and occasional latency. When slow, unreachable, or when `ROUTING_ENABLED=false`, the system automatically falls back to deterministic great-circle Haversine calculations scaled by a road curvature factor (1.30) and an intercity speed model (45–55 km/h).
- **Overpass API (`overpass-api.de`)**: Public OpenStreetMap querying service. If Overpass requests time out, the system automatically falls back to verified catalog stops and local dining recommendations.
- **LLM APIs (Google Gemini / OpenAI)**: Subject to API quotas and latency. If an LLM call fails or times out, the planner transparently switches to the deterministic Smart planner.

### 2. Data Provenance & Attribution
- **OpenStreetMap Data**: Route geometry, candidate waypoints, and highway amenities © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright) (ODbL).
- **Department of Tourism, Government of Karnataka**: Curated destination descriptions, monument details, and heritage site information ([karnatakatourism.org](https://karnatakatourism.org)).
- **National Informatics Centre (NIC)**: District administrative boundaries, headquarters coordinates, and official portals ([karnataka.gov.in](https://karnataka.gov.in)).

### 3. Known Limitations
- **Stateless Architecture**: Itinerary persistence is client-side (`localStorage`); the backend does not store user accounts or historical itineraries in a server database.
- **Public OSRM Demo**: For high-volume production deployments, self-hosting an OSRM instance or using an enterprise routing service is recommended.
