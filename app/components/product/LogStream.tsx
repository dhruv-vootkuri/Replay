// Faithful reproduction of the real terminal-styled log stream at
// app/dashboard/logs — same level colors as lib/replay/format.ts
// LOG_LEVEL_META, real sample lines from the screenshotted session.

import WindowChrome from "./WindowChrome";

type Level = "debug" | "info" | "ok" | "warn" | "error";

const LEVEL_META: Record<Level, { label: string; color: string }> = {
  debug: { label: "DEBUG", color: "#6B7280" },
  info: { label: "INFO", color: "#38BDF8" },
  ok: { label: "OK", color: "#34D399" },
  warn: { label: "WARN", color: "#F59E0B" },
  error: { label: "ERROR", color: "#F43F5E" },
};

type LogRow = { ts: string; level: Level; source: string; message: string };

const ROWS: LogRow[] = [
  { ts: "09:41:04", level: "ok", source: "loader", message: "Trace persisted (12 spans)" },
  { ts: "09:41:02", level: "ok", source: "tool", message: "extract_table(10-Q) → Cloud +18%, Hardware -4%, Services +9%" },
  { ts: "09:41:01", level: "ok", source: "tool", message: "search_filings(Acme Corp Q2 10-Q) → Found 10-Q filed 2026-05-02" },
  { ts: "09:41:00", level: "info", source: "tracer", message: "Capturing trace for ResearchAgent — \"Summarize the Q2 revenue drivers for Acme Corp.\"" },
  { ts: "08:30:00", level: "warn", source: "engine", message: "Replaying downstream spans after fork point" },
  { ts: "08:30:00", level: "info", source: "cli", message: "Fork requested at 'get_population'" },
  { ts: "07:12:00", level: "ok", source: "tool", message: "lookup_error(429) → 429 = rate limited; retry with backoff" },
];

export default function LogStream() {
  return (
    <div className="arctic-code-block" style={{ background: "#0A0A0A", boxShadow: "0 10px 24px -8px rgba(15,23,32,0.55), 0 2px 6px -2px rgba(15,23,32,0.4)", fontFamily: "var(--font-mono)" }}>
      <WindowChrome title="logs — live" />
      <div style={{ padding: "20px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span className="dash-live-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "#34D399" }} />
        <span style={{ fontSize: "0.625rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "#666666" }}>streaming</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {ROWS.map((row, i) => {
          const lm = LEVEL_META[row.level];
          return (
            <div key={i} style={{ display: "flex", gap: 12, fontSize: "0.75rem", flexWrap: "wrap" }}>
              <span style={{ color: "#828282", flexShrink: 0 }}>{row.ts}</span>
              <span style={{ color: lm.color, fontWeight: 700, width: 42, flexShrink: 0 }}>{lm.label}</span>
              <span style={{ color: "#8B95A3", width: 52, flexShrink: 0 }}>{row.source}</span>
              <span style={{ color: "#D4D4D4" }}>{row.message}</span>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}
