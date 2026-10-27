// Curated destinations metadata with verified best_months
export interface CuratedDestination {
  id: string;
  name: string;
  region: string;
  district: string;
  lat: number | null;
  lng: number | null;
  categories: string[];
  description: string;
  highlights: string[];
  best_months: number[];
  season_note: string;
  is_start_hub: boolean;
  daily_cost_inr?: { budget: number; mid: number; luxury: number };
}

export const KARNATAKA_DESTINATIONS: CuratedDestination[] = [
  {
    "id": "bengaluru",
    "name": "Bengaluru",
    "region": "Capital Region",
    "district": "Bengaluru Urban",
    "lat": 12.97,
    "lng": 77.56,
    "categories": [
      "urban",
      "food"
    ],
    "description": "India's garden city and tech capital, known for cafés, breweries, markets and a cosmopolitan food scene.",
    "highlights": [
      "Lalbagh Botanical Garden",
      "Cubbon Park",
      "Bangalore Palace",
      "Vidhana Soudha"
    ],
    "best_months": [
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      11,
      12
    ],
    "season_note": "October–February is most comfortable; visitable year-round.",
    "is_start_hub": true,
    "daily_cost_inr": {
      "budget": 1500,
      "mid": 4000,
      "luxury": 10000
    }
  },
  {
    "id": "mysuru",
    "name": "Mysuru (Mysore)",
    "region": "South Karnataka",
    "district": "Mysuru",
    "lat": 12.3086,
    "lng": 76.6531,
    "categories": [
      "heritage",
      "urban",
      "food"
    ],
    "description": "The cultural capital of Karnataka, famous for its illuminated palace, Dasara festivities and traditional markets.",
    "highlights": [
      "Mysore Palace",
      "Chamundi Hill",
      "Brindavan Gardens",
      "Devaraja Market"
    ],
    "best_months": [
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      11,
      12
    ],
    "season_note": "Year-round; October–March is the most comfortable sightseeing window.",
    "is_start_hub": true,
    "daily_cost_inr": {
      "budget": 1200,
      "mid": 3200,
      "luxury": 8000
    }
  },
  {
    "id": "srirangapatna",
    "name": "Srirangapatna",
    "region": "South Karnataka",
    "district": "Mandya",
    "lat": 12.414,
    "lng": 76.704,
    "categories": [
      "heritage",
      "nature"
    ],
    "description": "Island fortress town of Tipu Sultan on the Cauvery, with temples, tombs and gardens close to Mysuru.",
    "highlights": [
      "Sriranganathaswamy Temple",
      "Dariya Daulat Bagh",
      "Tipu Sultan's Gumbaz"
    ],
    "best_months": [
      10,
      11,
      12,
      1,
      2,
      3
    ],
    "season_note": "Best during comfortable weather months.",
    "is_start_hub": false,
    "daily_cost_inr": {
      "budget": 1000,
      "mid": 2600,
      "luxury": 6500
    }
  },
  {
    "id": "ranganathittu",
    "name": "Ranganathittu Bird Sanctuary",
    "region": "South Karnataka",
    "district": "Mandya",
    "lat": 12.4,
    "lng": 76.65,
    "categories": [
      "wildlife",
      "nature"
    ],
    "description": "Riverine sanctuary on the Cauvery with nesting islands, crocodiles and boat rides — a short detour from Mysuru.",
    "highlights": [
      "Boat ride past nesting islands",
      "Painted storks and ibis colonies",
      "Riverside watching points"
    ],
    "best_months": [
      12,
      1,
      2,
      6,
      7,
      8,
      9,
      10,
      11
    ],
    "season_note": "December–February for migratory birds; June–November for the nesting season.",
    "is_start_hub": false,
    "daily_cost_inr": {
      "budget": 1200,
      "mid": 3200,
      "luxury": 8000
    }
  },
  {
    "id": "melkote",
    "name": "Melkote",
    "region": "South Karnataka",
    "district": "Mandya",
    "lat": 12.6594,
    "lng": 76.6483,
    "categories": [
      "heritage",
      "spiritual"
    ],
    "description": "Temple town on a granite hill above the Cauvery plains, known for Cheluvanarayana Swamy and its step tank.",
    "highlights": [
      "Cheluvanarayana Swamy Temple",
      "Kalyani step tank",
      "Tirumalai Rangaswamy hill"
    ],
    "best_months": [
      10,
      11,
      12,
      1,
      2,
      3
    ],
    "season_note": "October–March.",
    "is_start_hub": false,
    "daily_cost_inr": {
      "budget": 950,
      "mid": 2500,
      "luxury": 6500
    }
  },
  {
    "id": "bannerghatta",
    "name": "Bannerghatta Biological Park",
    "region": "Capital Region",
    "district": "Bengaluru Urban",
    "lat": 12.8008,
    "lng": 77.5756,
    "categories": [
      "wildlife",
      "nature"
    ],
    "description": "National park and biological park on Bengaluru's southern edge with safari, zoo and butterfly park.",
    "highlights": [
      "Bus safari through animal zones",
      "Zoo and museum",
      "Butterfly park"
    ],
    "best_months": [
      10,
      11,
      12,
      1,
      2,
      3,
      4,
      5
    ],
    "season_note": "October–February for comfortable weather; wildlife sightings can be strong March–May.",
    "is_start_hub": false,
    "daily_cost_inr": {
      "budget": 1500,
      "mid": 4000,
      "luxury": 10000
    }
  },
  {
    "id": "hampi",
    "name": "Hampi",
    "region": "North Karnataka",
    "district": "Vijayanagara",
    "lat": 15.3344,
    "lng": 76.4622,
    "categories": [
      "heritage",
      "nature"
    ],
    "description": "A UNESCO World Heritage site of boulder-strewn landscapes and the ruined splendour of the Vijayanagara Empire.",
    "highlights": [
      "Virupaksha Temple",
      "Vittala Temple & Stone Chariot",
      "Hemakuta Hill sunset",
      "Royal Enclosure"
    ],
    "best_months": [
      11,
      12,
      1,
      2
    ],
    "season_note": "November–February; very hot March–May.",
    "is_start_hub": false,
    "daily_cost_inr": {
      "budget": 1000,
      "mid": 2800,
      "luxury": 7500
    }
  },
  {
    "id": "badami",
    "name": "Badami",
    "region": "North Karnataka",
    "district": "Bagalkot",
    "lat": 15.92,
    "lng": 75.6803,
    "categories": [
      "heritage",
      "nature"
    ],
    "description": "Rock-cut cave temples of the Chalukyas set above a red sandstone lake, gateway to the Aihole–Pattadakal circuit.",
    "highlights": [
      "Badami Cave Temples",
      "Agastya Lake",
      "Upper Badami Fort",
      "Bhutanatha Group"
    ],
    "best_months": [
      11,
      12,
      1,
      2
    ],
    "season_note": "November–February.",
    "is_start_hub": false,
    "daily_cost_inr": {
      "budget": 900,
      "mid": 2500,
      "luxury": 6500
    }
  },
  {
    "id": "aihole",
    "name": "Aihole",
    "region": "North Karnataka",
    "district": "Bagalkot",
    "lat": 16.0189,
    "lng": 75.8819,
    "categories": [
      "heritage"
    ],
    "description": "Open-air museum of early Chalukyan temples and rock-cut shrines on the Malaprabha river.",
    "highlights": [
      "Durga temple",
      "Lad Khan temple",
      "Ravana Phadi cave"
    ],
    "best_months": [
      11,
      12,
      1,
      2
    ],
    "season_note": "November–February.",
    "is_start_hub": false,
    "daily_cost_inr": {
      "budget": 900,
      "mid": 2400,
      "luxury": 6500
    }
  },
  {
    "id": "pattadakal",
    "name": "Pattadakal",
    "region": "North Karnataka",
    "district": "Bagalkot",
    "lat": 15.9514,
    "lng": 75.8147,
    "categories": [
      "heritage"
    ],
    "description": "UNESCO-listed cluster of Chalukyan temples blending northern and southern Indian temple styles.",
    "highlights": [
      "Papanatha Temple",
      "Virupaksha Temple",
      "Kailasa Temple",
      "Archaeological Museum"
    ],
    "best_months": [
      11,
      12,
      1,
      2
    ],
    "season_note": "November–February.",
    "is_start_hub": false,
    "daily_cost_inr": {
      "budget": 900,
      "mid": 2500,
      "luxury": 6500
    }
  },
  {
    "id": "vijayapura",
    "name": "Vijayapura (Bijapur)",
    "region": "North Karnataka",
    "district": "Vijayapura",
    "lat": 16.83,
    "lng": 75.7361,
    "categories": [
      "heritage"
    ],
    "description": "Adilshahi capital with the monumental Gol Gumbaz, imperial mosques and fine Indo-Islamic architecture.",
    "highlights": [
      "Gol Gumbaz",
      "Ibrahim Rauza",
      "Jama Masjid",
      "Upper Fort"
    ],
    "best_months": [
      11,
      12,
      1,
      2
    ],
    "season_note": "November–February.",
    "is_start_hub": true,
    "daily_cost_inr": {
      "budget": 900,
      "mid": 2400,
      "luxury": 6000
    }
  },
  {
    "id": "bidar",
    "name": "Bidar",
    "region": "North Karnataka",
    "district": "Bidar",
    "lat": 17.9244,
    "lng": 77.5267,
    "categories": [
      "heritage"
    ],
    "description": "The northernmost fortress of the Deccan, with a majestic fort, Bahmani monuments and handmade paper craft.",
    "highlights": [
      "Bidar Fort",
      "Bahmani Tombs",
      "Guru Nanak Jhira Sahib",
      "Rangin Mahal"
    ],
    "best_months": [
      11,
      12,
      1,
      2
    ],
    "season_note": "November–February.",
    "is_start_hub": false,
    "daily_cost_inr": {
      "budget": 850,
      "mid": 2300,
      "luxury": 6000
    }
  },
  {
    "id": "kalaburagi",
    "name": "Kalaburagi (Gulbarga)",
    "region": "North Karnataka",
    "district": "Kalaburagi",
    "lat": 17.3405,
    "lng": 76.8311,
    "categories": [
      "heritage",
      "spiritual"
    ],
    "description": "Former Bahmani capital with the spectacular Jama Masjid, mystic dargahs and rich Sufi heritage.",
    "highlights": [
      "Jama Masjid",
      "Khwaja Banda Nawaz Dargah",
      "Bahmani Tombs",
      "Gulbarga Fort"
    ],
    "best_months": [
      11,
      12,
      1,
      2
    ],
    "season_note": "November–February.",
    "is_start_hub": true,
    "daily_cost_inr": {
      "budget": 900,
      "mid": 2400,
      "luxury": 6000
    }
  },
  {
    "id": "belagavi",
    "name": "Belagavi",
    "region": "North Karnataka",
    "district": "Belagavi",
    "lat": 15.8583,
    "lng": 74.5244,
    "categories": [
      "heritage",
      "urban"
    ],
    "description": "A fort city of Kittur Rani Chennamma with colonial-era libraries, temples and a pleasant plateau climate.",
    "highlights": [
      "Belagavi Fort",
      "Kittur Rani Chennamma Fort",
      "Gokak Falls",
      "Vishweswarayya Tower"
    ],
    "best_months": [
      10,
      11,
      12,
      1,
      2,
      3
    ],
    "season_note": "October–March.",
    "is_start_hub": true,
    "daily_cost_inr": {
      "budget": 1000,
      "mid": 2600,
      "luxury": 6500
    }
  },
  {
    "id": "shravanabelagola",
    "name": "Shravanabelagola",
    "region": "South Karnataka",
    "district": "Hassan",
    "lat": 12.859,
    "lng": 76.489,
    "categories": [
      "heritage",
      "spiritual"
    ],
    "description": "Ancient Jain pilgrimage town crowned by the colossal Gommateshwara Bahubali statue.",
    "highlights": [
      "Gommateshwara Bahubali statue (Vindhyagiri)",
      "Chandragiri hill temples",
      "Kalyani tank"
    ],
    "best_months": [
      10,
      11,
      12,
      1,
      2,
      3
    ],
    "season_note": "October–March.",
    "is_start_hub": false,
    "daily_cost_inr": {
      "budget": 900,
      "mid": 2400,
      "luxury": 6000
    }
  },
  {
    "id": "belur",
    "name": "Belur",
    "region": "South Karnataka",
    "district": "Hassan",
    "lat": 13.1629,
    "lng": 75.8606,
    "categories": [
      "heritage"
    ],
    "description": "Hoysala-era temple town on the Yagachi river, home to the intricately carved Chennakeshava Temple.",
    "highlights": [
      "Chennakeshava Temple",
      "Hoysala sculpture halls",
      "Yagachi Dam"
    ],
    "best_months": [
      10,
      11,
      12,
      1,
      2,
      3
    ],
    "season_note": "October–March.",
    "is_start_hub": false,
    "daily_cost_inr": {
      "budget": 1000,
      "mid": 2600,
      "luxury": 6500
    }
  },
  {
    "id": "halebidu",
    "name": "Halebidu",
    "region": "South Karnataka",
    "district": "Hassan",
    "lat": 13.2132,
    "lng": 75.995,
    "categories": [
      "heritage"
    ],
    "description": "Former Hoysala capital with the monumental Hoysaleswara Temple set beside a lake.",
    "highlights": [
      "Hoysaleswara Temple",
      "Keshava temple (unfinished)",
      "Archaeological Museum"
    ],
    "best_months": [
      10,
      11,
      12,
      1,
      2,
      3
    ],
    "season_note": "October–March.",
    "is_start_hub": false,
    "daily_cost_inr": {
      "budget": 1000,
      "mid": 2600,
      "luxury": 6500
    }
  },
  {
    "id": "somanathapura",
    "name": "Somanathapura",
    "region": "South Karnataka",
    "district": "Mysuru",
    "lat": 12.2757,
    "lng": 76.8817,
    "categories": [
      "heritage"
    ],
    "description": "Small Cauvery-bank village with a perfectly preserved trikuta Chennakeshava temple.",
    "highlights": [
      "Chennakeshava Temple (trikuta)",
      "Sculpted wall panels",
      "Cauvery riverbank"
    ],
    "best_months": [
      10,
      11,
      12,
      1,
      2,
      3
    ],
    "season_note": "October–March.",
    "is_start_hub": false,
    "daily_cost_inr": {
      "budget": 1000,
      "mid": 2600,
      "luxury": 6500
    }
  },
  {
    "id": "hubballi",
    "name": "Hubballi-Dharwad (Hubli)",
    "region": "North Karnataka",
    "district": "Dharwad",
    "lat": 15.3647,
    "lng": 75.124,
    "categories": [
      "urban",
      "food"
    ],
    "description": "Twin commercial cities with a lively street-food culture, centuries-old temples and easy access to Dandeli.",
    "highlights": [
      "Unkal Lake",
      "Chennakeshava Temple",
      "Nrupatunga Betta",
      "SDM Medical College Museum"
    ],
    "best_months": [
      1,
      2,
      3,
      4,
      10,
      11,
      12
    ],
    "season_note": "Best during comfortable weather months.",
    "is_start_hub": true,
    "daily_cost_inr": {
      "budget": 1000,
      "mid": 2600,
      "luxury": 6500
    }
  },
  {
    "id": "dandeli",
    "name": "Dandeli",
    "region": "Malnad (Western Ghats)",
    "district": "Uttara Kannada",
    "lat": 15.2523,
    "lng": 74.6222,
    "categories": [
      "adventure",
      "nature",
      "wildlife"
    ],
    "description": "Jungle adventure hub on the Kali River offering rafting, kayaking, coracle rides and hornbill spotting.",
    "highlights": [
      "Kali River rafting",
      "Dandeli Wildlife Sanctuary",
      "Syntherocks",
      "Kavala Caves"
    ],
    "best_months": [
      10,
      11,
      12,
      1,
      2,
      3,
      4,
      5,
      6
    ],
    "season_note": "Rafting season depends on river flow; confirm locally before booking.",
    "is_start_hub": false,
    "daily_cost_inr": {
      "budget": 1200,
      "mid": 3000,
      "luxury": 8000
    }
  },
  {
    "id": "gokarna",
    "name": "Gokarna",
    "region": "Coastal Karnataka",
    "district": "Uttara Kannada",
    "lat": 14.55,
    "lng": 74.3167,
    "categories": [
      "beach",
      "spiritual",
      "nature"
    ],
    "description": "Temple town on the Arabian Sea with laid-back coves like Om Beach and Kudle Beach.",
    "highlights": [
      "Om Beach",
      "Kudle Beach",
      "Mahabaleshwar Temple",
      "Half Moon Beach trek"
    ],
    "best_months": [
      10,
      11,
      12,
      1,
      2,
      3
    ],
    "season_note": "October–March; sea can be rough during the monsoon.",
    "is_start_hub": true,
    "daily_cost_inr": {
      "budget": 1100,
      "mid": 3000,
      "luxury": 8500
    }
  },
  {
    "id": "murudeshwar",
    "name": "Murudeshwar",
    "region": "Coastal Karnataka",
    "district": "Uttara Kannada",
    "lat": 14.0936,
    "lng": 74.4838,
    "categories": [
      "beach",
      "spiritual"
    ],
    "description": "Coastal shrine with a towering Shiva statue, gopura and island-fort views over the Arabian Sea.",
    "highlights": [
      "Murudeshwar Temple",
      "Shiva Statue",
      "Netrani Island boat ride",
      "Murudeshwar Fort"
    ],
    "best_months": [
      10,
      11,
      12,
      1,
      2,
      3
    ],
    "season_note": "October–March.",
    "is_start_hub": false,
    "daily_cost_inr": {
      "budget": 1000,
      "mid": 2700,
      "luxury": 7000
    }
  },
  {
    "id": "yana",
    "name": "Yana",
    "region": "Malnad (Western Ghats)",
    "district": "Uttara Kannada",
    "lat": 14.527,
    "lng": 74.5596,
    "categories": [
      "nature",
      "adventure"
    ],
    "description": "Limestone cave formations in the Sahyadri forests of Uttara Kannada, reached by a short forest walk.",
    "highlights": [
      "Bhairaveshwara cave",
      "Mohan shikhara cave",
      "Forest trail to the caves"
    ],
    "best_months": [
      10,
      11,
      12,
      1,
      2,
      3
    ],
    "season_note": "October–March (post-monsoon and winter).",
    "is_start_hub": false,
    "daily_cost_inr": {
      "budget": 1000,
      "mid": 2600,
      "luxury": 7000
    }
  },
  {
    "id": "karwar",
    "name": "Karwar",
    "region": "Coastal Karnataka",
    "district": "Uttara Kannada",
    "lat": 14.8,
    "lng": 74.13,
    "categories": [
      "beach",
      "nature"
    ],
    "description": "A quiet harbour town of Rabindranath Tagore fame with island-dotted bays and the Kali river estuary.",
    "highlights": [
      "Devbagh Beach",
      "Karwar Beach",
      "Rabindranath Tagore Beach",
      "Kali River boat ride"
    ],
    "best_months": [
      10,
      11,
      12,
      1,
      2,
      3
    ],
    "season_note": "October–March.",
    "is_start_hub": true,
    "daily_cost_inr": {
      "budget": 1000,
      "mid": 2600,
      "luxury": 7000
    }
  },
  {
    "id": "udupi",
    "name": "Udupi & Manipal",
    "region": "Coastal Karnataka",
    "district": "Udupi",
    "lat": 13.3389,
    "lng": 74.7451,
    "categories": [
      "spiritual",
      "beach",
      "food"
    ],
    "description": "Pilgrim town famous for the Krishna temple, student-town Manipal and the iconic Udupi dosa.",
    "highlights": [
      "Sri Krishna Matha",
      "Malpe Beach",
      "St. Mary's Island",
      "Manipal End Point"
    ],
    "best_months": [
      10,
      11,
      12,
      1,
      2,
      3
    ],
    "season_note": "October–March.",
    "is_start_hub": false,
    "daily_cost_inr": {
      "budget": 1000,
      "mid": 2700,
      "luxury": 7000
    }
  },
  {
    "id": "karkala",
    "name": "Karkala",
    "region": "Coastal Karnataka",
    "district": "Udupi",
    "lat": 13.2,
    "lng": 74.983,
    "categories": [
      "heritage",
      "spiritual"
    ],
    "description": "Coastal hinterland town known for its towering Gommateshwara statue and Jain heritage.",
    "highlights": [
      "Gommateshwara statue",
      "Anantha lake & temple",
      "Karkala Fort"
    ],
    "best_months": [
      10,
      11,
      12,
      1,
      2,
      3
    ],
    "season_note": "October–March.",
    "is_start_hub": false,
    "daily_cost_inr": {
      "budget": 950,
      "mid": 2500,
      "luxury": 6500
    }
  },
  {
    "id": "moodabidri",
    "name": "Moodabidri",
    "region": "Coastal Karnataka",
    "district": "Udupi",
    "lat": 12.9101,
    "lng": 75.003,
    "categories": [
      "heritage",
      "spiritual"
    ],
    "description": "Jain temple town famous for the thousand-pillar Saavira Kambada Basadi.",
    "highlights": [
      "Saavira Kambada Basadi (1000 pillars)",
      "Guru Basadi",
      "Jain manuscript museum"
    ],
    "best_months": [
      10,
      11,
      12,
      1,
      2,
      3
    ],
    "season_note": "October–March.",
    "is_start_hub": false,
    "daily_cost_inr": {
      "budget": 900,
      "mid": 2400,
      "luxury": 6000
    }
  },
  {
    "id": "mangaluru",
    "name": "Mangaluru (Mangalore)",
    "region": "Coastal Karnataka",
    "district": "Dakshina Kannada",
    "lat": 12.8717,
    "lng": 74.8425,
    "categories": [
      "urban",
      "beach",
      "food"
    ],
    "description": "Coastal port city with temple architecture, golden beaches and celebrated Mangalorean seafood.",
    "highlights": [
      "Panambur Beach",
      "Kadri Manjunath Temple",
      "Kudroli Gokarnath Temple",
      "Tannirbhavi Beach"
    ],
    "best_months": [
      10,
      11,
      12,
      1,
      2,
      3
    ],
    "season_note": "October–March.",
    "is_start_hub": true,
    "daily_cost_inr": {
      "budget": 1200,
      "mid": 3000,
      "luxury": 7500
    }
  },
  {
    "id": "agumbe",
    "name": "Agumbe",
    "region": "Malnad (Western Ghats)",
    "district": "Shivamogga",
    "lat": 13.5087,
    "lng": 75.0959,
    "categories": [
      "nature",
      "hills"
    ],
    "description": "Rainforest plateau in the Western Ghats famous for sunset points, king cobras and monsoon streams.",
    "highlights": [
      "Agumbe Sunset Point",
      "Rainforest Research Station",
      "Onake Abbi Falls",
      "Koodlu Teertha trek"
    ],
    "best_months": [
      10,
      11,
      12,
      1,
      2
    ],
    "season_note": "October–February; heavy rains June–September.",
    "is_start_hub": false,
    "daily_cost_inr": {
      "budget": 1000,
      "mid": 2600,
      "luxury": 7000
    }
  },
  {
    "id": "chikkamagaluru",
    "name": "Chikkamagaluru (Chikmagalur)",
    "region": "Malnad (Western Ghats)",
    "district": "Chikkamagaluru",
    "lat": 13.3252,
    "lng": 75.7924,
    "categories": [
      "nature",
      "hills"
    ],
    "description": "Coffee-country hill district of misty peaks, waterfalls and plantation homestays.",
    "highlights": [
      "Mullayanagiri Peak",
      "Baba Budangiri",
      "Hebbe Falls",
      "Coffee plantation walk"
    ],
    "best_months": [
      10,
      11,
      12,
      1,
      2
    ],
    "season_note": "October–February; monsoon June–September.",
    "is_start_hub": true,
    "daily_cost_inr": {
      "budget": 1200,
      "mid": 3200,
      "luxury": 8500
    }
  },
  {
    "id": "kudremukh",
    "name": "Kudremukh",
    "region": "Malnad (Western Ghats)",
    "district": "Chikkamagaluru",
    "lat": 13.1295,
    "lng": 75.2686,
    "categories": [
      "nature",
      "hills",
      "adventure"
    ],
    "description": "Rolling shola grasslands and the classic Kudremukh ridge trek in the Western Ghats.",
    "highlights": [
      "Kudremukh Peak trek",
      "Karkala Bahubali Statue",
      "Hanuman Gundi Falls",
      "Lakya Dam"
    ],
    "best_months": [
      10,
      11,
      12,
      1,
      2
    ],
    "season_note": "October–February; heavy rains June–September.",
    "is_start_hub": false,
    "daily_cost_inr": {
      "budget": 1100,
      "mid": 2800,
      "luxury": 7500
    }
  },
  {
    "id": "sringeri",
    "name": "Sringeri",
    "region": "Malnad (Western Ghats)",
    "district": "Chikkamagaluru",
    "lat": 13.42,
    "lng": 75.25,
    "categories": [
      "spiritual",
      "nature"
    ],
    "description": "Sharada Peetham maths on the Tunga river, a major Advaita pilgrimage centre in the Ghats.",
    "highlights": [
      "Sharada Peetham",
      "Vidyashankara Temple",
      "Tunga river banks"
    ],
    "best_months": [
      10,
      11,
      12,
      1,
      2,
      3
    ],
    "season_note": "October–March.",
    "is_start_hub": false,
    "daily_cost_inr": {
      "budget": 1000,
      "mid": 2600,
      "luxury": 7000
    }
  },
  {
    "id": "shivamogga",
    "name": "Shivamogga (Shimoga)",
    "region": "Malnad (Western Ghats)",
    "district": "Shivamogga",
    "lat": 13.933,
    "lng": 75.567,
    "categories": [
      "urban",
      "nature"
    ],
    "description": "Gateway city to Malnad, base for Jog Falls and wildlife sanctuaries with easy rail and air links.",
    "highlights": [
      "Tyavarekoppa Lion Safari",
      "Sharavathi backwaters",
      "Sacred Heart Museum",
      "Sacred Heart Church"
    ],
    "best_months": [
      10,
      11,
      12,
      1,
      2,
      3
    ],
    "season_note": "October–March.",
    "is_start_hub": true,
    "daily_cost_inr": {
      "budget": 950,
      "mid": 2500,
      "luxury": 6500
    }
  },
  {
    "id": "jog-falls",
    "name": "Jog Falls",
    "region": "Malnad (Western Ghats)",
    "district": "Shivamogga",
    "lat": 14.2235,
    "lng": 74.8087,
    "categories": [
      "nature"
    ],
    "description": "One of India's highest plunge waterfalls, a four-cascade drop in the Sharavathi valley.",
    "highlights": [
      "Viewing platforms for Raja, Rani, Rocket & Roarer",
      "Linganamakki reservoir",
      "Tunga viewpoint"
    ],
    "best_months": [
      8,
      9,
      10,
      11,
      12
    ],
    "season_note": "Peak flow during and just after the monsoon (August–December).",
    "is_start_hub": false,
    "daily_cost_inr": {
      "budget": 950,
      "mid": 2500,
      "luxury": 6500
    }
  },
  {
    "id": "madikeri",
    "name": "Madikeri (Coorg)",
    "region": "Malnad (Western Ghats)",
    "district": "Kodagu",
    "lat": 12.4209,
    "lng": 75.7397,
    "categories": [
      "nature",
      "hills"
    ],
    "description": "Scotland of India — coffee and spice estates, ridge-top viewpoints and Kodava culture.",
    "highlights": [
      "Raja's Seat",
      "Abbey Falls",
      "Madikeri Fort",
      "Dubare Elephant Camp"
    ],
    "best_months": [
      10,
      11,
      12,
      1,
      2,
      3
    ],
    "season_note": "October–March.",
    "is_start_hub": true,
    "daily_cost_inr": {
      "budget": 1300,
      "mid": 3400,
      "luxury": 9000
    }
  },
  {
    "id": "b-r-hills",
    "name": "B.R. Hills (Biligiri Ranganatha)",
    "region": "Southern Forests",
    "district": "Chamarajanagar",
    "lat": 11.9939,
    "lng": 77.1406,
    "categories": [
      "wildlife",
      "nature",
      "hills"
    ],
    "description": "Biligiri Ranganatha hills where the Eastern and Western Ghats meet — temple town, forests and safaris.",
    "highlights": [
      "BRT wildlife sanctuary drive",
      "Biligiri Ranganatha temple",
      "Hilltop viewpoints"
    ],
    "best_months": [
      10,
      11,
      12,
      1,
      2,
      3
    ],
    "season_note": "October–March; drier months are preferable for wildlife viewing.",
    "is_start_hub": false,
    "daily_cost_inr": {
      "budget": 1300,
      "mid": 3600,
      "luxury": 9500
    }
  },
  {
    "id": "bandipur",
    "name": "Bandipur",
    "region": "Southern Forests",
    "district": "Chamarajanagar",
    "lat": 11.6617,
    "lng": 76.6272,
    "categories": [
      "wildlife",
      "nature"
    ],
    "description": "Tiger reserve in the Nilgiri biosphere with elephant herds, dry deciduous forest and jeep safaris.",
    "highlights": [
      "Morning jeep safari",
      "Nilgiri biosphere drive",
      "Bandipur interpretation centre",
      "Mudumalai edge"
    ],
    "best_months": [
      10,
      11,
      12,
      1,
      2,
      3,
      4,
      5
    ],
    "season_note": "October–February; March–May can also be good for sightings.",
    "is_start_hub": false,
    "daily_cost_inr": {
      "budget": 1500,
      "mid": 4500,
      "luxury": 12000
    }
  },
  {
    "id": "kabini",
    "name": "Kabini (Nagarhole)",
    "region": "Southern Forests",
    "district": "Kodagu",
    "lat": 11.9735,
    "lng": 76.3528,
    "categories": [
      "wildlife",
      "nature"
    ],
    "description": "River-side tiger reserve famed for boat safaris, leopards, wild dogs and dense elephant country.",
    "highlights": [
      "Boat safari on Kabini backwaters",
      "Jeep safari in Nagarhole",
      "Barrage viewpoint",
      "Birding at dawn"
    ],
    "best_months": [
      10,
      11,
      12,
      1,
      2,
      3,
      4,
      5
    ],
    "season_note": "Dry season roughly October–May; boat safari may be suspended in very high or low water.",
    "is_start_hub": false,
    "daily_cost_inr": {
      "budget": 1600,
      "mid": 4800,
      "luxury": 13000
    }
  }
];

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function getDestinationsForMonth(monthNumber: number): CuratedDestination[] {
  return KARNATAKA_DESTINATIONS.filter(d => d.best_months && d.best_months.includes(monthNumber));
}

