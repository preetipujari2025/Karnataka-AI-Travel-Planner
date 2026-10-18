import { useState, useEffect, useMemo } from "react";
import { Search, MapPin, Layers, ChevronRight } from "lucide-react";
import { fetchDestinations } from "../../api/client";
import type { DestinationSummary } from "../../api/types";

interface DestinationExplorerProps {
  onSelectStartCity?: (cityId: string) => void;
}

export default function DestinationExplorer({ onSelectStartCity }: DestinationExplorerProps) {
  const [destinations, setDestinations] = useState<DestinationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRegion, setSelectedRegion] = useState<string>("all");

  useEffect(() => {
    const controller = new AbortController();
    fetchDestinations(undefined, controller.signal)
      .then((data) => {
        setDestinations(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
    return () => controller.abort();
  }, []);

  // Unique regions
  const regions = useMemo(() => {
    const set = new Set<string>();
    destinations.forEach((d) => {
      if (d.region) set.add(d.region);
    });
    return ["all", ...Array.from(set)];
  }, [destinations]);

  // Filtered list
  const filtered = useMemo(() => {
    return destinations.filter((d) => {
      const matchesSearch =
        searchQuery === "" ||
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.highlights.some((h) => h.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesRegion = selectedRegion === "all" || d.region === selectedRegion;

      return matchesSearch && matchesRegion;
    });
  }, [destinations, searchQuery, selectedRegion]);

  return (
    <section id="destinations-archive" className="relative py-24 px-4 sm:px-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full glass-pill px-3 py-1 text-xs font-semibold text-emerald-400 mb-3">
            <Layers className="h-3.5 w-3.5" />
            <span className="uppercase tracking-widest text-[10px]">Verified Destination Archive</span>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white">
            {destinations.length > 0
              ? `Karnataka's ${destinations.length} Curated & Verified Destinations`
              : "Karnataka's Verified Destination Archive"}
          </h2>
          <p className="mt-2 text-slate-400 text-sm sm:text-base max-w-2xl font-light">
            Every destination in our intelligent repository contains verified GPS coordinates,
            heritage categories, driving connections, and curated highlights.
          </p>
        </div>

        {/* Search bar */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ruins, hills, beaches, temples..."
            className="w-full rounded-full border border-white/10 bg-slate-900/80 py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
        </div>
      </div>

      {/* Filter Tabs by Region */}
      <div className="flex flex-wrap items-center gap-2 pb-6 border-b border-white/5 mb-8">
        <span className="text-xs uppercase tracking-wider text-slate-500 mr-2 font-semibold">
          Region:
        </span>
        {regions.map((region) => (
          <button
            key={region}
            type="button"
            onClick={() => setSelectedRegion(region)}
            className={`rounded-full px-3 py-1 text-xs capitalize transition-all ${
              selectedRegion === region
                ? "bg-amber-400 text-slate-950 font-bold"
                : "glass-pill text-slate-300 hover:text-white hover:bg-white/10"
            }`}
          >
            {region === "all" ? "All Karnataka" : region}
          </button>
        ))}
      </div>

      {/* Grid of Destinations */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-64 rounded-2xl glass-panel animate-pulse p-6 border-white/5"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl glass-panel p-12 text-center text-slate-400">
          <p className="text-sm">No destinations match your search or filter.</p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setSelectedRegion("all");
            }}
            className="mt-3 text-xs text-amber-400 underline underline-offset-4"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((dest) => (
            <div
              key={dest.id}
              className="group flex flex-col justify-between rounded-2xl glass-panel p-6 border-white/10 transition-all duration-300 hover:border-amber-400/40 hover:-translate-y-1 hover:shadow-xl"
            >
              <div>
                {/* Top meta row */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-amber-400">
                    <MapPin className="h-3 w-3" />
                    {dest.region}
                  </span>
                  {dest.lat && dest.lng ? (
                    <span className="font-mono text-[10px] text-slate-500">
                      {dest.lat.toFixed(2)}°N, {dest.lng.toFixed(2)}°E
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-500">Coordinates pending</span>
                  )}
                </div>

                {/* Title */}
                <h3 className="font-display text-xl font-bold text-white group-hover:text-amber-300 transition-colors">
                  {dest.name}
                </h3>

                {/* Description */}
                <p className="mt-2 text-xs text-slate-400 leading-relaxed line-clamp-3">
                  {dest.description}
                </p>

                {/* Highlights */}
                {dest.highlights.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-white/5">
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold block mb-1.5">
                      Curated Highlights:
                    </span>
                    <ul className="space-y-1">
                      {dest.highlights.slice(0, 3).map((hl) => (
                        <li key={hl} className="text-xs text-slate-300 flex items-center gap-1.5">
                          <span className="h-1 w-1 rounded-full bg-amber-400" />
                          <span className="truncate">{hl}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Tags & Action */}
              <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
                <div className="flex flex-wrap gap-1">
                  {dest.categories.map((cat) => (
                    <span
                      key={cat}
                      className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] text-slate-400 capitalize"
                    >
                      {cat}
                    </span>
                  ))}
                </div>

                {onSelectStartCity && (
                  <button
                    type="button"
                    onClick={() => onSelectStartCity(dest.id)}
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-amber-400 hover:bg-amber-400/10 transition-colors"
                  >
                    <span>Depart here</span>
                    <ChevronRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
