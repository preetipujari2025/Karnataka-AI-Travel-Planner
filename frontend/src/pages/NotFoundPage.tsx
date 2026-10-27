import { Link } from "react-router-dom";
import { Compass, Home, MapPin, Route, ArrowLeft } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-[#fcfbf9] text-[#1b2b22] flex flex-col justify-between selection:bg-[#2d6a4f]/15 selection:text-[#1b2b22]">
      <header className="border-b border-[#d8e6de] bg-white/95 px-6 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-3 text-xs uppercase tracking-wider font-semibold text-[#14231b] hover:text-[#2d6a4f] transition-colors"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#2d6a4f] to-[#1e533c] text-white font-bold shadow-xs">
              <Compass className="h-4 w-4" />
            </div>
            <span>Karnataka Trails AI</span>
          </Link>
          <Link
            to="/"
            className="flex items-center gap-1.5 rounded-xl border border-[#c8dec2] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#1e533c] hover:bg-[#eaf4ee] transition shadow-2xs"
          >
            <Home className="h-3.5 w-3.5 text-[#2d6a4f]" />
            <span>Home</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="max-w-md w-full text-center space-y-6 rounded-3xl border border-[#cbe1d5] bg-white/90 p-8 sm:p-12 shadow-xl glass-panel-elevated">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#eaf4ee] text-[#2d6a4f] border border-[#c2ded0]">
            <MapPin className="h-8 w-8 animate-pulse" />
          </div>

          <div className="space-y-2">
            <span className="text-xs uppercase tracking-wider text-[#2d6a4f] font-bold">
              404 — Path Not Found
            </span>
            <h1 className="font-serif text-3xl font-normal text-[#14231b]">Route Off the Map</h1>
            <p className="text-sm text-[#35483d] leading-relaxed">
              The page or destination you requested doesn't exist or has moved. Choose one of Karnataka's verified trail builders below.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              to="/plan"
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#f5a623] to-[#e08713] hover:from-[#e59b20] hover:to-[#cb770c] text-white px-6 py-3 text-xs font-bold uppercase tracking-wider transition shadow-md shadow-[#e08713]/25 hover:shadow-lg"
            >
              <Compass className="h-4 w-4" />
              <span>Trip Planner</span>
            </Link>
            <Link
              to="/road-trip"
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-[#c8dec2] bg-white hover:bg-[#eaf4ee] text-[#1e533c] px-6 py-3 text-xs font-bold uppercase tracking-wider transition shadow-2xs"
            >
              <Route className="h-4 w-4 text-[#2d6a4f]" />
              <span>Road Trips</span>
            </Link>
          </div>

          <div className="pt-4 border-t border-[#dce9e1]">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs text-[#5e7467] hover:text-[#1e533c] font-medium transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Return to Karnataka Trails homepage</span>
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-[#d8e6de] bg-[#f6f9f6] py-6 text-center text-xs text-[#5e7467]">
        Karnataka Trails AI · Curated Karnataka Tourism Explorer
      </footer>
    </div>
  );
}
