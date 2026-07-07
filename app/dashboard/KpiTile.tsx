import { Sparkline } from "./charts";

export function KpiTile({
  label,
  value,
  unit,
  spark,
  sparkColor,
  accent = "#38BDF8",
  delta,
}: {
  label: string;
  value: string;
  unit?: string;
  spark?: number[];
  sparkColor?: string;
  accent?: string;
  delta?: { value: string; positive: boolean };
}) {
  return (
    <div className="dash-fade-in rounded-xl border border-white/[0.06] bg-surface/40 p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-dim-starlight/70">{label}</span>
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accent }} />
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <div className="font-[family-name:var(--font-display)] text-3xl font-semibold tabular-nums text-starlight">
          {value}
          {unit && <span className="ml-1 text-base font-normal text-dim-starlight/70">{unit}</span>}
        </div>
        {spark && <Sparkline points={spark} color={sparkColor ?? accent} />}
      </div>
      {delta && (
        <div className={`mt-2 text-xs ${delta.positive ? "text-pulse" : "text-divergence"}`}>
          {delta.positive ? "▲" : "▼"} {delta.value}
        </div>
      )}
    </div>
  );
}