export interface TripIdea {
  title: string;
  region: string;
  durationDays: number;
  description: string;
  destinations: string[];
  startCity: string;
  budgetTier: 'budget' | 'mid' | 'luxury';
  interests: string[];
  image: string;
}

export const CURATED_IDEAS: TripIdea[] = [
  {
    title: 'Hampi & Badami UNESCO Trail',
    region: 'Central & North Karnataka',
    durationDays: 4,
    description: 'Walk amid 14th-century monolithic boulder palaces, stone chariots, and 6th-century rock-cut cave shrines.',
    destinations: ['Hampi', 'Badami', 'Pattadakal', 'Aihole'],
    startCity: 'hubballi',
    budgetTier: 'mid',
    interests: ['heritage', 'photography', 'spirituality'],
    image: '/images/hampi.jpg'
  },
  {
    title: 'Coorg Misty Coffee Highlands',
    region: 'Malnad & Western Ghats',
    durationDays: 3,
    description: 'Wake up to the aroma of arabica coffee, misty plantation walks, Abbey Falls, and peaceful Kodava hospitality.',
    destinations: ['Madikeri', 'Abbey Falls', 'Dubare Elephant Camp', "Raja's Seat"],
    startCity: 'bengaluru',
    budgetTier: 'luxury',
    interests: ['nature', 'food', 'relaxed'],
    image: '/images/coorg.jpg'
  },
  {
    title: 'Western Ghats Waterfalls & Rainforest',
    region: 'Western Ghats & Malnad',
    durationDays: 3,
    description: "Witness India's monumental four-cascade plunge waterfall, dense evergreen canopy walks, and sunset over the misty ghats.",
    destinations: ['Jog Falls', 'Agumbe', 'Shivamogga', 'Sringeri'],
    startCity: 'hubballi',
    budgetTier: 'mid',
    interests: ['waterfalls', 'nature', 'photography'],
    image: '/images/jog_falls.jpg'
  },
  {
    title: 'The Golden Karavali Coast',
    region: 'Coastal Karnataka',
    durationDays: 4,
    description: 'Secluded crescent beaches, cliffside temple panoramas in Murudeshwar, and legendary coastal delicacies.',
    destinations: ['Gokarna', 'Murudeshwar', 'Karwar', 'Yana Rocks'],
    startCity: 'mangaluru',
    budgetTier: 'mid',
    interests: ['beach', 'nature', 'food'],
    image: '/images/gokarna.jpg'
  },
  {
    title: 'Royal Mysuru & Kabini Wildlife Safari',
    region: 'South Karnataka',
    durationDays: 4,
    description: 'Golden palace illumination, Cauvery river island history, and dawn boat safaris in pristine Nilgiri tiger corridors.',
    destinations: ['Mysuru', 'Srirangapatna', 'Kabini', 'Bandipur'],
    startCity: 'bengaluru',
    budgetTier: 'luxury',
    interests: ['wildlife', 'heritage', 'nature'],
    image: '/images/mysuru.jpg'
  }
];

