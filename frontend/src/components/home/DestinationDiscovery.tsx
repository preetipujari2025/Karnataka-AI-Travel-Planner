import { MapPin, ArrowUpRight } from "lucide-react";

export interface FeaturedDestination {
  id: string;
  name: string;
  region: string;
  category: string;
  image: string;
  summary: string;
  tags: string[];
  cityHubId: string;
}

const FEATURED_DESTINATIONS: FeaturedDestination[] = [
  {
    id: "hampi",
    name: "Hampi",
    region: "Central Karnataka",
    category: "UNESCO World Heritage",
    image: "/images/hampi.jpg",
    summary:
      "Capital of the Vijayanagara Empire with monumental granite temples, royal enclosures, and the legendary stone chariot beside the Tungabhadra river.",
    tags: ["Monolithic Ruins", "UNESCO Sanctuary", "Boulder Sunsets"],
    cityHubId: "hubballi",
  },
  {
    id: "mysuru",
    name: "Mysuru",
    region: "South Karnataka",
    category: "Royal Heritage",
    image: "/images/mysuru.jpg",
    summary:
      "Cultural capital of Karnataka celebrated for the illuminated Ambavilas Palace, traditional silk weaving, and gateway to southern wildlife reserves.",
    tags: ["Illuminated Palace", "Dasara Traditions", "Heritage Markets"],
    cityHubId: "mysuru",
  },
  {
    id: "coorg",
    name: "Coorg (Madikeri)",
    region: "Malnad (Western Ghats)",
    category: "Highland Retreat",
    image: "/images/coorg.jpg",
    summary:
      "The Scotland of India — misty coffee and spice estates, high mountain viewpoints, cascading Abbey Falls, and proud Kodava hospitality.",
    tags: ["Coffee Plantations", "Misty Ridges", "Estate Living"],
    cityHubId: "bengaluru",
  },
  {
    id: "gokarna",
    name: "Gokarna",
    region: "Coastal Karnataka",
    category: "Coastal Wilderness",
    image: "/images/gokarna.jpg",
    summary:
      "A serene temple town perched where the Western Ghats meet the Arabian Sea, famous for Om Beach, half-moon coves, and coastal trekking trails.",
    tags: ["Om Beach Trail", "Arabian Sea Cliffs", "Secluded Coves"],
    cityHubId: "mangaluru",
  },
  {
    id: "chikkamagaluru",
    name: "Chikkamagaluru",
    region: "Malnad (Western Ghats)",
    category: "Mountain Ridges",
    image: "/images/chikkamagaluru.jpg",
    summary:
      "The birthplace of Indian coffee nestled beneath Karnataka's highest peak, Mullayanagiri, offering sweeping valley walks and waterfall treks.",
    tags: ["Mullayanagiri Peak", "Ridge Trekking", "Rainforest Waterfalls"],
    cityHubId: "bengaluru",
  },
];

interface DestinationDiscoveryProps {
  onSelectDestination: (dest: FeaturedDestination) => void;
  onExploreAll: () => void;
}

export default function DestinationDiscovery({
  onSelectDestination,
  onExploreAll,
}: DestinationDiscoveryProps) {
  return (
    <section id="discover" className="relative py-28 px-6 sm:px-10 max-w-7xl mx-auto scroll-mt-20">
      {/* Editorial Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-amber-400 font-mono mb-3">
            <MapPin className="h-3.5 w-3.5" />
            <span>Iconic Karnataka Anchors</span>
          </div>
          <h2 className="font-serif text-3xl sm:text-5xl font-normal tracking-tight text-white leading-tight">
            Destination Discovery
          </h2>
          <p className="mt-4 text-base text-slate-300 font-light leading-relaxed">
            Begin your route around one of Karnataka's foundational destinations. Each hub
            anchors surrounding valleys, coastal drives, and ancient trails.
          </p>
        </div>

        <button
          type="button"
          onClick={onExploreAll}
          className="text-xs uppercase tracking-widest font-mono text-slate-400 hover:text-amber-400 transition-colors flex items-center gap-2"
        >
          <span>View All Destinations</span>
          <ArrowUpRight className="h-4 w-4" />
        </button>
      </div>

      {/* Large Visual Destination Cards (Asymmetrical / Grid) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {FEATURED_DESTINATIONS.map((dest, index) => {
          // Give first two cards larger prominence on large screens if desired
          const isSpan = index === 0 || index === 3;

          return (
            <div
              key={dest.id}
              className={`group relative flex flex-col justify-between overflow-hidden rounded-xl border border-white/10 bg-[#0a0f18] transition-all duration-300 hover:border-white/25 ${
                isSpan ? "lg:col-span-1" : "lg:col-span-1"
              }`}
            >
              {/* Card Imagery with Scrim */}
              <div className="relative h-80 sm:h-96 w-full overflow-hidden">
                <img
                  src={dest.image}
                  alt={dest.name}
                  className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f18] via-[#0a0f18]/40 to-transparent" />

                {/* Top Badges */}
                <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                  <span className="rounded-md border border-white/15 bg-black/60 px-3 py-1 text-[10px] font-mono uppercase tracking-widest text-slate-300 backdrop-blur-md">
                    {dest.category}
                  </span>
                  <span className="text-xs font-mono text-amber-400">
                    {dest.region}
                  </span>
                </div>

                {/* Bottom Title on Image */}
                <div className="absolute bottom-4 left-4 right-4">
                  <h3 className="font-serif text-3xl font-normal text-white">
                    {dest.name}
                  </h3>
                </div>
              </div>

              {/* Details & Action */}
              <div className="p-6 flex flex-col justify-between flex-1">
                <p className="text-sm text-slate-300 font-light leading-relaxed line-clamp-3">
                  {dest.summary}
                </p>

                <div className="mt-6 pt-5 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
                  {/* Experience Tags */}
                  <div className="flex flex-wrap gap-1.5">
                    {dest.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded bg-white/5 px-2 py-0.5 text-[10px] font-sans text-slate-400"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Explore & Plan Action */}
                  <button
                    type="button"
                    onClick={() => onSelectDestination(dest)}
                    className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    <span>Plan Around {dest.name}</span>
                    <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
