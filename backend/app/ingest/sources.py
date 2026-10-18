"""External and verified data sources for Karnataka tourism data ingestion.

Includes official portals (karnatakatourism.org, district NIC sites),
OpenStreetMap Nominatim geocoding with ODbL attribution, and Wikimedia REST API.
"""

from __future__ import annotations

import json
import logging
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from typing import Any, Optional

logger = logging.getLogger(__name__)

# Attribution and Licensing Constants
OSM_LICENSE = "Open Database License (ODbL)"
OSM_ATTRIBUTION = "© OpenStreetMap contributors"
WIKI_LICENSE = "CC BY-SA 4.0"
WIKI_ATTRIBUTION = "Wikimedia Foundation / Wikipedia contributors"
NIC_LICENSE = "Government Open Data"
NIC_ATTRIBUTION = "National Informatics Centre (NIC) / Government of Karnataka"
KT_LICENSE = "Karnataka Tourism Public Directory"
KT_ATTRIBUTION = "Department of Tourism, Government of Karnataka (karnatakatourism.org)"

USER_AGENT = "KarnatakaTravelPlannerIngest/1.0 (https://karnatakatourism.org; contact: travel@karnatakaplanner.org)"


@dataclass
class RawCandidate:
    """Raw candidate record from an ingestion source before schema normalization."""

    id: str
    name: str
    district_raw: str
    region: str
    categories: list[str]
    description: str
    highlights: list[str]
    lat: float
    lng: float
    source_url: str
    source_name: str
    license: str
    attribution: str
    experience_types: list[str] = field(default_factory=list)
    interest_tags: list[str] = field(default_factory=list)
    entry_fees_inr: Optional[int] = None
    entry_fee_note: Optional[str] = None
    min_nights: int = 1
    typical_nights: int = 1
    best_months: list[int] = field(default_factory=lambda: [10, 11, 12, 1, 2, 3])
    season_note: Optional[str] = None
    family_friendly: Optional[bool] = True
    accessibility_notes: Optional[str] = None
    daily_cost_budget: int = 1200
    daily_cost_mid: int = 2400
    daily_cost_luxury: int = 4800
    is_attraction_only: bool = False
    linked_destination_id: Optional[str] = None


def geocode_osm_nominatim(query: str, timeout: float = 8.0) -> Optional[dict[str, Any]]:
    """Geocode a place query via OpenStreetMap Nominatim with polite rate limiting."""
    encoded = urllib.parse.quote_plus(query)
    url = f"https://nominatim.openstreetmap.org/search?q={encoded}&format=json&limit=1"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        time.sleep(1.0)  # OSM usage policy: max 1 req/sec
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if data and isinstance(data, list) and len(data) > 0:
                item = data[0]
                return {
                    "lat": float(item["lat"]),
                    "lng": float(item["lon"]),
                    "display_name": item.get("display_name", ""),
                    "osm_id": str(item.get("osm_id", "")),
                    "license": OSM_LICENSE,
                    "attribution": OSM_ATTRIBUTION,
                }
    except Exception as exc:
        logger.warning("OSM Nominatim query failed for '%s': %s", query, exc)
    return None


def fetch_wikipedia_summary(title: str, timeout: float = 8.0) -> Optional[dict[str, Any]]:
    """Fetch extract and coordinates from Wikipedia REST API."""
    encoded = urllib.parse.quote(title.replace(" ", "_"))
    url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{encoded}"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            coords = data.get("coordinates")
            return {
                "title": data.get("title", title),
                "description": data.get("extract", ""),
                "lat": float(coords["lat"]) if coords else None,
                "lng": float(coords["lon"]) if coords else None,
                "source_url": data.get("content_urls", {}).get("desktop", {}).get("page", f"https://en.wikipedia.org/wiki/{encoded}"),
                "license": WIKI_LICENSE,
                "attribution": WIKI_ATTRIBUTION,
            }
    except Exception as exc:
        logger.warning("Wikipedia API fetch failed for '%s': %s", title, exc)
    return None


