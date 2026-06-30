"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import Constellation from "@/app/components/constellation/Constellation";
import { heroPoints, heroEdges } from "@/app/components/constellation/presets";

const RESOLVE_DURATION = 1100;

type CapRow = { label: string; tracing: boolean | "partial"; replayCapable: boolean | "partial" };

const CAPABILITIES: CapRow[] = [
  { label: "Trace capture",          tracing: true,      replayCapable: true      },
  { label: "Pattern insights",       tracing: "partial", replayCapable: "partial" },
  { label: "Re-run past traces",     tracing: false,     replayCapable: true      },
  { label: "Insights on re-runs",    tracing: false,     replayCapable: false     },
  { label: "Sandbox unsafe tools",   tracing: false,     replayCapable: false     },
  { label: "Continuous agent audit", tracing: false,     replayCapable: false     },
];

function CellVal({ v }: { v: boolean | "partial" }) {
  if (v === true)  return <span style={{ color: "#FFFFFF" }}>✓</span>;
  if (v === "partial")
    return (
      <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.5625rem", letterSpacing: "0.1em", fontFamily: "Space Mono, monospace", textTransform: "uppercase" }}>
        partial
      </span>
    );
  return <span style={{ color: "rgba(255,255,255,0.18)" }}>—</span>;
}

interface WhySectionProps {
  canvasPaused?: boolean;
  isActive?: boolean;
}

