"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PageHeader, Card, KindBadge, StatusPill, Mono, EmptyState } from "../../ui";
import { DiffView } from "../../DiffView";
import { getTrace, replaysForTrace } from "@/lib/replay/data";
import { simulateFork, type SimulatedReplay } from "@/lib/replay/fork";
import type { Span } from "@/lib/replay/types";
import { KIND_META, fmtDuration, fmtNumber, fmtDate, shortId } from "@/lib/replay/format";

export default function TraceDetailPage() {
  const params = useParams<{ id: string }>();
  const trace = getTrace(params.id);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showIds, setShowIds] = useState(false);
  const [forkingId, setForkingId] = useState<string | null>(null);
  const [forkResult, setForkResult] = useState<SimulatedReplay | null>(null);

  const selected = useMemo(
    () => trace?.spans.find((s) => s.span_id === selectedId) ?? null,
    [trace, selectedId],
  );
  const recordedReplays = trace ? replaysForTrace(trace.trace_id) : [];

  if (!trace) {
    return (
      <div>
        <PageHeader title="Trace not found" breadcrumb={[{ label: "traces", href: "/dashboard/traces" }]} />
        <div className="px-8 py-6">
          <EmptyState text="No trace matches this id." />
        </div>
      </div>
    );
  }

  const total = trace.duration_ms ?? 1;

  function selectSpan(s: Span) {
    setSelectedId((cur) => (cur === s.span_id ? null : s.span_id));
    setForkingId(null);
    setForkResult(null);
  }

  function startFork(s: Span) {
    setForkingId(s.span_id);
    setForkResult(null);
  }

  function runFork(spanId: string, inputs: Record<string, string>) {
    setForkResult(simulateFork(trace!, spanId, inputs));
  }

  return (
    <div>
      <PageHeader
        title={trace.agent ?? "Trace"}
        breadcrumb={[
          { label: "traces", href: "/dashboard/traces" },
          { label: shortId(trace.trace_id, 12), href: `/dashboard/traces/${trace.trace_id}` },
        ]}
        subtitle={trace.query}
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowIds((v) => !v)}
              className={`rounded-lg border px-3 py-2 text-xs transition-colors ${
                showIds ? "border-signal/50 bg-signal/10 text-signal" : "border-black/[0.10] text-dim-starlight hover:text-starlight"
              }`}
            >
              {showIds ? "Hide span IDs" : "Show span IDs"}
            </button>
            <StatusPill status={trace.status} />
          </div>
        }
      />

      <div className="px-8 py-6">
        {/* Meta strip */}
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Meta label="Trace ID" value={<Mono className="text-starlight">{shortId(trace.trace_id, 16)}</Mono>} />
          <Meta label="Spans" value={String(trace.span_count)} />
          <Meta label="LLM calls" value={String(trace.llm_count)} accent={KIND_META.llm.color} />
          <Meta label="Tool calls" value={String(trace.tool_count)} accent={KIND_META.tool.color} />
          <Meta label="Tokens" value={fmtNumber(trace.total_tokens)} />
          <Meta label="Duration" value={fmtDuration(trace.duration_ms)} />
        </div>
        <div className="mb-6 text-xs text-dim-starlight/50">Captured {fmtDate(trace.created_at)}</div>

        {/* Recorded replays banner */}
        {recordedReplays.length > 0 && (
          <div className="mb-5 flex flex-wrap items-center gap-2 rounded-lg border border-boundary/30 bg-boundary/[0.06] px-4 py-2.5 text-sm">
            <span className="text-boundary">◇ {recordedReplays.length} recorded replay{recordedReplays.length > 1 ? "s" : ""}</span>
            {recordedReplays.map((r) => (
              <Link
                key={r.replay_trace_id}
                href={`/dashboard/replays/${r.replay_trace_id}`}
                className="rounded bg-black/[0.05] px-2 py-1 font-[family-name:var(--font-mono)] text-xs text-dim-starlight hover:text-signal"
              >
                {shortId(r.replay_trace_id, 12)} →
              </Link>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_minmax(360px,420px)]">
          {/* Timeline */}
          <Card title="Timeline" hint="◆ = forkable · click a span to inspect">
            <div className="flex flex-col">
              {trace.spans.map((s, i) => (
                <SpanRow
                  key={s.span_id}
                  span={s}
                  index={i}
                  total={total}
                  active={s.span_id === selectedId}
                  showId={showIds}
                  onClick={() => selectSpan(s)}
                />
              ))}
            </div>
          </Card>

          {/* Inspector */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            {selected ? (
              <Inspector
                span={selected}
                forking={forkingId === selected.span_id}
                forkResult={forkResult && forkResult.fork_span_id === selected.span_id ? forkResult : null}
                onStartFork={() => startFork(selected)}
                onCancelFork={() => {
                  setForkingId(null);
                  setForkResult(null);
                }}
                onRunFork={(inputs) => runFork(selected.span_id, inputs)}
              />
            ) : (
              <Card>
                <EmptyState icon="◈" text="Select a span to inspect its inputs, output, and fork it." />
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Span row (waterfall) ─────────────────────────────────────────────
function SpanRow({
  span,
  index,
  total,
  active,
  showId,
  onClick,
}: {
  span: Span;
  index: number;
  total: number;
  active: boolean;
  showId: boolean;
  onClick: () => void;
}) {
  const meta = KIND_META[span.kind];
  const left = ((span.start_rel_ms ?? 0) / total) * 100;
  const width = Math.max(((span.duration_ms ?? 0) / total) * 100, 0.6);
  const err = span.status === "ERROR";

  return (
    <button
      onClick={onClick}
      className={`group grid grid-cols-[minmax(0,1fr)_120px] items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors ${
        active ? "bg-signal/10" : "hover:bg-black/[0.03]"
      }`}
    >
      <div className="flex min-w-0 items-center gap-2" style={{ paddingLeft: span.depth * 16 }}>
        {span.depth > 0 && <span className="text-dim-starlight/25">└</span>}
        <span className="flex-shrink-0" style={{ color: span.is_forkable ? KIND_META.tool.color : "#DCE3EA" }}>
          {span.is_forkable ? "◆" : "·"}
        </span>
        <KindBadge kind={span.kind} />
        <span className={`truncate text-sm ${active ? "text-starlight" : "text-dim-starlight group-hover:text-starlight"}`}>
          {span.display_name}
        </span>
        {err && <span className="flex-shrink-0 text-divergence">✗</span>}
        {showId && <Mono className="flex-shrink-0 text-[10px] text-dim-starlight/40">{shortId(span.span_id, 10)}</Mono>}
      </div>
      {/* mini waterfall */}
      <div className="relative h-4">
        <div className="absolute inset-y-0 left-0 right-0 my-auto h-px bg-black/[0.05]" />
        <div
          className="absolute inset-y-0 my-auto h-2 rounded-full"
          style={{
            left: `${left}%`,
            width: `${width}%`,
            backgroundColor: err ? "#F43F5E" : meta.color,
            opacity: active ? 1 : 0.7,
          }}
          title={fmtDuration(span.duration_ms)}
        />
      </div>
    </button>
  );
}

// ── Inspector ────────────────────────────────────────────────────────
function Inspector({
  span,
  forking,
  forkResult,
  onStartFork,
  onCancelFork,
  onRunFork,
}: {
  span: Span;
  forking: boolean;
  forkResult: SimulatedReplay | null;
  onStartFork: () => void;
  onCancelFork: () => void;
  onRunFork: (inputs: Record<string, string>) => void;
}) {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <KindBadge kind={span.kind} />
        <span className="font-[family-name:var(--font-display)] text-base font-semibold text-starlight">
          {span.display_name}
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-dim-starlight/60">
        <Mono className="text-dim-starlight/50">{shortId(span.span_id, 18)}</Mono>
        <span>{fmtDuration(span.duration_ms)}</span>
        <span className={span.status === "ERROR" ? "text-divergence" : "text-pulse"}>{span.status}</span>
      </div>

      {/* LLM detail */}
      {span.kind === "llm" && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2 text-xs">
            {span.model && <Facet k="model" v={span.model} />}
            {span.temperature != null && <Facet k="temp" v={String(span.temperature)} />}
            {span.finish_reason && <Facet k="finish" v={span.finish_reason} />}
            {span.tokens && <Facet k="tokens" v={`${span.tokens.total} (${span.tokens.input}/${span.tokens.output})`} />}
          </div>
          {span.prompt?.map((m, i) => (
            <Block key={i} label={m.role}>
              {m.content}
            </Block>
          ))}
          {span.tool_calls?.map((tc, i) => (
            <Block key={i} label={`tool call → ${tc.name}`} mono>
              {tc.arguments}
            </Block>
          ))}
          {span.completion ? <Block label="completion">{span.completion}</Block> : null}
        </div>
      )}

      {/* Tool detail */}
      {span.kind === "tool" && (
        <div className="mt-4 space-y-3">
          {span.tool_description && <p className="text-xs text-dim-starlight/70">{span.tool_description}</p>}
          {Object.keys(span.inputs).length > 0 && (
            <div>
              <div className="mb-1 text-[11px] uppercase tracking-wide text-dim-starlight/50">Arguments</div>
              {Object.entries(span.inputs).map(([k, v]) => (
                <div key={k} className="flex gap-2 py-0.5 text-xs">
                  <Mono className="text-dim-starlight/60">{k}:</Mono>
                  <span className="text-starlight">{v}</span>
                </div>
              ))}
            </div>
          )}
          {span.output && <Block label="result">{span.output}</Block>}
        </div>
      )}

      {/* Non-forkable spans (agent/task) */}
      {!span.is_forkable && span.kind !== "llm" && span.kind !== "tool" && (
        <p className="mt-4 text-xs text-dim-starlight/50">
          This is a structural {span.kind} span — it has no editable inputs, so it can&apos;t be forked.
        </p>
      )}

      {/* Fork zone */}
      {span.is_forkable && (
        <div className="mt-5 border-t border-black/[0.08] pt-4">
          {!forking && !forkResult && (
            <button
              onClick={onStartFork}
              className="w-full rounded-lg bg-signal py-2.5 text-sm font-medium text-deep-space transition-opacity hover:opacity-90"
            >
              ◆ Fork here
            </button>
          )}
          {forking && !forkResult && (
            <ForkForm span={span} onRun={onRunFork} onCancel={onCancelFork} />
          )}
          {forkResult && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-pulse">
                <span>✓ Replay complete</span>
                <span className="rounded bg-anomaly/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-anomaly">
                  simulated
                </span>
              </div>
              <p className="text-xs text-dim-starlight/70">{forkResult.summary}</p>
              <DiffView replay={forkResult} />
              <button
                onClick={onStartFork}
                className="w-full rounded-lg border border-black/[0.10] py-2 text-sm text-dim-starlight transition-colors hover:text-starlight"
              >
                Fork again
              </button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function ForkForm({
  span,
  onRun,
  onCancel,
}: {
  span: Span;
  onRun: (inputs: Record<string, string>) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => ({ ...span.inputs }));
  const fields = Object.entries(span.inputs);

  return (
    <div className="space-y-3">
      <div className="text-[11px] uppercase tracking-wide text-dim-starlight/50">Edit inputs to fork</div>
      {fields.map(([k, v]) => {
        const long = String(v).length > 60;
        return (
          <div key={k}>
            <label className="mb-1 block font-[family-name:var(--font-mono)] text-xs text-dim-starlight/60">{k}</label>
            {long ? (
              <textarea
                rows={3}
                value={values[k]}
                onChange={(e) => setValues((s) => ({ ...s, [k]: e.target.value }))}
                className="w-full resize-y rounded-lg border border-black/[0.10] bg-black/[0.04] px-3 py-2 text-sm text-starlight focus:border-signal/50 focus:outline-none"
              />
            ) : (
              <input
                value={values[k]}
                onChange={(e) => setValues((s) => ({ ...s, [k]: e.target.value }))}
                className="w-full rounded-lg border border-black/[0.10] bg-black/[0.04] px-3 py-2 text-sm text-starlight focus:border-signal/50 focus:outline-none"
              />
            )}
          </div>
        );
      })}
      <div className="flex gap-2">
        <button
          onClick={() => onRun(values)}
          className="flex-1 rounded-lg bg-signal py-2 text-sm font-medium text-deep-space transition-opacity hover:opacity-90"
        >
          Run replay
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg border border-black/[0.10] px-4 py-2 text-sm text-dim-starlight transition-colors hover:text-starlight"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Small building blocks ────────────────────────────────────────────
function Meta({ label, value, accent }: { label: string; value: React.ReactNode; accent?: string }) {
  return (
    <div className="rounded-lg border border-black/[0.08] bg-surface/30 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-dim-starlight/50">{label}</div>
      <div className="mt-0.5 text-sm font-medium" style={{ color: accent ?? "#0B0E14" }}>
        {value}
      </div>
    </div>
  );
}

function Facet({ k, v }: { k: string; v: string }) {
  return (
    <span className="rounded bg-black/[0.05] px-2 py-1 font-[family-name:var(--font-mono)] text-[11px]">
      <span className="text-dim-starlight/50">{k} </span>
      <span className="text-starlight">{v}</span>
    </span>
  );
}

function Block({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <div className="mb-1 text-[11px] uppercase tracking-wide text-dim-starlight/50">{label}</div>
      <div
        className={`max-h-48 overflow-y-auto dash-scroll rounded-lg border border-black/[0.08] bg-black/[0.04] px-3 py-2 text-xs leading-relaxed text-dim-starlight/90 ${
          mono ? "font-[family-name:var(--font-mono)]" : ""
        }`}
      >
        {children}
      </div>
    </div>
  );
}
