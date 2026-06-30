"use client";

import { useId, useEffect, useRef, useState } from "react";
import { motion, useAnimationFrame } from "framer-motion";
import type { ConstellationProps, StarPoint, Edge } from "./types";

// Deterministic pseudo-random
function sr(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

const S = (v: number) => v * 100; // 0-1 → 0-100 SVG units

function buildEdgeWaypoints(points: StarPoint[], edges: Edge[]): { x: number; y: number }[] {
  if (edges.length === 0) return [];
  const pm = new Map(points.map(p => [p.id, p]));
  const waypoints: { x: number; y: number }[] = [];
  for (let i = 0; i < edges.length; i++) {
    const f = pm.get(edges[i].from);
    const t = pm.get(edges[i].to);
    if (!f || !t) continue;
    if (i === 0) waypoints.push({ x: S(f.x), y: S(f.y) });
    waypoints.push({ x: S(t.x), y: S(t.y) });
  }
  return waypoints;
}

interface TravelingDotProps {
  points: StarPoint[];
  edges: Edge[];
  glowId: string;
  reduced: boolean;
  paused: boolean;
}

interface TravelingDotPropsWithColor extends TravelingDotProps { accentColor: string; }

function TravelingDot({ points, edges, glowId, reduced, paused, accentColor }: TravelingDotPropsWithColor) {
  const waypoints = buildEdgeWaypoints(points, edges);
  const [pos, setPos] = useState(waypoints[0] ?? { x: 50, y: 50 });
  const t0 = useRef(0);
  const PERIOD = 10000; // ms

  useAnimationFrame((ts) => {
    if (reduced || paused || waypoints.length < 2) return;
    if (t0.current === 0) t0.current = ts;
    const elapsed = (ts - t0.current) % PERIOD;
    const progress = elapsed / PERIOD;
    const totalSegments = waypoints.length - 1;
    const rawIdx = progress * totalSegments;
    const idx = Math.min(Math.floor(rawIdx), totalSegments - 1);
    const frac = rawIdx - idx;
    const from = waypoints[idx];
    const to = waypoints[idx + 1];
    if (from && to) {
      setPos({ x: from.x + (to.x - from.x) * frac, y: from.y + (to.y - from.y) * frac });
    }
  });

  if (reduced || waypoints.length < 2) return null;

  return (
    <circle
      cx={pos.x}
      cy={pos.y}
      r={2.5}
      fill={accentColor}
      filter={`url(#${glowId}-strong)`}
    />
  );
}

export default function ConstellationSVG({
  points, edges, state = "resolved", variant = "default",
  accentColor = "#F59E0B", overlayPoints, overlayEdges,
  paused,
  className, style,
}: ConstellationProps) {
  const uid = useId().replace(/:/g, "-");
  const glowId = `csg${uid}`;
  const reducedRef = useRef(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => {
      reducedRef.current = e.matches;
      setReduced(e.matches);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const pm = new Map(points.map(p => [p.id, p]));

  // Ghost offset for twin-ghost
  const GHOST_OFFSET = 7; // SVG units

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
      className={className}
      style={{ width: "100%", height: "100%", ...style }}
      aria-hidden="true"
    >
      <defs>
        <filter id={`${glowId}-soft`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="1.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={`${glowId}-strong`} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={`${glowId}-accent`} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="1.8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Ghost layer (Sandboxes) */}
      {variant === "twin-ghost" && (
        <g opacity={0.22} transform={`translate(${GHOST_OFFSET}, ${GHOST_OFFSET})`}>
          {edges.map((e, i) => {
            const f = pm.get(e.from);
            const t = pm.get(e.to);
            if (!f || !t) return null;
            return (
              <line
                key={`ghost-edge-${i}`}
                x1={S(f.x)} y1={S(f.y)}
                x2={S(t.x)} y2={S(t.y)}
                stroke={accentColor}
                strokeWidth={0.6}
                strokeDasharray="2.5 3"
              />
            );
          })}
          {points.map(p => (
            <circle
              key={`ghost-star-${p.id}`}
              cx={S(p.x)} cy={S(p.y)}
              r={(p.r ?? 2) * 0.6}
              fill={accentColor}
            />
          ))}
          {/* Boundary circle */}
          {(() => {
            const cx = points.reduce((s, p) => s + S(p.x), 0) / points.length;
            const cy = points.reduce((s, p) => s + S(p.y), 0) / points.length;
            const rad = Math.max(...points.map(p => Math.hypot(S(p.x) - cx, S(p.y) - cy))) + 8;
            return (
              <circle
                cx={cx + GHOST_OFFSET} cy={cy + GHOST_OFFSET}
                r={rad}
                fill="none"
                stroke={accentColor}
                strokeWidth={0.8}
                strokeDasharray="3 4"
                opacity={0.6}
              />
            );
          })()}
        </g>
      )}

      {/* Live boundary circle (Sandboxes) */}
      {variant === "twin-ghost" && (() => {
        const cx = points.reduce((s, p) => s + S(p.x), 0) / points.length;
        const cy = points.reduce((s, p) => s + S(p.y), 0) / points.length;
        const rad = Math.max(...points.map(p => Math.hypot(S(p.x) - cx, S(p.y) - cy))) + 8;
        return (
          <circle
            cx={cx} cy={cy} r={rad}
            fill="none"
            stroke={accentColor}
            strokeWidth={0.8}
            strokeDasharray="3 4"
            opacity={0.35}
          />
        );
      })()}

      {/* Primary edges */}
      {edges.map((e, i) => {
        const f = pm.get(e.from);
        const t = pm.get(e.to);
        if (!f || !t) return null;
        const hl = !!e.highlighted && (variant === "flagged" || variant === "overlay-diff");
        return (
          <line
            key={`edge-${i}`}
            x1={S(f.x)} y1={S(f.y)}
            x2={S(t.x)} y2={S(t.y)}
            stroke={hl ? accentColor : "#38BDF8"}
            strokeWidth={hl ? 1.2 : 0.6}
            strokeOpacity={hl ? 0.85 : state === "unresolved" ? 0.12 : 0.22}
          />
        );
      })}

      {/* Overlay edges (Pressure Tests) */}
      {variant === "overlay-diff" && overlayEdges && overlayPoints && (() => {
        const opm = new Map([
          ...pm.entries(),
          ...overlayPoints.map(p => [p.id, p] as [string, StarPoint]),
        ]);
        return overlayEdges.map((e, i) => {
          const f = opm.get(e.from);
          const t = opm.get(e.to);
          if (!f || !t) return null;
          return (
            <line
              key={`ov-edge-${i}`}
              x1={S(f.x)} y1={S(f.y)}
              x2={S(t.x)} y2={S(t.y)}
              stroke={e.highlighted ? accentColor : "#38BDF8"}
              strokeWidth={e.highlighted ? 1.2 : 0.5}
              strokeOpacity={e.highlighted ? 0.85 : 0.15}
              strokeDasharray={e.highlighted ? undefined : "2 3"}
            />
          );
        });
      })()}

      {/* Stars */}
      {points.map((p, i) => {
        const hl = !!p.highlighted && (variant === "flagged" || variant === "overlay-diff");
        const color = hl ? accentColor : "#38BDF8";
        const r = p.r ?? 2;
        const twinkleDur = 1.8 + sr(i * 3) * 2.2;
        const twinkleDelay = sr(i * 3 + 1) * 3;
        const minOpacity = 0.35;

        return (
          <g key={`star-${p.id}`} filter={`url(#${hl ? `${glowId}-accent` : `${glowId}-soft`})`}>
            <motion.circle
              cx={S(p.x)}
              cy={S(p.y)}
              r={r}
              fill={color}
              {...(p.twinkle && !reduced
                ? {
                    animate: { opacity: [1, minOpacity, 1] },
                    transition: {
                      duration: twinkleDur,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: twinkleDelay,
                      repeatType: "loop" as const,
                    },
                  }
                : {})}
            />
            {/* Bright core */}
            <circle
              cx={S(p.x)}
              cy={S(p.y)}
              r={r * 0.3}
              fill="white"
              opacity={0.85}
            />
          </g>
        );
      })}

      {/* Overlay stars (Pressure Tests) */}
      {variant === "overlay-diff" && overlayPoints?.map((p, i) => (
        <circle
          key={`ov-star-${p.id}-${i}`}
          cx={S(p.x)}
          cy={S(p.y)}
          r={(p.r ?? 2) * 0.75}
          fill={p.highlighted ? accentColor : "#38BDF8"}
          opacity={0.5}
        />
      ))}

      {/* Traveling point (Agent) */}
      {variant === "traveling-point" && (
        <TravelingDot points={points} edges={edges} glowId={glowId} reduced={reduced} paused={paused ?? false} accentColor={accentColor} />
      )}
    </svg>
  );
}
