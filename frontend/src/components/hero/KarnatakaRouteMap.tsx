import { useEffect, useState } from "react";

interface KarnatakaRouteMapProps {
  className?: string;
}

export default function KarnatakaRouteMap({ className = "" }: KarnatakaRouteMapProps) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [useCssMotion, setUseCssMotion] = useState(true);

  useEffect(() => {
    // Detect system reduced motion preference
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mediaQuery.matches);

    function handleChange(e: MediaQueryListEvent) {
      setReducedMotion(e.matches);
    }
    mediaQuery.addEventListener("change", handleChange);

    // Detect CSS offset-path support
    const supportsOffsetPath =
      typeof window !== "undefined" &&
      typeof window.CSS !== "undefined" &&
      typeof window.CSS.supports === "function" &&
      window.CSS.supports("offset-path", 'path("M 0 0")');

    setUseCssMotion(Boolean(supportsOffsetPath));

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  // Continuous scenic route path connecting:
  // North Belagavi (460, 380) -> East Hampi (770, 520) -> Ghats Chikkamagaluru (530, 820) -> South Mysuru (690, 1070)
  const routePath =
    "M 460,380 C 560,400 680,440 770,520 C 810,600 610,730 530,820 C 460,900 580,1000 690,1070";

  return (
    <div
      className={`pointer-events-none select-none relative w-full h-full ${className}`}
      aria-hidden="true"
    >
      <style>{`
        /* Smooth 16-second road-trip journey from North to South */
        @keyframes driveCarAlongRoute {
          0% {
            offset-distance: 0%;
            opacity: 0;
          }
          3% {
            opacity: 1;
          }
          88% {
            offset-distance: 100%;
            opacity: 1;
          }
          93% {
            offset-distance: 100%;
            opacity: 0;
          }
          100% {
            offset-distance: 0%;
            opacity: 0;
          }
        }

        .hero-moving-car {
          offset-path: path("${routePath}");
          offset-rotate: auto;
          animation: driveCarAlongRoute 16s cubic-bezier(0.38, 0, 0.22, 1) infinite;
        }

        /* Waypoint Dot Soft Glow Pulses timed with car arrival */
        @keyframes glowNorthDot {
          0%, 100% { transform: scale(1); opacity: 0; }
          1% { opacity: 0.85; }
          9% { transform: scale(2.4); opacity: 0; }
        }
        @keyframes glowHampiDot {
          0%, 28%, 100% { transform: scale(1); opacity: 0; }
          31% { opacity: 0.85; }
          39% { transform: scale(2.4); opacity: 0; }
        }
        @keyframes glowChikDot {
          0%, 62%, 100% { transform: scale(1); opacity: 0; }
          65% { opacity: 0.85; }
          73% { transform: scale(2.4); opacity: 0; }
        }
        @keyframes glowMysuruDot {
          0%, 85%, 100% { transform: scale(1); opacity: 0; }
          88% { opacity: 0.85; }
          96% { transform: scale(2.4); opacity: 0; }
        }

        .dot-pulse-1 { animation: glowNorthDot 16s ease-out infinite; transform-origin: 460px 380px; }
        .dot-pulse-2 { animation: glowHampiDot 16s ease-out infinite; transform-origin: 770px 520px; }
        .dot-pulse-3 { animation: glowChikDot 16s ease-out infinite; transform-origin: 530px 820px; }
        .dot-pulse-4 { animation: glowMysuruDot 16s ease-out infinite; transform-origin: 690px 1070px; }

        /* Accessible reduced-motion gentle cross-fade between 3 key positions */
        @keyframes reducedFade1 {
          0%, 100% { opacity: 0.95; }
          28% { opacity: 0.95; }
          34% { opacity: 0; }
          94% { opacity: 0; }
        }
        @keyframes reducedFade2 {
          0%, 28% { opacity: 0; }
          34% { opacity: 0.95; }
          62% { opacity: 0.95; }
          68% { opacity: 0; }
          100% { opacity: 0; }
        }
        @keyframes reducedFade3 {
          0%, 62% { opacity: 0; }
          68% { opacity: 0.95; }
          94% { opacity: 0.95; }
          100% { opacity: 0; }
        }

        .car-pos-north { animation: reducedFade1 12s ease-in-out infinite; }
        .car-pos-central { animation: reducedFade2 12s ease-in-out infinite; }
        .car-pos-south { animation: reducedFade3 12s ease-in-out infinite; }
      `}</style>

      <svg
        viewBox="0 0 1226 1283"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="headlight-beam" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#FFF9D2" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#FFF9D2" stopOpacity="0" />
          </linearGradient>

          <filter id="route-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          <filter id="dot-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* 1. Dotted Route Path */}
        {/* Soft amber glow underlay */}
        <path
          d={routePath}
          stroke="#F2A93B"
          strokeWidth="10"
          strokeLinecap="round"
          fill="none"
          opacity="0.5"
          filter="url(#route-glow)"
        />
        {/* Crisp foreground dotted route line */}
        <path
          d={routePath}
          stroke="#FFFBF2"
          strokeWidth="4"
          strokeDasharray="10 12"
          strokeLinecap="round"
          fill="none"
        />

        {/* 2. Waypoint Dots with Soft Glow on Arrival (Zero text) */}
        {/* Dot 1: North (Belagavi area: 460, 380) */}
        <g id="waypoint-north">
          {!reducedMotion && (
            <circle
              cx="460"
              cy="380"
              r="12"
              fill="none"
              stroke="#F2A93B"
              strokeWidth="4"
              className="dot-pulse-1"
              filter="url(#dot-glow)"
            />
          )}
          <circle cx="460" cy="380" r="8" fill="#FFFBF2" stroke="#F2A93B" strokeWidth="4" />
        </g>

        {/* Dot 2: Central-East (Hampi area: 770, 520) */}
        <g id="waypoint-central">
          {!reducedMotion && (
            <circle
              cx="770"
              cy="520"
              r="12"
              fill="none"
              stroke="#F2A93B"
              strokeWidth="4"
              className="dot-pulse-2"
              filter="url(#dot-glow)"
            />
          )}
          <circle cx="770" cy="520" r="8" fill="#FFFBF2" stroke="#F2A93B" strokeWidth="4" />
        </g>

        {/* Dot 3: Malenadu / Ghats (Chikkamagaluru area: 530, 820) */}
        <g id="waypoint-ghats">
          {!reducedMotion && (
            <circle
              cx="530"
              cy="820"
              r="12"
              fill="none"
              stroke="#F2A93B"
              strokeWidth="4"
              className="dot-pulse-3"
              filter="url(#dot-glow)"
            />
          )}
          <circle cx="530" cy="820" r="8" fill="#FFFBF2" stroke="#F2A93B" strokeWidth="4" />
        </g>

        {/* Dot 4: South (Mysuru area: 690, 1070) */}
        <g id="waypoint-south">
          {!reducedMotion && (
            <circle
              cx="690"
              cy="1070"
              r="12"
              fill="none"
              stroke="#F2A93B"
              strokeWidth="4"
              className="dot-pulse-4"
              filter="url(#dot-glow)"
            />
          )}
          <circle cx="690" cy="1070" r="8" fill="#FFFBF2" stroke="#F2A93B" strokeWidth="4" />
        </g>

        {/* 3. The Road-Trip Car */}
        {reducedMotion ? (
          /* Accessible fallback: gentle cross-fade between 3 stops instead of a static car */
          <g id="reduced-motion-cars" className="pointer-events-none">
            <g transform="translate(460, 380) rotate(12)" className="car-pos-north">
              <CarGraphic />
            </g>
            <g transform="translate(770, 520) rotate(62)" className="car-pos-central">
              <CarGraphic />
            </g>
            <g transform="translate(690, 1070) rotate(50)" className="car-pos-south">
              <CarGraphic />
            </g>
          </g>
        ) : useCssMotion ? (
          /* Modern hardware-accelerated CSS offset-path animation */
          <g className="hero-moving-car pointer-events-none">
            <CarGraphic />
          </g>
        ) : (
          /* SVG SMIL fallback for environments without CSS offset-path */
          <g className="pointer-events-none">
            <animateMotion
              path={routePath}
              dur="16s"
              repeatCount="indefinite"
              rotate="auto"
              calcMode="linear"
              keyTimes="0;0.88;0.93;1"
              keyPoints="0;1;1;0"
            />
            <animate
              attributeName="opacity"
              values="0;1;1;0;0"
              keyTimes="0;0.03;0.88;0.93;1"
              dur="16s"
              repeatCount="indefinite"
            />
            <CarGraphic />
          </g>
        )}
      </svg>
    </div>
  );
}

