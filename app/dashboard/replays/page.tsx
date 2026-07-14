import Link from "next/link";
import { PageHeader, Card, Mono, EmptyState } from "../ui";
import { replays, getTrace } from "@/lib/replay/data";
import { fmtRelativeTime, shortId } from "@/lib/replay/format";

export default function ReplaysPage() {
  return (
    <div>
      <PageHeader
        title="Replays"
        subtitle={`${replays.length} forks · what the agent would have done with different inputs`}
      />
      <div className="px-8 py-6">
        {replays.length === 0 ? (
          <Card>
            <EmptyState text="No replays yet. Fork a span from any trace to create one." />
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {replays.map((r) => {
              const orig = getTrace(r.original_trace_id);
              const changed = r.final_output_before.trim() !== r.final_output_after.trim();
              return (
                <Link
                  key={r.replay_trace_id}
                  href={`/dashboard/replays/${r.replay_trace_id}`}
                  className="group rounded-xl border border-black/[0.08] bg-surface/40 p-5 transition-colors hover:border-signal/30"
                >
                  <div className="flex items-center justify-between">
                    <Mono className="text-signal group-hover:underline">{shortId(r.replay_trace_id, 16)}</Mono>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        changed ? "bg-anomaly/15 text-anomaly" : "bg-black/[0.05] text-dim-starlight/60"
                      }`}
                    >
                      {changed ? "output changed" : "output stable"}
                    </span>
                  </div>

                  <div className="mt-3 text-xs text-dim-starlight/60">
                    forked at{" "}
                    <span className="font-[family-name:var(--font-mono)] text-boundary">{r.fork_span_name}</span>
                    {orig && (
                      <>
                        {" · "}from{" "}
                        <span className="font-[family-name:var(--font-mono)] text-dim-starlight">
                          {shortId(orig.trace_id, 10)}
                        </span>
                      </>
                    )}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg border border-divergence/25 bg-surface/30 p-2.5">
                      <div className="mb-1 text-[10px] uppercase tracking-wide text-divergence">before</div>
                      <p className="line-clamp-3 text-dim-starlight/80">{r.final_output_before || "—"}</p>
                    </div>
                    <div className="rounded-lg border border-pulse/25 bg-surface/30 p-2.5">
                      <div className="mb-1 text-[10px] uppercase tracking-wide text-pulse">after</div>
                      <p className="line-clamp-3 text-dim-starlight/80">{r.final_output_after || "—"}</p>
                    </div>
                  </div>

                  <div className="mt-3 text-[11px] text-dim-starlight/50">{fmtRelativeTime(r.created_at)}</div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
