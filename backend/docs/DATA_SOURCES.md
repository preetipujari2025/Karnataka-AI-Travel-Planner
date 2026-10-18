# Karnataka Destination Dataset — Sources & Data Quality

Data file: [`app/data/karnataka_destinations.json`](../app/data/karnataka_destinations.json)
Last verification pass: **2026-10-14**

## What each record contains

| Field | Meaning |
|---|---|
| `id` | Lowercase slug, unique across the dataset (`a-z`, `0-9`, `-`) |
| `name`, `region`, `district` | Display name, planning region, Karnataka district (`null` if unknown) |
| `lat`, `lng` | WGS84 decimal degrees; **`null` when no reliable source** — such records are excluded from routing and map display (`is_map_ready` is false) |
| `categories` | Broad tags used by the recommendation engine: `heritage, nature, hills, beach, adventure, spiritual, wildlife, food, urban` |
| `interest_tags` | Fine-grained free-form tags (e.g. `hoysala`, `coffee`, `birding`) |
| `experience_types` | Controlled enum: `sightseeing, heritage_tour, wildlife_safari, trekking, beach, pilgrimage, boating, nature_walk, food_tour, photography` |
| `min_nights` / `typical_nights` | Recommended visit duration (nights) — used by the planner's pace model |
| `daily_cost_inr` | **Planning estimate** per person per day (stay + food + local transport), tiers `budget / mid / luxury`. Estimates, not sourced prices. |
| `entry_fees_inr` | Estimated main entry fee in INR per person, **`null` when unknown** (never guessed) |
| `entry_fee_note` | Human explanation of how the fee was derived or why it is null |
| `activity_cost_inr` | Estimated local activity cost (e.g. boat ride), `null` when unknown. Informational — not yet summed into the budget. |
| `best_months` / `season_note` | Best-season guidance (months 1–12 plus optional prose) |
| `family_friendly` | `true/false` when reasonably documented, `null` when unknown |
| `accessibility_notes` | Prose only where supportable; `null` otherwise |
| `sources` | Source URLs supporting the checkable facts (coordinates, fees, season) |
| `data_confidence` | `verified` / `estimated` / `unverified` (see below) |
| `last_verified_on` | ISO date of the last source check; `null` if never checked |

## Confidence definitions

- **verified** — coordinates *and* the stated entry fee were backed by a cited source in the `sources` list, checked on `last_verified_on`.
- **estimated** — plausible and commonly reported (coordinates from a reliable reference like Wikipedia or Karnataka Tourism), but the fee or another checkable fact was **not** source-confirmed. Fees are set to `null` in that case.
- **unverified** — no source check yet; treat every number in the record as provisional.

**Never fabricate** exact coordinates, entry fees, operating hours or official claims.
When in doubt: use `null` and record the gap.

## Source preference order

1. Official bodies: Karnataka Tourism (`karnatakatourism.org`), ASI (`asi.nic.in`), park/tariff sites (e.g. `bannerughattabiopark.org`, official ticketing sites)
2. Wikipedia (for coordinates and well-documented facts)
3. Established travel references — used only as corroboration, never as the sole source for a `verified` fee claim unless it is a live tariff page

## Dataset-wide conventions

- All money values are **INR**, per person, integer rupees.
- `daily_cost_inr` values are deliberately labelled planning estimates; they are *not* covered by `data_confidence`.
- The dataset is the single source of truth: to add/edit a destination, edit the JSON only — no application-code changes required (schema evolves with backward-compatible optional fields).
- Validation is enforced twice: structurally at load time ([`loader.py`](../app/data/loader.py) raises `DatasetValidationError` on duplicate ids / invalid records) and report-style by [`scripts/validate_dataset.py`](../scripts/validate_dataset.py).

## Verification status (2026-10-14 pass)

Run `python scripts/validate_dataset.py` for the live report. Summary of the last pass:

- **38 records** total (14 added in this pass: Aihole, Belur, Halebidu, Somanathapura, Shravanabelagola, Srirangapatna, Ranganathittu, Melkote, Bannerghatta, B.R. Hills, Sringeri, Karkala, Moodabidri, Yana).
- **verified (8):** hampi, vijayapura, gokarna, jog-falls, karkala, bannerghatta, ranganathittu, yana
- **unverified (1):** hubballi — `last_verified_on` is `null`; coordinates/fee were not re-checked in this pass.
- **estimated (29):** everything else — coordinates sourced, entry fees left `null` unless confirmed.
- Entry fee is `null` for 30 of 38 records; only the 8 verified fees (plus Ranganathittu's activity cost) are budgeted.

### Key sources used

- ASI Hampi: https://asi.nic.in/pages/WorldHeritageHampi
- Karnataka Tourism hub: https://karnatakatourism.org/en/destinations/ (destination subpages for Bengaluru, Mysuru, Coorg, Hampi, Melkote, Gokarna, Chikkamagalur, Sringeri, Jog Falls, Dandeli rafting, Yana caves, Bandipur, Kabini/backwaters, B.R. Tiger Reserve)
- Bannerghatta official tariff: https://bannerughattabiopark.org/tariff.html
- Ranganathittu tickets: https://tickets.ranganathittu.in/
- Hoysala temples: https://en.wikipedia.org/wiki/Chennakeshava_Temple,_Belur , https://en.wikipedia.org/wiki/Hoysaleswara_Temple
- Deccan Heritage Foundation: https://www.deccan-heritage-foundation.org/heritage-sites/halebidu-and-belur/
- Per-destination Wikipedia pages (see `sources` in each record)

## How to update the dataset

1. Edit `app/data/karnataka_destinations.json` (only the data file).
2. Run `python scripts/validate_dataset.py` — fix any ERRORS; review WARNINGS.
3. Run `python -m pytest` — service/filter/nearby tests must still pass.
4. Set `last_verified_on` to today's date **only** for records you actually re-checked, and raise/lower `data_confidence` accordingly.
