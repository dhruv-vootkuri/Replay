"use client";

import { useState } from "react";
import WindowChrome from "./WindowChrome";

type OS = "unix" | "windows";

const OS_LABEL: Record<OS, string> = { unix: "macOS/Linux", windows: "Windows" };

// The one real place the CLI's own commands genuinely differ is shell
// syntax for the REPLAY=1 env-var shortcut (see CLAUDE.md's "Real CLI
// commands worth naming in copy") — macOS and Linux are both POSIX shells
// (bash/zsh) with identical syntax, so they're one tab, not two that
// happen to show the same text; Windows/PowerShell needs the $env: form,
// which is a real difference, not decoration.
const COMMANDS: Record<OS, { prompt: string; lines: string[] }> = {
  unix: {
    prompt: "$",
    lines: ["pip install replay", "python my_agent.py", "REPLAY=1 python my_agent.py"],
  },
  windows: {
    prompt: ">",
    lines: ["pip install replay", "python my_agent.py", "$env:REPLAY=1; python my_agent.py"],
  },
};

export default function InstallCommand() {
  const [os, setOs] = useState<OS>("unix");
  const cmd = COMMANDS[os];

  return (
    <div
      className="arctic-code-block install-code-block"
      style={{ background: "#0A0A0A", boxShadow: "0 10px 24px -8px rgba(15,23,32,0.55), 0 2px 6px -2px rgba(15,23,32,0.4)", fontFamily: "var(--font-mono)" }}
    >
      <WindowChrome
        center={
          // Text sized/colored to match the WindowChrome title convention
          // every other real-UI block uses (see e.g. ReplayDiff's
          // "replay.diff — get_capital", Waterfall's "waterfall —
          // traces/ResearchAgent": 0.8125rem, weight 600, #D4D4D4) instead
          // of the smaller, dimmer mono-label treatment this used before —
          // these tabs sit where a title normally would, so they should
          // read at the same weight as one.
          <div role="tablist" aria-label="Operating system" style={{ display: "flex", gap: 2, background: "#1A1D24", borderRadius: 5, padding: 2 }}>
            {(["unix", "windows"] as const).map((opt) => (
              <button
                key={opt}
                role="tab"
                aria-selected={os === opt}
                onClick={() => setOs(opt)}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  padding: "4px 14px",
                  borderRadius: 4,
                  border: "none",
                  cursor: "pointer",
                  color: os === opt ? "#0B0E14" : "#D4D4D4",
                  background: os === opt ? "#5FA8D3" : "transparent",
                  transition: "background 0.2s, color 0.2s",
                }}
              >
                {OS_LABEL[opt]}
              </button>
            ))}
          </div>
        }
      />
      <div style={{ padding: "24px 28px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {cmd.lines.map((line, i) => (
            <div key={i} style={{ display: "flex", gap: 10, fontSize: "0.8125rem" }}>
              <span style={{ color: "#38BDF8", flexShrink: 0 }}>{cmd.prompt}</span>
              <span style={{ color: "#D4D4D4" }}>{line}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
