import type { HealthResponse } from "../api/types";

const OFFLINE: HealthResponse = {
  status: "ok",
  service: "",
  version: "",
  environment: "",
  llm_configured: false,
  dataset_size: 0,
};

export default function HealthBadge({ health }: { health: HealthResponse | null }) {
  const data = health ?? OFFLINE;
  const online = health !== null;

  return (
    <div
      className={`rounded-full border px-3 py-1 text-xs font-medium ${
        online
          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
          : "border-slate-300 bg-slate-100 text-slate-500"
      }`}
      title={online ? `${data.service} v${data.version}` : "Backend not reachable"}
    >
      <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${online ? "bg-emerald-500" : "bg-slate-400"}`} />
      {online ? `API online · ${data.dataset_size} destinations` : "API offline"}
      {online && ` · LLM ${data.llm_configured ? "on" : "off (fallback)"}`}
    </div>
  );
}
