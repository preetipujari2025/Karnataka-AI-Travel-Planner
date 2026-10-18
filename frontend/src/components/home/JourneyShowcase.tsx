import { ArrowRight, Compass } from "lucide-react";
import type { Interest, Pace, BudgetTier } from "../../api/types";

export interface JourneyArchetype {
  id: string;
  category: string;
  title: string;
  region: string;
  description: string;
  image: string;
  tags: string[];
  interests: Interest[];
  pace: Pace;
  budgetTier: BudgetTier;
  startCity: string;
  durationDays: number;
}

const JOURNEYS: JourneyArchetype[] = [
  {
    id: "nature-escapes",
    category: "Nature Escapes",
    title: "The Western Ghats & Malnad Mist",
    region: "Coorg • Chikkamagaluru • Sakleshpur",
    description:
      "Wake up to estate coffee aromas, trek the high ridges of Mullayanagiri, and wander through cool rainforest canopies and tumbling waterfalls.",
    image: "/images/coorg.jpg",
    tags: ["Misty Ridges", "Plantation Stays", "Rainforests"],
    interests: ["nature", "adventure"],
    pace: "relaxed",
    budgetTier: "mid",
    startCity: "bengaluru",
    durationDays: 4,
  },
  {
    id: "heritage-trails",
    category: "Heritage Trails",
    title: "Imperial Vijayanagara & Chalukya",
    region: "Hampi • Badami • Pattadakal • Aihole",
    description:
      "Walk among monolithic stone chariots, thousand-year-old rock-cut cave temples, and vast boulder kingdoms glowing in golden evening light.",
    image: "/images/hampi.jpg",
    tags: ["UNESCO Heritage", "Cave Temples", "Ancient Sanctuaries"],
    interests: ["heritage", "photography", "spirituality"],
    pace: "balanced",
    budgetTier: "mid",
    startCity: "hubballi",
    durationDays: 5,
  },
  {
    id: "coastal-journeys",
    category: "Coastal Journeys",
    title: "The Untamed Karavali Coastline",
    region: "Gokarna • Karwar • Murudeshwar • Udupi",
    description:
      "Follow rocky coastal trails down to secluded crescent beaches, gaze at soaring gopuras beside the Arabian Sea, and savour Karavali delicacies.",
    image: "/images/gokarna.jpg",
    tags: ["Crescent Beaches", "Arabian Sea Cliffs", "Coastal Dining"],
    interests: ["beach", "food", "nature"],
    pace: "balanced",
    budgetTier: "mid",
    startCity: "mangaluru",
    durationDays: 4,
  },
  {
    id: "cultural-wildlife",
    category: "Cultural & Wildlife Experiences",
    title: "Royal Splendour & Wild Corridors",
    region: "Mysuru • Kabini • Bandipur • Nagarhole",
    description:
      "Marvel at the illuminated grandeur of the Wadiyar dynasty palace, then drift on dawn boat safaris through pristine leopard and elephant reserves.",
    image: "/images/mysuru.jpg",
    tags: ["Palace Grandeur", "Tiger Reserves", "Dawn River Safaris"],
    interests: ["wildlife", "heritage", "nature"],
    pace: "balanced",
    budgetTier: "luxury",
    startCity: "mysuru",
    durationDays: 5,
  },
];

interface JourneyShowcaseProps {
  onSelectJourney: (journey: JourneyArchetype) => void;
}

export default function JourneyShowcase({ onSelectJourney }: JourneyShowcaseProps) {
  return (
    <section id="experiences" className="relative py-28 px-6 sm:px-10 max-w-7xl mx-auto scroll-mt-20">
      {/* Editorial Section Header */}
      <div className="max-w-3xl mb-16">
        <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-amber-400 font-mono mb-3">
          <Compass className="h-3.5 w-3.5" />
          <span>Curated Journey Archetypes</span>
        </div>
        <h2 className="font-serif text-3xl sm:text-5xl font-normal tracking-tight text-white leading-tight">
          Find the Journey That Feels Like You.
        </h2>
        <p className="mt-4 text-base text-slate-300 font-light leading-relaxed">
          Karnataka is not a single landscape — it is an entire continent of experiences.
          Whether drawn to contemplative stone architecture, deep coffee plantations, or
          untouched coastal cliffs, choose an archetype to anchor your route.
        </p>
      </div>

      {/* Grid of Immersive Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10">
        {JOURNEYS.map((journey) => (
          <div
            key={journey.id}
            className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-white/10 bg-[#0a0f18] transition-all duration-300 hover:border-white/25"
          >
            {/* Visual Photography Box */}
            <div className="relative h-80 sm:h-96 w-full overflow-hidden">
              <img
                src={journey.image}
                alt={journey.title}
                className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              />
              {/* Scrim Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f18] via-[#0a0f18]/30 to-transparent" />

              {/* Category Pill */}
              <div className="absolute top-4 left-4">
                <span className="rounded-md border border-white/15 bg-black/60 px-3 py-1 text-[11px] font-mono uppercase tracking-widest text-amber-300 backdrop-blur-md">
                  {journey.category}
                </span>
              </div>

              {/* Region Pill */}
              <div className="absolute bottom-4 left-4 right-4">
                <span className="text-xs font-mono text-slate-300 uppercase tracking-wider block">
                  {journey.region}
                </span>
                <h3 className="font-serif text-2xl sm:text-3xl font-normal text-white mt-1">
                  {journey.title}
                </h3>
              </div>
            </div>

            {/* Description & Action */}
            <div className="p-6 sm:p-8 flex flex-col justify-between flex-1">
              <p className="text-sm text-slate-300 font-light leading-relaxed">
                {journey.description}
              </p>

              <div className="mt-6 pt-5 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
                {/* Tags */}
                <div className="flex flex-wrap gap-2">
                  {journey.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded bg-white/5 px-2.5 py-1 text-[11px] font-sans text-slate-400"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Action button */}
                <button
                  type="button"
                  onClick={() => onSelectJourney(journey)}
                  className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400 hover:text-amber-300 transition-colors"
                >
                  <span>Plan This Journey</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
