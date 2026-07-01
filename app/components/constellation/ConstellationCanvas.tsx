"use client";

import { useEffect, useRef, useCallback } from "react";
import type { ConstellationProps, StarPoint, Edge } from "./types";

const TAU = Math.PI * 2;

function sr(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

// Stellar color classes: blue-white (hot), white, warm yellow, orange-red (cool).
// Distribution roughly mirrors visible-sky star populations.
const STAR_COLORS = ["#C8DBFF", "#EEF2F8", "#FFF0CA", "#FFBF80"] as const;
// Cool giants (yellow/orange classes) render larger so spectral color reads
// at these pixel sizes — opacity alone is too subtle to distinguish hues.
const SPECTRAL_SIZE_MULT = [1.0, 1.0, 1.35, 1.6] as const;

type BgStar = {
  x: number; y: number; r: number; opacity: number;
  colorIdx: number;
  freq: number; phase: number; twinkle: boolean;
};

function makeBgStars(n: number, tier: "field" | "dust", seedBase = 0): BgStar[] {
  return Array.from({ length: n }, (_, i) => {
    const s = seedBase + i * 7;
    // Color: ~38% blue-white, ~37% white, ~16% warm-yellow, ~9% orange
    const cs = sr(s + 7);
    const colorIdx = cs < 0.38 ? 0 : cs < 0.75 ? 1 : cs < 0.91 ? 2 : 3;
    const sizeMult = SPECTRAL_SIZE_MULT[colorIdx];

    let r: number, opacity: number, twinkle: boolean;
    if (tier === "dust") {
      // Sub-pixel, individually near-invisible — collectively forms the
      // faint grey undertone of unresolved background stars.
      const sizeSeed = sr(s + 2);
      r = (0.08 + sizeSeed * 0.07) * sizeMult;
      opacity = 0.02 + sr(s + 6) * 0.04;
      twinkle = false;
    } else {
      // Power-law size: cube the seed so most stars are tiny
      const sizeSeed = sr(s + 2);
      r = (0.18 + sizeSeed * sizeSeed * sizeSeed * 2.2) * sizeMult; // 0.18 – 3.8

      // Base opacity scales with brightness (larger = brighter) + individual dimming
      const brightness = 0.06 + (Math.min(r, 2.38) / 2.38) * 0.55;
      const dimSeed = sr(s + 6);
      opacity = brightness * (0.55 + dimSeed * 0.45);
      twinkle = r > 0.75 && sr(s + 5) > 0.55; // only medium/large stars twinkle
    }

    return {
      x: sr(s),
      y: sr(s + 1),
      r,
      opacity,
      colorIdx,
      freq: 0.3 + sr(s + 3) * 0.9,
      phase: sr(s + 4) * TAU,
      twinkle,
    };
  });
}

// Radial-gradient point source: peaks at centre, falls to transparent at the
// edge, so stars bleed into the dark instead of reading as flat filled discs.
function drawGlowStar(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, r: number, color: string, opacity: number,
) {
  const gradR = Math.max(r * 3, 0.75);
  const grad = ctx.createRadialGradient(x, y, 0, x, y, gradR);
  grad.addColorStop(0, color);
  grad.addColorStop(1, `${color}00`);
  ctx.globalAlpha = opacity;
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, gradR, 0, TAU);
  ctx.fill();
}

// Three overlapping strokes (wide/faint -> narrow/bright) fake a luminous
// line instead of a flat hairline rule.
const GLOW_PASSES = [
  { lw: 4,   a: 0.04 },
  { lw: 1.5, a: 0.12 },
  { lw: 0.6, a: 0.28 },
] as const;

