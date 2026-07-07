import { traces, replays } from "./data";
import type { SpanKind } from "./types";

export interface Totals {
  traceCount: number;
  replayCount: number;
  llmCalls: number;
  toolCalls: number;
  totalTokens: number;
  avgDurationMs: number;
  errorRate: number; // 0..1
  spanCount: number;
}

export function getTotals(): Totals {
  const traceCount = traces.length;
  const llmCalls = traces.reduce((a, t) => a + t.llm_count, 0);
  const toolCalls = traces.reduce((a, t) => a + t.tool_count, 0);
  const totalTokens = traces.reduce((a, t) => a + t.total_tokens, 0);
  const spanCount = traces.reduce((a, t) => a + t.span_count, 0);
  const durations = traces.map((t) => t.duration_ms ?? 0).filter((d) => d > 0);
  const avgDurationMs = durations.length
    ? durations.reduce((a, b) => a + b, 0) / durations.length
    : 0;
  const errors = traces.filter((t) => t.status === "ERROR").length;
  return {
    traceCount,
    replayCount: replays.length,
    llmCalls,
    toolCalls,
    totalTokens,
    avgDurationMs,
    errorRate: traceCount ? errors / traceCount : 0,
    spanCount,
  };
}

// Span-kind breakdown across all traces (for the donut / stacked bar).
export function getKindBreakdown(): { kind: SpanKind; count: number }[] {
  const map = new Map<SpanKind, number>();
  for (const t of traces) for (const s of t.spans) map.set(s.kind, (map.get(s.kind) ?? 0) + 1);
  const order: SpanKind[] = ["llm", "tool", "agent", "task", "span"];
  return order.filter((k) => map.has(k)).map((kind) => ({ kind, count: map.get(kind)! }));
}

// Traces grouped by calendar day (chronological).
export function getTracesByDay(): { date: string; label: string; count: number; errors: number }[] {
  const map = new Map<string, { count: number; errors: number }>();
  for (const t of traces) {
    const day = t.created_at.slice(0, 10);
    const cur = map.get(day) ?? { count: 0, errors: 0 };
    cur.count += 1;
    if (t.status === "ERROR") cur.errors += 1;
    map.set(day, cur);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => ({
      date,
      label: new Date(date + "T00:00:00Z").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }),
      count: v.count,
      errors: v.errors,
    }));
}

// Per-trace latency, newest first (for the latency bar chart).
export function getLatencies(): { trace_id: string; agent: string; ms: number; status: string }[] {
  return traces.map((t) => ({
    trace_id: t.trace_id,
    agent: t.agent ?? "agent",
    ms: t.duration_ms ?? 0,
    status: t.status,
  }));
}

// Token usage per trace.
export function getTokenUsage(): { trace_id: string; agent: string; tokens: number }[] {
  return traces
    .map((t) => ({ trace_id: t.trace_id, agent: t.agent ?? "agent", tokens: t.total_tokens }))
    .filter((t) => t.tokens > 0);
}

// Tool-call frequency across all traces.
export function getToolFrequency(): { tool: string; count: number }[] {
  const map = new Map<string, number>();
  for (const t of traces)
    for (const s of t.spans)
      if (s.kind === "tool" && s.tool_name) map.set(s.tool_name, (map.get(s.tool_name) ?? 0) + 1);
  return [...map.entries()].map(([tool, count]) => ({ tool, count })).sort((a, b) => b.count - a.count);
}

// Agent activity breakdown.
export function getAgentBreakdown(): { agent: string; traces: number; tokens: number }[] {
  const map = new Map<string, { traces: number; tokens: number }>();
  for (const t of traces) {
    const a = t.agent ?? "agent";
    const cur = map.get(a) ?? { traces: 0, tokens: 0 };
    cur.traces += 1;
    cur.tokens += t.total_tokens;
    map.set(a, cur);
  }
  return [...map.entries()]
    .map(([agent, v]) => ({ agent, ...v }))
    .sort((a, b) => b.traces - a.traces);
}
