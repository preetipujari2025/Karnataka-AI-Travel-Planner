import type { Interest, Pace, BudgetTier } from "../api/types";

export interface TrailTheme {
  id: string;
  title: string;
  subtitle: string;
  tagline: string;
  region: string;
  image: string;
  durationDays: number;
  interests: Interest[];
  pace: Pace;
  budgetTier: BudgetTier;
  startCity: string;
  highlights: string[];
  gradient: string;
}

export const CURATED_TRAILS: TrailTheme[] = [
  {
    id: "vijayanagara-heritage",
    title: "Imperial Vijayanagara & Chalukya",
    subtitle: "Stone Chariots & Monolithic Wonder",
    tagline: "Wander through UNESCO boulder-strewn kingdoms and thousand-year-old rock-cut cave temples.",
    region: "Central & North Karnataka",
    image: "/images/hampi.jpg",
    durationDays: 5,
    interests: ["heritage", "photography", "spirituality"],
    pace: "balanced",
    budgetTier: "mid",
    startCity: "hubballi",
    highlights: ["Hampi Vittala Temple", "Badami Cave Temples", "Pattadakal UNESCO complex", "Tungabhadra boulder sunsets"],
    gradient: "from-amber-500/20 via-orange-500/10 to-transparent",
  },
  {
    id: "western-ghats-coffee",
    title: "Malnad Mist & Coffee Trails",
    subtitle: "Rainforests, Waterfalls & Coffee Estates",
    tagline: "Breathe the crisp mountain air of Coorg and Chikkamagaluru, waking to birdsong and estate aromas.",
    region: "Malnad (Western Ghats)",
    image: "/images/coorg.jpg",
    durationDays: 4,
    interests: ["nature", "food", "adventure"],
    pace: "relaxed",
    budgetTier: "luxury",
    startCity: "bengaluru",
    highlights: ["Mullayanagiri Peak", "Coorg private plantation stays", "Abbey & Hebbe Falls", "Agumbe rainforest sunset"],
    gradient: "from-emerald-500/20 via-teal-500/10 to-transparent",
  },
  {
    id: "karavali-coastline",
    title: "The Golden Karavali Coast",
    subtitle: "Sacred Coves, Pristine Cliffs & Seafood",
    tagline: "Experience tranquil Arabian Sea shores, secluded crescent beaches, towering cliffside temples and legendary coastal delicacies.",
    region: "Coastal Karnataka",
    image: "/images/gokarna.jpg",
    durationDays: 4,
    interests: ["beach", "food", "nature", "photography"],
    pace: "balanced",
    budgetTier: "mid",
    startCity: "mangaluru",
    highlights: ["Gokarna Om Beach trail", "Murudeshwar Shiva Statue", "St. Mary's volcanic islands", "Fresh Karavali sea cuisine"],
    gradient: "from-cyan-500/20 via-blue-500/10 to-transparent",
  },
  {
    id: "royal-mysuru-wildlife",
    title: "Royal Grandeur & Wild Safaris",
    subtitle: "Golden Palaces & Tiger Reserves",
    tagline: "A majestic voyage bridging the illuminated splendour of the Wadiyar dynasty with India's most pristine tiger habitats.",
    region: "South Karnataka & Southern Forests",
    image: "/images/mysuru.jpg",
    durationDays: 5,
    interests: ["wildlife", "heritage", "nature"],
    pace: "balanced",
    budgetTier: "luxury",
    startCity: "mysuru",
    highlights: ["Mysore Palace illuminated twilight", "Kabini backwaters boat safari", "Bandipur tiger reserve dawn drive", "Chamundi Hill"],
    gradient: "from-yellow-500/20 via-amber-500/10 to-transparent",
  },
];
