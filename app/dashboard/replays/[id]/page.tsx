"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { PageHeader, Card, Mono, EmptyState } from "../../ui";
import { DiffView } from "../../DiffView";
import { getReplay, getTrace } from "@/lib/replay/data";
import { fmtDate, shortId } from "@/lib/replay/format";

export default function ReplayDetailPage() {
  const params = useParams<{ id: string }>();
  const replay = getReplay(params.id);

  if (!replay) {
    return (
      <div>
        <PageHeader title="Replay not found" breadcrumb={[{ label: "replays", href: "/dashboard/replays" }]} />
        <div className="px-8 py-6">
          <EmptyState text="No replay matches this id." />
        </div>
      </div>
    );
  }

  const orig = getTrace(replay.original_trace_id);

  return (
    <div>
      <PageHeader
        title="Replay diff"
        breadcrumb={[
          { label: "replays", href: "/dashboard/replays" },
          { label: shortId(replay.replay_trace_id, 12), href: `/dashboard/replays/${replay.replay_trace_id}` },
        ]}
        subtitle={replay.summary}
        right={
          orig && (
            <Link
              href={`/dashboard/traces/${orig.trace_id}`}
              className="rounded-lg border border-white/[0.08] px-3 py-2 text-xs text-dim-starlight transition-colors hover:text-signal"
            >
              ← Original trace
            </Link>
          )
        }
      />

      <div className="space-y-5 px-8 py-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Meta label="Replay ID" value={<Mono className="text-starlight">{shortId(replay.replay_trace_id, 14)}</Mono>} />
          <Meta label="Original" value={<Mono className="text-starlight">{shortId(replay.original_trace_id, 14)}</Mono>} />
          <Meta label="Fork point" value={<span className="text-boundary">{replay.fork_span_name}</span>} />
          <Meta label="Replayed" value={fmtDate(replay.created_at)} />
        </div>

        {Object.keys(replay.changes).length > 0 && (
          <Card title="Applied changes">
            <div className="space-y-1.5">
              {Object.entries(replay.changes).map(([k, v]) => (
                <div key={k} className="flex flex-wrap items-center gap-2 text-sm">
                  <Mono className="text-dim-starlight/60">{k}</Mono>
                  <span className="text-dim-starlight/40">=</span>
                  <span className="font-[family-name:var(--font-mono)] text-pulse">{v}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        <DiffView replay={replay} />
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-surface/30 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-dim-starlight/50">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-starlight">{value}</div>
    </div>
  );
}