export function getRandomTripIdea(): TripIdea {
  const index = Math.floor(Math.random() * CURATED_IDEAS.length);
  return CURATED_IDEAS[index];
}

export function getTripOfTheWeek(): TripIdea {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const weekNumber = Math.ceil((((now.getTime() - startOfYear.getTime()) / 86400000) + startOfYear.getDay() + 1) / 7);
  return CURATED_IDEAS[weekNumber % CURATED_IDEAS.length];
}

export const COMMON_SPELLING_VARIANTS: Record<string, string[]> = {
  belagavi: ["belgaum"],
  belgaum: ["belagavi"],
  mysuru: ["mysore"],
  mysore: ["mysuru"],
  mangaluru: ["mangalore", "south canara", "dakshina kannada"],
  mangalore: ["mangaluru", "south canara", "dakshina kannada"],
  kalaburagi: ["gulbarga"],
  gulbarga: ["kalaburagi"],
  shivamogga: ["shimoga"],
  shimoga: ["shivamogga"],
  bengaluru: ["bangalore"],
  bangalore: ["bengaluru"],
  vijayapura: ["bijapur"],
  bijapur: ["vijayapura"],
  ballari: ["bellary"],
  bellary: ["ballari"],
  hubballi: ["hubli", "dharwad"],
  hubli: ["hubballi", "dharwad"],
  dharwad: ["hubli", "hubballi"],
  madikeri: ["coorg", "kodagu"],
  coorg: ["madikeri", "kodagu"],
  kodagu: ["coorg", "madikeri"],
  chikkamagaluru: ["chikmagalur", "chickmagalur"],
  chikmagalur: ["chikkamagaluru", "chickmagalur"],
  chickmagalur: ["chikkamagaluru", "chikmagalur"],
  tumakuru: ["tumkur"],
  tumkur: ["tumakuru"],
  bagalkote: ["bagalkot"],
  bagalkot: ["bagalkote"],
  hampi: ["hosapete", "hospet", "vijayanagara"],
  hospet: ["hampi", "hosapete", "vijayanagara"],
  hosapete: ["hampi", "vijayanagara", "hospet"],
  vijayanagara: ["hampi", "hosapete", "hospet"],
  davanagere: ["davangere"],
  davangere: ["davanagere"],
  yadgir: ["yadgiri"],
  yadgiri: ["yadgir"],
  ramanagara: ["ramanagar", "bengaluru south"],
  ramanagar: ["ramanagara", "bengaluru south"],
  udupi: ["udipi"],
  udipi: ["udupi"],
  doddaballapura: ["bengaluru rural", "bangalore rural"],
  karwar: ["uttara kannada", "north canara"],
  chamarajanagara: ["chamarajanagar"],
  chamarajanagar: ["chamarajanagara"],
  chikkaballapura: ["chikkaballapur", "chikballapur"],
  chikkaballapur: ["chikkaballapura", "chikballapur"],
};

