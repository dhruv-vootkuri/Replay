import type { Trace, Replay, Span, LogEntry, LogLevel, LogSource } from "./types";
import real from "./sample-real.json";

// The one real, recovered trace + its real replay (fork country="Paris").
const realTrace = real.trace as unknown as Trace;
const realReplay = real.replay as unknown as Replay;

// ── Deterministic PRNG so SSR === client (no Date.now / Math.random) ──
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function id(rng: () => number, len = 32): string {
  const hex = "0123456789abcdef";
  let s = "";
  for (let i = 0; i < len; i++) s += hex[Math.floor(rng() * 16)];
  return s;
}

// ── Synthetic agent templates ────────────────────────────────────────
interface StepTool {
  tool: string;
  desc: string;
  input: Record<string, string>;
  output: string;
}
interface Template {
  agent: string;
  query: string;
  system: string;
  model: string;
  steps: StepTool[];
  finalAnswer: string;
  failAt?: number; // index into steps that errors
}

const TEMPLATES: Template[] = [
  {
    agent: "ResearchAgent",
    query: "Summarize the Q2 revenue drivers for Acme Corp.",
    system: "You are a financial research assistant. Cite the source table for every figure.",
    model: "gpt-4o",
    steps: [
      { tool: "search_filings", desc: "Search SEC filings.", input: { query: "Acme Corp Q2 10-Q" }, output: "Found 10-Q filed 2026-05-02 (3 relevant sections)" },
      { tool: "extract_table", desc: "Extract a financial table.", input: { doc: "10-Q", section: "revenue" }, output: "Cloud +18%, Hardware -4%, Services +9%" },
    ],
    finalAnswer: "Q2 revenue rose 11% YoY, driven mainly by Cloud (+18%) and Services (+9%); Hardware declined 4%.",
  },
  {
    agent: "SupportBot",
    query: "My export keeps failing with a 429 — how do I fix it?",
    system: "You are a support agent. Prefer the safest documented fix.",
    model: "gpt-4o-mini",
    steps: [
      { tool: "lookup_error", desc: "Look up an error code.", input: { code: "429" }, output: "429 = rate limited; retry with backoff" },
      { tool: "search_docs", desc: "Search the docs.", input: { q: "export rate limit" }, output: "Docs: batch exports capped at 5/min" },
    ],
    finalAnswer: "A 429 means you're exceeding 5 exports/min. Add exponential backoff or batch fewer rows per call.",
  },
  {
    agent: "CodeReviewer",
    query: "Does this diff introduce an N+1 query?",
    system: "You are a senior code reviewer. Flag performance issues with a line reference.",
    model: "gpt-4o",
    steps: [
      { tool: "read_diff", desc: "Read the pull-request diff.", input: { pr: "1421" }, output: "loads user.orders inside a for-loop over users" },
      { tool: "run_profiler", desc: "Profile the hot path.", input: { path: "GET /users" }, output: "142 queries for 141 users" },
    ],
    finalAnswer: "Yes — user.orders is loaded per-iteration (142 queries for 141 users). Preload with a join to fix the N+1.",
  },
  {
    agent: "LangGraph",
    query: "Book me the cheapest flight from SFO to Tokyo next Friday.",
    system: "You are a travel agent. Never book without a confirmed price.",
    model: "gpt-4o",
    steps: [
      { tool: "search_flights", desc: "Search available flights.", input: { from: "SFO", to: "HND", date: "next Friday" }, output: "12 options, cheapest $612 (ZipAir)" },
      { tool: "hold_seat", desc: "Place a temporary hold.", input: { flight: "ZipAir ZG23" }, output: "ERROR: seat inventory unavailable" },
    ],
    finalAnswer: "The cheapest fare (ZipAir, $612) just sold out mid-hold. Want me to try the next option at $680?",
    failAt: 1,
  },
  {
    agent: "ResearchAgent",
    query: "What's the current population of the capital of France?",
    system: "You are a helpful assistant. Always use the provided tools.",
    model: "gpt-4o",
    steps: [
      { tool: "get_capital", desc: "Returns the capital city of a country.", input: { country: "France" }, output: "Paris" },
      { tool: "get_population", desc: "Returns the approximate population of a city.", input: { city: "Paris" }, output: "2.1 million" },
    ],
    finalAnswer: "The population of Paris, the capital of France, is approximately 2.1 million.",
  },
  {
    agent: "SupportBot",
    query: "Refund my last invoice, it was charged twice.",
    system: "You are a billing agent. Confirm the duplicate before refunding.",
    model: "gpt-4o-mini",
    steps: [
      { tool: "list_charges", desc: "List recent charges.", input: { account: "acct_88" }, output: "Two $49 charges 4s apart on 2026-06-30" },
    ],
    finalAnswer: "Confirmed a duplicate $49 charge on Jun 30. I've queued a refund; it lands in 3–5 business days.",
  },
];

