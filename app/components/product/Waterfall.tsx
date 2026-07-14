// Faithful reproduction of the real trace waterfall at app/dashboard/traces/[id] —
// same span data (ResearchAgent trace, 12 spans, 3 LLM / 2 tool), same kind
// badges/colors as lib/replay/format.ts KIND_META, same forkable ◆ marker.
// The console's real colors are intentionally kept here (this is a window
// into the real product, not marketing chrome) against the page's arctic
// monochrome frame.

import WindowChrome from "./WindowChrome";

type Kind = "agent" | "task" | "llm" | "tool";

const KIND_META: Record<Kind, { label: string; color: string }> = {
  agent: { label: "AGENT", color: "#818CF8" },
  task: { label: "TASK", color: "#F59E0B" },
  llm: { label: "LLM", color: "#38BDF8" },
  tool: { label: "TOOL", color: "#34D399" },
};

type Row = { kind: Kind; name: string; depth: number; forkable?: boolean; width: number };

const ROWS: Row[] = [
  { kind: "agent", name: "invoke_agent ResearchAgent", depth: 0, width: 62 },
  { kind: "agent", name: "ResearchAgent.workflow", depth: 1, width: 60 },
  { kind: "task", name: "execute_task model", depth: 2, width: 10 },
  { kind: "llm", name: "ChatOpenAI.chat", depth: 3, forkable: true, width: 9 },
  { kind: "task", name: "execute_task tools", depth: 2, width: 3 },
  { kind: "tool", name: "search_filings", depth: 3, forkable: true, width: 3 },
  { kind: "task", name: "execute_task model", depth: 2, width: 15 },
  { kind: "llm", name: "ChatOpenAI.chat", depth: 3, forkable: true, width: 14 },
  { kind: "task", name: "execute_task tools", depth: 2, width: 3 },
  { kind: "tool", name: "extract_table", depth: 3, forkable: true, width: 3 },
  { kind: "task", name: "execute_task model", depth: 2, width: 30 },
  { kind: "llm", name: "ChatOpenAI.chat", depth: 3, forkable: true, width: 28 },
];

interface WaterfallProps {
  compact?: boolean;
}

export default function Waterfall({ compact = false }: WaterfallProps) {
  return (
    <div
      className="arctic-code-block"
      style={{
        background: "#0A0A0A",
        boxShadow: "0 10px 24px -8px rgba(15,23,32,0.55), 0 2px 6px -2px rgba(15,23,32,0.4)",
        fontFamily: "var(--font-mono)",
      }}
    >
      <WindowChrome title="waterfall — traces/ResearchAgent" />
      <div style={{ padding: compact ? "18px 20px" : "28px 32px" }}>
      {!compact && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <span style={{ fontSize: "0.6875rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "#808080" }}>
            traces / ResearchAgent
          </span>
          <span style={{ fontSize: "0.6875rem", letterSpacing: "0.08em", color: "#808080" }}>
            ◆ = forkable
          </span>
        </div>
      )}
      <div className="dash-scroll" style={{ display: "flex", flexDirection: "column", gap: compact ? 6 : 8, overflowX: "auto" }}>
        {ROWS.map((row, i) => {
          const meta = KIND_META[row.kind];
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, paddingLeft: row.depth * 18, minWidth: "max-content" }}>
              <span style={{ width: 12, flexShrink: 0, color: row.forkable ? KIND_META.tool.color : "#3A3A3A", fontSize: "0.75rem" }}>
                {row.forkable ? "◆" : "·"}
              </span>
              <span
                style={{
                  flexShrink: 0,
                  fontSize: "0.625rem",
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  color: meta.color,
                  background: `${meta.color}1A`,
                  padding: "2px 6px",
                  minWidth: 40,
                  textAlign: "center",
                }}
              >
                {meta.label}
              </span>
              <span style={{ color: "#D4D4D4", fontSize: "0.8125rem", flexShrink: 0 }}>{row.name}</span>
              <span style={{ flex: 1, height: 1, minWidth: 20 }} />
              <span
                style={{
                  height: 4,
                  width: `${row.width}%`,
                  maxWidth: 140,
                  background: meta.color,
                  opacity: 0.85,
                  flexShrink: 0,
                }}
              />
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}