export interface StartHubCity {
  id: string;
  name: string;
  region: string;
  lat: number | null;
  lng: number | null;
  categories: string[];
  description: string;
  highlights: string[];
}

export const DEFAULT_START_HUBS: StartHubCity[] = [
  // Primary Transit Hubs
  {
    id: "bengaluru",
    name: "Bengaluru (Bangalore)",
    region: "Capital Region",
    lat: 12.9716,
    lng: 77.5946,
    categories: ["urban", "food"],
    description: "State capital, Kempegowda International Airport and primary transit hub.",
    highlights: ["Lalbagh", "Cubbon Park", "Bangalore Palace"],
  },
  {
    id: "mysuru",
    name: "Mysuru (Mysore)",
    region: "South Karnataka",
    lat: 12.2958,
    lng: 76.6394,
    categories: ["heritage", "urban", "food"],
    description: "Royal heritage capital, cultural gateway and southern rail terminus.",
    highlights: ["Mysore Palace", "Chamundi Hill", "Brindavan Gardens"],
  },
  {
    id: "belagavi",
    name: "Belagavi",
    region: "North Karnataka",
    lat: 15.8497,
    lng: 74.4977,
    categories: ["heritage", "urban"],
    description: "Northern gateway city on NH-48 bordering Maharashtra and Goa with commercial airport.",
    highlights: ["Belagavi Fort", "Kittur Fort", "Gokak Falls"],
  },
  {
    id: "mangaluru",
    name: "Mangaluru (Mangalore)",
    region: "Coastal Karnataka",
    lat: 12.9141,
    lng: 74.8560,
    categories: ["urban", "beach", "food"],
    description: "Major port city, international airport and gateway to coastal Karnataka.",
    highlights: ["Panambur Beach", "Kadri Manjunath Temple", "Tannirbhavi Beach"],
  },
  {
    id: "hubballi",
    name: "Hubballi-Dharwad (Hubli)",
    region: "North Karnataka",
    lat: 15.3647,
    lng: 75.1240,
    categories: ["urban", "food"],
    description: "Commercial capital of North Karnataka and major railway junction with airport.",
    highlights: ["Unkal Lake", "Chennakeshava Temple", "Nrupatunga Betta"],
  },
  {
    id: "kalaburagi",
    name: "Kalaburagi (Gulbarga)",
    region: "North Karnataka",
    lat: 17.3297,
    lng: 76.8343,
    categories: ["heritage", "urban"],
    description: "Kalyana Karnataka divisional headquarters with Bahmani fort and airport.",
    highlights: ["Gulbarga Fort", "Khwaja Bande Nawaz Dargah", "Sharana Basaveshwara Temple"],
  },
  {
    id: "shivamogga",
    name: "Shivamogga (Shimoga)",
    region: "Malnad (Western Ghats)",
    lat: 13.9299,
    lng: 75.5681,
    categories: ["urban", "nature"],
    description: "Gateway city to Malnad and Jog Falls with Kuvempu airport.",
    highlights: ["Tyavarekoppa Lion Safari", "Sharavathi backwaters", "Sacred Heart Church"],
  },
  {
    id: "vijayapura",
    name: "Vijayapura (Bijapur)",
    region: "North Karnataka",
    lat: 16.8302,
    lng: 75.7100,
    categories: ["heritage"],
    description: "Historic Adil Shahi capital famous for Gol Gumbaz and Indo-Islamic monuments.",
    highlights: ["Gol Gumbaz", "Ibrahim Rauza", "Jama Masjid"],
  },
  {
    id: "ballari",
    name: "Ballari (Bellary)",
    region: "North Karnataka",
    lat: 15.1394,
    lng: 76.9214,
    categories: ["urban", "heritage"],
    description: "Historic monolithic rock fortress city and commercial center.",
    highlights: ["Ballari Fort", "Kumbara Rock", "Hampi Gateway"],
  },
  {
    id: "madikeri",
    name: "Madikeri (Coorg / Kodagu)",
    region: "South Karnataka",
    lat: 12.4244,
    lng: 75.7382,
    categories: ["nature", "hills"],
    description: "Coffee capital of India in misty Western Ghats highlands.",
    highlights: ["Raja's Seat", "Abbey Falls", "Madikeri Fort"],
  },
  {
    id: "chikkamagaluru",
    name: "Chikkamagaluru (Chikmagalur)",
    region: "Malnad (Western Ghats)",
    lat: 13.3161,
    lng: 75.7720,
    categories: ["nature", "hills"],
    description: "Coffee birthplace with Karnataka's highest peak Mullayanagiri.",
    highlights: ["Mullayanagiri", "Baba Budangiri", "Hebbe Falls"],
  },
  {
    id: "gokarna",
    name: "Gokarna",
    region: "Coastal Karnataka",
    lat: 14.5479,
    lng: 74.3188,
    categories: ["beach", "spiritual"],
    description: "Pristine pilgrimage and coastal town with five crescent beaches.",
    highlights: ["Om Beach", "Mahabaleshwar Temple", "Kudle Beach"],
  },
  {
    id: "karwar",
    name: "Karwar (Uttara Kannada)",
    region: "Coastal Karnataka",
    lat: 14.8135,
    lng: 74.1298,
    categories: ["beach", "nature"],
    description: "Scenic northern coastal port district HQ near Goa border.",
    highlights: ["Rabindranath Tagore Beach", "Sadashivgad Fort", "Devbagh Beach"],
  },
  {
    id: "hampi",
    name: "Hampi / Hosapete (Vijayanagara)",
    region: "North Karnataka",
    lat: 15.3350,
    lng: 76.4600,
    categories: ["heritage"],
    description: "UNESCO World Heritage imperial capital of Vijayanagara Empire.",
    highlights: ["Virupaksha Temple", "Vijaya Vittala Stone Chariot", "Lotus Mahal"],
  },
  {
    id: "udupi",
    name: "Udupi",
    region: "Coastal Karnataka",
    lat: 13.3409,
    lng: 74.7421,
    categories: ["heritage", "beach", "food"],
    description: "Temple town, culinary capital, and gateway to Malpe beach.",
    highlights: ["Krishna Matha", "Malpe Beach", "St. Mary's Island"],
  },
  // District Headquarters
  { id: "bagalkote", name: "Bagalkote (Bagalkot District HQ)", region: "Belagavi Division", lat: 16.1817, lng: 75.6958, categories: ["urban", "heritage"], description: "District HQ: Bagalkote City. Major heritage circuits: Badami, Aihole, Pattadakal.", highlights: ["Bagalkote City", "Badami Gateway"] },
  { id: "bidar", name: "Bidar (Bidar District HQ)", region: "Kalaburagi Division", lat: 17.9104, lng: 77.5199, categories: ["urban", "heritage"], description: "District HQ: Bidar City. Crown of Karnataka featuring Bahmani architecture.", highlights: ["Bidar Fort", "Mahmud Gawan Madrasa"] },
  { id: "chamarajanagara", name: "Chamarajanagara (Chamarajanagar District HQ)", region: "Mysuru Division", lat: 11.9261, lng: 76.9437, categories: ["urban", "nature"], description: "District HQ: Chamarajanagara. Border district with Bandipur and B.R. Hills.", highlights: ["Chamarajanagar Town", "Bandipur Gateway"] },
  { id: "chikkaballapura", name: "Chikkaballapura (Chikkaballapur District HQ)", region: "Bengaluru Division", lat: 13.4355, lng: 77.7315, categories: ["urban", "nature"], description: "District HQ: Chikkaballapura City. Home of Nandi Hills and Bhoga Nandeeshwara.", highlights: ["Nandi Hills", "Bhoga Nandeeshwara"] },
  { id: "chitradurga", name: "Chitradurga (Chitradurga District HQ)", region: "Bengaluru Division", lat: 14.2251, lng: 76.3980, categories: ["urban", "heritage"], description: "District HQ: Chitradurga City. Famous stone fortress and wind farms.", highlights: ["Chitradurga Fort", "Chandravalli Caves"] },
  { id: "davanagere", name: "Davanagere (Davangere District HQ)", region: "Bengaluru Division", lat: 14.4644, lng: 75.9218, categories: ["urban", "food"], description: "District HQ: Davanagere City. Heart of Karnataka known for Benne Dosa.", highlights: ["Davanagere Town", "Harihar Temple"] },
  { id: "dharwad", name: "Dharwad (Dharwad District HQ)", region: "Belagavi Division", lat: 15.4589, lng: 75.0078, categories: ["urban", "heritage"], description: "District HQ: Dharwad City (twin city with Hubballi transit hub).", highlights: ["Dharwad City", "Karnatak University"] },
  { id: "bengaluru-rural", name: "Doddaballapura (Bengaluru Rural District HQ)", region: "Bengaluru Division", lat: 13.2924, lng: 77.5428, categories: ["urban", "nature"], description: "District HQ: Doddaballapura. Features Ghati Subramanya and Shivagange.", highlights: ["Doddaballapura Town", "Ghati Subramanya"] },
  { id: "gadag", name: "Gadag-Betageri (Gadag District HQ)", region: "Belagavi Division", lat: 15.4298, lng: 75.6320, categories: ["urban", "heritage"], description: "District HQ: Gadag-Betageri. Kalyana Chalukya architectural treasure at Lakkundi.", highlights: ["Trikuteshwara Temple", "Lakkundi"] },
  { id: "hassan", name: "Hassan (Hassan District HQ)", region: "Mysuru Division", lat: 13.0033, lng: 76.1004, categories: ["urban", "heritage"], description: "District HQ: Hassan City. Base for Belur, Halebidu, and Shravanabelagola.", highlights: ["Hassan Town Center", "Hoysala Gateway"] },
  { id: "haveri", name: "Haveri (Haveri District HQ)", region: "Belagavi Division", lat: 14.7954, lng: 75.3992, categories: ["urban", "nature"], description: "District HQ: Haveri City. Known for Ranebennur wildlife and cardamom trade.", highlights: ["Haveri Town", "Ranebennur Blackbuck"] },
  { id: "vijayanagara", name: "Hosapete (Vijayanagara District HQ)", region: "Kalaburagi Division", lat: 15.2689, lng: 76.3909, categories: ["urban", "heritage"], description: "District HQ: Hosapete City. Heart of UNESCO Hampi monuments.", highlights: ["Hosapete Town", "Tungabhadra Dam"] },
  { id: "kolar", name: "Kolar (Kolar District HQ)", region: "Bengaluru Division", lat: 13.1367, lng: 78.1291, categories: ["urban", "nature"], description: "District HQ: Kolar City. Land of gold mines (KGF) and Antara Gange caves.", highlights: ["Kolar Town", "Antara Gange"] },
  { id: "koppal", name: "Koppal (Koppal District HQ)", region: "Kalaburagi Division", lat: 15.3468, lng: 76.1550, categories: ["urban", "heritage"], description: "District HQ: Koppal Town. Kinnal wood craft and Anegundi Kishkindha.", highlights: ["Koppal Fort", "Anegundi Gateway"] },
  { id: "mandya", name: "Mandya (Mandya District HQ)", region: "Mysuru Division", lat: 12.5218, lng: 76.8951, categories: ["urban", "nature"], description: "District HQ: Mandya City. Sugar city with Srirangapatna and Ranganathittu.", highlights: ["Mandya Town", "Srirangapatna Gateway"] },
  { id: "raichur", name: "Raichur (Raichur District HQ)", region: "Kalaburagi Division", lat: 16.2120, lng: 77.3439, categories: ["urban", "heritage"], description: "District HQ: Raichur City. Doab region between Krishna and Tungabhadra rivers.", highlights: ["Raichur Fort", "Tungabhadra Basin"] },
  { id: "bengaluru-south", name: "Ramanagara (Bengaluru South District HQ)", region: "Bengaluru Division", lat: 12.7209, lng: 77.2799, categories: ["urban", "nature"], description: "District HQ: Ramanagara (Silk City and Sholay hill boulders).", highlights: ["Ramadevara Betta", "Silk Cocoon Market"] },
  { id: "tumakuru", name: "Tumakuru (Tumkur District HQ)", region: "Bengaluru Division", lat: 13.3409, lng: 77.1010, categories: ["urban", "nature"], description: "District HQ: Tumakuru City. City of education and monolith hills.", highlights: ["Devarayanadurga", "Madhugiri Monolith"] },
  { id: "yadgir", name: "Yadgir (Yadgir District HQ)", region: "Kalaburagi Division", lat: 16.7700, lng: 77.1300, categories: ["urban", "heritage"], description: "District HQ: Yadgir Town. Historic hill fort on the Bhima river basin.", highlights: ["Yadgir Fort", "Bhima River"] },
];

