import type { Replay } from "@/lib/replay/types";
import { REPLAY_TYPE_META, KIND_META } from "@/lib/replay/format";
import { KindBadge, ReplayBadge } from "./ui";

// Mirrors `replay diff`: cached / forked / downstream classification with
// before→after on the forked span and the final downstream output.
export function DiffView({ replay }: { replay: Replay }) {
  return (
    <div className="space-y-4">
      {/* Final output before/after */}
      {(replay.final_output_before || replay.final_output_after) && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <BeforeAfterCard label="Original output" tone="before" text={replay.final_output_before} />
          <BeforeAfterCard label="After replay" tone="after" text={replay.final_output_after} />
        </div>
      )}

      {/* Span-by-span */}
      <div className="rounded-xl border border-black/[0.08] bg-surface/40">
        <div className="border-b border-black/[0.08] px-4 py-2.5 text-[11px] uppercase tracking-wide text-dim-starlight/60">
          Spans
        </div>
        <div className="divide-y divide-black/[0.06]">
          {replay.spans.map((s) => (
            <div key={s.span_id} className="flex flex-col gap-2 px-4 py-3">
              <div className="flex items-center gap-2.5">
                {s.replay_type && <ReplayBadge type={s.replay_type} />}
                <KindBadge kind={s.kind} />
                <span className="font-[family-name:var(--font-mono)] text-sm text-starlight">{s.display_name}</span>
              </div>

              {s.replay_type === "forked" && s.field_changes && s.field_changes.length > 0 && (
                <div className="ml-1 space-y-2 border-l-2 pl-3" style={{ borderColor: REPLAY_TYPE_META.forked.color }}>
                  {s.field_changes.map((c) => (
                    <div key={c.field} className="text-xs">
                      <div className="font-[family-name:var(--font-mono)] text-dim-starlight/60">{c.field}</div>
                      <div className="text-divergence">− {c.before || "(empty)"}</div>
                      <div className="text-pulse">+ {c.after || "(empty)"}</div>
                    </div>
                  ))}
                </div>
              )}

              {s.replay_type === "downstream" && s.kind === "llm" && s.output && (
                <div className="ml-1 border-l-2 pl-3 text-xs" style={{ borderColor: REPLAY_TYPE_META.downstream.color }}>
                  <span className="text-dim-starlight/60">output: </span>
                  <span className="text-dim-starlight/90">{s.output}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 rounded-lg border border-black/[0.08] bg-surface/30 px-4 py-3 text-xs">
        {(["cached", "forked", "downstream"] as const).map((t) => (
          <div key={t} className="flex items-center gap-2">
            <ReplayBadge type={t} />
            <span className="text-dim-starlight/70">{REPLAY_TYPE_META[t].description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BeforeAfterCard({ label, tone, text }: { label: string; tone: "before" | "after"; text: string }) {
  const color = tone === "before" ? "#F43F5E" : "#34D399";
  return (
    <div className="rounded-lg border bg-surface/30 p-3" style={{ borderColor: `${color}33` }}>
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] uppercase tracking-wide" style={{ color }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
        {label}
      </div>
      <p className="text-sm leading-relaxed text-dim-starlight/90">{text || <span className="text-dim-starlight/40">—</span>}</p>
    </div>
  );
}
