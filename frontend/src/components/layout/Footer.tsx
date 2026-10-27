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
    <footer id="about" className="relative mt-24 border-t border-[#F2A93B]/20 bg-[#FFFBF2] pt-16 pb-12 text-[#2C3E38]">
      <div className="mx-auto max-w-7xl px-6 sm:px-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 pb-12 border-b border-[#FDEBD8]">
          {/* Col 1 & 2: Project Identity & Mission */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#F2A93B] to-[#D98C1E] text-white font-bold shadow-xs">
                <Compass className="h-5 w-5" />
              </div>
              <span className="font-serif text-xl font-bold tracking-tight text-[#1B2B27]">
                Karnataka Trails <span className="italic font-light text-[#F2A93B]">AI</span>
              </span>
            </div>

            <p className="mt-4 text-xs sm:text-sm text-[#536B63] leading-relaxed max-w-lg font-normal">
              A peaceful, intelligent travel planner celebrating Karnataka's vast historical,
              coastal, and Western Ghats circuits. Powered by a deterministic graph routing engine,
              verified real-world INR pricing models, and AI reasoning.
            </p>

            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-[#F2A93B]/25 bg-[#FDEBD8]/50 p-4 max-w-lg">
              <ShieldCheck className="h-5 w-5 text-[#1F7A7A] shrink-0 mt-0.5" />
              <div className="text-xs text-[#2C3E38]">
                <strong className="text-[#1B2B27] block font-semibold">Data Provenance Guarantee</strong>
                Curated dataset of 38 verified Karnataka destinations with coordinates, driving connections,
                and transparent INR fee models. Zero invented travel stats or fake booking hooks.
              </div>
            </div>
          </div>

          {/* Col 3: Navigation */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#14231b] mb-4">
              Explore & Plan
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <button
                  type="button"
                  onClick={onNavigateToDestinations}
                  className="text-[#475f51] hover:text-[#1e533c] transition-colors cursor-pointer"
                >
                  Destination Archive
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onNavigateToExperiences}
                  className="text-[#475f51] hover:text-[#1e533c] transition-colors cursor-pointer"
                >
                  Featured Signature Trails
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onNavigateToPlanner}
                  className="text-[#475f51] hover:text-[#1e533c] transition-colors cursor-pointer"
                >
                  AI Itinerary Planner
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onNavigateToAbout}
                  className="text-[#475f51] hover:text-[#1e533c] transition-colors cursor-pointer"
                >
                  About the System
                </button>
              </li>
            </ul>
          </div>

          {/* Col 4: System Architecture & Data Sources */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#14231b] mb-4">
              Data & System
            </h4>
            <ul className="space-y-2.5 text-xs text-[#526a5c]">
              <li>
                <a
                  href="http://localhost:8000/docs"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-[#475f51] hover:text-[#1e533c] transition-colors"
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
                  className="flex items-center gap-1.5 text-[#475f51] hover:text-[#1e533c] transition-colors"
                >
                  <span>API Health Status</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>
                <span>FastAPI Pydantic v2 + Vite React 19</span>
              </li>
              <li>
                <span>Map layers © OpenStreetMap & CARTO</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom copyright row */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#627a6c]">
          <p>© {new Date().getFullYear()} Karnataka Trails AI. Independent travel planning tool.</p>
          <div className="flex items-center gap-1.5">
            <span>Built with care for</span>
            <span className="text-[#1e533c] font-semibold">Karnataka's Heritage, Forests & Coast</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
