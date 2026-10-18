import { useState, useEffect } from "react";
import { ArrowRight } from "lucide-react";

interface HeroSectionProps {
  onCreateItinerary: () => void;
  onExploreKarnataka: () => void;
}

const HERO_IMAGES = [
  {
    url: "/images/hampi.jpg",
    location: "Hampi, Vijayanagara",
    caption: "Ancient granite ruins and stone chariots under sunset skies",
  },
  {
    url: "/images/coorg.jpg",
    location: "Coorg, Western Ghats",
    caption: "Mist-draped coffee plantations and emerald mountain ridges",
  },
  {
    url: "/images/gokarna.jpg",
    location: "Gokarna, Karavali Coast",
    caption: "Pristine Arabian Sea coves and coastal cliffs",
  },
];

export default function HeroSection({
  onCreateItinerary,
  onExploreKarnataka,
}: HeroSectionProps) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveImageIndex((prev) => (prev + 1) % HERO_IMAGES.length);
    }, 9000);
    return () => clearInterval(timer);
  }, []);

  const currentImage = HERO_IMAGES[activeImageIndex];

  return (
    <section className="relative min-h-screen w-full flex flex-col justify-between overflow-hidden">
      {/* Background with Restrained Motion and Scrim */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        {HERO_IMAGES.map((img, idx) => (
          <div
            key={img.url}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              idx === activeImageIndex ? "opacity-100 scale-105" : "opacity-0 scale-100 pointer-events-none"
            }`}
            style={{
              backgroundImage: `url(${img.url})`,
              backgroundPosition: "center",
              backgroundSize: "cover",
              transition: "opacity 1.5s ease-in-out, transform 12s ease-out",
            }}
          />
        ))}

        {/* Editorial Gradients & High Contrast Scrim */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#070b12] via-[#070b12]/50 to-[#070b12]/70" />
        <div className="absolute inset-0 bg-radial-gradient from-transparent via-black/40 to-black/80" />
      </div>

      {/* Hero Header Space */}
      <div className="pt-24" />

      {/* Main Editorial Content */}
      <div className="mx-auto w-full max-w-7xl px-6 sm:px-10 py-12 flex flex-col justify-center my-auto">
        <div className="max-w-3xl">
          {/* Subtle Category Pill */}
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1 text-xs uppercase tracking-widest text-amber-300 backdrop-blur-md mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            <span>AI-Orchestrated Travel Planning</span>
          </div>

          {/* Large Editorial Headline */}
          <h1 className="font-serif text-4xl sm:text-6xl md:text-7xl font-normal tracking-tight text-white leading-[1.1]">
            Your Karnataka. <br />
            <span className="italic font-light text-amber-200">
              Your Kind of Journey.
            </span>
          </h1>

          {/* Supporting Text */}
          <p className="mt-6 text-base sm:text-lg text-slate-300 font-light leading-relaxed max-w-2xl">
            From boulder-strewn UNESCO kingdoms to rainforest coffee ridges and quiet Arabian
            Sea cliffs — create a multi-day itinerary custom-tailored to your passions, time,
            and budget. Grounded in real road distances and verified regional costs.
          </p>

          {/* Action Buttons */}
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={onCreateItinerary}
              className="flex items-center gap-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 px-7 py-3.5 text-xs font-bold uppercase tracking-wider transition-all duration-200 shadow-xl shadow-amber-400/20 hover:scale-[1.02]"
            >
              <span>Create My Itinerary</span>
              <ArrowRight className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={onExploreKarnataka}
              className="flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 text-white px-6 py-3.5 text-xs font-semibold uppercase tracking-wider backdrop-blur-md transition-all duration-200 hover:border-white/30"
            >
              <span>Explore Karnataka</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Bar: Location Caption & Understated Scroll Indicator */}
      <div className="mx-auto w-full max-w-7xl px-6 sm:px-10 pb-8 flex items-end justify-between text-xs text-slate-400">
        {/* Subtle Location Caption */}
        <div className="hidden sm:flex flex-col">
          <span className="text-[10px] uppercase tracking-widest text-slate-500 font-mono">
            Featured Landscape
          </span>
          <span className="text-slate-300 font-medium mt-0.5">{currentImage.location}</span>
          <span className="text-slate-400 text-[11px] font-light">{currentImage.caption}</span>
        </div>

        {/* Understated Scroll Indicator */}
        <button
          type="button"
          onClick={onExploreKarnataka}
          className="group mx-auto sm:mx-0 flex flex-col items-center gap-2 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <span className="text-[10px] uppercase tracking-widest font-mono">
            Scroll to Discover
          </span>
          <div className="flex h-7 w-4 items-start justify-center rounded-full border border-white/20 p-1">
            <div className="h-1.5 w-1 rounded-full bg-amber-400 animate-bounce" />
          </div>
        </button>

        {/* Verification Tag */}
        <div className="hidden lg:flex flex-col items-end text-right">
          <span className="text-[10px] uppercase tracking-widest text-slate-500 font-mono">
            Geocoded Data
          </span>
          <span className="text-slate-300 font-medium mt-0.5">31 Districts • 67 Destinations</span>
          <span className="text-slate-400 text-[11px] font-light">Zero-hallucination routing</span>
        </div>
      </div>
    </section>
  );
}
