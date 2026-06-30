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

type BgStar = {
  x: number; y: number; r: number; opacity: number;
  colorIdx: number;
  freq: number; phase: number; twinkle: boolean;
};

function makeBgStars(n: number): BgStar[] {
  return Array.from({ length: n }, (_, i) => {
    // Power-law size: cube the seed so most stars are tiny
    const sizeSeed = sr(i * 7 + 2);
    const r = 0.18 + sizeSeed * sizeSeed * sizeSeed * 2.2; // 0.18 – 2.38

    // Base opacity scales with brightness (larger = brighter) + individual dimming
    const brightness = 0.06 + (r / 2.38) * 0.55;
    const dimSeed = sr(i * 7 + 6);
    const opacity = brightness * (0.55 + dimSeed * 0.45);

    // Color: ~38% blue-white, ~37% white, ~16% warm-yellow, ~9% orange
    const cs = sr(i * 7 + 7);
    const colorIdx = cs < 0.38 ? 0 : cs < 0.75 ? 1 : cs < 0.91 ? 2 : 3;

    return {
      x: sr(i * 7),
      y: sr(i * 7 + 1),
      r,
      opacity,
      colorIdx,
      freq: 0.3 + sr(i * 7 + 3) * 0.9,
      phase: sr(i * 7 + 4) * TAU,
      twinkle: r > 0.75 && sr(i * 7 + 5) > 0.55, // only medium/large stars twinkle
    };
  });
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
  // Tracked via ref so `draw` stays stable across rapid resolveProgress updates
  const resolveRef = useRef<number | undefined>(undefined);

  // Initialise bg star density (mobile-aware) and listen for resize.
  // Replaces the old IntersectionObserver — with position:fixed the canvas is
  // always "intersecting" the viewport, so the observer never paused anything.
  useEffect(() => {
    const init = () => {
      // 280 stars on desktop, 110 on mobile — still well below performance concern
      bgRef.current = makeBgStars(window.innerWidth < 768 ? 110 : 280);
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
    for (const s of bgRef.current) {
      const twinkleMod = s.twinkle && !rm
        ? 0.7 + 0.3 * ((Math.sin(time * 0.001 * s.freq + s.phase) + 1) / 2)
        : 1;
      ctx.globalAlpha = s.opacity * twinkleMod;
      ctx.fillStyle = STAR_COLORS[s.colorIdx];
      ctx.beginPath();
      ctx.arc(s.x * W, s.y * H, s.r, 0, TAU);
      ctx.fill();
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
        ctx.globalAlpha = (hl ? hlAlpha : baseAlpha) * edgeMult;
        ctx.strokeStyle = hl ? hlColor : baseColor;
        ctx.lineWidth = hl ? 1.5 : 0.75;
        ctx.setLineDash(dash);
        ctx.beginPath();
        ctx.moveTo(fp.x, fp.y);
        ctx.lineTo(tp.x, tp.y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
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
        ctx.globalAlpha = (e.highlighted ? 0.8 : 0.18) * edgeMult;
        ctx.strokeStyle = e.highlighted ? accentColor : "#38BDF8";
        ctx.lineWidth = e.highlighted ? 1.5 : 0.75;
        ctx.setLineDash(e.highlighted ? [] : [3, 3]);
        ctx.beginPath();
        ctx.moveTo(fp.x, fp.y);
        ctx.lineTo(tp.x, tp.y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
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
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = "#818CF8";
      ctx.lineWidth = 0.75;
      ctx.setLineDash([4, 5]);
      for (const e of edges) {
        const f = pm.get(e.from);
        const t = pm.get(e.to);
        if (!f || !t) continue;
        ctx.beginPath();
        ctx.moveTo((f.x + off) * W, (f.y + off) * H);
        ctx.lineTo((t.x + off) * W, (t.y + off) * H);
        ctx.stroke();
      }
      ctx.setLineDash([]);
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
