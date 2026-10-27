import { Sparkles, HeartHandshake, Sliders, MapPin } from "lucide-react";

export default function AIPlanningIntro() {
  const steps = [
    {
      step: "01",
      title: "Tell us what you love.",
      description:
        "Select your core passions — UNESCO stone ruins, Western Ghats coffee ridges, pristine Arabian Sea coves, or wild tiger reserves. Choose one or multiple.",
      icon: HeartHandshake,
      badge: "Passions & Themes",
    },
    {
      step: "02",
      title: "Choose your pace and comfort.",
      description:
        "Define your available days (1 to 21 days), travel rhythm (relaxed, balanced, or packed), starting hub, and preferred comfort tier.",
      icon: Sliders,
      badge: "Real Constraints",
    },
    {
      step: "03",
      title: "Receive your tailored circuit.",
      description:
        "Our graph engine computes genuine highway drive times, balances multi-day stays, and delivers a day-by-day plan with verifiable Indian Rupee costs.",
      icon: MapPin,
      badge: "Zero-Guesswork Routes",
    },
  ];

  return (
    <section id="how-it-works" className="py-16 px-6 sm:px-10 max-w-7xl mx-auto w-full scroll-mt-24">
      {/* Header */}
      <div className="max-w-3xl mb-12">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#2d6a4f]/20 bg-[#eaf4ee] px-3.5 py-1 text-xs font-semibold text-[#1e533c] shadow-xs mb-3">
          <Sparkles className="h-3.5 w-3.5 text-[#2d6a4f]" />
          <span className="uppercase tracking-wider text-[11px]">How It Works</span>
        </div>
        <h2 className="font-serif text-3xl sm:text-5xl font-normal tracking-tight text-[#14231b] leading-tight">
          Thoughtful Planning in 3 Steps
        </h2>
        <p className="mt-3 text-base text-[#35483d] font-normal leading-relaxed">
          Generic travel sites suggest disconnected bullet points. Karnataka AI Travel Planner
          sequences geographically adjacent hubs, calculates realistic highway hours, and
          builds a calm, cohesive journey that fits your schedule.
        </p>
      </div>

      {/* Three Clear Steps */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {steps.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.step}
              className="relative flex flex-col justify-between rounded-3xl glass-panel-elevated p-8 border border-[#cbe1d5] shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-[#2d6a4f]/40 hover:shadow-xl"
            >
              <div>
                <div className="flex items-center justify-between pb-6 border-b border-[#dce9e1]">
                  <span className="font-serif text-2xl font-bold text-[#2d6a4f]">
                    {s.step}
                  </span>
                  <span className="rounded-full bg-[#eaf4ee] px-3 py-1 text-[11px] font-semibold text-[#1e533c] border border-[#c2ded0]">
                    {s.badge}
                  </span>
                </div>

                <div className="mt-6 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eaf4ee] text-[#1e533c] border border-[#c2ded0]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-serif text-xl font-normal text-[#14231b]">
                    {s.title}
                  </h3>
                </div>

                <p className="mt-4 text-sm text-[#35483d] font-normal leading-relaxed">
                  {s.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
