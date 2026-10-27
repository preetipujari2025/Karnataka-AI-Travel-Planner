import { useState } from "react";
import { Clock, MapPin, Sparkles, ArrowRight, Compass } from "lucide-react";
import { CURATED_TRAILS, type TrailTheme } from "../../lib/trailsData";

interface TrailsShowcaseProps {
  onSelectTrail: (trail: TrailTheme) => void;
}

export default function TrailsShowcase({ onSelectTrail }: TrailsShowcaseProps) {
  const [hoveredTrailId, setHoveredTrailId] = useState<string | null>(null);

  return (
    <section id="experiences" className="relative py-20 px-6 sm:px-10 max-w-7xl mx-auto scroll-mt-24">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#2d6a4f]/20 bg-[#eaf4ee] px-3.5 py-1 text-xs font-semibold text-[#1e533c] shadow-xs mb-3">
            <Compass className="h-3.5 w-3.5 text-[#2d6a4f]" />
            <span className="uppercase tracking-wider text-[11px]">Curated Regional Circuits</span>
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-normal tracking-tight text-[#14231b]">
            Featured Karnataka Trails
          </h2>
          <p className="mt-3 text-[#35483d] text-sm sm:text-base max-w-2xl font-normal leading-relaxed">
            Four iconic landscapes defined by geology, rainforests, and maritime history. Each
            circuit is calibrated with authentic travel times and zero-hallucination connections.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-[#2d6a4f] bg-white/80 px-4 py-2 rounded-xl border border-[#cce0d4] shadow-xs">
          <span className="h-2 w-2 rounded-full bg-[#2d6a4f] animate-pulse" />
          <span>4 Verified Signature Trails</span>
        </div>
      </div>

      {/* Big Image Cards Grid (2x2 or 4-col responsive) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {CURATED_TRAILS.map((trail) => {
          const isHovered = hoveredTrailId === trail.id;
          const webpUrl = trail.image.replace(/\.jpg$/, ".webp");

          return (
            <div
              key={trail.id}
              onMouseEnter={() => setHoveredTrailId(trail.id)}
              onMouseLeave={() => setHoveredTrailId(null)}
              className="group relative flex flex-col justify-between overflow-hidden rounded-3xl glass-panel-elevated border border-[#cbe1d5] shadow-lg transition-all duration-500 hover:-translate-y-1.5 hover:shadow-2xl hover:border-[#2d6a4f]/40"
            >
              {/* Big Visual Imagery with Gentle Parallax Zoom */}
              <div className="relative h-72 sm:h-80 w-full overflow-hidden bg-[#eef4f0]">
                <picture>
                  <source srcSet={webpUrl} type="image/webp" />
                  <img
                    src={trail.image}
                    alt={trail.title}
                    loading="lazy"
                    className={`h-full w-full object-cover transition-transform duration-700 ease-out ${
                      isHovered ? "scale-108 -translate-y-1" : "scale-100"
                    }`}
                  />
                </picture>

                {/* Light bottom gradient overlay to blend into the card */}
                <div className="absolute inset-0 bg-gradient-to-t from-white via-white/20 to-transparent" />

                {/* Duration Badge */}
                <div className="absolute top-4 right-4 flex items-center gap-1.5 rounded-full bg-white/90 backdrop-blur-md px-3.5 py-1 text-xs font-semibold text-[#1e533c] border border-[#d2e2d8] shadow-sm">
                  <Clock className="h-3.5 w-3.5 text-[#2d6a4f]" />
                  <span>{trail.durationDays} Days</span>
                </div>

                {/* Region Tag */}
                <div className="absolute bottom-4 left-5 flex items-center gap-1.5 rounded-full bg-white/90 backdrop-blur-md px-3 py-1 text-xs font-medium text-[#263c30] border border-[#d2e2d8] shadow-xs">
                  <MapPin className="h-3.5 w-3.5 text-[#2d6a4f]" />
                  <span>{trail.region}</span>
                </div>
              </div>

              {/* Card Body & Highlights */}
              <div className="flex flex-1 flex-col justify-between p-6 sm:p-7">
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-serif text-2xl font-normal text-[#14231b] group-hover:text-[#1e533c] transition-colors">
                        {trail.title}
                      </h3>
                      <p className="text-xs font-medium text-[#b45309] mt-0.5">
                        {trail.subtitle}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-[#2d6a4f] bg-[#eaf4ee] px-2.5 py-1 rounded-lg border border-[#cbe1d5]">
                      {trail.budgetTier} class
                    </span>
                  </div>

                  <p className="mt-3 text-sm text-[#35483d] leading-relaxed font-normal">
                    {trail.tagline}
                  </p>

                  {/* Highlights chips */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {trail.highlights.map((hl) => (
                      <span
                        key={hl}
                        className="rounded-lg border border-[#d8e6de] bg-[#f7faf8] px-2.5 py-1 text-[11px] font-medium text-[#263c30]"
                      >
                        {hl}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Action CTA */}
                <div className="mt-6 pt-5 border-t border-[#dce9e1] flex items-center justify-between">
                  <div className="text-xs text-[#5e7467]">
                    Starting from <strong className="text-[#14231b] font-semibold capitalize">{trail.startCity}</strong>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectTrail(trail)}
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#f5a623] to-[#e08713] hover:from-[#e59b20] hover:to-[#cb770c] text-white px-5 py-2.5 text-xs font-bold uppercase tracking-wider transition shadow-md shadow-[#e08713]/20 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Plan This Trail</span>
                    <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
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
