"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import Constellation from "@/app/components/constellation/Constellation";
import type { StarPoint, Edge } from "@/app/components/constellation/types";
import {
  insightsPoints, insightsEdges,
  pressurePoints, pressureEdges, pressureOverlayPoints, pressureOverlayEdges,
  sandboxPoints, sandboxEdges,
  agentPoints, agentEdges,
} from "@/app/components/constellation/presets";

const SLIVER = 52;
const REVEAL_DURATION = 720;

type TabDef = {
  id: string;
  label: string;
  accent: string;
  points: StarPoint[];
  edges: Edge[];
  variant: "flagged" | "overlay-diff" | "twin-ghost" | "traveling-point";
  overlayPoints?: StarPoint[];
  overlayEdges?: Edge[];
  heading: string;
  body: string;
};

const TABS: TabDef[] = [
  {
    id: "insights",
    label: "Insights",
    accent: "#5EA8F0",
    points: insightsPoints,
    edges: insightsEdges,
    variant: "flagged",
    heading: "Surface what diverged.",
    body: "Alioth watches every trace. When a cluster of decisions falls outside the expected pattern, it highlights exactly which edges changed — not a log of everything that happened. You open a flag and see the specific decision node, not a wall of tokens.",
  },
  {
    id: "pressure-tests",
    label: "Pressure Tests",
    accent: "#9B8CF5",
    points: pressurePoints,
    edges: pressureEdges,
    variant: "overlay-diff",
    overlayPoints: pressureOverlayPoints,
    overlayEdges: pressureOverlayEdges,
    heading: "Re-run the exact moment.",
    body: "Pick any trace, swap one input variable, and re-run it. The overlaid diff view shows precisely where the agent's path diverged from the original. No reproducing from scratch. No guessing which input caused it.",
  },
  {
    id: "sandboxes",
    label: "Sandboxes",
    accent: "#3EC8D8",
    points: sandboxPoints,
    edges: sandboxEdges,
    variant: "twin-ghost",
    heading: "Test without touching production.",
    body: "Snapshot your full agent environment — tools, memory, system prompt, external calls — into an isolated clone. Run destructive experiments or validate a fix. The live system is never touched. Takes about 30 seconds to spin up.",
  },
  {
    id: "agent",
    label: "Agent",
    accent: "#6DCCB0",
    points: agentPoints,
    edges: agentEdges,
    variant: "traveling-point",
    heading: "Infrastructure that audits itself.",
    body: "Alioth's monitoring agent traverses your agentic graph on a continuous loop, comparing current behavior against a baseline. It surfaces drift and flags regressions before your users notice — and before you're debugging at 2 a.m.",
  },
];

function smoothstep(x: number): number {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}

// FT range = 4×24 vh holds + 3×120 vh entrances = 456 vh total (pct 0→1).
// Each tab k≥1 starts entering after k holds and (k-1) entrances have elapsed.
function rawProgress(k: number, pct: number): number {
  if (k === 0) return 1;
  const startPct = (k * 24 + (k - 1) * 120) / 456;
  return Math.max(0, Math.min(1, (pct - startPct) / (120 / 456)));
}

function sg(p: number, start: number, end: number): number {
  return smoothstep((p - start) / (end - start));
}

interface FeaturesSectionProps {
  tabScrollProgress?: number;
  canvasPaused?: boolean;
  isActive?: boolean;
}

