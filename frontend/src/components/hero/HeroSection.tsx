import { ArrowRight, Compass, MapPin } from "lucide-react";
import KarnatakaRouteMap from "./KarnatakaRouteMap";

interface HeroSectionProps {
  onCreateItinerary: () => void;
  onExploreKarnataka: () => void;
}

export default function HeroSection({
  onCreateItinerary,
  onExploreKarnataka,
}: HeroSectionProps) {
  return (
    <section className="relative w-full overflow-hidden select-none">
      {/* Soft, warm, pale background with delicate peach and sky-blue atmospheric glows */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden="true">
        {/* Base warm ivory */}
        <div className="absolute inset-0 bg-[#FFFBF2]" />

        {/* Soft Peach luminous glow in the top-right */}
        <div className="absolute -top-32 right-[-5%] w-[38rem] h-[38rem] rounded-full bg-[#FDEBD8]/80 blur-3xl" />

        {/* Pale Sky-blue luminous glow in center-left */}
        <div className="absolute top-48 left-[-10%] w-[34rem] h-[34rem] rounded-full bg-[#E6F1F7]/75 blur-3xl" />

        {/* Faint marigold warmth in bottom-center */}
        <div className="absolute bottom-[-10%] left-[30%] w-[28rem] h-[28rem] rounded-full bg-[#F2A93B]/10 blur-3xl" />

        {/* Ambient radial overlay ensuring seamless blend */}
        <div className="absolute inset-0 bg-radial-gradient from-transparent via-[#FFFBF2]/30 to-[#FFFBF2]" />
      </div>

      {/* Main Split Layout Container */}
      <div className="mx-auto w-full max-w-7xl px-6 sm:px-10 pt-28 sm:pt-32 lg:pt-36 pb-16 sm:pb-20 lg:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 xl:gap-14 items-center">
          
          {/* ========================================================================= */}
          {/* LEFT SIDE: Editorial Typography, Actions & Trust Stats                    */}
          {/* ========================================================================= */}
          <div className="lg:col-span-7 xl:col-span-7 flex flex-col justify-center text-left">
            {/* Small pill label */}
            <div className="inline-flex items-center gap-2 self-start rounded-full border border-[#F2A93B]/35 bg-white/85 px-4 py-1.5 text-xs font-medium text-[#1B2B27] shadow-xs backdrop-blur-md mb-6">
              <span className="h-2 w-2 rounded-full bg-[#F2A93B] animate-pulse" />
              <span className="tracking-wide font-medium">Karnataka AI Travel Planner</span>
              <span className="text-[#F2A93B]/60">•</span>
              <span className="text-[#1F7A7A] font-semibold">Authentic Circuits</span>
            </div>

            {/* Big Headline */}
            <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-[4rem] xl:text-[4.5rem] font-normal tracking-tight text-[#1B2B27] leading-[1.12]">
              Discover Karnataka, <br className="hidden sm:inline" />
              <span className="italic font-light text-[#F2A93B]">
                Your Way.
              </span>
            </h1>

            {/* Short Subtitle */}
            <p className="mt-6 text-base sm:text-lg text-[#2C3E38] font-normal leading-relaxed max-w-xl">
              From mist-shrouded Western Ghats coffee ridges to sun-drenched Hoysala stone temples
              and quiet Arabian Sea shores. Craft an itinerary tailored to your pace, passions, and
              budget with real highway drive hours and verified regional costs.
            </p>

            {/* Action Buttons: Plan My Trip & Explore Destinations */}
            <div className="mt-8 sm:mt-10 flex flex-wrap items-center gap-4">
              {/* Primary Button: Plan My Trip (Karnataka Saffron/Marigold) */}
              <button
                type="button"
                id="hero-plan-btn"
                onClick={onCreateItinerary}
                className="group flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-[#F2A93B] via-[#E59828] to-[#D98C1E] hover:from-[#E59828] hover:to-[#C67B13] text-white px-7 py-3.5 text-sm font-semibold tracking-wide transition-all duration-200 shadow-md shadow-[#F2A93B]/25 hover:shadow-lg hover:shadow-[#F2A93B]/35 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
              >
                <Compass className="h-4 w-4 transition-transform duration-300 group-hover:rotate-45" />
                <span>Plan My Trip</span>
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </button>

              {/* Secondary Button: Explore Destinations (Peacock Teal / Ivory) */}
              <button
                type="button"
                id="hero-explore-btn"
                onClick={onExploreKarnataka}
                className="flex items-center gap-2 rounded-xl border border-[#1F7A7A]/30 bg-white/90 hover:bg-white text-[#1F7A7A] hover:text-[#166060] px-6 py-3.5 text-sm font-medium tracking-wide shadow-xs backdrop-blur-md transition-all duration-200 hover:border-[#1F7A7A]/50 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
              >
                <MapPin className="h-4 w-4 text-[#1F7A7A]" />
                <span>Explore Destinations</span>
              </button>
            </div>

            {/* 3 Small Trust Stats */}
            <div className="mt-10 pt-8 border-t border-[#FDEBD8] grid grid-cols-3 gap-3 sm:gap-4 max-w-lg">
              {/* Stat 1 */}
              <div className="rounded-xl border border-[#F2A93B]/20 bg-white/70 p-3 sm:p-3.5 backdrop-blur-xs shadow-xs transition-transform duration-200 hover:-translate-y-0.5">
                <span className="block font-serif text-xl sm:text-2xl font-bold text-[#1B2B27]">38</span>
                <span className="text-[11px] sm:text-xs font-medium text-[#536B63] leading-tight block mt-0.5">
                  Curated Destinations
                </span>
              </div>

              {/* Stat 2 */}
              <div className="rounded-xl border border-[#F2A93B]/20 bg-white/70 p-3 sm:p-3.5 backdrop-blur-xs shadow-xs transition-transform duration-200 hover:-translate-y-0.5">
                <span className="block font-serif text-xl sm:text-2xl font-bold text-[#1B2B27]">31</span>
                <span className="text-[11px] sm:text-xs font-medium text-[#536B63] leading-tight block mt-0.5">
                  Districts
                </span>
              </div>

              {/* Stat 3 */}
              <div className="rounded-xl border border-[#F2A93B]/20 bg-white/70 p-3 sm:p-3.5 backdrop-blur-xs shadow-xs transition-transform duration-200 hover:-translate-y-0.5">
                <span className="block font-serif text-xl sm:text-2xl font-bold text-[#1B2B27]">AI + Smart</span>
                <span className="text-[11px] sm:text-xs font-medium text-[#536B63] leading-tight block mt-0.5">
                  Planner
                </span>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* RIGHT SIDE: Floating Karnataka Map Visual with Dotted Route & Moving Car   */}
          {/* ========================================================================= */}
          <div className="lg:col-span-5 xl:col-span-5 flex justify-center items-center w-full">
            <div className="relative w-full max-w-[420px] sm:max-w-[480px] lg:max-w-[520px] xl:max-w-[560px] aspect-[1226/1283] flex items-center justify-center">
              {/* Seamless Floating Karnataka Map & Silk Ribbons - No borders, no arch, no grey panel */}
              <picture className="block w-full h-full pointer-events-none select-none">
                <source
                  type="image/webp"
                  srcSet="/images/hero-karnataka-transparent-640.webp 640w, /images/hero-karnataka-transparent-1024.webp 1024w, /images/hero-karnataka-transparent-1600.webp 1600w"
                  sizes="(max-width: 640px) 420px, (max-width: 1024px) 480px, 560px"
                />
                <img
                  src="/images/hero-karnataka-transparent.png"
                  alt="Illustrated map of Karnataka with flowing silk ribbons"
                  width={1226}
                  height={1283}
                  loading="eager"
                  fetchPriority="high"
                  className="w-full h-full object-contain pointer-events-none select-none drop-shadow-xs"
                />
              </picture>

              {/* Dotted Route, Glowing Waypoint Dots, and Moving Car Overlay */}
              <div className="absolute inset-0 pointer-events-none z-10">
                <KarnatakaRouteMap />
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
