// ── Replay data model ────────────────────────────────────────────────
// Mirrors the enriched shape the Python `serve` backend produced from raw
// OpenTelemetry spans, so this frontend can later swap bundled data for a
// live `fetch('/api/...')` with no shape changes.

export type SpanKind = "agent" | "task" | "llm" | "tool" | "span";
export type SpanStatus = "OK" | "ERROR" | "UNSET";
export type ReplayType = "cached" | "forked" | "downstream";

export interface PromptMessage {
  role: string;
  content: string;
}

export interface ToolCall {
  name: string;
  arguments: string;
}

export interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

export interface Span {
  span_id: string;
  parent_span_id: string | null;
  name: string;
  display_name: string;
  kind: SpanKind;
  depth: number;
  start_rel_ms: number;
  duration_ms: number | null;
  status: SpanStatus;
  inputs: Record<string, string>;
  output: string;
  is_forkable: boolean;

  // llm-only
  model?: string;
  temperature?: number | string;
  tokens?: TokenUsage;
  prompt?: PromptMessage[];
  completion?: string;
  finish_reason?: string;
  tool_calls?: ToolCall[];

  // tool-only
  tool_name?: string;
  tool_description?: string;

  // replay-only
  replay_type?: ReplayType;
  changes_applied?: Record<string, string>;
  // normalized before/after for the forked span, decoupled from attribute keys
  field_changes?: { field: string; before: string; after: string }[];
}

export interface Trace {
  trace_id: string;
  created_at: string;
  agent: string | null;
  query: string;
  status: "OK" | "ERROR";
  span_count: number;
  llm_count: number;
  tool_count: number;
  duration_ms: number | null;
  total_tokens: number;
  spans: Span[];
}

export interface Replay {
  replay_trace_id: string;
  original_trace_id: string;
  fork_span_id: string;
  fork_span_name: string;
  created_at: string;
  changes: Record<string, string>;
  summary: string;
  final_output_before: string;
  final_output_after: string;
  spans: Span[];
}

export type LogLevel = "info" | "success" | "warn" | "error" | "debug";
export type LogSource = "engine" | "loader" | "tool" | "server" | "cli" | "tracer";

export interface LogEntry {
  id: string;
  ts: string; // ISO
  level: LogLevel;
  source: LogSource;
  trace_id?: string;
  message: string;
}
