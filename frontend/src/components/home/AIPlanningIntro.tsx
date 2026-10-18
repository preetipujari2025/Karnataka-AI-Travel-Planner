import { Sparkles, HeartHandshake, Sliders, MapPin } from "lucide-react";

export default function AIPlanningIntro() {
  const steps = [
    {
      step: "01",
      title: "Tell us what you love.",
      description:
        "Select your core passions — UNESCO boulder ruins, Western Ghats coffee treks, Arabian Sea beach trails, or wildlife safaris. Choose one or multiple.",
      icon: HeartHandshake,
      badge: "Passions & Themes",
    },
    {
      step: "02",
      title: "Choose your time and budget.",
      description:
        "Define your available days (1 to 21 days), party size, travel rhythm (relaxed, balanced, or intensive), and preferred comfort tier.",
      icon: Sliders,
      badge: "Real-world Constraints",
    },
    {
      step: "03",
      title: "Receive your personalized journey.",
      description:
        "Our engine computes optimal driving legs, organizes multi-day stay spans, and delivers a day-by-day plan with transparent INR cost breakdowns.",
      icon: MapPin,
      badge: "Zero-Hallucination Routes",
    },
  ];

  return (
    <div className="mb-14 max-w-7xl mx-auto">
      {/* Header */}
      <div className="max-w-3xl mb-12">
        <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-amber-400 font-mono mb-3">
          <Sparkles className="h-3.5 w-3.5" />
          <span>How It Works</span>
        </div>
        <h2 className="font-serif text-3xl sm:text-5xl font-normal tracking-tight text-white leading-tight">
          Intelligent Planning, Tailored to You
        </h2>
        <p className="mt-4 text-base text-slate-300 font-light leading-relaxed">
          Generic travel sites suggest disconnected lists. Karnataka Trails AI analyzes
          geographic proximity across 38 curated hubs, respects realistic drive times, and
          builds a coherent journey that fits your schedule.
        </p>
      </div>

      {/* Three Clear Steps */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {steps.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.step}
              className="relative flex flex-col justify-between rounded-xl border border-white/10 bg-[#0a0f18] p-7 transition-all duration-300 hover:border-white/20"
            >
              <div>
                <div className="flex items-center justify-between pb-6 border-b border-white/5">
                  <span className="font-mono text-2xl font-bold text-amber-400">
                    {s.step}
                  </span>
                  <span className="rounded bg-white/5 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-400">
                    {s.badge}
                  </span>
                </div>

                <div className="mt-6 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-amber-400">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h3 className="font-serif text-xl font-normal text-white">
                    {s.title}
                  </h3>
                </div>

                <p className="mt-4 text-xs sm:text-sm text-slate-300 font-light leading-relaxed">
                  {s.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
