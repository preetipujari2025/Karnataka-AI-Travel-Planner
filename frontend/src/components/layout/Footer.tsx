import { Compass, ExternalLink, ShieldCheck } from "lucide-react";

interface FooterProps {
  onNavigateToDestinations: () => void;
  onNavigateToExperiences: () => void;
  onNavigateToPlanner: () => void;
  onNavigateToAbout: () => void;
}

export default function Footer({
  onNavigateToDestinations,
  onNavigateToExperiences,
  onNavigateToPlanner,
  onNavigateToAbout,
}: FooterProps) {
  return (
    <footer id="about" className="relative mt-32 border-t border-white/10 bg-[#05080e] pt-20 pb-14 text-slate-400">
      <div className="mx-auto max-w-7xl px-6 sm:px-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 pb-14 border-b border-white/5">
          {/* Col 1 & 2: Project Identity & Mission */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-400 text-slate-950 font-bold">
                <Compass className="h-5 w-5" />
              </div>
              <span className="font-display text-lg font-bold tracking-wider text-white">
                Karnataka Trails <span className="text-amber-400 font-light">AI</span>
              </span>
            </div>

            <p className="mt-4 text-xs sm:text-sm text-slate-400 font-light leading-relaxed max-w-lg">
              An intelligent, cinematic travel planner celebrating Karnataka's vast historical,
              coastal, and highland circuits. Powered by a deterministic graph routing engine,
              verified real-world INR pricing models, and AI reasoning.
            </p>

            <div className="mt-6 flex items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-4 max-w-lg">
              <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-300">
                <strong className="text-white block font-medium">Data Provenance Guarantee</strong>
                Curated dataset of 38 verified Karnataka destinations with coordinates, driving connections,
                and transparent INR fee models. Zero invented travel stats or fake booking hooks.
              </div>
            </div>
          </div>

          {/* Col 3: Navigation */}
          <div>
            <h4 className="text-xs font-mono uppercase tracking-widest text-slate-200 mb-4 font-semibold">
              Explore & Plan
            </h4>
            <ul className="space-y-3 text-xs font-light">
              <li>
                <button
                  type="button"
                  onClick={onNavigateToDestinations}
                  className="hover:text-amber-400 transition-colors"
                >
                  Discover Karnataka
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onNavigateToExperiences}
                  className="hover:text-amber-400 transition-colors"
                >
                  Journey Experiences
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onNavigateToPlanner}
                  className="hover:text-amber-400 transition-colors"
                >
                  AI Itinerary Planner
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onNavigateToAbout}
                  className="hover:text-amber-400 transition-colors"
                >
                  About the Project
                </button>
              </li>
            </ul>
          </div>

          {/* Col 4: System Architecture & Data Sources */}
          <div>
            <h4 className="text-xs font-mono uppercase tracking-widest text-slate-200 mb-4 font-semibold">
              Data & System
            </h4>
            <ul className="space-y-3 text-xs font-light">
              <li>
                <a
                  href="http://localhost:8000/docs"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 hover:text-amber-400 transition-colors"
                >
                  <span>FastAPI Specification</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>
                <a
                  href="http://localhost:8000/health"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 hover:text-amber-400 transition-colors"
                >
                  <span>API Health Status</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>
                <span className="text-slate-500">FastAPI Pydantic v2 + Vite React 19</span>
              </li>
              <li>
                <span className="text-slate-500">Map layers © OpenStreetMap & CARTO</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom copyright row */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} Karnataka Trails AI. Independent travel planning tool.</p>
          <div className="flex items-center gap-1">
            <span>Built with reverence for</span>
            <span className="text-amber-400 font-medium">Karnataka's Heritage, Forests & Coast</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
