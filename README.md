# AI Travel Planner for Karnataka

Personalised, AI-assisted travel itineraries for Karnataka, built around a traveller's
**interests, available time, budget and preferred type of experience**.

> Status: **foundation complete** — working FastAPI backend, React frontend, curated
> dataset, deterministic fallback planner, AI integration (env-configured), health check
> and smoke tests. Visual design intentionally deferred (UI is functional and neutral so
> it can be adapted to your design pass later).

## Tech stack

| Layer      | Tech |
|------------|------|
| Frontend   | React, Vite, TypeScript, Tailwind CSS v4, Leaflet + OpenStreetMap |
| Backend    | Python, FastAPI, Pydantic v2 |
| AI         | Any OpenAI-compatible LLM API, configured via environment variables |
| Data       | Curated JSON dataset of 38 Karnataka destinations with source attribution (no DB needed) |
| Testing    | Pytest (backend), Vitest (frontend) |
| Storage    | None for now — SQLite only if persistence becomes a real requirement |

## Repository layout

```
.
├── README.md
├── .gitignore
├── .env.example                # root template (both apps)
├── backend/
│   ├── .env.example            # backend-only template
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   ├── pytest.ini
│   ├── app/
│   │   ├── main.py             # FastAPI app factory + CORS
│   │   ├── config.py           # settings from environment
│   │   ├── schemas.py          # typed request/response models
│   │   ├── api/                # endpoints (health, destinations, plans)
│   │   ├── data/               # curated dataset + integrity-checking loader
│   │   ├── scripts/            # validate_dataset.py (CLI data-quality report)
│   │   ├── docs/DATA_SOURCES.md# dataset provenance & confidence definitions
│   │   └── services/
│   │       ├── destination_service.py # validate/filter/search/nearby/map-ready
│   │       ├── recommendation.py   # scoring & destination selection
│   │       ├── routing.py          # distance, travel time, stop order
│   │       ├── budget.py           # cost calculation
│   │       ├── fallback_planner.py # deterministic planner (always works)
│   │       ├── ai_service.py       # dedicated AI service (providers, validation, errors)
│   │       ├── ai_planner.py       # LLM integration + validation orchestration
│   │       └── planner.py          # orchestrator (AI -> fallback)
│   └── tests/                  # pytest smoke + unit tests
└── frontend/
    ├── package.json
    ├── vite.config.ts          # dev proxy /api -> :8000 + vitest config
    └── src/
        ├── api/                # typed API client + TS types (mirror of schemas)
        ├── components/         # form, itinerary, budget, map, health badge
        └── lib/                # pure helpers (unit tested)
```

Each concern lives in its own module — destination data, recommendation logic,
budget calculation, routing, AI integration and API endpoints are separate files.

## Prerequisites

- Python 3.10+ (tested on 3.13)
- Node.js 20.19+ / 22+ with npm
- An AI provider API key is **optional**: without it or when `AI_PROVIDER=mock`, the system works seamlessly.

## Environment configuration

Templates (never commit real secrets):

- [`.env.example`](.env.example) — root overview
- [`backend/.env.example`](backend/.env.example) — CORS origins + AI provider settings
- [`frontend/.env.example`](frontend/.env.example) — `VITE_API_BASE_URL` (optional)

Key variables:

| Variable | App | Purpose | Default |
|---|---|---|---|
| `CORS_ORIGINS` | backend | Allowed frontend origins | `http://localhost:5173,...` |
| `AI_PROVIDER` / `LLM_PROVIDER` | backend | Configurable AI provider (`openai`, `gemini`, or `mock`) | `openai` |
| `AI_API_KEY` / `LLM_API_KEY` | backend | Provider API key. **Empty = deterministic fallback** | empty |
| `AI_BASE_URL` / `LLM_BASE_URL` | backend | Provider base URL | `https://api.openai.com/v1` |
| `AI_MODEL` / `LLM_MODEL` | backend | Model name (e.g. `gpt-4o-mini`, `gemini-1.5-flash`) | `gpt-4o-mini` |
| `AI_TIMEOUT_SECONDS` / `LLM_TIMEOUT_SECONDS` | backend | Provider request timeout in seconds | `30` |
| `VITE_API_BASE_URL` | frontend | Backend URL (leave empty to use dev proxy) | empty |

> **Note on offline testing**: Setting `AI_PROVIDER=mock` allows running and testing the entire AI itinerary personalization pipeline locally without an API key or network access!

## Running locally

### 1. Backend (FastAPI) — terminal 1

Windows (PowerShell/CMD):

```bash
cd backend
py -3.13 -m venv .venv          # or: python -m venv .venv
.venv\Scripts\activate
pip install -r requirements-dev.txt
copy .env.example .env          # then add your LLM_API_KEY if you have one
uvicorn app.main:app --reload --port 8000
```