// ── Build one synthetic trace from a template ────────────────────────
function buildTrace(tpl: Template, seed: number, createdAt: string): Trace {
  const rng = mulberry32(seed);
  const traceId = id(rng);
  const spans: Span[] = [];
  let cursor = 0; // relative ms

  const agentId = id(rng, 16);
  const workflowId = id(rng, 16);

  const push = (s: Span) => spans.push(s);

  // depth-0 agent + depth-1 workflow (durations filled after)
  const agentSpan: Span = {
    span_id: agentId, parent_span_id: null, name: `invoke_agent ${tpl.agent}`,
    display_name: `invoke_agent ${tpl.agent}`, kind: "agent", depth: 0,
    start_rel_ms: 0, duration_ms: 0, status: "OK", inputs: {}, output: "", is_forkable: false,
  };
  const workflowSpan: Span = {
    span_id: workflowId, parent_span_id: agentId, name: `${tpl.agent}.workflow`,
    display_name: `${tpl.agent}.workflow`, kind: "agent", depth: 1,
    start_rel_ms: 3, duration_ms: 0, status: "OK", inputs: {}, output: "", is_forkable: false,
  };
  push(agentSpan);
  push(workflowSpan);
  cursor = 5;

  let totalTokens = 0;
  let traceStatus: "OK" | "ERROR" = "OK";

  const nSteps = tpl.steps.length;
  for (let i = 0; i <= nSteps; i++) {
    // model step (llm)
    const modelTaskId = id(rng, 16);
    const llmId = id(rng, 16);
    const llmDur = 900 + Math.floor(rng() * 1800);
    const isFinal = i === nSteps;
    const inTok = 90 + Math.floor(rng() * 120);
    const outTok = isFinal ? 20 + Math.floor(rng() * 40) : 12 + Math.floor(rng() * 12);
    totalTokens += inTok + outTok;

    push({
      span_id: modelTaskId, parent_span_id: workflowId, name: "execute_task model",
      display_name: "execute_task model", kind: "task", depth: 2,
      start_rel_ms: cursor, duration_ms: llmDur + 6, status: "OK", inputs: {}, output: "", is_forkable: false,
    });
    const llmSpan: Span = {
      span_id: llmId, parent_span_id: modelTaskId, name: "ChatOpenAI.chat",
      display_name: "ChatOpenAI.chat", kind: "llm", depth: 3,
      start_rel_ms: cursor + 3, duration_ms: llmDur, status: "OK",
      inputs: { system: tpl.system, user: tpl.query },
      output: isFinal ? tpl.finalAnswer : "",
      is_forkable: true,
      model: tpl.model, temperature: 0,
      tokens: { input: inTok, output: outTok, total: inTok + outTok },
      prompt: [
        { role: "system", content: tpl.system },
        { role: "user", content: tpl.query },
      ],
      completion: isFinal ? tpl.finalAnswer : "",
      finish_reason: isFinal ? "stop" : "tool_calls",
    };
    if (!isFinal) {
      llmSpan.tool_calls = [
        { name: tpl.steps[i].tool, arguments: JSON.stringify(tpl.steps[i].input) },
      ];
    }
    push(llmSpan);
    cursor += llmDur + 10;

    if (isFinal) break;

    // tool step
    const step = tpl.steps[i];
    const toolTaskId = id(rng, 16);
    const toolId = id(rng, 16);
    const toolDur = 0.3 + rng() * 3;
    const failed = tpl.failAt === i;
    if (failed) traceStatus = "ERROR";
    push({
      span_id: toolTaskId, parent_span_id: workflowId, name: "execute_task tools",
      display_name: "execute_task tools", kind: "task", depth: 2,
      start_rel_ms: cursor, duration_ms: toolDur + 1, status: failed ? "ERROR" : "OK",
      inputs: {}, output: "", is_forkable: false,
    });
    push({
      span_id: toolId, parent_span_id: toolTaskId, name: `execute_tool ${step.tool}`,
      display_name: step.tool, kind: "tool", depth: 3,
      start_rel_ms: cursor + 2, duration_ms: toolDur, status: failed ? "ERROR" : "OK",
      inputs: step.input, output: step.output, is_forkable: true,
      tool_name: step.tool, tool_description: step.desc,
    });
    cursor += toolDur + 8;
  }

  const total = cursor;
  agentSpan.duration_ms = total;
  workflowSpan.duration_ms = total - 3;

  const llm = spans.filter((s) => s.kind === "llm");
  const tool = spans.filter((s) => s.kind === "tool");

  return {
    trace_id: traceId,
    created_at: createdAt,
    agent: tpl.agent,
    query: tpl.query,
    status: traceStatus,
    span_count: spans.length,
    llm_count: llm.length,
    tool_count: tool.length,
    duration_ms: total,
    total_tokens: totalTokens,
    spans,
  };
}