export default function FeaturesSection({ tabScrollProgress = 0, canvasPaused, isActive = false }: FeaturesSectionProps) {
  const rm  = useReducedMotion() ?? false;
  const pct = tabScrollProgress;

  // One-shot RAF progress per tab — all fire the same way, just triggered at different times
  const startedRef = useRef([false, false, false, false]);
  const [rp0, setRp0] = useState(0);
  const [rp1, setRp1] = useState(0);
  const [rp2, setRp2] = useState(0);
  const [rp3, setRp3] = useState(0);

  function fireReveal(setter: (v: number) => void, reducedMotion: boolean) {
    if (reducedMotion) { setter(1); return; }
    let start: number | undefined;
    const tick = (ts: number) => {
      if (start === undefined) start = ts;
      const t = Math.min((ts - start) / REVEAL_DURATION, 1);
      setter(t);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // Tab 0: fires when the Features section arrives
  useEffect(() => {
    if (!isActive || startedRef.current[0]) return;
    startedRef.current[0] = true;
    fireReveal(setRp0, rm);
  }, [isActive, rm]);

  // Tabs 1–3: fire once each tab has scrolled at least 92% into view
  useEffect(() => {
    const setters = [setRp0, setRp1, setRp2, setRp3];
    [1, 2, 3].forEach(k => {
      if (startedRef.current[k] || rawProgress(k, pct) < 0.92) return;
      startedRef.current[k] = true;
      fireReveal(setters[k], rm);
    });
  }, [pct, rm]);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const h = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  const rpArr = [rp0, rp1, rp2, rp3];

  return (
    <section id="features" style={{ height: "100%", position: "relative", overflow: "hidden", background: "#080C14" }}>

      {TABS.map((tab, k) => {
        const rp         = rawProgress(k, pct);
        const tx         = rm ? 0 : (1 - smoothstep(rp)) * 100;
        const tabOpacity = rm ? smoothstep(rp) : 1;

        // Each tab's stagger progress is its own RAF-driven value (0→1)
        const p = smoothstep(rpArr[k]);

        const a1 = sg(p, 0.00, 0.36); const y1 = (1 - a1) * 12;
        const a2 = sg(p, 0.10, 0.45); const y2 = (1 - a2) * 12;
        const a3 = sg(p, 0.22, 0.58); const y3 = (1 - a3) * 12;
        const a4 = sg(p, 0.38, 0.72); const y4 = (1 - a4) * 10;

        return (
          <div
            key={tab.id}
            style={{
              position: "absolute", inset: 0,
              left: isMobile ? 0 : k * SLIVER,
              width: isMobile ? "100%" : `calc(100% - ${k * SLIVER}px)`,
              transform: `translateX(${tx}%)`,
              opacity: tabOpacity,
              zIndex: k + 1,
              background: "#080C14",
              borderLeft: `3px solid ${tab.accent}`,
              willChange: rm ? "opacity" : "transform",
              overflow: "hidden",
            }}
          >
            {/* Sliver strip — desktop only */}
            {!isMobile && (
              <div style={{ position: "absolute", left: 0, top: 0, width: SLIVER - 3, height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: "Syne, sans-serif", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: tab.accent, writingMode: "vertical-rl", transform: "rotate(180deg)", userSelect: "none", opacity: 0.9 }}>
                  {tab.label}
                </span>
              </div>
            )}

            {isMobile ? (
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "56px 24px 48px", gap: 20, overflowY: "auto" }}>
                <div style={{ width: "min(56vw, 180px)", aspectRatio: "1", flexShrink: 0 }}>
                  <Constellation mode="svg" points={tab.points} edges={tab.edges} state="resolved" variant={tab.variant} accentColor={tab.accent} overlayPoints={tab.overlayPoints} overlayEdges={tab.overlayEdges} paused={canvasPaused} />
                </div>
                <div style={{ textAlign: "center", maxWidth: 340 }}>
                  <p style={{ fontFamily: "Space Mono, monospace", fontSize: "0.5625rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "#38BDF8", marginBottom: 8, opacity: a1, transform: `translateY(${y1}px)` }}>How it works</p>
                  <p style={{ fontFamily: "Space Mono, monospace", fontSize: "0.625rem", letterSpacing: "0.18em", textTransform: "uppercase", color: tab.accent, marginBottom: 12, opacity: a2, transform: `translateY(${y2}px)` }}>{tab.label}</p>
                  <h3 style={{ fontFamily: "Syne, sans-serif", fontSize: "clamp(1.25rem, 5vw, 1.625rem)", fontWeight: 600, lineHeight: 1.15, color: "#FFFFFF", marginBottom: 14, opacity: a3, transform: `translateY(${y3}px)` }}>{tab.heading}</h3>
                  <p style={{ fontFamily: "Outfit, sans-serif", fontSize: "0.9375rem", lineHeight: 1.65, color: "#FFFFFF", opacity: a4, transform: `translateY(${y4}px)` }}>{tab.body}</p>
                </div>
              </div>
            ) : (
              <div style={{ position: "absolute", left: SLIVER, right: 0, top: 0, bottom: 0, display: "flex", alignItems: "center" }}>
                <div style={{ flexShrink: 0, width: "44%", padding: "48px 40px", alignSelf: "stretch", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: "100%", maxWidth: 360, aspectRatio: "1" }}>
                    <Constellation mode="svg" points={tab.points} edges={tab.edges} state="resolved" variant={tab.variant} accentColor={tab.accent} overlayPoints={tab.overlayPoints} overlayEdges={tab.overlayEdges} paused={canvasPaused} />
                  </div>
                </div>

                <div style={{ width: 1, height: "46%", background: "#1E293B", flexShrink: 0 }} />

                <div style={{ flex: 1, padding: "0 52px 0 44px", maxWidth: 500 }}>
                  <p style={{ fontFamily: "Space Mono, monospace", fontSize: "0.5625rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "#38BDF8", marginBottom: 10, opacity: a1, transform: `translateY(${y1}px)` }}>How it works</p>
                  <p style={{ fontFamily: "Space Mono, monospace", fontSize: "0.6875rem", letterSpacing: "0.18em", textTransform: "uppercase", color: tab.accent, marginBottom: 18, opacity: a2, transform: `translateY(${y2}px)` }}>{tab.label}</p>
                  <h3 style={{ fontFamily: "Syne, sans-serif", fontSize: "clamp(1.375rem, 2vw, 2rem)", fontWeight: 600, lineHeight: 1.1, color: "#FFFFFF", marginBottom: 20, opacity: a3, transform: `translateY(${y3}px)` }}>{tab.heading}</h3>
                  <p style={{ fontFamily: "Outfit, sans-serif", fontSize: "clamp(0.9375rem, 1.25vw, 1.0625rem)", lineHeight: 1.75, color: "#FFFFFF", opacity: a4, transform: `translateY(${y4}px)` }}>{tab.body}</p>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Progress dots */}
      <div style={{ position: "absolute", bottom: 28, left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 8, zIndex: 100, pointerEvents: "none" }}>
        {TABS.map((tab, k) => {
          const rp = rawProgress(k, pct);
          const active = rp >= 0.95 && (k === TABS.length - 1 || rawProgress(k + 1, pct) < 0.05);
          return (
            <div key={tab.id} style={{ height: 5, width: rp > 0.05 ? (active ? 20 : 14) : 5, borderRadius: 3, background: rp > 0.05 ? tab.accent : "#1E293B", opacity: rp > 0.05 ? 1 : 0.3, transition: "width 0.3s ease, background 0.3s ease" }} />
          );
        })}
      </div>
    </section>
  );
}