macOS / Linux:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

- Health check: http://localhost:8000/health
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 2. Frontend (Vite) — terminal 2

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The dev server proxies `/api` and `/health` to the backend
on `:8000` (CORS is also configured on the backend for direct calls).

## Tests & checks

```bash
# Backend (110 tests)
cd backend
.venv/Scripts/python -m pytest        # Windows — or: python -m pytest (activated venv)
.venv/Scripts/python scripts/validate_dataset.py   # dataset data-quality report

# Frontend (typecheck + 8 unit tests + production build)
cd frontend
npm run typecheck
npm test
npm run build
```

## API overview

Canonical routes (all errors use the envelope `{"error": {"code", "message", "details"?}}`):

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Status, version, environment, LLM configured, dataset size |
| GET | `/api/destinations` | Filters: `q`/`search`, `region`, `category`, `interest`, `experience`, `map_only`; pagination: `limit` (1-100, default 50), `offset` |
| GET | `/api/destinations/{id}` | Full dataset record, or 404 with the error envelope |
| POST | `/api/itineraries/generate` | Trip request → complete personalised itinerary + `budget_fit` |
| POST | `/api/itineraries/{id}/regenerate` | Stateless revise/re-roll: body carries the previous itinerary payload + constraints (+ optional `changes`) |
| GET | `/api/itineraries/{id}` | **Not implemented — no persistence in this MVP** (documented 404 by design) |

Legacy routes kept for existing clients/tests: `/health`, `/api/v1/meta`, `/api/v1/destinations*`, `/api/v1/plans`.
Interactive docs: `GET /docs` (Swagger UI) and `/redoc`.

### Trip request schema (`POST /api/itineraries/generate`)

| Field | Type | Rules |
|---|---|---|
| `start_city` | string | Must be a dataset destination id with coordinates (else 400) |
| `days` | int | 1–21 ("impossible durations" rejected) |
| `travel_dates` | `{start_date, end_date}` | Optional; start ≥ today, end ≥ start, span must equal `days` (else 422) |
| `total_budget_inr` | int, optional | 100–1,00,00,000 INR (else 422); over-budget plans return `budget_fit.within_budget=false` + warning, never a fake success |
| `travellers` | int | 1–20 |
| `interests` | list | ≥1 (empty mandatory preference → 422) |
| `experience_types` | list, optional | Preference bonus in scoring |
| `transport_preference` | `any \| public_transport \| private_cab \| self_drive` | Drives transport cost/km and public-transport travel time |
| `pace` | `relaxed \| balanced \| packed` | Stay-length model |
| `dietary_preference` | `no_preference \| vegetarian \| vegan \| jain \| non_vegetarian` | Reflected in food activities |
| `accessibility_requirements` | string ≤500 chars, optional | Emits accessibility warnings for stops with documented notes |
| `family_preference` | `with_children \| with_elderly`, optional | Family-friendly stops score higher |
| `planner` | `auto \| ai \| fallback` | `ai` returns 503 if the LLM is unavailable |

### Example: generate

```bash
curl -X POST http://localhost:8000/api/itineraries/generate \
  -H "Content-Type: application/json" \
  -d '{
    "start_city": "bengaluru",
    "days": 5,
    "travellers": 2,
    "interests": ["heritage", "nature"],
    "experience_types": ["heritage_tour"],
    "budget_tier": "mid",
    "total_budget_inr": 60000,
    "transport_preference": "public_transport",
    "pace": "balanced",
    "dietary_preference": "vegetarian",
    "planner": "auto"
  }'
```

Response (trimmed — 200 OK):

```json
{
  "plan_id": "6eb2f868bd0f",
  "source": "fallback",
  "summary": "5-day Karnataka trip (balanced pace) covering 4 stops: ...",
  "interests": ["heritage", "nature"],
  "itinerary": [
    {"day": 3, "place": {"destination_id": "hampi", "name": "Hampi", "lat": 15.33, "lng": 76.46, "region": "North Karnataka"},
     "stay_day": 1, "stay_days": 2,
     "activities": [{"time": "14:00", "title": "Virupaksha Temple", "description": "...", "destination_id": "hampi", "kind": "sightseeing"}]},
    {"day": 4, "place": {"...": "..."}, "stay_day": 2, "stay_days": 2, "activities": ["..."]}
  ],
  "selected_destinations": ["..."],
  "route": [{"day": 2, "origin": {"...": "..."}, "destination": {"...": "..."}, "distance_km": 143.6, "duration_hours": 3.7, "transport": "road"}],
  "stays": [
    {"destination_id": "bengaluru", "name": "Bengaluru", "first_day": 1, "last_day": 1, "days": 1},
    {"destination_id": "hampi", "name": "Hampi", "first_day": 3, "last_day": 4, "days": 2}
  ],
  "budget": {"currency": "INR", "tier": "mid", "days": 5, "travellers": 2, "stay_food_inr": 29400, "transport_inr": 1748, "activities_inr": 80, "total_inr": 31228, "per_person_total_inr": 15614,
    "unknown_entry_fees": ["Bengaluru", "Badami"], "zero_entry_fees": [],
    "estimate_complete": false,
    "excluded_costs_note": "Incomplete estimate: entry fees for Bengaluru, Badami are not verified and are EXCLUDED from this total (they are not zero). ..."},
  "budget_fit": {"total_budget_inr": 60000, "estimated_total_inr": 31228, "within_budget": true, "variance_inr": 28772},
  "warnings": ["Entry fee for Srirangapatna is not verified; excluded from the budget."]
}
```

