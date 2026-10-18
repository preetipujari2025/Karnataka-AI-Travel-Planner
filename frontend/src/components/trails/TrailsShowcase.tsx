import { Compass, Clock, MapPin, Sparkles, ArrowRight } from "lucide-react";
import { CURATED_TRAILS, type TrailTheme } from "../../lib/trailsData";

interface TrailsShowcaseProps {
  onSelectTrail: (trail: TrailTheme) => void;
}

export default function TrailsShowcase({ onSelectTrail }: TrailsShowcaseProps) {
  return (
    <section id="curated-trails" className="relative py-24 px-4 sm:px-8 max-w-7xl mx-auto">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full glass-pill px-3 py-1 text-xs font-semibold text-amber-400 mb-3">
            <Compass className="h-3.5 w-3.5" />
            <span className="uppercase tracking-widest text-[10px]">Curated Regional Circuits</span>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white">
            Signature Karnataka Trails
          </h2>
          <p className="mt-2 text-slate-400 text-sm sm:text-base max-w-2xl font-light">
            Designed around geological, ecological, and cultural circuits. Pick a signature trail
            to immediately launch the AI planner pre-configured for that region.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>4 Verified Signature Circuits</span>
        </div>
      </div>

      {/* Grid of Trail Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {CURATED_TRAILS.map((trail) => (
          <div
            key={trail.id}
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl glass-panel border-white/10 transition-all duration-500 hover:-translate-y-1.5 hover:border-amber-400/40 hover:shadow-2xl hover:shadow-amber-500/10"
          >
            {/* Top Visual Imagery */}
            <div className="relative h-56 w-full overflow-hidden">
              <img
                src={trail.image}
                alt={trail.title}
                className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#070b12] via-slate-950/40 to-transparent" />

              {/* Days badge */}
              <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full glass-pill px-2.5 py-1 text-[11px] font-semibold text-amber-300">
                <Clock className="h-3 w-3" />
                <span>{trail.durationDays} Days</span>
              </div>

              {/* Region Pill */}
              <div className="absolute bottom-3 left-3 flex items-center gap-1 text-[11px] font-medium text-slate-300">
                <MapPin className="h-3.5 w-3.5 text-amber-400" />
                <span>{trail.region}</span>
              </div>
            </div>

            {/* Content & Details */}
            <div className="flex flex-1 flex-col justify-between p-5">
              <div>
                <h3 className="font-display text-lg font-bold text-white group-hover:text-amber-300 transition-colors">
                  {trail.title}
                </h3>
                <p className="text-xs font-serif italic text-amber-400/80 mt-0.5">
                  {trail.subtitle}
                </p>
                <p className="mt-2.5 text-xs text-slate-400 leading-relaxed line-clamp-2">
                  {trail.tagline}
                </p>

                {/* Highlights tags */}
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {trail.highlights.slice(0, 2).map((hl) => (
                    <span
                      key={hl}
                      className="rounded-md border border-white/5 bg-white/5 px-2 py-0.5 text-[10px] text-slate-300"
                    >
                      {hl}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={() => onSelectTrail(trail)}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-white/5 border border-white/10 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-200 transition-all duration-200 group-hover:bg-gradient-to-r group-hover:from-amber-500 group-hover:to-amber-400 group-hover:text-slate-950 group-hover:border-transparent group-hover:shadow-lg group-hover:shadow-amber-500/20"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Configure Itinerary</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
