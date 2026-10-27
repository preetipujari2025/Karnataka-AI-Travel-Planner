import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Compass, Menu, X, ArrowRight } from "lucide-react";
import type { HealthResponse } from "../../api/types";
import { getSavedTrips, addSavedTripsListener } from "../../lib/savedTrips";

interface NavbarProps {
  health?: HealthResponse | null;
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
  const [savedCount, setSavedCount] = useState(0);
  const location = useLocation();

  useEffect(() => {
    function handleScroll() {
      setIsScrolled(window.scrollY > 30);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setSavedCount(getSavedTrips().length);
    const unsubscribe = addSavedTripsListener(() => {
      setSavedCount(getSavedTrips().length);
    });
    return unsubscribe;
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-400 ${
        isScrolled
          ? "bg-[#FFFBF2]/95 backdrop-blur-md border-b border-[#F2A93B]/20 py-3.5 shadow-xs shadow-[#1B2B27]/5"
          : "bg-transparent py-5"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 sm:px-10">
        {/* Project Logo & Identity */}
        <Link
          to="/"
          className="group flex items-center gap-3 transition-opacity hover:opacity-90 cursor-pointer"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#F2A93B] to-[#D98C1E] text-white font-semibold shadow-xs">
            <Compass className="h-5 w-5 transition-transform duration-500 group-hover:rotate-45" />
          </div>
          <div className="flex flex-col">
            <span className="font-serif text-lg font-bold tracking-tight text-[#1B2B27]">
              Karnataka Trails <span className="italic font-light text-[#F2A93B]">AI</span>
            </span>
            <span className="text-[10px] uppercase tracking-widest text-[#536B63] font-sans font-medium">
              Calm Travel Planner
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-7">
          <button
            type="button"
            onClick={onNavigateToDestinations}
            className="text-xs uppercase tracking-wider font-semibold text-[#2C3E38] hover:text-[#1F7A7A] transition-colors cursor-pointer"
          >
            Destinations
          </button>
          <button
            type="button"
            onClick={onNavigateToExperiences}
            className="text-xs uppercase tracking-wider font-semibold text-[#2C3E38] hover:text-[#1F7A7A] transition-colors cursor-pointer"
          >
            Featured Trails
          </button>
          <button
            type="button"
            onClick={onNavigateToPlanner}
            className={`text-xs uppercase tracking-wider font-semibold transition-colors cursor-pointer ${
              location.pathname === "/plan"
                ? "text-[#1F7A7A] font-bold"
                : "text-[#2C3E38] hover:text-[#1F7A7A]"
            }`}
          >
            Trip Planner
          </button>
          <Link
            to="/road-trip"
            className={`text-xs uppercase tracking-wider font-semibold transition-colors cursor-pointer ${
              location.pathname === "/road-trip"
                ? "text-[#1F7A7A] font-bold"
                : "text-[#2C3E38] hover:text-[#1F7A7A]"
            }`}
          >
            Road Trips
          </Link>
          <Link
            to="/saved"
            className={`flex items-center gap-1.5 text-xs uppercase tracking-wider font-semibold transition-colors cursor-pointer ${
              location.pathname === "/saved"
                ? "text-[#1F7A7A] font-bold"
                : "text-[#2C3E38] hover:text-[#1F7A7A]"
            }`}
          >
            <span>Saved Trips</span>
            {savedCount > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#F2A93B] px-1 text-[10px] font-bold text-white">
                {savedCount}
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={onNavigateToAbout}
            className="text-xs uppercase tracking-wider font-semibold text-[#2C3E38] hover:text-[#1F7A7A] transition-colors cursor-pointer"
          >
            About
          </button>
        </nav>

        {/* Right Action & Engine Status */}
        <div className="hidden sm:flex items-center gap-4">
          {/* Health indicator */}
          <div
            title={`Backend: ${health?.status === "ok" ? "Operational" : "Ready"} (${health?.dataset_size ?? 38} destinations)`}
            className="flex items-center gap-1.5 text-[11px] text-[#536B63] font-medium"
          >
            <span
              className={`h-2 w-2 rounded-full ${
                health?.status === "ok" ? "bg-emerald-500" : "bg-[#F2A93B]"
              }`}
            />
            <span className="hidden lg:inline text-xs">
              {health?.status === "ok" ? "Engine Active" : "Online"}
            </span>
          </div>

          {/* Saffron Primary CTA Button */}
          <button
            type="button"
            onClick={onNavigateToPlanner}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#F2A93B] via-[#E59828] to-[#D98C1E] hover:from-[#E59828] hover:to-[#C67B13] text-white px-5 py-2.5 text-xs font-bold uppercase tracking-wider transition-all duration-200 shadow-xs hover:shadow-md hover:shadow-[#F2A93B]/25 hover:-translate-y-0.5 cursor-pointer"
          >
            <span>Plan My Trip</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Mobile Hamburger Trigger */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-[#263c30] hover:text-[#14231b] md:hidden cursor-pointer"
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden mt-3 mx-4 rounded-2xl bg-[#FFFBF2]/98 border border-[#F2A93B]/25 p-6 backdrop-blur-xl shadow-xl">
          <nav className="flex flex-col gap-4">
            <button
              type="button"
              onClick={() => {
                onNavigateToDestinations();
                setMobileMenuOpen(false);
              }}
              className="text-left text-sm uppercase tracking-wider font-semibold text-[#1B2B27] py-2 border-b border-[#FDEBD8] hover:text-[#1F7A7A]"
            >
              Destinations
            </button>
            <button
              type="button"
              onClick={() => {
                onNavigateToExperiences();
                setMobileMenuOpen(false);
              }}
              className="text-left text-sm uppercase tracking-wider font-semibold text-[#1B2B27] py-2 border-b border-[#FDEBD8] hover:text-[#1F7A7A]"
            >
              Featured Trails
            </button>
            <button
              type="button"
              onClick={() => {
                onNavigateToPlanner();
                setMobileMenuOpen(false);
              }}
              className="text-left text-sm uppercase tracking-wider font-semibold text-[#1B2B27] py-2 border-b border-[#FDEBD8] hover:text-[#1F7A7A]"
            >
              Trip Planner
            </button>
            <Link
              to="/road-trip"
              onClick={() => setMobileMenuOpen(false)}
              className="text-left text-sm uppercase tracking-wider font-semibold text-[#1B2B27] py-2 border-b border-[#FDEBD8] hover:text-[#1F7A7A]"
            >
              Road Trips
            </Link>
            <Link
              to="/saved"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-between text-left text-sm uppercase tracking-wider font-semibold text-[#1B2B27] py-2 border-b border-[#FDEBD8] hover:text-[#1F7A7A]"
            >
              <span>Saved Trips</span>
              {savedCount > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#F2A93B] text-[10px] font-bold text-white">
                  {savedCount}
                </span>
              )}
            </Link>
            <button
              type="button"
              onClick={() => {
                onNavigateToAbout();
                setMobileMenuOpen(false);
              }}
              className="text-left text-sm uppercase tracking-wider font-semibold text-[#263c30] py-2 border-b border-[#eef4f0] hover:text-[#2d6a4f]"
            >
              About
            </button>
            <button
              type="button"
              onClick={() => {
                onNavigateToPlanner();
                setMobileMenuOpen(false);
              }}
              className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#f5a623] to-[#e08713] py-3 text-xs font-bold uppercase tracking-wider text-white shadow-md cursor-pointer"
            >
              <span>Plan My Trip</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}
