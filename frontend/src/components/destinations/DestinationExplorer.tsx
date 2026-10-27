import { useState, useEffect, useMemo, useCallback } from "react";
import { Search, MapPin, Layers, ChevronRight, AlertCircle, RefreshCw } from "lucide-react";
import { fetchDestinations } from "../../api/client";
import type { DestinationSummary } from "../../api/types";
import { getDestinationImage } from "../../lib/destinationAssets";
import { KARNATAKA_DESTINATIONS } from "../../lib/destinationsData";

interface DestinationExplorerProps {
  onSelectStartCity?: (cityId: string) => void;
}

const CURATED_FALLBACK_DESTINATIONS: DestinationSummary[] = KARNATAKA_DESTINATIONS.map((d) => ({
  id: d.id,
  name: d.name,
  region: d.region,
  lat: d.lat,
  lng: d.lng,
  categories: d.categories,
  description: d.description,
  highlights: d.highlights,
}));

export default function DestinationExplorer({ onSelectStartCity }: DestinationExplorerProps) {
  const [destinations, setDestinations] = useState<DestinationSummary[]>(CURATED_FALLBACK_DESTINATIONS);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRegion, setSelectedRegion] = useState<string>("all");
  const [backendError, setBackendError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const loadDestinations = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      const data = await fetchDestinations(undefined, signal);
      if (data && data.length > 0) {
        setDestinations(data);
        setBackendError(null);
      } else {
        setDestinations(CURATED_FALLBACK_DESTINATIONS);
      }
    } catch (err) {
      if (signal?.aborted) return;
      // Backend is down or returned error: use built-in curated destinations so explorer is NEVER empty
      setDestinations(CURATED_FALLBACK_DESTINATIONS);
      setBackendError(
        "Backend service at :8000 is currently offline. Showing built-in verified Karnataka destinations."
      );
    } finally {
      setLoading(false);
      setIsRetrying(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadDestinations(controller.signal);
    return () => controller.abort();
  }, [loadDestinations]);

  function handleRetry() {
    setIsRetrying(true);
    loadDestinations();
  }

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
    <section id="destinations-archive" className="relative py-20 px-6 sm:px-10 max-w-7xl mx-auto scroll-mt-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#2d6a4f]/20 bg-[#eaf4ee] px-3.5 py-1 text-xs font-semibold text-[#1e533c] shadow-xs mb-3">
            <Layers className="h-3.5 w-3.5 text-[#2d6a4f]" />
            <span className="uppercase tracking-wider text-[11px]">Verified Karnataka Destinations</span>
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-normal tracking-tight text-[#14231b]">
            Destination Explorer
          </h2>
          <p className="mt-3 text-[#35483d] text-sm sm:text-base max-w-2xl font-normal leading-relaxed">
            Every destination in our repository features verified GPS coordinates, authentic
            regional categorizations, realistic road transit, and curated highlights.
          </p>
        </div>

        {/* Search bar */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5e7467]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ruins, hills, beaches..."
            className="w-full rounded-2xl border border-[#c8dec2] bg-white py-2.5 pl-10 pr-4 text-xs text-[#14231b] placeholder-[#7d9385] shadow-xs focus:border-[#2d6a4f] focus:outline-hidden focus:ring-2 focus:ring-[#2d6a4f]/20 transition"
          />
        </div>
      </div>

      {/* Backend Offline Graceful Notification with Try Again Button */}
      {backendError && (
        <div className="mb-8 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
            <span>{backendError}</span>
          </div>
          <button
            type="button"
            onClick={handleRetry}
            disabled={isRetrying}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#2d6a4f] text-white px-3.5 py-1.5 text-xs font-semibold hover:bg-[#1e533c] transition shadow-xs cursor-pointer shrink-0 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRetrying ? "animate-spin" : ""}`} />
            <span>{isRetrying ? "Retrying..." : "Try again"}</span>
          </button>
        </div>
      )}

      {/* Filter Tabs by Region */}
      <div className="flex flex-wrap items-center gap-2 pb-6 border-b border-[#dce9e1] mb-8">
        <span className="text-xs uppercase tracking-wider text-[#526a5c] mr-2 font-semibold">
          Filter Region:
        </span>
        {regions.map((region) => (
          <button
            key={region}
            type="button"
            onClick={() => setSelectedRegion(region)}
            className={`rounded-full px-4 py-1.5 text-xs capitalize transition-all cursor-pointer ${
              selectedRegion === region
                ? "bg-[#2d6a4f] text-white font-semibold shadow-xs"
                : "bg-white text-[#263c30] border border-[#d2e2d8] hover:border-[#2d6a4f]/40 hover:bg-[#eaf4ee]"
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
              className="h-64 rounded-3xl glass-panel-elevated animate-pulse p-6 border-[#cbe1d5]"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl glass-panel-elevated p-12 text-center text-[#5e7467] border border-[#cbe1d5]">
          <p className="text-sm">No destinations match your search or filter.</p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setSelectedRegion("all");
            }}
            className="mt-3 text-xs text-[#1e533c] font-semibold underline underline-offset-4 cursor-pointer"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((dest) => {
            const img = getDestinationImage(dest.id, dest.region);
            const webp = img.replace(/\.jpg$/, ".webp");

            return (
              <div
                key={dest.id}
                className="group flex flex-col justify-between overflow-hidden rounded-3xl glass-panel-elevated border border-[#cbe1d5] shadow-sm transition-all duration-300 hover:border-[#2d6a4f]/40 hover:-translate-y-1 hover:shadow-xl"
              >
                <div>
                  {/* Visual Image Header */}
                  <div className="relative h-44 w-full overflow-hidden bg-[#eef4f0]">
                    <picture>
                      <source srcSet={webp} type="image/webp" />
                      <img
                        src={img}
                        alt={dest.name}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </picture>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />

                    <div className="absolute top-3 left-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/90 backdrop-blur-xs px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#1e533c]">
                        <MapPin className="h-3 w-3 text-[#2d6a4f]" />
                        {dest.region}
                      </span>
                    </div>

                    <div className="absolute bottom-3 left-4 right-4 text-white">
                      <h3 className="font-serif text-lg font-normal text-white drop-shadow-xs">
                        {dest.name}
                      </h3>
                    </div>
                  </div>

                  <div className="p-5">
                    {/* Description */}
                    <p className="text-xs text-[#35483d] leading-relaxed line-clamp-3">
                      {dest.description}
                    </p>

                    {/* Highlights */}
                    {dest.highlights.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-[#dce9e1]">
                        <span className="text-[10px] uppercase tracking-wider text-[#5e7467] font-semibold block mb-1.5">
                          Signature Highlights:
                        </span>
                        <ul className="space-y-1">
                          {dest.highlights.slice(0, 3).map((hl) => (
                            <li key={hl} className="text-xs text-[#263c30] flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-[#2d6a4f]" />
                              <span className="truncate">{hl}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                {/* Categories & Depart Action */}
                <div className="px-5 pb-5 pt-2 border-t border-[#dce9e1] flex items-center justify-between">
                  <div className="flex flex-wrap gap-1">
                    {dest.categories.slice(0, 2).map((cat) => (
                      <span
                        key={cat}
                        className="rounded-md bg-[#eaf4ee] border border-[#c2ded0] px-2 py-0.5 text-[10px] text-[#1e533c] font-medium capitalize"
                      >
                        {cat}
                      </span>
                    ))}
                  </div>

                  {onSelectStartCity && (
                    <button
                      type="button"
                      onClick={() => onSelectStartCity(dest.id)}
                      className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-[#1e533c] hover:bg-[#eaf4ee] transition cursor-pointer"
                    >
                      <span>Depart here</span>
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