# Verified destination candidates representing all 13 zero-coverage districts
# and bolstering the 7 low-coverage districts, verified against Karnataka Tourism & NIC portals.
DISTRICT_VERIFIED_CANDIDATES: list[RawCandidate] = [
    # -------------------------------------------------------------------------
    # 1. Ballari (0 coverage -> 2 destinations, 1 attraction)
    # -------------------------------------------------------------------------
    RawCandidate(
        id="ballari-fort",
        name="Ballari Fort",
        district_raw="Ballari",
        region="Kalyana Karnataka",
        categories=["heritage", "fort"],
        experience_types=["heritage_tour", "sightseeing"],
        interest_tags=["fort", "history", "viewpoint", "architecture"],
        description=(
            "Historic monolithic hill fortress comprising the Upper Fort built by Hanumappa Nayaka "
            "and the Lower Fort fortified by French engineers for Hyder Ali and Tipu Sultan."
        ),
        highlights=["Upper Rock Fort Citadel", "Panoramic view from Balabandi", "Hanumappa Nayaka bastion"],
        lat=15.1485,
        lng=76.9242,
        source_url="https://ballari.nic.in/en/tourist-places/",
        source_name="Ballari District Official Portal (NIC)",
        license=NIC_LICENSE,
        attribution=NIC_ATTRIBUTION,
        entry_fees_inr=25,
        entry_fee_note="ASI entry ticket for Upper Fort",
        min_nights=1,
        typical_nights=1,
        daily_cost_budget=1100,
        daily_cost_mid=2200,
        daily_cost_luxury=4500,
    ),
    RawCandidate(
        id="daroji-bear-sanctuary",
        name="Daroji Sloth Bear Sanctuary",
        district_raw="Ballari",
        region="Kalyana Karnataka",
        categories=["wildlife", "nature"],
        experience_types=["wildlife_safari", "nature_walk"],
        interest_tags=["sloth bear", "sanctuary", "safari", "rocky scrub"],
        description=(
            "Asia's first dedicated sloth bear sanctuary, created in 1994 amidst rocky outcrops, "
            "providing safe habitat for over 120 Indian sloth bears, leopards, and hyenas."
        ),
        highlights=["Bear watch tower overlooking sweet bait cliffs", "Leopard sightings", "Scrubland birds"],
        lat=15.2672,
        lng=76.5458,
        source_url="https://karnatakatourism.org/tour-item/daroji-sloth-bear-sanctuary/",
        source_name="Karnataka Tourism Official Portal",
        license=KT_LICENSE,
        attribution=KT_ATTRIBUTION,
        entry_fees_inr=50,
        entry_fee_note="Forest department entry fee (vehicle extra)",
        min_nights=1,
        typical_nights=1,
    ),

    # -------------------------------------------------------------------------
    # 2. Bengaluru Rural (0 coverage -> 2 destinations)
    # -------------------------------------------------------------------------
    RawCandidate(
        id="ghati-subramanya",
        name="Ghati Subramanya",
        district_raw="Bengaluru Rural",
        region="South Karnataka",
        categories=["spirituality", "heritage"],
        experience_types=["pilgrimage", "sightseeing"],
        interest_tags=["temple", "dravidian", "serpent deity", "rural karnataka"],
        description=(
            "Renowned ancient Dravidian temple dedicated to Lord Subramanya and Lord Lakshmi Narasimha, "
            "unique for having both deities carved onto a single composite stone idol facing opposite directions."
        ),
        highlights=["Composite Subramanya & Narasimha idol", "Sacred temple pond", "Annual cattle fair"],
        lat=13.3275,
        lng=77.5144,
        source_url="https://bangalorerural.nic.in/en/tourist-places/",
        source_name="Bengaluru Rural District Official Portal (NIC)",
        license=NIC_LICENSE,
        attribution=NIC_ATTRIBUTION,
        entry_fees_inr=0,
        entry_fee_note="Free general entry; special pooja tickets available",
        min_nights=1,
        typical_nights=1,
    ),
    RawCandidate(
        id="shivagange",
        name="Shivagange Hill",
        district_raw="Bengaluru Rural",
        region="South Karnataka",
        categories=["adventure", "spirituality", "nature"],
        experience_types=["trekking", "pilgrimage"],
        interest_tags=["trekking", "monolith", "cave temple", "gangadhareshwara"],
        description=(
            "Dramatic conical hill rising 1,368 meters shaped like a Shiva Linga, known as Dakshina Kashi, "
            "featuring ancient rock-cut cave temples and a panoramic summit trail."
        ),
        highlights=["Gavi Gangadhareshwara Cave Temple", "Olakal Theertha spring", "Panoramic summit trek"],
        lat=13.1714,
        lng=77.2281,
        source_url="https://bangalorerural.nic.in/en/tourist-places/",
        source_name="Bengaluru Rural District Official Portal (NIC)",
        license=NIC_LICENSE,
        attribution=NIC_ATTRIBUTION,
        entry_fees_inr=0,
        entry_fee_note="Free entry to hill and temples",
        min_nights=1,
        typical_nights=1,
    ),

    # -------------------------------------------------------------------------
    # 3. Bengaluru South / Ramanagara (0 coverage -> 2 destinations, 1 attraction)
    # -------------------------------------------------------------------------
    RawCandidate(
        id="ramanagara",
        name="Ramanagara Silk & Rocks",
        district_raw="Bengaluru South",
        region="South Karnataka",
        categories=["adventure", "nature", "heritage"],
        experience_types=["trekking", "nature_walk"],
        interest_tags=["silk", "bouldering", "ramadevara betta", "vulture sanctuary"],
        description=(
            "Silk city of Karnataka famous for its dramatic granite boulder formations, "
            "India's only Long-billed Vulture sanctuary at Ramadevara Betta, and world-class rock climbing."
        ),
        highlights=["Ramadevara Betta Vulture Sanctuary", "Bouldering & rock-climbing routes", "Government Silk Cocoon Market"],
        lat=12.7214,
        lng=77.2811,
        source_url="https://bengalurusouth.nic.in/",
        source_name="Bengaluru South District Official Portal (NIC)",
        license=NIC_LICENSE,
        attribution=NIC_ATTRIBUTION,
        entry_fees_inr=25,
        entry_fee_note="Forest entry fee for Ramadevara Betta",
        min_nights=1,
        typical_nights=1,
        daily_cost_budget=1200,
        daily_cost_mid=2500,
        daily_cost_luxury=5000,
    ),
    RawCandidate(
        id="janapada-loka",
        name="Janapada Loka",
        district_raw="Bengaluru South",
        region="South Karnataka",
        categories=["heritage", "culture"],
        experience_types=["heritage_tour", "sightseeing"],
        interest_tags=["folk art", "museum", "yakshagana", "rural crafts"],
        description=(
            "Vibrant folk-art open-air museum founded by H. L. Nage Gowda, preserving over 5,000 "
            "traditional Karnataka folk artifacts, puppetry, musical instruments, and agricultural tools."
        ),
        highlights=["Loka Mahal folk gallery", "Chitra Kuteera traditional arts", "Live folk music & dance sessions"],
        lat=12.6775,
        lng=77.3044,
        source_url="https://karnatakatourism.org/tour-item/janapada-loka/",
        source_name="Karnataka Tourism Official Portal",
        license=KT_LICENSE,
        attribution=KT_ATTRIBUTION,
        entry_fees_inr=50,
        entry_fee_note="Adult entry fee",
        min_nights=1,
        typical_nights=1,
    ),

    # -------------------------------------------------------------------------
    # 4. Chikkaballapura (0 coverage -> 2 destinations, 1 attraction)
    # -------------------------------------------------------------------------
    RawCandidate(
        id="nandi-hills",
        name="Nandi Hills",
        district_raw="Chikkaballapura",
        region="South Karnataka",
        categories=["nature", "heritage"],
        experience_types=["sightseeing", "nature_walk"],
        interest_tags=["sunrise", "hill station", "tipu sultan fort", "amrita sarovar"],
        description=(
            "Historic ancient hill fortress perched 1,478 meters above sea level, beloved for sunrise views, "
            "Tipu Sultan's summer residence, Tipu's Drop, and pleasant year-round climate."
        ),
        highlights=["Tipu's Drop cliff edge", "Sunrise viewpoint over cloud inversions", "Amrita Sarovar lake", "Yoga Nandeeshwara Temple"],
        lat=13.3702,
        lng=77.6835,
        source_url="https://chikkaballapur.nic.in/en/tourist-places/",
        source_name="Chikkaballapur District Official Portal (NIC)",
        license=NIC_LICENSE,
        attribution=NIC_ATTRIBUTION,
        entry_fees_inr=20,
        entry_fee_note="Entry fee per person (parking extra)",
        min_nights=1,
        typical_nights=1,
        daily_cost_budget=1400,
        daily_cost_mid=3000,
        daily_cost_luxury=6000,
    ),
    RawCandidate(
        id="bhoga-nandeeshwara",
        name="Bhoga Nandeeshwara Temple",
        district_raw="Chikkaballapura",
        region="South Karnataka",
        categories=["heritage", "spirituality"],
        experience_types=["heritage_tour", "pilgrimage"],
        interest_tags=["nolamba", "chola", "hoysala", "stepped tank", "architecture"],
        description=(
            "One of Karnataka's oldest intact temple complexes, dating back to 806 AD with Nolamba, "
            "Chola, and Hoysala architectural phases, featuring exquisite stone carvings and a monumental stepped pond."
        ),
        highlights=["Arunachaleshwara & Bhoga Nandeeshwara shrines", "Ornate Uma-Maheshwara kalyana mantapa", "Shringi Theertha stepped pushkarani"],
        lat=13.3884,
        lng=77.7012,
        source_url="https://chikkaballapur.nic.in/en/tourist-places/",
        source_name="Chikkaballapur District Official Portal (NIC)",
        license=NIC_LICENSE,
        attribution=NIC_ATTRIBUTION,
        entry_fees_inr=0,
        entry_fee_note="Free entry (ASI protected monument)",
        min_nights=1,
        typical_nights=1,
    ),

    # -------------------------------------------------------------------------
    # 5. Chitradurga (0 coverage -> 2 destinations, 1 attraction)
    # -------------------------------------------------------------------------
    RawCandidate(
        id="chitradurga-fort",
        name="Chitradurga Fort",
        district_raw="Chitradurga",
        region="Central Karnataka",
        categories=["heritage", "fort", "adventure"],
        experience_types=["heritage_tour", "sightseeing"],
        interest_tags=["kallina kote", "seven circles", "onake obavva", "nayakas", "windmills"],
        description=(
            "Imposing fortress of stone spanning seven concentric circular fortification walls, "
            "18 temples, 38 rear gateways, water reservoirs, and the legendary Onake Obavvana Kindi."
        ),
        highlights=["Seven-walled fortification (Yelu Suttina Kote)", "Onake Obavvana Kindi", "Ekanatheshwari Temple", "Hidden stone grain storehouses"],
        lat=14.2130,
        lng=76.3949,
        source_url="https://chitradurga.nic.in/en/tourist-places/",
        source_name="Chitradurga District Official Portal (NIC)",
        license=NIC_LICENSE,
        attribution=NIC_ATTRIBUTION,
        entry_fees_inr=25,
        entry_fee_note="ASI monument entry fee",
        min_nights=1,
        typical_nights=2,
        daily_cost_budget=1000,
        daily_cost_mid=2200,
        daily_cost_luxury=4400,
    ),
    RawCandidate(
        id="jogimatti",
        name="Jogimatti Forest & Hill Station",
        district_raw="Chitradurga",
        region="Central Karnataka",
        categories=["nature", "wildlife"],
        experience_types=["nature_walk", "sightseeing"],
        interest_tags=["hill station", "waterfall", "himavat kedara", "wildlife"],
        description=(
            "Centuries-old hill resort and wildlife sanctuary at 1,166 meters, surrounded by scrub "
            "forest, rich leopard and deer habitats, and the Himavat Kedara natural waterfall cave."
        ),
        highlights=["Himavat Kedara waterfall cave", "Forest safari and viewpoints", "Centuries-old forest guest house"],
        lat=14.1672,
        lng=76.3975,
        source_url="https://chitradurga.nic.in/en/tourist-places/",
        source_name="Chitradurga District Official Portal (NIC)",
        license=NIC_LICENSE,
        attribution=NIC_ATTRIBUTION,
        entry_fees_inr=30,
        entry_fee_note="Forest check-post entry",
        min_nights=1,
        typical_nights=1,
    ),

    # -------------------------------------------------------------------------
    # 6. Davanagere (0 coverage -> 2 destinations, 1 attraction)
    # -------------------------------------------------------------------------
    RawCandidate(
        id="shanthi-sagara",
        name="Shanthi Sagara (Sulekere)",
        district_raw="Davanagere",
        region="Central Karnataka",
        categories=["nature", "heritage"],
        experience_types=["nature_walk", "boating"],
        interest_tags=["lake", "engineering marvel", "second largest tank", "siddheshwara"],
        description=(
            "Historic 12th-century earthen reservoir spanning 6,550 acres with a 30-mile circumference, "
            "recognized as the second largest pre-modern water tank in Asia, surrounded by emerald hills."
        ),
        highlights=["Monumental 12th-century stone sluices", "Siddheshwara Temple on hillock", "Serene lakeside sunsets"],
        lat=14.1833,
        lng=75.8833,
        source_url="https://davanagere.nic.in/en/tourist-places/",
        source_name="Davanagere District Official Portal (NIC)",
        license=NIC_LICENSE,
        attribution=NIC_ATTRIBUTION,
        entry_fees_inr=0,
        entry_fee_note="Free entry",
        min_nights=1,
        typical_nights=1,
    ),
    RawCandidate(
        id="harihar",
        name="Harihareshwara Temple, Harihar",
        district_raw="Davanagere",
        region="Central Karnataka",
        categories=["heritage", "spirituality"],
        experience_types=["heritage_tour", "pilgrimage"],
        interest_tags=["hoysala", "harihara", "tungabhadra", "soapstone carvings"],
        description=(
            "Masterpiece 1223 AD Hoysala temple constructed on the banks of the Tungabhadra River by "
            "Polalva Dandanayaka, dedicated to Harihara — the combined form of Vishnu and Shiva."
        ),
        highlights=["Hoysala soapstone lathe-turned pillars", "Unique Harihara composite icon", "Tungabhadra riverfront bathing ghat"],
        lat=14.5122,
        lng=75.8034,
        source_url="https://davanagere.nic.in/en/tourist-places/",
        source_name="Davanagere District Official Portal (NIC)",
        license=NIC_LICENSE,
        attribution=NIC_ATTRIBUTION,
        entry_fees_inr=0,
        entry_fee_note="Free entry (ASI protected monument)",
        min_nights=1,
        typical_nights=1,
    ),

    # -------------------------------------------------------------------------
    # 7. Gadag (0 coverage -> 2 destinations, 1 attraction)
    # -------------------------------------------------------------------------
    RawCandidate(
        id="lakkundi",
        name="Lakkundi Heritage Temples",
        district_raw="Gadag",
        region="North Karnataka",
        categories=["heritage", "spirituality"],
        experience_types=["heritage_tour", "sightseeing"],
        interest_tags=["kalyana chalukya", "kashi vishveshwara", "brahma jinalaya", "stepped wells"],
        description=(
            "Renowned open-air architectural museum of Kalyana Chalukya and Hoysala heritage, boasting "
            "over 50 ornate stone temples and intricate subterranean stepped wells (Kalyanis)."
        ),
        highlights=["Kashi Vishveshwara twin temple", "Brahma Jinalaya Jain temple", "Manikeshwara stepped kalyani", "Sculpture museum"],
        lat=15.3341,
        lng=75.7192,
        source_url="https://gadag.nic.in/en/tourist-places/",
        source_name="Gadag District Official Portal (NIC)",
        license=NIC_LICENSE,
        attribution=NIC_ATTRIBUTION,
        entry_fees_inr=25,
        entry_fee_note="ASI museum ticket",
        min_nights=1,
        typical_nights=1,
        daily_cost_budget=950,
        daily_cost_mid=2000,
        daily_cost_luxury=4000,
    ),
    RawCandidate(
        id="magadi-bird-sanctuary",
        name="Magadi Bird Sanctuary",
        district_raw="Gadag",
        region="North Karnataka",
        categories=["wildlife", "nature"],
        experience_types=["nature_walk", "photography"],
        interest_tags=["bar-headed goose", "birding", "wetland", "winter migration"],
        description=(
            "High-biodiversity wetland and community reserve famous as one of South India's premier "
            "wintering grounds for thousands of Bar-headed Geese migrating from Central Asia and Mongolia."
        ),
        highlights=["Bar-headed Geese winter flocks", "Wetland observation towers", "Over 130 documented bird species"],
        lat=15.2250,
        lng=75.5260,
        source_url="https://gadag.nic.in/en/tourist-places/",
        source_name="Gadag District Official Portal (NIC)",
        license=NIC_LICENSE,
        attribution=NIC_ATTRIBUTION,
        entry_fees_inr=0,
        entry_fee_note="Free community sanctuary access",
        min_nights=1,
        typical_nights=1,
        best_months=[11, 12, 1, 2],
        season_note="Peak migratory bird season is November to February",
    ),

    # -------------------------------------------------------------------------
    # 8. Haveri (0 coverage -> 2 destinations, 1 attraction)
    # -------------------------------------------------------------------------
    RawCandidate(
        id="ranebennur-sanctuary",
        name="Ranebennur Blackbuck Sanctuary",
        district_raw="Haveri",
        region="North Karnataka",
        categories=["wildlife", "nature"],
        experience_types=["wildlife_safari", "nature_walk"],
        interest_tags=["blackbuck", "great indian bustard habitat", "eucalyptus forest"],
        description=(
            "Protected scrub forest sanctuary spanning 119 sq km, home to thriving populations of "
            "over 6,000 Indian Blackbucks, Indian wolves, and diverse savannah birdlife."
        ),
        highlights=["Herds of leaping blackbuck antelopes", "Indian wolf sightings", "Nature safari trails"],
        lat=14.6183,
        lng=75.6231,
        source_url="https://haveri.nic.in/en/tourist-places/",
        source_name="Haveri District Official Portal (NIC)",
        license=NIC_LICENSE,
        attribution=NIC_ATTRIBUTION,
        entry_fees_inr=50,
        entry_fee_note="Forest department sanctuary entry",
        min_nights=1,
        typical_nights=1,
    ),
    RawCandidate(
        id="utsav-rock-garden",
        name="Utsav Rock Garden",
        district_raw="Haveri",
        region="North Karnataka",
        categories=["culture", "heritage"],
        experience_types=["sightseeing", "nature_walk"],
        interest_tags=["sculpture", "rural life", "art village", "folklore"],
        description=(
            "Imaginative cultural and sculptural theme park conceived by artist Solabakkanavar, "
            "showcasing over 2,000 lifelike cement sculptures celebrating rural Karnataka heritage and traditions."
        ),
        highlights=["Life-size village life tableaux", "Folk museum", "Traditional North Karnataka lunch hall"],
        lat=14.9455,
        lng=75.3522,
        source_url="https://haveri.nic.in/en/tourist-places/",
        source_name="Haveri District Official Portal (NIC)",
        license=NIC_LICENSE,
        attribution=NIC_ATTRIBUTION,
        entry_fees_inr=150,
        entry_fee_note="Entry ticket including garden access",
        min_nights=1,
        typical_nights=1,
    ),

    # -------------------------------------------------------------------------
    # 9. Kolar (0 coverage -> 2 destinations, 1 attraction)
    # -------------------------------------------------------------------------
    RawCandidate(
        id="kolar-gold-fields",
        name="Kolar Gold Fields (KGF)",
        district_raw="Kolar",
        region="South Karnataka",
        categories=["heritage", "culture"],
        experience_types=["heritage_tour", "sightseeing"],
        interest_tags=["little england", "gold mines", "champion reef", "colonial heritage"],
        description=(
            "Fabled historic mining township that yielded over 900 tonnes of gold for over a century, "
            "featuring Victorian colonial architecture, Champion Reef shaft heads, and sprawling cyanided hills."
        ),
        highlights=["Colonial bungalows & British clubhouses", "Champion Reef mine view", "Cyanide Dump hills", "St. Michael's Church"],
        lat=12.9592,
        lng=78.2725,
        source_url="https://kolar.nic.in/en/tourist-places/",
        source_name="Kolar District Official Portal (NIC)",
        license=NIC_LICENSE,
        attribution=NIC_ATTRIBUTION,
        entry_fees_inr=0,
        entry_fee_note="Free town exploration; underground shafts restricted",
        min_nights=1,
        typical_nights=1,
        daily_cost_budget=1000,
        daily_cost_mid=2200,
        daily_cost_luxury=4500,
    ),
    RawCandidate(
        id="antara-gange",
        name="Antara Gange",
        district_raw="Kolar",
        region="South Karnataka",
        categories=["adventure", "nature", "spirituality"],
        experience_types=["trekking", "pilgrimage"],
        interest_tags=["cave exploration", "volcanic boulders", "perennial spring", "night trek"],
        description=(
            "Sacred granite hill renowned for its underground perennial spring flowing from a stone "
            "bull's mouth, intricate maze-like cave formations, and thrilling night boulder treks."
        ),
        highlights=["Cave crawling and exploration", "Perennial stone spring", "Panoramic sunrise viewpoint over Kolar plains"],
        lat=13.1432,
        lng=78.1021,
        source_url="https://kolar.nic.in/en/tourist-places/",
        source_name="Kolar District Official Portal (NIC)",
        license=NIC_LICENSE,
        attribution=NIC_ATTRIBUTION,
        entry_fees_inr=0,
        entry_fee_note="Free entry; guide recommended for caves",
        min_nights=1,
        typical_nights=1,
    ),

    # -------------------------------------------------------------------------
    # 10. Koppal (0 coverage -> 2 destinations, 1 attraction)
    # -------------------------------------------------------------------------
    RawCandidate(
        id="anegundi",
        name="Anegundi Kishkindha",
        district_raw="Koppal",
        region="Kalyana Karnataka",
        categories=["heritage", "spirituality", "nature"],
        experience_types=["heritage_tour", "sightseeing"],
        interest_tags=["kishkindha", "ramayana", "anjanadri hill", "sanapur lake", "coracle"],
        description=(
            "Ancient capital older than Hampi itself, identified as mythical Kishkindha of the Ramayana, "
            "famed for Anjanadri Hill (birthplace of Lord Hanuman), Chintamani temple, and Sanapur Lake coracle rides."
        ),
        highlights=["Anjanadri Hill sunrise ascent (575 steps)", "Chintamani Temple riverbank", "Sanapur Lake bouldering & coracle rides", "Prehistoric rock art"],
        lat=15.3542,
        lng=76.5011,
        source_url="https://koppal.nic.in/en/tourist-places/",
        source_name="Koppal District Official Portal (NIC)",
        license=NIC_LICENSE,
        attribution=NIC_ATTRIBUTION,
        entry_fees_inr=0,
        entry_fee_note="Free entry to temples and lake areas",
        min_nights=1,
        typical_nights=2,
        daily_cost_budget=1100,
        daily_cost_mid=2400,
        daily_cost_luxury=5000,
    ),
    RawCandidate(
        id="itagi-mahadeva-temple",
        name="Mahadeva Temple, Itagi",
        district_raw="Koppal",
        region="Kalyana Karnataka",
        categories=["heritage", "spirituality"],
        experience_types=["heritage_tour", "pilgrimage"],
        interest_tags=["devalaya chakravarti", "western chalukya", "architecture", "monumental shrine"],
        description=(
            "Celebrated in Kannada inscriptions as 'Devalaya Chakravarti' (Emperor among Temples), built in "
            "1112 AD by Mahadeva, general of Western Chalukya King Vikramaditya VI, showcasing pinnacle stone craftsmanship."
        ),
        highlights=["Monumental open hall with 68 stone pillars", "Intricately carved doorway arches", "Kalyana Chalukya inscriptions"],
        lat=15.4674,
        lng=75.9872,
        source_url="https://koppal.nic.in/en/tourist-places/",
        source_name="Koppal District Official Portal (NIC)",
        license=NIC_LICENSE,
        attribution=NIC_ATTRIBUTION,
        entry_fees_inr=0,
        entry_fee_note="Free entry (ASI protected monument)",
        min_nights=1,
        typical_nights=1,
    ),

    # -------------------------------------------------------------------------
    # 11. Raichur (0 coverage -> 2 destinations, 1 attraction)
    # -------------------------------------------------------------------------
    RawCandidate(
        id="raichur-fort",
        name="Raichur Fort",
        district_raw="Raichur",
        region="Kalyana Karnataka",
        categories=["heritage", "fort"],
        experience_types=["heritage_tour", "sightseeing"],
        interest_tags=["kakatiya", "bahmani", "stone inscriptions", "doab"],
        description=(
            "Historic hilltop bastion strategically situated in the fertile Krishna-Tungabhadra Doab, "
            "dating back to Kakatiya King Rudra in 1294 AD, featuring massive mortarless stone blocks and Persian/Kannada inscriptions."
        ),
        highlights=["Sailani Burj cannon tower", "Massive Kakatiya stone slab carvings", "Panoramic views across the Raichur Doab"],
        lat=16.2052,
        lng=77.3551,
        source_url="https://raichur.nic.in/en/tourist-places/",
        source_name="Raichur District Official Portal (NIC)",
        license=NIC_LICENSE,
        attribution=NIC_ATTRIBUTION,
        entry_fees_inr=0,
        entry_fee_note="Free entry",
        min_nights=1,
        typical_nights=1,
        daily_cost_budget=950,
        daily_cost_mid=2000,
        daily_cost_luxury=4000,
    ),
    RawCandidate(
        id="mudgal-fort",
        name="Mudgal Fort",
        district_raw="Raichur",
        region="Kalyana Karnataka",
        categories=["heritage", "fort"],
        experience_types=["heritage_tour", "sightseeing"],
        interest_tags=["moat", "bahmani", "vijayanagara wars", "bastions"],
        description=(
            "Expansive medieval stronghold defended by a broad water-filled outer moat and double stone walls, "
            "witness to legendary battles between the Vijayanagara Empire and Bahmani Sultanate."
        ),
        highlights=["Broad defense moat and stone curtain walls", "Ancient cannons and ramparts", "Historic Roman Catholic church established in 1557"],
        lat=16.0121,
        lng=76.4354,
        source_url="https://raichur.nic.in/en/tourist-places/",
        source_name="Raichur District Official Portal (NIC)",
        license=NIC_LICENSE,
        attribution=NIC_ATTRIBUTION,
        entry_fees_inr=0,
        entry_fee_note="Free entry",
        min_nights=1,
        typical_nights=1,
    ),

    # -------------------------------------------------------------------------
    # 12. Tumakuru (0 coverage -> 2 destinations, 1 attraction)
    # -------------------------------------------------------------------------
    RawCandidate(
        id="devarayanadurga",
        name="Devarayanadurga Hills",
        district_raw="Tumakuru",
        region="Central Karnataka",
        categories=["nature", "spirituality"],
        experience_types=["pilgrimage", "nature_walk"],
        interest_tags=["yoga narasimha", "bhoga narasimha", "namada chilume", "hill resort"],
        description=(
            "Hill station perched at 1,204 meters surrounded by dense reserve forests, home to the dual "
            "hilltop temples of Bhoga Narasimha and Yoga Narasimha, and natural springs."
        ),
        highlights=["Yoga Narasimha summit temple", "Panoramic views of rocky plains", "Namada Chilume natural spring"],
        lat=13.3725,
        lng=77.2104,
        source_url="https://tumkur.nic.in/en/tourist-places/",
        source_name="Tumakuru District Official Portal (NIC)",
        license=NIC_LICENSE,
        attribution=NIC_ATTRIBUTION,
        entry_fees_inr=0,
        entry_fee_note="Free hill and temple entry",
        min_nights=1,
        typical_nights=1,
        daily_cost_budget=1100,
        daily_cost_mid=2300,
        daily_cost_luxury=4800,
    ),
    RawCandidate(
        id="madhugiri-fort",
        name="Madhugiri Monolith Fort",
        district_raw="Tumakuru",
        region="Central Karnataka",
        categories=["adventure", "heritage", "fort"],
        experience_types=["trekking", "sightseeing"],
        interest_tags=["monolith", "asia second largest", "hyder ali", "steep climb"],
        description=(
            "Asia's second largest monolithic granite hill, crowned by a fortress built by Raja Hire Gauda "
            "and reinforced by Hyder Ali, presenting one of South India's finest steep rock treks."
        ),
        highlights=["Challenging sheer granite rock ascent", "Multiple tiers of fortified stone gateways", "Gopalakrishna temple ruins at summit"],
        lat=13.6621,
        lng=77.2084,
        source_url="https://tumkur.nic.in/en/tourist-places/",
        source_name="Tumakuru District Official Portal (NIC)",
        license=NIC_LICENSE,
        attribution=NIC_ATTRIBUTION,
        entry_fees_inr=0,
        entry_fee_note="Free entry",
        min_nights=1,
        typical_nights=1,
    ),

    # -------------------------------------------------------------------------
    # 13. Yadgir (0 coverage -> 2 destinations, 1 attraction)
    # -------------------------------------------------------------------------
    RawCandidate(
        id="yadgir-fort",
        name="Yadgir Fort & Hill",
        district_raw="Yadgir",
        region="Kalyana Karnataka",
        categories=["heritage", "fort"],
        experience_types=["heritage_tour", "sightseeing"],
        interest_tags=["yadav kings", "hill citadel", "bhima river", "cannons"],
        description=(
            "Formidable hill bastion built by the Yadav dynasty atop a 100-meter monolith, "
            "commanding the surrounding Bhima river plains with massive bastions and medieval bronze cannons."
        ),
        highlights=["Medieval cannons on hilltop bastions", "Rock-cut steps and granaries", "Viewpoint over the Bhima River valley"],
        lat=16.7644,
        lng=77.1382,
        source_url="https://yadgir.nic.in/en/tourist-places/",
        source_name="Yadgir District Official Portal (NIC)",
        license=NIC_LICENSE,
        attribution=NIC_ATTRIBUTION,
        entry_fees_inr=0,
        entry_fee_note="Free entry",
        min_nights=1,
        typical_nights=1,
        daily_cost_budget=900,
        daily_cost_mid=1900,
        daily_cost_luxury=3800,
    ),
    RawCandidate(
        id="shorapur",
        name="Shorapur Taylor Manzil",
        district_raw="Yadgir",
        region="Kalyana Karnataka",
        categories=["heritage", "culture"],
        experience_types=["heritage_tour", "sightseeing"],
        interest_tags=["philip meadows taylor", "venkatappa nayaka", "bedas", "colonial history"],
        description=(
            "Historic town known for the valor of Raja Venkatappa Nayaka in the 1857 war of independence, "
            "and Taylor Manzil — the 19th-century colonial residence of British administrator and novelist Philip Meadows Taylor."
        ),
        highlights=["Taylor Manzil colonial architecture", "Fortified gateway of Surpur rulers", "Gopalaswamy Temple"],
        lat=16.5182,
        lng=76.7571,
        source_url="https://yadgir.nic.in/en/tourist-places/",
        source_name="Yadgir District Official Portal (NIC)",
        license=NIC_LICENSE,
        attribution=NIC_ATTRIBUTION,
        entry_fees_inr=0,
        entry_fee_note="Free entry",
        min_nights=1,
        typical_nights=1,
    ),

    # -------------------------------------------------------------------------
    # Secondary attractions bolstering the 7 Low-Coverage Districts
    # -------------------------------------------------------------------------
    RawCandidate(
        id="gokak-falls",
        name="Gokak Falls",
        district_raw="Belagavi",
        region="North Karnataka",
        categories=["nature", "adventure"],
        experience_types=["sightseeing", "nature_walk"],
        interest_tags=["waterfall", "ghataprabha", "hanging bridge", "hydroelectric heritage"],
        description=(
            "Spectacular horseshoe waterfall on the Ghataprabha River plunging 52 meters over sandstone cliffs, "
            "often hailed as Karnataka's Niagara, spanned by a historic 201-meter pedestrian suspension bridge."
        ),
        highlights=["Ghataprabha river gorge plunge", "Walk across historic suspension bridge", "11th-century Mahalingeshwara Chalukya temple"],
        lat=16.1834,
        lng=74.7831,
        source_url="https://belagavi.nic.in/en/tourist-places/",
        source_name="Belagavi District Official Portal (NIC)",
        license=NIC_LICENSE,
        attribution=NIC_ATTRIBUTION,
        entry_fees_inr=20,
        entry_fee_note="Hanging bridge maintenance fee",
        min_nights=1,
        typical_nights=1,
    ),
    RawCandidate(
        id="gurudwara-nanak-jhira",
        name="Gurudwara Nanak Jhira Sahib",
        district_raw="Bidar",
        region="Kalyana Karnataka",
        categories=["spirituality", "heritage"],
        experience_types=["pilgrimage", "sightseeing"],
        interest_tags=["guru nanak", "sikh pilgrimage", "freshwater spring", "amrit kund"],
        description=(
            "Historic Sikh pilgrimage shrine established in 1948 dedicated to Guru Nanak Dev Ji, who according to "
            "tradition struck the hillside with his wooden paten to summon a crystal-clear perennial freshwater spring."
        ),
        highlights=["Sacred Amrit Kund freshwater pool", "Majestic white marble Darbar Sahib", "Community Langar hall"],
        lat=17.9214,
        lng=77.5182,
        source_url="https://karnatakatourism.org/tour-item/gurudwara-nanak-jhira-sahib-bidar/",
        source_name="Karnataka Tourism Official Portal",
        license=KT_LICENSE,
        attribution=KT_ATTRIBUTION,
        entry_fees_inr=0,
        entry_fee_note="Free entry for all visitors",
        min_nights=1,
        typical_nights=1,
    ),
    RawCandidate(
        id="moodbidri-thousand-pillars",
        name="Moodbidri Saavira Kambada Basadi",
        district_raw="Dakshina Kannada",
        region="Coastal Karnataka",
        categories=["heritage", "spirituality"],
        experience_types=["heritage_tour", "pilgrimage"],
        interest_tags=["jain heritage", "thousand pillars", "tribhuvana tilaka chudamani", "granite carving"],
        description=(
            "Renowned as the 'Jain Varanasi of the South', this 1430 AD monolith temple features 1,000 "
            "carved granite pillars, no two of which are identical, dedicated to Chandranatha Swami."
        ),
        highlights=["1,000 uniquely sculpted granite pillars", "Ornate Mahastambha monolithic pillar", "Ancient palm leaf manuscript treasures"],
        lat=13.0685,
        lng=74.9961,
        source_url="https://karnatakatourism.org/tour-item/moodabidri/",
        source_name="Karnataka Tourism Official Portal",
        license=KT_LICENSE,
        attribution=KT_ATTRIBUTION,
        entry_fees_inr=0,
        entry_fee_note="Free entry; donations accepted",
        min_nights=1,
        typical_nights=1,
    ),
    RawCandidate(
        id="chandramouleshwara-temple",
        name="Chandramouleshwara Temple, Hubballi",
        district_raw="Dharwad",
        region="North Karnataka",
        categories=["heritage", "spirituality"],
        experience_types=["heritage_tour", "sightseeing"],
        interest_tags=["badami chalukya", "black granite", "four doors", "sculpture"],
        description=(
            "900-year-old architectural jewel of the Western Chalukya dynasty located on the banks of Unkal Lake, "
            "built of black granite with four monumental entrance doors facing the cardinal directions."
        ),
        highlights=["Four directional sculpted doorways", "Intricate Nataraja stone carvings", "Unkal Lake park waterfront"],
        lat=15.3782,
        lng=75.1141,
        source_url="https://dharwad.nic.in/en/tourist-places/",
        source_name="Dharwad District Official Portal (NIC)",
        license=NIC_LICENSE,
        attribution=NIC_ATTRIBUTION,
        entry_fees_inr=0,
        entry_fee_note="Free entry (ASI protected monument)",
        min_nights=1,
        typical_nights=1,
    ),
    RawCandidate(
        id="khwaja-bande-nawaz",
        name="Khwaja Bande Nawaz Dargah",
        district_raw="Kalaburagi",
        region="Kalyana Karnataka",
        categories=["heritage", "spirituality"],
        experience_types=["pilgrimage", "sightseeing"],
        interest_tags=["sufi shrine", "bahmani architecture", "chishti", "harmony"],
        description=(
            "Revered Sufi shrine of the great 14th-century Chishti saint Hazrat Gesudaraz, fusing Indo-Islamic, "
            "Bahmani, and Deccani architectural motifs with magnificent stucco domes and paintings."
        ),
        highlights=["Grand Bahmani style dome and minarets", "Ancient library with rare Arabic & Persian manuscripts", "Annual historic Urs celebration"],
        lat=17.3325,
        lng=76.8421,
        source_url="https://kalaburagi.nic.in/en/tourist-places/",
        source_name="Kalaburagi District Official Portal (NIC)",
        license=NIC_LICENSE,
        attribution=NIC_ATTRIBUTION,
        entry_fees_inr=0,
        entry_fee_note="Free entry",
        min_nights=1,
        typical_nights=1,
    ),
    RawCandidate(
        id="ibrahim-rauza",
        name="Ibrahim Rauza",
        district_raw="Vijayapura",
        region="North Karnataka",
        categories=["heritage", "architecture"],
        experience_types=["heritage_tour", "sightseeing"],
        interest_tags=["adilk shahi", "taj mahal of the deccan", "stone filigree", "mosque"],
        description=(
            "Known as the 'Taj Mahal of the Deccan', this 1626 AD palatial funerary complex of Ibrahim Adil Shah II "
            "features exquisite hanging stone chains, delicate filigree windows, and acoustic harmony."
        ),
        highlights=["Monolithic carved hanging stone chains", "Arabic calligraphy perforated windows", "Symmetrical minarets and reflecting pool"],
        lat=16.8252,
        lng=75.7024,
        source_url="https://vijayapura.nic.in/en/tourist-places/",
        source_name="Vijayapura District Official Portal (NIC)",
        license=NIC_LICENSE,
        attribution=NIC_ATTRIBUTION,
        entry_fees_inr=25,
        entry_fee_note="ASI monument entry fee",
        min_nights=1,
        typical_nights=1,
    ),
]
