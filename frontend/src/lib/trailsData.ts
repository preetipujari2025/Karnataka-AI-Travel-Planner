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
    id: "hampi-heritage",
    title: "Hampi Heritage Trail",
    subtitle: "Stone Chariots & Monolithic Kingdoms",
    tagline: "Wander through UNESCO boulder-strewn Vijayanagara ruins, sacred Tungabhadra banks, and ancient Chalukyan rock-cut caves.",
    region: "Central & North Karnataka",
    image: "/images/hampi.jpg",
    durationDays: 5,
    interests: ["heritage", "photography", "spirituality"],
    pace: "balanced",
    budgetTier: "mid",
    startCity: "hubballi",
    highlights: ["Hampi Vittala Temple", "Badami Cave Temples", "Pattadakal UNESCO complex", "Tungabhadra boulder sunsets"],
    gradient: "from-[#2d6a4f]/15 to-transparent",
  },
  {
    id: "coorg-coffee",
    title: "Coorg Coffee Trails",
    subtitle: "Misty Estates & Highland Hospitality",
    tagline: "Breathe the crisp mountain air of Coorg, waking to birdsong, private arabica estate walks, Abbey Falls, and peaceful Kodava homestays.",
    region: "Malnad & Western Ghats",
    image: "/images/coorg.jpg",
    durationDays: 4,
    interests: ["nature", "food", "coffee_hills"],
    pace: "relaxed",
    budgetTier: "luxury",
    startCity: "bengaluru",
    highlights: ["Private coffee plantation walks", "Mullayanagiri & Brahmagiri ridges", "Abbey & Hebbe Falls", "Aromas of fresh Kodava roasts"],
    gradient: "from-[#2d6a4f]/15 to-transparent",
  },
  {
    id: "western-ghats-waterfalls",
    title: "Western Ghats Waterfalls",
    subtitle: "Cascading Plunges & Rainforest Canopy",
    tagline: "Experience India's monumental four-tier Jog plunge waterfall, dense Agumbe rainforest trails, and misty green mountain streams.",
    region: "Western Ghats & Malnad",
    image: "/images/jog_falls.jpg",
    durationDays: 3,
    interests: ["waterfalls", "nature", "photography"],
    pace: "balanced",
    budgetTier: "mid",
    startCity: "hubballi",
    highlights: ["Jog Falls 4-stream cascades", "Agumbe rainforest canopy walks", "Sharavathi valley viewpoints", "Dense misty ghat descents"],
    gradient: "from-[#2d6a4f]/15 to-transparent",
  },
  {
    id: "karavali-coast",
    title: "Karavali Coast & Cliffs",
    subtitle: "Sacred Coves, Golden Sands & Cliffside Panoramas",
    tagline: "Unwind along serene Arabian Sea shores, secluded crescent beach trails in Gokarna, monumental cliffside Shiva temples, and coastal delicacies.",
    region: "Coastal Karnataka",
    image: "/images/gokarna.jpg",
    durationDays: 4,
    interests: ["beach", "food", "nature", "photography"],
    pace: "balanced",
    budgetTier: "mid",
    startCity: "mangaluru",
    highlights: ["Gokarna Om Beach cliff trail", "Murudeshwar seaside monument", "St. Mary's volcanic basalt islands", "Fresh coastal Karavali cuisine"],
    gradient: "from-[#2d6a4f]/15 to-transparent",
  },
];