**Multi-day stays:** a destination repeated across consecutive itinerary days is
ONE stay, never a duplicate selection. `stays[]` lists each stop once with its
`first_day`/`last_day`/`days` span, and each day carries `stay_day`/`stay_days`
(e.g. “day 2 of 2 in Hampi”). `selected_destinations` contains every stop
exactly once, and route legs exist only on days where the destination changes.

**Budget completeness:** `activities_inr` sums only **verified** entry fees.
An unverified fee is never counted as ₹0 — it is named in `unknown_entry_fees`,
flips `estimate_complete` to `false`, and `excluded_costs_note` states exactly
what the total leaves out. A confirmed free entry (e.g. Gokarna) appears in
`zero_entry_fees` instead. `total_inr` always equals
`stay_food_inr + transport_inr + activities_inr`.

### Example: regenerate (stateless)

No server-side itinerary store exists, so the client echoes the previous payload;
the path id must equal `previous_itinerary.plan_id` (otherwise 400 explaining the
stateless contract). `trip` carries the preserved constraints, `changes` optional
overrides.

```bash
curl -X POST http://localhost:8000/api/itineraries/6eb2f868bd0f/regenerate \
  -H "Content-Type: application/json" \
  -d '{
    "previous_itinerary": { "plan_id": "6eb2f868bd0f", "...": "full previous response" },
    "trip": { "start_city": "bengaluru", "days": 5, "travellers": 2,
              "interests": ["heritage", "nature"], "budget_tier": "mid",
              "pace": "balanced", "total_budget_inr": 60000, "planner": "auto" },
    "changes": { "days": 3, "pace": "packed" }
  }'
```

Response adds `"regenerated_from": "6eb2f868bd0f"` and a fresh `plan_id`.

### Example: error envelope

```json
{
  "error": {
    "code": "request_validation_error",
    "message": "Request validation failed",
    "details": [{"field": "total_budget_inr", "message": "Input should be greater than or equal to 100"}]
  }
}
```

Codes: `bad_request` (400), `not_found` (404), `request_validation_error` (422),
`service_unavailable` (503, e.g. forced `planner: "ai"` without an LLM key),
`internal_error` (500).

### Legacy plan endpoint

```bash
curl -X POST http://localhost:8000/api/v1/plans \
  -H "Content-Type: application/json" \
  -d '{"interests":["heritage","nature"],"days":5,"travellers":2,
       "budget_tier":"mid","pace":"balanced","start_city":"bengaluru",
       "start_month":12,"planner":"auto"}'
```

`planner` is `auto` (AI when configured, silently falls back with a warning),
`ai` (forces the LLM; returns 503 if unavailable) or `fallback` (deterministic).

## Design decisions

- **Deterministic fallback is the backbone**: stops, routing, budget and day
  allocation are computed by pure modules. The LLM only drafts narrative day
  activities and is validated with Pydantic — if it fails or misbehaves, the
  fallback output is used and reported in `warnings`.
- **No database yet**: the dataset is a static curated JSON file; SQLite can be
  added later if users need saved trips.
- **No auth/microservices**: single FastAPI app, single React app, per the brief.
- **Money never comes from the LLM**: `budget.py` computes every rupee figure.
- **AI provider status**: provider/model/timeout are configured via
  `LLM_API_KEY`/`LLM_BASE_URL`/`LLM_MODEL`/`LLM_TIMEOUT_SECONDS` (see
  `.env.example`). With no key, `auto` falls back with a warning and `ai`
  returns 503 — never a fake success. Structured output is parsed defensively
  (JSON extraction, day-count, numeric day numbers, unique days, destination-ID
  allow-list) and all failure modes are covered by **mocked** tests; a live
  call against a real provider has **not** been verified in this environment
  because no key is configured.

## Version control

The repo is initialised (`git init`) with a `.gitignore` covering `.env`,
`node_modules/`, `.venv/` and build output. Initial commit:

```bash
git add .
git commit -m "Foundation: FastAPI backend, React frontend, fallback planner, tests"
```