export default function WhySection({ canvasPaused, isActive = false }: WhySectionProps) {
  const rm = useReducedMotion() ?? false;
  const startedRef = useRef(false);
  const [rp, setRp] = useState(0);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const h = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  useEffect(() => {
    if (!isActive || startedRef.current) return;
    startedRef.current = true;
    if (rm) { setRp(1); return; }

    let start: number | undefined;
    let raf: number;
    const tick = (ts: number) => {
      if (start === undefined) start = ts;
      const t = Math.min((ts - start) / RESOLVE_DURATION, 1);
      setRp(t);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isActive, rm]);

  const c = (v: number) => Math.max(0, Math.min(1, v));
  const ease = (x: number) => { const t = c(x); return t * t * (3 - 2 * t); };

  // Left column
  const labelOp = ease(c(rp / 0.35));
  const labelY  = (1 - labelOp) * 14;
  const h2Op    = ease(c((rp - 0.1) / 0.36));
  const h2Y     = (1 - h2Op) * 14;
  const p1Op    = ease(c((rp - 0.24) / 0.34));
  const p1Y     = (1 - p1Op) * 10;
  const p2Op    = ease(c((rp - 0.34) / 0.32));
  const p2Y     = (1 - p2Op) * 10;

  // Right column (table)
  const thOp   = ease(c((rp - 0.18) / 0.32));
  const thY    = (1 - thOp) * 10;
  const rowOp  = (i: number) => ease(c((rp - (0.32 + i * 0.055)) / 0.28));
  const rowY   = (i: number) => (1 - rowOp(i)) * 8;

  return (
    <section
      id="why"
      style={{ height: "100%", position: "relative", overflow: "hidden", background: "#080C14" }}
    >
      <div style={{ position: "absolute", inset: 0, opacity: 0.13, pointerEvents: "none" }}>
        <Constellation mode="canvas" points={heroPoints} edges={heroEdges} state="resolved" paused={canvasPaused} />
      </div>

      <div style={{ position: "absolute", inset: 0, background: "rgba(8,12,20,0.82)", pointerEvents: "none" }} />

      <div
        style={{
          position: "relative", zIndex: 1, height: "100%",
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          alignItems: isMobile ? "flex-start" : "center",
          padding: isMobile ? "80px 24px 32px" : "80px 64px 40px",
          gap: isMobile ? 32 : 60,
        }}
      >
        {/* Left: text */}
        <div style={{ flex: isMobile ? "none" : "0 0 44%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <p
            style={{
              fontFamily: "Space Mono, monospace", fontSize: "0.6875rem",
              letterSpacing: "0.2em", textTransform: "uppercase", color: "#38BDF8", marginBottom: 20,
              opacity: labelOp, transform: `translateY(${labelY}px)`,
            }}
          >
            The gap in the market
          </p>

          <h2
            style={{
              fontFamily: "Syne, sans-serif",
              fontSize: "clamp(2rem, 4.5vw, 3.5rem)", fontWeight: 700,
              lineHeight: 1.08, color: "#FFFFFF", marginBottom: 32,
              opacity: h2Op, transform: `translateY(${h2Y}px)`,
            }}
          >
            Logs tell you what happened.
            <br />
            Only pressure tests prove your fix will hold.
          </h2>

          <p
            style={{
              fontFamily: "Outfit, sans-serif",
              fontSize: "clamp(0.9375rem, 1.35vw, 1.0625rem)",
              lineHeight: 1.75, color: "#FFFFFF", marginBottom: 14,
              opacity: p1Op, transform: `translateY(${p1Y}px)`,
            }}
          >
            Every other observability platform was built for deterministic systems — where a
            known input reliably produces the same output. In agentic AI, that assumption
            doesn&apos;t hold. You can write every rule, give an LLM every tool, and it can
            still deviate on the very next run.
          </p>

          <p
            style={{
              fontFamily: "Outfit, sans-serif",
              fontSize: "clamp(0.9375rem, 1.35vw, 1.0625rem)",
              lineHeight: 1.75, color: "#FFFFFF",
              opacity: p2Op, transform: `translateY(${p2Y}px)`,
            }}
          >
            Some platforms replay traces. Others surface insights. None connect the two —
            and none offer a sandbox to isolate the tool calls that carry real-world
            consequences.
          </p>
        </div>

        {/* Vertical rule */}
        {!isMobile && (
          <div style={{ width: 1, height: "46%", background: "#1E293B", flexShrink: 0, opacity: thOp }} />
        )}

        {/* Right: table */}
        <div style={{ flex: 1, overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: isMobile ? 360 : "auto" }}>
            <thead>
              <tr style={{ opacity: thOp, transform: `translateY(${thY}px)` }}>
                {(
                  [
                    { label: "Capability",     align: "left",   accent: false },
                    { label: "Tracing tools",  align: "center", accent: false },
                    { label: "Alioth-capable", align: "center", accent: false },
                    { label: "Alioth",         align: "center", accent: true  },
                  ] as const
                ).map(({ label, align, accent }, ci) => (
                  <th
                    key={label}
                    style={{
                      textAlign: align,
                      fontFamily: "Space Mono, monospace", fontSize: "0.5625rem",
                      letterSpacing: "0.14em", textTransform: "uppercase",
                      color: accent ? "#38BDF8" : "#FFFFFF",
                      fontWeight: accent ? 700 : 400, paddingBottom: 14,
                      paddingRight: ci < 3 ? 20 : 0, paddingLeft: ci === 3 ? 16 : 0,
                      borderLeft: ci === 3 ? "1px solid rgba(56,189,248,0.15)" : "none",
                      background: ci === 3 ? "rgba(56,189,248,0.03)" : "transparent",
                    }}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CAPABILITIES.map((row, i) => (
                <tr
                  key={row.label}
                  style={{
                    borderTop: "1px solid #1E293B",
                    opacity: rowOp(i), transform: `translateY(${rowY(i)}px)`,
                  }}
                >
                  <td style={{ padding: "11px 20px 11px 0", fontFamily: "Outfit, sans-serif", fontSize: "0.875rem", color: "#FFFFFF", whiteSpace: "nowrap" }}>
                    {row.label}
                  </td>
                  <td style={{ textAlign: "center", padding: "11px 20px 11px 0" }}>
                    <CellVal v={row.tracing} />
                  </td>
                  <td style={{ textAlign: "center", padding: "11px 20px 11px 0" }}>
                    <CellVal v={row.replayCapable} />
                  </td>
                  <td style={{ textAlign: "center", padding: "11px 16px", background: "rgba(56,189,248,0.04)", borderLeft: "1px solid rgba(56,189,248,0.12)" }}>
                    <span style={{ color: "#38BDF8", fontWeight: 700, fontSize: "1rem" }}>✓</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