function strokeGlowLine(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  color: string, alphaMult: number, dash: number[] = [],
) {
  ctx.setLineDash(dash);
  ctx.strokeStyle = color;
  for (const p of GLOW_PASSES) {
    ctx.globalAlpha = p.a * alphaMult;
    ctx.lineWidth = p.lw;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

export default function ConstellationCanvas({
  points, edges, state = "resolved", variant = "default",
  accentColor = "#F59E0B", overlayPoints, overlayEdges,
  resolveProgress, paused,
  className, style,
}: ConstellationProps) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const rafRef     = useRef<number>(0);
  const t0Ref      = useRef<number>(0);
  const pausedRef  = useRef(false);
  const reducedRef = useRef(false);
  const bgRef      = useRef<BgStar[]>([]);
  const dustRef    = useRef<BgStar[]>([]);
  // Tracked via ref so `draw` stays stable across rapid resolveProgress updates
  const resolveRef = useRef<number | undefined>(undefined);

  // Initialise bg star density (mobile-aware) and listen for resize.
  // Replaces the old IntersectionObserver — with position:fixed the canvas is
  // always "intersecting" the viewport, so the observer never paused anything.
  useEffect(() => {
    const init = () => {
      // 550 field stars + 200 sub-pixel dust on desktop, 200/80 on mobile —
      // still well below performance concern
      const mobile = window.innerWidth < 768;
      bgRef.current = makeBgStars(mobile ? 200 : 550, "field", 0);
      dustRef.current = makeBgStars(mobile ? 80 : 200, "dust", 100000);
      reducedRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    };
    init();
    window.addEventListener("resize", init, { passive: true });
    return () => window.removeEventListener("resize", init);
  }, []);

  // Sync resolveProgress prop → ref without causing RAF restart
  useEffect(() => {
    resolveRef.current = resolveProgress;
  }, [resolveProgress]);

  // Sync paused prop → ref (page.tsx drives this based on scroll position)
  useEffect(() => {
    pausedRef.current = paused ?? false;
  }, [paused]);

  const draw = useCallback((ctx: CanvasRenderingContext2D, W: number, H: number, time: number) => {
    const rm  = reducedRef.current;
    const rp  = resolveRef.current;
    const dpr = window.devicePixelRatio || 1;

    // resolveProgress controls drift and edge visibility for the hero resolve sequence.
    // When undefined, behavior falls back to the `state` prop (normal unresolved/resolved).
    const isAnimating = rp !== undefined;
    const driftFraction = isAnimating
      ? Math.max(0, 1 - rp! / 0.78)
      : (state === "unresolved" ? 1 : 0);
    const edgeMult = isAnimating
      ? smoothstep(0.22, 0.72, rp!)
      : 1;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // — Ambient background stars (realistic density + spectral color)
    // Dust layer first: sub-pixel, individually invisible, forms the
    // continuous grey undertone real dark-sky fields have beneath point sources.
    for (const s of dustRef.current) {
      drawGlowStar(ctx, s.x * W, s.y * H, s.r, STAR_COLORS[s.colorIdx], s.opacity);
    }
    for (const s of bgRef.current) {
      const twinkleMod = s.twinkle && !rm
        ? 0.7 + 0.3 * ((Math.sin(time * 0.001 * s.freq + s.phase) + 1) / 2)
        : 1;
      drawGlowStar(ctx, s.x * W, s.y * H, s.r, STAR_COLORS[s.colorIdx], s.opacity * twinkleMod);
    }
    ctx.globalAlpha = 1;

    const pm = new Map(points.map(p => [p.id, p]));

    const getPos = (p: StarPoint, i: number): { x: number; y: number } => {
      const drift = rm ? 0 : driftFraction;
      if (drift > 0) {
        const dx = Math.sin(time * 0.0003 + i * 1.7) * 0.035 * W * drift;
        const dy = Math.cos(time * 0.00025 + i * 2.3) * 0.035 * H * drift;
        return { x: p.x * W + dx, y: p.y * H + dy };
      }
      return { x: p.x * W, y: p.y * H };
    };

    // — Edges
    const drawEdgeList = (
      edgeList: Edge[],
      pMap: Map<string, StarPoint>,
      idxOffset: number,
      baseColor: string,
      baseAlpha: number,
      hlColor: string,
      hlAlpha: number,
      dash: number[] = [],
    ) => {
      for (const e of edgeList) {
        const fi = points.findIndex(p => p.id === e.from);
        const ti = points.findIndex(p => p.id === e.to);
        const f = pMap.get(e.from);
        const t = pMap.get(e.to);
        if (!f || !t) continue;
        const fp = getPos(f, fi + idxOffset);
        const tp = getPos(t, ti + idxOffset);
        const hl = !!e.highlighted && (variant === "flagged" || variant === "overlay-diff");
        if (hl) {
          ctx.globalAlpha = hlAlpha * edgeMult;
          ctx.strokeStyle = hlColor;
          ctx.lineWidth = 1.5;
          ctx.setLineDash(dash);
          ctx.beginPath();
          ctx.moveTo(fp.x, fp.y);
          ctx.lineTo(tp.x, tp.y);
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          strokeGlowLine(ctx, fp.x, fp.y, tp.x, tp.y, baseColor, (baseAlpha / 0.22) * edgeMult, dash);
        }
      }
      ctx.globalAlpha = 1;
    };

    drawEdgeList(edges, pm, 0, "#38BDF8", 0.22, accentColor, 0.75);

    // Overlay edges (Pressure Tests)
    if (variant === "overlay-diff" && overlayEdges && overlayPoints) {
      const opm = new Map([
        ...pm.entries(),
        ...overlayPoints.map(p => [p.id, p] as [string, StarPoint]),
      ]);
      for (const e of overlayEdges) {
        const f = opm.get(e.from);
        const t = opm.get(e.to);
        if (!f || !t) continue;
        const fi = points.findIndex(p => p.id === e.from);
        const ti = points.findIndex(p => p.id === e.to);
        const fp = getPos(f, fi);
        const tp = getPos(t, ti);
        if (e.highlighted) {
          ctx.globalAlpha = 0.8 * edgeMult;
          ctx.strokeStyle = accentColor;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(fp.x, fp.y);
          ctx.lineTo(tp.x, tp.y);
          ctx.stroke();
        } else {
          strokeGlowLine(ctx, fp.x, fp.y, tp.x, tp.y, "#38BDF8", (0.18 / 0.22) * edgeMult, [3, 3]);
        }
      }
      ctx.globalAlpha = 1;
    }

    // — Constellation stars
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const pos = getPos(p, i);
      const hl = !!p.highlighted && (variant === "flagged" || variant === "overlay-diff");
      const freq = 0.5 + sr(i * 3) * 0.9;
      const phase = sr(i * 3 + 1) * TAU;
      const twA = p.twinkle && !rm
        ? 0.55 + 0.45 * ((Math.sin(time * 0.001 * freq + phase) + 1) / 2)
        : 1;
      const color = hl ? accentColor : "#38BDF8";
      const r = p.r ?? 2;

      ctx.globalAlpha = twA;
      ctx.shadowBlur = hl ? 16 : 9;
      ctx.shadowColor = color;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, TAU);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.fillStyle = "#FFFFFF";
      ctx.globalAlpha = twA * 0.85;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r * 0.32, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // — Twin/ghost (Sandboxes)
    if (variant === "twin-ghost") {
      const off = 0.07;
      for (const e of edges) {
        const f = pm.get(e.from);
        const t = pm.get(e.to);
        if (!f || !t) continue;
        strokeGlowLine(
          ctx,
          (f.x + off) * W, (f.y + off) * H,
          (t.x + off) * W, (t.y + off) * H,
          "#818CF8", 0.18 / 0.22, [4, 5],
        );
      }
      for (const p of points) {
        ctx.fillStyle = accentColor;
        ctx.globalAlpha = 0.22;
        ctx.beginPath();
        ctx.arc((p.x + off) * W, (p.y + off) * H, (p.r ?? 2) * 0.65, 0, TAU);
        ctx.fill();
      }
      const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
      const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
      const maxR = Math.max(...points.map(p => Math.hypot(p.x - cx, p.y - cy)));
      const rad = (maxR + 0.1) * Math.min(W, H);
      ctx.strokeStyle = accentColor;
      ctx.globalAlpha = 0.28;
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(cx * W, cy * H, rad, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    // — Traveling point (Agent)
    if (variant === "traveling-point" && !rm && edges.length > 0) {
      const period = 10000;
      const t = (time % period) / period;
      const idx = Math.floor(t * edges.length) % edges.length;
      const frac = (t * edges.length) - Math.floor(t * edges.length);
      const edge = edges[idx];
      const f = pm.get(edge.from);
      const tPt = pm.get(edge.to);
      if (f && tPt) {
        const fi = points.findIndex(p => p.id === edge.from);
        const ti = points.findIndex(p => p.id === edge.to);
        const fp = getPos(f, fi);
        const tp = getPos(tPt, ti);
        const px = fp.x + (tp.x - fp.x) * frac;
        const py = fp.y + (tp.y - fp.y) * frac;
        ctx.shadowBlur = 20;
        ctx.shadowColor = accentColor;
        ctx.fillStyle = accentColor;
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(px, py, 3.5, 0, TAU);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
  }, [points, edges, state, variant, accentColor, overlayPoints, overlayEdges]);
  // resolveProgress intentionally omitted — synced via resolveRef to avoid RAF restarts

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const loop = (ts: number) => {
      rafRef.current = requestAnimationFrame(loop);
      if (pausedRef.current) return;
      if (pausedRef.current) return; // skip draw when page is off-screen
      if (t0Ref.current === 0) t0Ref.current = ts;
      const time = ts - t0Ref.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
      }
      draw(ctx, W, H, time);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: "block", width: "100%", height: "100%", ...style }}
    />
  );
}
