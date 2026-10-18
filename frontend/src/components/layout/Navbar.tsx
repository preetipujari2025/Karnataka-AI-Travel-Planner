import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Compass, Menu, X, ArrowRight } from "lucide-react";
import type { HealthResponse } from "../../api/types";

interface NavbarProps {
  health: HealthResponse | null;
  onNavigateToPlanner: () => void;
  onNavigateToExperiences: () => void;
  onNavigateToDestinations: () => void;
  onNavigateToAbout: () => void;
}

export default function Navbar({
  health,
  onNavigateToPlanner,
  onNavigateToExperiences,
  onNavigateToDestinations,
  onNavigateToAbout,
}: NavbarProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setIsScrolled(window.scrollY > 40);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isScrolled
          ? "bg-[#070b12]/92 backdrop-blur-md border-b border-white/10 py-3 shadow-xl"
          : "bg-transparent py-5"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 sm:px-10">
        {/* Project Logo & Identity */}
        <a
          href="#"
          className="group flex items-center gap-3 transition-opacity hover:opacity-90"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-400 text-slate-950 font-semibold shadow-md shadow-amber-400/20">
            <Compass className="h-5 w-5 transition-transform duration-500 group-hover:rotate-45" />
          </div>
          <div className="flex flex-col">
            <span className="font-display text-lg font-bold tracking-wider text-white">
              Karnataka Trails <span className="text-amber-400 font-light">AI</span>
            </span>
            <span className="text-[10px] uppercase tracking-widest text-slate-400 font-sans">
              Intelligent Travel Planner
            </span>
          </div>
        </a>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-8">
          <button
            type="button"
            onClick={onNavigateToDestinations}
            className="text-xs uppercase tracking-widest font-medium text-slate-300 hover:text-amber-400 transition-colors"
          >
            Discover
          </button>
          <button
            type="button"
            onClick={onNavigateToExperiences}
            className="text-xs uppercase tracking-widest font-medium text-slate-300 hover:text-amber-400 transition-colors"
          >
            Experiences
          </button>
          <button
            type="button"
            onClick={onNavigateToPlanner}
            className="text-xs uppercase tracking-widest font-medium text-slate-300 hover:text-amber-400 transition-colors"
          >
            Plan a Trip
          </button>
          <Link
            to="/road-trip"
            className="text-xs uppercase tracking-widest font-medium text-slate-300 hover:text-amber-400 transition-colors"
          >
            Road Trips
          </Link>
          <button
            type="button"
            onClick={onNavigateToAbout}
            className="text-xs uppercase tracking-widest font-medium text-slate-300 hover:text-amber-400 transition-colors"
          >
            About
          </button>
        </nav>

        {/* Right Action & Engine Status */}
        <div className="hidden sm:flex items-center gap-4">
          {/* Subtle Health Dot */}
          <div
            title={`Backend: ${health?.status === "ok" ? "Operational" : "Connecting..."} (${health?.dataset_size ?? 38} destinations)`}
            className="flex items-center gap-2 text-[11px] text-slate-400 font-mono"
          >
            <span
              className={`h-2 w-2 rounded-full ${
                health?.status === "ok" ? "bg-emerald-400 shadow-sm shadow-emerald-400" : "bg-amber-400"
              }`}
            />
            <span className="hidden lg:inline text-slate-400">
              {health?.status === "ok" ? "Engine Active" : "Connecting"}
            </span>
          </div>

          {/* Prominent Action Button */}
          <button
            type="button"
            onClick={onNavigateToPlanner}
            className="flex items-center gap-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 px-5 py-2.5 text-xs font-bold uppercase tracking-wider transition-all duration-200 shadow-lg shadow-amber-400/20 hover:scale-[1.02]"
          >
            <span>Plan Your Journey</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Mobile Hamburger Trigger */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-slate-300 hover:text-white md:hidden"
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6 text-white" />}
        </button>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden mt-3 mx-4 rounded-xl bg-[#090e18]/95 border border-white/10 p-6 backdrop-blur-xl shadow-2xl">
          <nav className="flex flex-col gap-4">
            <button
              type="button"
              onClick={() => {
                onNavigateToDestinations();
                setMobileMenuOpen(false);
              }}
              className="text-left text-sm uppercase tracking-wider font-medium text-slate-200 py-2 border-b border-white/5 hover:text-amber-400"
            >
              Discover
            </button>
            <button
              type="button"
              onClick={() => {
                onNavigateToExperiences();
                setMobileMenuOpen(false);
              }}
              className="text-left text-sm uppercase tracking-wider font-medium text-slate-200 py-2 border-b border-white/5 hover:text-amber-400"
            >
              Experiences
            </button>
            <button
              type="button"
              onClick={() => {
                onNavigateToPlanner();
                setMobileMenuOpen(false);
              }}
              className="text-left text-sm uppercase tracking-wider font-medium text-slate-200 py-2 border-b border-white/5 hover:text-amber-400"
            >
              Plan a Trip
            </button>
            <Link
              to="/road-trip"
              onClick={() => setMobileMenuOpen(false)}
              className="text-left text-sm uppercase tracking-wider font-medium text-slate-200 py-2 border-b border-white/5 hover:text-amber-400"
            >
              Road Trips
            </Link>
            <button
              type="button"
              onClick={() => {
                onNavigateToAbout();
                setMobileMenuOpen(false);
              }}
              className="text-left text-sm uppercase tracking-wider font-medium text-slate-200 py-2 border-b border-white/5 hover:text-amber-400"
            >
              About
            </button>
            <button
              type="button"
              onClick={() => {
                onNavigateToPlanner();
                setMobileMenuOpen(false);
              }}
              className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-amber-400 py-3 text-xs font-bold uppercase tracking-wider text-slate-950"
            >
              <span>Plan Your Journey</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}