// Clean, charming road-trip SUV SVG icon with warm saffron body, headlights, roof luggage, and wheels
function CarGraphic() {
  return (
    <g id="karnataka-roadtrip-car" className="pointer-events-none drop-shadow-md">
      {/* Forward Headlight Beam */}
      <path d="M 24 -9 L 52 -15 L 52 15 L 24 9 Z" fill="url(#headlight-beam)" opacity="0.4" />

      {/* Car Wheels */}
      <rect x="-18" y="-16" width="10" height="4" rx="2" fill="#1B2B27" />
      <rect x="10" y="-16" width="10" height="4" rx="2" fill="#1B2B27" />
      <rect x="-18" y="12" width="10" height="4" rx="2" fill="#1B2B27" />
      <rect x="10" y="12" width="10" height="4" rx="2" fill="#1B2B27" />

      {/* Main Body (Warm Karnataka Saffron #F2A93B) */}
      <rect
        x="-24"
        y="-13"
        width="48"
        height="26"
        rx="8"
        fill="#F2A93B"
        stroke="#D98C1E"
        strokeWidth="1.5"
      />

      {/* Roof Rack & Luggage Pack (Kumkum Red #C8473D and ivory pack) */}
      <rect x="-10" y="-16" width="20" height="3" rx="1" fill="#1B2B27" />
      <rect x="-8" y="-19" width="16" height="3.5" rx="1.5" fill="#C8473D" />

      {/* Windows (Pale Sky Glass #E6F1F7) */}
      <path d="M 5 -10 L 15 -10 L 18 -1 L 5 -1 Z" fill="#E6F1F7" opacity="0.9" />
      <path d="M -3 -10 L -13 -10 L -16 -1 L -3 -1 Z" fill="#E6F1F7" opacity="0.85" />
      <rect x="-2" y="-10" width="5.5" height="9" rx="1" fill="#E6F1F7" opacity="0.9" />

      {/* Front Headlights & Rear Taillights */}
      <circle cx="23" cy="-7" r="2.2" fill="#FFFDEB" />
      <circle cx="23" cy="7" r="2.2" fill="#FFFDEB" />
      <circle cx="-23" cy="-8" r="1.8" fill="#C8473D" />
      <circle cx="-23" cy="8" r="1.8" fill="#C8473D" />
    </g>
  );
}