// Fixed timestamps (descending recency), no Date.now.
const TIMES = [
  "2026-07-06T16:41:00Z",
  "2026-07-06T14:12:00Z",
  "2026-07-05T22:03:00Z",
  "2026-07-05T09:48:00Z",
  "2026-07-03T18:20:00Z",
  "2026-07-01T11:15:00Z",
];

const syntheticTraces: Trace[] = TEMPLATES.map((tpl, i) =>
  buildTrace(tpl, 1000 + i * 97, TIMES[i]),
);

// Newest first; real trace sits in the middle of the timeline.
export const traces: Trace[] = [...syntheticTraces, realTrace].sort(
  (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
);

// ── Replays ──────────────────────────────────────────────────────────
// The one real replay, plus a couple synthetic ones off synthetic traces.
function buildSyntheticReplay(
  base: Trace,
  seed: number,
  forkKind: "llm" | "tool",
  fieldChanges: { field: string; before: string; after: string }[],
  before: string,
  after: string,
  createdAt: string,
): Replay {
  const rng = mulberry32(seed);
  const forkTarget = [...base.spans].reverse().find((s) => s.kind === forkKind && s.is_forkable)!;
  const forkIdx = base.spans.findIndex((x) => x.span_id === forkTarget.span_id);
  const replaySpans: Span[] = base.spans.map((s, myIdx) => {
    let rt: Span["replay_type"] = "cached";
    if (s.span_id === forkTarget.span_id) rt = "forked";
    else if (myIdx > forkIdx) rt = "downstream";
    const copy: Span = { ...s, replay_type: rt };
    if (rt === "forked") {
      copy.field_changes = fieldChanges;
      copy.changes_applied = Object.fromEntries(fieldChanges.map((c) => [c.field, c.after]));
    }
    if (rt === "downstream" && s.kind === "llm" && s.output) copy.output = after;
    return copy;
  });
  return {
    replay_trace_id: id(rng),
    original_trace_id: base.trace_id,
    fork_span_id: forkTarget.span_id,
    fork_span_name: forkTarget.display_name,
    created_at: createdAt,
    changes: Object.fromEntries(fieldChanges.map((c) => [c.field, c.after])),
    summary: `Forked at '${forkTarget.display_name}' with changes: ${fieldChanges
      .map((c) => `${c.field}='${c.after}'`)
      .join(", ")}. ${replaySpans.filter((s) => s.replay_type === "downstream").length} downstream span(s) affected.`,
    final_output_before: before,
    final_output_after: after,
    spans: replaySpans,
  };
}

// Normalize the real replay's forked span into clean field_changes.
// Its raw changes_applied is keyed by OTel attribute (gen_ai.tool.call.arguments);
// derive the human before/after (country: Zorblax → Paris) from the original trace.
(function normalizeRealReplay() {
  // source `replayed_at` is a unix-seconds float that misparses as 1970 — pin it
  // to just after the original trace was captured.
  realReplay.created_at = "2026-03-30T21:31:12Z";
  const forked = realReplay.spans.find((s) => s.replay_type === "forked");
  if (!forked) return;
  const origSpan = realTrace.spans.find((s) => s.display_name === forked.display_name);
  const before = origSpan ? Object.entries(origSpan.inputs)[0] : undefined;
  // real fork changed country "Zorblax" → "Paris"
  forked.field_changes = [
    { field: before ? before[0] : "country", before: before ? before[1] : "Zorblax", after: "Paris" },
  ];
  forked.changes_applied = { [before ? before[0] : "country"]: "Paris" };
})();

const researchTrace = traces.find((t) => t.agent === "ResearchAgent" && t.query.includes("France"))!;
const reviewTrace = traces.find((t) => t.agent === "CodeReviewer")!;

export const replays: Replay[] = [
  realReplay,
  buildSyntheticReplay(
    researchTrace,
    5501,
    "tool",
    [{ field: "result", before: "2.1 million", after: "8.9 million" }],
    "The population of Paris, the capital of France, is approximately 2.1 million.",
    "The population of Paris, the capital of France, is approximately 8.9 million.",
    "2026-07-06T15:30:00Z",
  ),
  buildSyntheticReplay(
    reviewTrace,
    5602,
    "llm",
    [
      {
        field: "user",
        before: "Does this diff introduce an N+1 query?",
        after: "Does this diff introduce an N+1 query? Assume the ORM auto-batches.",
      },
    ],
    "Yes — user.orders is loaded per-iteration (142 queries for 141 users). Preload with a join to fix the N+1.",
    "No N+1 if the ORM auto-batches: the per-iteration access collapses into a single IN query. Verify batching is actually on.",
    "2026-07-05T23:10:00Z",
  ),
];

// ── Activity log feed ────────────────────────────────────────────────
// Deterministically synthesized from the traces + replays, newest first.
function buildLogs(): LogEntry[] {
  const rng = mulberry32(42);
  const out: LogEntry[] = [];
  const add = (ts: string, level: LogLevel, source: LogSource, message: string, trace_id?: string) =>
    out.push({ id: id(rng, 12), ts, level, source, message, trace_id });

  for (const t of traces) {
    const base = new Date(t.created_at).getTime();
    const iso = (offsetMs: number) => new Date(base + offsetMs).toISOString();
    add(iso(0), "info", "tracer", `Capturing trace for ${t.agent ?? "agent"} — "${t.query.slice(0, 48)}"`, t.trace_id);
    add(iso(20), "debug", "tracer", `Registered ${t.span_count} spans (${t.llm_count} LLM, ${t.tool_count} tool)`, t.trace_id);
    for (const s of t.spans) {
      if (s.kind === "llm" && s.tokens) {
        add(iso(s.start_rel_ms + 22), "debug", "engine", `${s.model} → ${s.tokens.total} tok (${s.tokens.input} in / ${s.tokens.output} out)`, t.trace_id);
      }
      if (s.kind === "tool") {
        if (s.status === "ERROR") {
          add(iso(s.start_rel_ms + 22), "error", "tool", `${s.tool_name} raised: ${s.output}`, t.trace_id);
        } else {
          add(iso(s.start_rel_ms + 22), "success", "tool", `${s.tool_name}(${Object.values(s.inputs)[0] ?? ""}) → ${s.output}`, t.trace_id);
        }
      }
    }
    if (t.status === "ERROR") {
      add(iso((t.duration_ms ?? 0) + 30), "warn", "engine", `Trace finished with errors (${(t.duration_ms ?? 0) / 1000 | 0}s)`, t.trace_id);
    } else {
      add(iso((t.duration_ms ?? 0) + 30), "success", "loader", `Trace persisted (${t.span_count} spans)`, t.trace_id);
    }
  }
  for (const r of replays) {
    const base = new Date(r.created_at).getTime();
    const iso = (o: number) => new Date(base + o).toISOString();
    add(iso(0), "info", "cli", `Fork requested at '${r.fork_span_name}'`, r.original_trace_id);
    add(iso(40), "warn", "engine", `Replaying downstream spans after fork point`, r.original_trace_id);
    add(iso(1200), "success", "engine", `Replay complete → ${r.replay_trace_id.slice(0, 12)}…`, r.original_trace_id);
  }

  return out.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
}

export const logs: LogEntry[] = buildLogs();

// ── Selectors ────────────────────────────────────────────────────────
export function getTrace(traceId: string): Trace | undefined {
  return traces.find((t) => t.trace_id === traceId || t.trace_id.startsWith(traceId));
}
export function getReplay(replayId: string): Replay | undefined {
  return replays.find((r) => r.replay_trace_id === replayId || r.replay_trace_id.startsWith(replayId));
}
export function replaysForTrace(traceId: string): Replay[] {
  return replays.filter((r) => r.original_trace_id === traceId);
}
