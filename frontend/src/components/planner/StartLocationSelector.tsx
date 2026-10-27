import { useState, useRef, useEffect, useMemo } from "react";
import { MapPin, Search, X, Check, ChevronDown, Compass, Building2 } from "lucide-react";
import type { DestinationSummary } from "../../api/types";
import { DEFAULT_START_HUBS, COMMON_SPELLING_VARIANTS } from "../../lib/destinationsData";

interface StartLocationSelectorProps {
  value: string;
  onChange: (id: string) => void;
  cities: DestinationSummary[];
  disabled?: boolean;
  id?: string;
  className?: string;
}

export default function StartLocationSelector({
  value,
  onChange,
  cities,
  disabled = false,
  id = "start-location-selector",
  className = "",
}: StartLocationSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Fall back to built-in verified start hubs if cities prop is empty or loading
  const effectiveCities = useMemo(() => {
    if (cities && cities.length > 0) {
      return cities;
    }
    return DEFAULT_START_HUBS as unknown as DestinationSummary[];
  }, [cities]);

  // Selected item
  const selectedLocation = useMemo(() => {
    return (
      effectiveCities.find((c) => c.id.toLowerCase() === value.toLowerCase()) ||
      effectiveCities.find((c) => value.toLowerCase().includes(c.id.toLowerCase())) ||
      effectiveCities[0] || {
        id: "bengaluru",
        name: "Bengaluru",
        region: "Capital Region",
      }
    );
  }, [effectiveCities, value]);

  // Filtered locations based on search query with common spelling variants support
  const filteredCities = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return effectiveCities;

    // Check if query or any part of query has aliases/variants
    const searchTerms = [q];
    for (const [key, variants] of Object.entries(COMMON_SPELLING_VARIANTS)) {
      if (q === key || q.includes(key) || key.includes(q)) {
        searchTerms.push(...variants);
      }
      for (const v of variants) {
        if (q === v || q.includes(v) || v.includes(q)) {
          searchTerms.push(key, ...variants);
        }
      }
    }
    const uniqueTerms = Array.from(new Set(searchTerms.map((t) => t.toLowerCase())));

    return effectiveCities.filter((c) => {
      const name = c.name.toLowerCase();
      const id = c.id.toLowerCase();
      const region = c.region.toLowerCase();
      const desc = (c.description || "").toLowerCase();

      // Direct match
      if (name.includes(q) || id.includes(q) || region.includes(q) || desc.includes(q)) {
        return true;
      }

      // Alias / variant match
      return uniqueTerms.some(
        (term) => name.includes(term) || id.includes(term) || region.includes(term) || desc.includes(term)
      );
    });
  }, [effectiveCities, searchQuery]);

  // Group into Major Hubs vs District Headquarters
  const { majorHubs, districtHqs } = useMemo(() => {
    const hubs: DestinationSummary[] = [];
    const hqs: DestinationSummary[] = [];

    filteredCities.forEach((city) => {
      const isDistrictHq =
        city.name.toLowerCase().includes("district hq") ||
        city.name.toLowerCase().includes("district") ||
        (city.id.includes("-") && !["jog-falls", "b-r-hills"].includes(city.id));

      if (isDistrictHq) {
        hqs.push(city);
      } else {
        hubs.push(city);
      }
    });

    return { majorHubs: hubs, districtHqs: hqs };
  }, [filteredCities]);

  function handleSelect(cityId: string) {
    onChange(cityId);
    setIsOpen(false);
    setSearchQuery("");
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between rounded-2xl border border-[#c8dec2] bg-white hover:border-[#2d6a4f]/50 px-4 py-3 text-left text-[#14231b] transition shadow-xs focus:border-[#2d6a4f] focus:outline-hidden disabled:opacity-50 cursor-pointer"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <MapPin className="h-4 w-4 text-[#2d6a4f] shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold truncate text-[#14231b]">
              {selectedLocation.name}
            </span>
            <span className="text-[11px] text-[#5e7467] truncate">
              {selectedLocation.region || "Karnataka"}
            </span>
          </div>
        </div>

        <ChevronDown
          className={`h-4 w-4 text-[#5e7467] transition-transform duration-200 shrink-0 ml-2 ${
            isOpen ? "rotate-180 text-[#2d6a4f]" : ""
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-3xl border border-[#cbe1d5] bg-white/98 backdrop-blur-xl p-3.5 shadow-2xl animate-in fade-in-50 zoom-in-95">
          {/* Search Box */}
          <div className="relative mb-2.5">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#5e7467]" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search 31 districts or transit hubs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-[#c8dec2] bg-[#f8faf8] py-2 pl-9 pr-8 text-xs text-[#14231b] placeholder-[#7d9385] focus:border-[#2d6a4f] focus:bg-white focus:outline-hidden"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2.5 text-[#5e7467] hover:text-[#14231b]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* List Container */}
          <div className="max-h-64 overflow-y-auto space-y-4 pr-1 text-xs">
            {filteredCities.length === 0 ? (
              <div className="p-4 text-center text-[#5e7467]">
                No matching Karnataka destination or district.
              </div>
            ) : (
              <>
                {/* Major Hubs */}
                {majorHubs.length > 0 && (
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-[#2d6a4f] font-bold px-2 py-1 block">
                      Primary Transit Hubs & Airports
                    </span>
                    <div className="space-y-1">
                      {majorHubs.map((city) => {
                        const isSelected =
                          city.id.toLowerCase() === value.toLowerCase() ||
                          value.toLowerCase().includes(city.id.toLowerCase());
                        return (
                          <button
                            key={city.id}
                            type="button"
                            onClick={() => handleSelect(city.id)}
                            className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-left transition cursor-pointer ${
                              isSelected
                                ? "bg-[#2d6a4f] text-white font-semibold"
                                : "hover:bg-[#eaf4ee] text-[#14231b]"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Compass
                                className={`h-3.5 w-3.5 shrink-0 ${
                                  isSelected ? "text-amber-200" : "text-[#2d6a4f]"
                                }`}
                              />
                              <div className="truncate">
                                <span className="block truncate">{city.name}</span>
                                <span
                                  className={`text-[10px] block truncate ${
                                    isSelected ? "text-emerald-100" : "text-[#5e7467]"
                                  }`}
                                >
                                  {city.region}
                                </span>
                              </div>
                            </div>
                            {isSelected && <Check className="h-3.5 w-3.5 shrink-0 ml-2 text-white" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* District Headquarters */}
                {districtHqs.length > 0 && (
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-[#5e7467] font-semibold px-2 py-1 block">
                      District Headquarters (31 Districts)
                    </span>
                    <div className="space-y-1">
                      {districtHqs.map((city) => {
                        const isSelected =
                          city.id.toLowerCase() === value.toLowerCase() ||
                          value.toLowerCase().includes(city.id.toLowerCase());
                        return (
                          <button
                            key={city.id}
                            type="button"
                            onClick={() => handleSelect(city.id)}
                            className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-left transition cursor-pointer ${
                              isSelected
                                ? "bg-[#2d6a4f] text-white font-semibold"
                                : "hover:bg-[#eaf4ee] text-[#14231b]"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Building2
                                className={`h-3.5 w-3.5 shrink-0 ${
                                  isSelected ? "text-amber-200" : "text-[#5e7467]"
                                }`}
                              />
                              <div className="truncate">
                                <span className="block truncate">{city.name}</span>
                                <span
                                  className={`text-[10px] block truncate ${
                                    isSelected ? "text-emerald-100" : "text-[#5e7467]"
                                  }`}
                                >
                                  {city.region}
                                </span>
                              </div>
                            </div>
                            {isSelected && <Check className="h-3.5 w-3.5 shrink-0 ml-2 text-white" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
