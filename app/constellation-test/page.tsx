"use client";

import { useState } from "react";
import Constellation from "@/app/components/constellation/Constellation";
import type { ConstellationState } from "@/app/components/constellation/types";
import {
  heroPoints, heroEdges,
  problemPoints, problemEdges,
  insightsPoints, insightsEdges,
  pressurePoints, pressureEdges, pressureOverlayPoints, pressureOverlayEdges,
  sandboxPoints, sandboxEdges,
  agentPoints, agentEdges,
} from "@/app/components/constellation/presets";

type Mode = "canvas" | "svg";

const VARIANTS = [
  {
    label: "Default / Resolved",
    description: "Clean shape, signal blue — base state for hero and features.",
    points: heroPoints,
    edges: heroEdges,
    state: "resolved" as ConstellationState,
    variant: "default" as const,
    accentColor: "#38BDF8",
    height: 260,
  },
  {
    label: "Unresolved (Problem page)",
    description: "Stars drift slowly, edges tangle — illegible. Canvas only makes this live.",
    points: problemPoints,
    edges: problemEdges,
    state: "unresolved" as ConstellationState,
    variant: "default" as const,
    accentColor: "#38BDF8",
    height: 260,
  },
  {
    label: "Flagged (Insights)",
    description: "Most edges calm; anomaly cluster glows amber.",
    points: insightsPoints,
    edges: insightsEdges,
    state: "resolved" as ConstellationState,
    variant: "flagged" as const,
    accentColor: "#F59E0B",
    height: 260,
  },
  {
    label: "Overlay Diff (Pressure Tests)",
    description: "Two traces overlaid — diverging edges in rose.",
    points: pressurePoints,
    edges: pressureEdges,
    state: "resolved" as ConstellationState,
    variant: "overlay-diff" as const,
    accentColor: "#F43F5E",
    overlayPoints: pressureOverlayPoints,
    overlayEdges: pressureOverlayEdges,
    height: 260,
  },
  {
    label: "Twin Ghost (Sandboxes)",
    description: "Live constellation + dashed ghost offset inside a boundary circle.",
    points: sandboxPoints,
    edges: sandboxEdges,
    state: "resolved" as ConstellationState,
    variant: "twin-ghost" as const,
    accentColor: "#818CF8",
    height: 280,
  },
  {
    label: "Traveling Point (Agent)",
    description: "A pulse of Emerald light loops the edges continuously.",
    points: agentPoints,
    edges: agentEdges,
    state: "resolved" as ConstellationState,
    variant: "traveling-point" as const,
    accentColor: "#34D399",
    height: 260,
  },
] as const;

function ModeButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 16px",
        background: active ? "#38BDF8" : "#0F172A",
        color: active ? "#080C14" : "#94A3B8",
        border: `1px solid ${active ? "#38BDF8" : "#1E293B"}`,
        borderRadius: 6,
        fontFamily: "Space Grotesk, sans-serif",
        fontSize: "0.8125rem",
        fontWeight: 500,
        cursor: "pointer",
        letterSpacing: "0.04em",
      }}
    >
      {label}
    </button>
  );
}

export default function ConstellationTestPage() {
  const [mode, setMode] = useState<Mode>("canvas");

  return (
    <div style={{ minHeight: "100vh", background: "#080C14", padding: "48px 40px" }}>
      {/* Header */}
      <div style={{ marginBottom: 40, maxWidth: 760 }}>
        <p style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "#38BDF8", marginBottom: 10 }}>
          constellation-test
        </p>
        <h1 style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: "2rem", fontWeight: 600, color: "#F1F5F9", marginBottom: 12 }}>
          All states &amp; variants
        </h1>
        <p style={{ fontFamily: "IBM Plex Sans, sans-serif", fontSize: "0.9375rem", color: "#94A3B8", marginBottom: 24 }}>
          Canvas — for full-page ambient backgrounds (star drift is live).<br />
          SVG — for small per-tab panels on the Features page (crisp at any size).
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <ModeButton active={mode === "canvas"} onClick={() => setMode("canvas")} label="canvas" />
          <ModeButton active={mode === "svg"}    onClick={() => setMode("svg")}    label="svg" />
        </div>
      </div>

      {/* Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 24 }}>
        {VARIANTS.map((v) => (
          <div
            key={v.label}
            style={{
              background: "#0F172A",
              border: "1px solid #1E293B",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {/* Canvas / SVG area */}
            <div style={{ height: v.height, position: "relative", background: "#080C14" }}>
              <Constellation
                mode={mode}
                points={v.points as unknown as import("@/app/components/constellation/types").StarPoint[]}
                edges={v.edges as unknown as import("@/app/components/constellation/types").Edge[]}
                state={v.state}
                variant={v.variant}
                accentColor={v.accentColor}
                overlayPoints={"overlayPoints" in v ? v.overlayPoints as unknown as import("@/app/components/constellation/types").StarPoint[] : undefined}
                overlayEdges={"overlayEdges" in v ? v.overlayEdges as unknown as import("@/app/components/constellation/types").Edge[] : undefined}
                style={{ position: "absolute", inset: 0 }}
              />
            </div>

            {/* Label */}
            <div style={{ padding: "16px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: v.accentColor, flexShrink: 0 }} />
                <p style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: "0.9375rem", fontWeight: 600, color: "#F1F5F9" }}>
                  {v.label}
                </p>
              </div>
              <p style={{ fontFamily: "IBM Plex Sans, sans-serif", fontSize: "0.8125rem", color: "#64748B", lineHeight: 1.6 }}>
                {v.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Notes */}
      <div style={{ marginTop: 48, padding: "20px 24px", background: "#0F172A", border: "1px solid #1E293B", borderRadius: 8, maxWidth: 600 }}>
        <p style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "#38BDF8", marginBottom: 8 }}>
          Implementation notes
        </p>
        <ul style={{ fontFamily: "IBM Plex Sans, sans-serif", fontSize: "0.8125rem", color: "#64748B", lineHeight: 1.8, paddingLeft: 20 }}>
          <li>Animation pauses automatically when off-screen (IntersectionObserver on canvas, RAF guard on SVG).</li>
          <li>prefers-reduced-motion: disables twinkle, star drift, and traveling-point motion.</li>
          <li>Canvas: DPR-aware, resizes with container each frame.</li>
          <li>SVG: unique filter IDs per instance via useId() — safe to render multiples.</li>
          <li>Traveling point uses Framer Motion&apos;s useAnimationFrame for smooth interpolation.</li>
        </ul>
      </div>
    </div>
  );
}
