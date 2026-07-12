// Faithful reproduction of the real replay-diff view at
// app/dashboard/replays/[id] — same recorded example from
// lib/replay/sample-real.json: forked at 'get_capital' with
// country Zorblax → Paris, 6 downstream spans affected.

type SpanStatus = "cached" | "forked" | "downstream";

const STATUS_META: Record<SpanStatus, { label: string; color: string }> = {
  cached: { label: "CACHED", color: "#6B7280" },
  forked: { label: "FORKED", color: "#F59E0B" },
  downstream: { label: "DOWNSTREAM", color: "#38BDF8" },
};

type Kind = "agent" | "task" | "tool" | "llm";
const KIND_COLOR: Record<Kind, string> = { agent: "#818CF8", task: "#F59E0B", tool: "#34D399", llm: "#38BDF8" };

type Row = {
  status: SpanStatus;
  kind: Kind;
  name: string;
  diff?: { field: string; before: string; after: string };
  output?: string;
};

const ROWS: Row[] = [
  { status: "cached", kind: "agent", name: "invoke_agent LangGraph" },
  { status: "cached", kind: "agent", name: "LangGraph.workflow" },
  { status: "cached", kind: "task", name: "execute_task tools" },
  { status: "forked", kind: "tool", name: "get_capital", diff: { field: "country", before: "Zorblax", after: "Paris" } },
  { status: "downstream", kind: "task", name: "execute_task model" },
  { status: "downstream", kind: "task", name: "execute_task tools" },
  { status: "downstream", kind: "tool", name: "get_population" },
  { status: "downstream", kind: "task", name: "execute_task model" },
  {
    status: "downstream",
    kind: "llm",
    name: "ChatOpenAI.chat",
    output: "It seems that “Zorblax” is not a recognized country, and therefore, I cannot provide information about its capital or population.",
  },
];

interface ReplayDiffProps {
  compact?: boolean;
}

export default function ReplayDiff({ compact = false }: ReplayDiffProps) {
  return (
    <div style={{ background: "#0A0A0A", border: "1px solid rgba(150,190,220,0.22)", boxShadow: "0 20px 50px -20px rgba(60,90,120,0.35), 0 0 0 1px rgba(190,220,239,0.06)", padding: compact ? "18px 20px" : "28px 32px", fontFamily: "var(--font-mono)" }}>
      {!compact && (
        <p style={{ fontSize: "0.8125rem", color: "#D4D4D4", marginBottom: 18, lineHeight: 1.6 }}>
          Forked at <span style={{ color: "#F59E0B" }}>&apos;execute_tool get_capital&apos;</span> with changes:{" "}
          <span style={{ color: "#F59E0B" }}>country=&apos;Paris&apos;</span>. 6 downstream span(s) affected.
        </p>
      )}

      {!compact && (
        <div style={{ display: "flex", gap: 12, marginBottom: 18 }}>
          <div style={{ flex: 1, border: "1px solid #3F1D1D", padding: "10px 14px" }}>
            <div style={{ fontSize: "0.5625rem", letterSpacing: "0.1em", color: "#F87171", marginBottom: 6 }}>ORIGINAL OUTPUT</div>
            <div style={{ fontSize: "0.75rem", color: "#B0B0B0", lineHeight: 1.5 }}>
              The population of Blorbis, the capital of Zorblax, is approximately 4.7 million.
            </div>
          </div>
          <div style={{ flex: 1, border: "1px solid #123B2A", padding: "10px 14px" }}>
            <div style={{ fontSize: "0.5625rem", letterSpacing: "0.1em", color: "#4ADE80", marginBottom: 6 }}>AFTER REPLAY</div>
            <div style={{ fontSize: "0.75rem", color: "#B0B0B0", lineHeight: 1.5 }}>
              The population of Blorbis, the capital of Zorblax, is 4.7 million.
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: compact ? 6 : 10 }}>
        {ROWS.map((row, i) => {
          const sm = STATUS_META[row.status];
          return (
            <div key={i}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.06em", color: sm.color, background: `${sm.color}1A`, padding: "2px 6px" }}>
                  {sm.label}
                </span>
                <span style={{ fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.06em", color: KIND_COLOR[row.kind], background: `${KIND_COLOR[row.kind]}1A`, padding: "2px 6px" }}>
                  {row.kind.toUpperCase()}
                </span>
                <span style={{ color: "#D4D4D4", fontSize: "0.8125rem" }}>{row.name}</span>
              </div>
              {row.diff && (
                <div style={{ marginLeft: 4, marginTop: 4, paddingLeft: 10, borderLeft: "2px solid #F59E0B", fontSize: "0.75rem" }}>
                  <div style={{ color: "#6B7280" }}>{row.diff.field}</div>
                  <div style={{ color: "#F87171" }}>− {row.diff.before}</div>
                  <div style={{ color: "#4ADE80" }}>+ {row.diff.after}</div>
                </div>
              )}
              {row.output && !compact && (
                <div style={{ marginLeft: 4, marginTop: 4, paddingLeft: 10, borderLeft: "2px solid #38BDF8", fontSize: "0.75rem", color: "#8A8A8A", lineHeight: 1.5 }}>
                  output: {row.output}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
