import { useState, useRef, useEffect, useMemo } from "react";
import { MapPin, Search, X, Check, ChevronDown, Compass, Building2 } from "lucide-react";
import type { DestinationSummary } from "../../api/types";

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

  // Selected item
  const selectedLocation = useMemo(() => {
    return (
      cities.find((c) => c.id.toLowerCase() === value.toLowerCase()) ||
      cities.find((c) => value.toLowerCase().includes(c.id.toLowerCase())) ||
      cities[0] || {
        id: "bengaluru",
        name: "Bengaluru",
        region: "Capital Region",
      }
    );
  }, [cities, value]);

  // Filtered locations based on search query
  const filteredCities = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return cities;
    return cities.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.region.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q))
    );
  }, [cities, searchQuery]);

  // Group into Major Hubs vs District Headquarters
  const { majorHubs, districtHqs } = useMemo(() => {
    const hubs: DestinationSummary[] = [];
    const hqs: DestinationSummary[] = [];

    filteredCities.forEach((city) => {
      const isDistrictHq =
        city.name.toLowerCase().includes("district hq") ||
        city.name.toLowerCase().includes("district") ||
        city.id.includes("-");

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
        className="w-full flex items-center justify-between rounded-xl border border-white/10 bg-[#0a0f18] hover:border-amber-400/50 px-3.5 py-3 text-left text-white transition focus:border-amber-400 focus:outline-none disabled:opacity-50"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <MapPin className="h-4 w-4 text-amber-400 shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold truncate text-white">
              {selectedLocation.name}
            </span>
            <span className="text-[11px] text-slate-400 truncate">
              {selectedLocation.region || "Karnataka"}
            </span>
          </div>
        </div>

        <ChevronDown
          className={`h-4 w-4 text-slate-400 transition-transform duration-200 shrink-0 ml-2 ${
            isOpen ? "rotate-180 text-amber-400" : ""
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl border border-white/15 bg-[#0a0f18]/95 backdrop-blur-xl p-3 shadow-2xl animate-in fade-in-50 zoom-in-95">
          {/* Search Box */}
          <div className="relative mb-2.5">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search 31 districts or transit hubs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-8 text-xs text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Results Scroll Area */}
          <div className="max-h-64 overflow-y-auto space-y-3 pr-1 text-xs">
            {filteredCities.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                No matching Karnataka location found for "{searchQuery}".
              </div>
            ) : (
              <>
                {/* Major Transit Hubs Group */}
                {majorHubs.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold">
                      <Compass className="h-3 w-3" />
                      <span>Major Transit Hubs ({majorHubs.length})</span>
                    </div>
                    <div className="space-y-1 mt-1">
                      {majorHubs.map((city) => {
                        const isSelected = selectedLocation.id === city.id;
                        return (
                          <button
                            key={city.id}
                            type="button"
                            onClick={() => handleSelect(city.id)}
                            className={`w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-left transition ${
                              isSelected
                                ? "bg-amber-400/20 text-white font-semibold border border-amber-400/40"
                                : "text-slate-300 hover:bg-white/5 hover:text-white"
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <span className="block truncate text-xs text-white">
                                {city.name}
                              </span>
                              <span className="block text-[10px] text-slate-400 truncate">
                                {city.region}
                              </span>
                            </div>
                            {isSelected && <Check className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* District Headquarters Group */}
                {districtHqs.length > 0 && (
                  <div className="pt-2 border-t border-white/5">
                    <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold">
                      <Building2 className="h-3 w-3" />
                      <span>District Headquarters ({districtHqs.length})</span>
                    </div>
                    <div className="space-y-1 mt-1">
                      {districtHqs.map((city) => {
                        const isSelected = selectedLocation.id === city.id;
                        return (
                          <button
                            key={city.id}
                            type="button"
                            onClick={() => handleSelect(city.id)}
                            className={`w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-left transition ${
                              isSelected
                                ? "bg-amber-400/20 text-white font-semibold border border-amber-400/40"
                                : "text-slate-300 hover:bg-white/5 hover:text-white"
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <span className="block truncate text-xs text-white">
                                {city.name}
                              </span>
                              <span className="block text-[10px] text-slate-400 truncate">
                                {city.region}
                              </span>
                            </div>
                            {isSelected && <Check className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Quick Counter Footer */}
          <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-slate-500 px-1">
            <span>All 31 Districts Supported</span>
            <span>{filteredCities.length} locations</span>
          </div>
        </div>
      )}
    </div>
  );
}
