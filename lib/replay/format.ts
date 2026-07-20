import type { SpanKind, ReplayType, LogLevel } from "./types";

// ── Duration ─────────────────────────────────────────────────────────
export function fmtDuration(ms: number | null | undefined): string {
  if (ms == null) return "—";
  if (ms < 1) return `${ms.toFixed(2)}ms`;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function fmtNumber(n: number): string {
  return n.toLocaleString("en-US");
}

// Relative time from a fixed "now" so SSR and client agree (no Date.now()).
const NOW = new Date("2026-07-06T18:00:00Z").getTime();
export function fmtRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diff = Math.max(0, NOW - then);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function fmtClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString("en-US", { hour12: false });
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function shortId(id: string, len = 12): string {
  return id.length > len ? `${id.slice(0, len)}…` : id;
}

// ── Span kind visual metadata ────────────────────────────────────────
export interface KindMeta {
  label: string;
  color: string; // hex
  cssVar: string; // tailwind theme var name
}

export const KIND_META: Record<SpanKind, KindMeta> = {
  llm: { label: "LLM", color: "#38BDF8", cssVar: "signal" },
  tool: { label: "Tool", color: "#34D399", cssVar: "pulse" },
  agent: { label: "Agent", color: "#818CF8", cssVar: "boundary" },
  task: { label: "Task", color: "#F59E0B", cssVar: "anomaly" },
  span: { label: "Span", color: "#94A3B8", cssVar: "dim-starlight" },
};

// ── Replay-type visual metadata (matches CLI diff legend) ─────────────
export interface ReplayTypeMeta {
  label: string;
  color: string;
  description: string;
}

export const REPLAY_TYPE_META: Record<ReplayType, ReplayTypeMeta> = {
  cached: {
    label: "cached",
    color: "#94A3B8",
    description: "Not re-executed — reused the original output.",
  },
  forked: {
    label: "forked",
    color: "#F59E0B",
    description: "Changed input — a real call was made.",
  },
  downstream: {
    label: "downstream",
    color: "#38BDF8",
    description: "Re-run because it followed the fork point.",
  },
};

// ── Log level metadata ───────────────────────────────────────────────
export const LOG_LEVEL_META: Record<LogLevel, { color: string; label: string }> = {
  debug: { color: "#64748B", label: "DEBUG" },
  info: { color: "#38BDF8", label: "INFO" },
  success: { color: "#34D399", label: "OK" },
  warn: { color: "#F59E0B", label: "WARN" },
  error: { color: "#F43F5E", label: "ERROR" },
};

export function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}
