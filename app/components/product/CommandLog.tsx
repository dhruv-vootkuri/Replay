// Real CLI command syntax (see replay/cli.py + README on the main branch)
// applied to the same recorded example as ReplayDiff above it — get_capital,
// country Zorblax → Paris, 6 downstream spans — so this reads as "the actual
// command behind that diff," not a second, unrelated example. IDs are
// illustrative short hashes in the same shape real trace/replay IDs take,
// not literal internal data.

import WindowChrome from "./WindowChrome";

type Line = { type: "cmd"; text: string } | { type: "out"; text: string; color?: string };

const LINES: Line[] = [
  { type: "cmd", text: 'replay fork bf35b08 4a91f2c --set country="Paris"' },
  { type: "out", text: "cached: 3 · forked: 1 · downstream: 6", color: "#8B95A3" },
  { type: "out", text: "✓ saved → bf35b08.replay.21b5a25.json", color: "#34D399" },
  { type: "cmd", text: "replay diff 21b5a25" },
  { type: "out", text: "get_capital  country: Zorblax → Paris", color: "#D4D4D4" },
  { type: "out", text: "6 downstream span(s) re-run", color: "#8B95A3" },
  { type: "cmd", text: "replay explore bf35b08" },
  { type: "out", text: "→ arrow keys to navigate, Enter to fork at a ◆ span", color: "#38BDF8" },
];

export default function CommandLog() {
  return (
    <div
      className="arctic-code-block"
      style={{ background: "#0A0A0A", boxShadow: "0 10px 24px -8px rgba(15,23,32,0.55), 0 2px 6px -2px rgba(15,23,32,0.4)", fontFamily: "var(--font-mono)" }}
    >
      <WindowChrome title="terminal — replay" />
      <div style={{ padding: "24px 28px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {LINES.map((line, i) =>
            line.type === "cmd" ? (
              <div key={i} style={{ display: "flex", gap: 10, fontSize: "0.8125rem", marginTop: i === 0 ? 0 : 10 }}>
                <span style={{ color: "#38BDF8", flexShrink: 0 }}>$</span>
                <span style={{ color: "#F5F5F5" }}>{line.text}</span>
              </div>
            ) : (
              <div key={i} style={{ paddingLeft: 20, fontSize: "0.75rem", color: line.color || "#B0B0B0" }}>
                {line.text}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
