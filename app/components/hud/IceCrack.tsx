"use client";

import { useEffect, useRef } from "react";

const TAU = Math.PI * 2;

export type IceCrackVariant = "default" | "flagged" | "overlay-diff" | "twin-ghost" | "traveling-point";

interface IceCrackProps {
  seed?: number;
  seedCount?: number;
  density?: number; // 0-1, scales segment count / branch chance
  variant?: IceCrackVariant;
  // Continuous mode: independent fracture groups grow, hold, fade, and
  // regrow elsewhere on staggered loops — used for always-alive backgrounds.
  loop?: boolean;
  // One-shot mode: growth is driven externally (0-1), matching the
  // resolveProgress contract every section's reveal timer already produces.
  resolveProgress?: number;
  paused?: boolean;
  className?: string;
}

type Segment = { x1: number; y1: number; x2: number; y2: number; seedIndex: number; main: boolean };
type Point = { x: number; y: number };

function seededRandom(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function buildField(seed: number, seedCount: number, density: number) {
  const rand = seededRandom(seed);
  const segments: Segment[] = [];
  const chains: Point[][] = [];
  const jitter = 0.9;
  const segLen = 0.11;
  const segMin = 3;
  const segMax = 5 + Math.round(density * 3);
  const branchChance = 0.25 + density * 0.35;

  for (let i = 0; i < seedCount; i++) {
    let x = 0.08 + rand() * 0.84;
    let y = 0.08 + rand() * 0.84;
    let angle = rand() * TAU;
    const chain: Point[] = [{ x, y }];
    const segCount = segMin + Math.floor(rand() * (segMax - segMin));
    for (let s = 0; s < segCount; s++) {
      angle += (rand() - 0.5) * jitter;
      const len = segLen * (0.7 + rand() * 0.6);
      const nx = x + Math.cos(angle) * len;
      const ny = y + Math.sin(angle) * len;
      segments.push({ x1: x, y1: y, x2: nx, y2: ny, seedIndex: i, main: true });
      chain.push({ x: nx, y: ny });

      if (rand() < branchChance) {
        let bx = nx;
        let by = ny;
        let ba = angle + (rand() < 0.5 ? 1 : -1) * (0.6 + rand() * 0.9);
        const bsegs = 1 + Math.floor(rand() * 2);
        for (let b = 0; b < bsegs; b++) {
          const blen = len * 0.55 * (0.7 + rand() * 0.6);
          const bnx = bx + Math.cos(ba) * blen;
          const bny = by + Math.sin(ba) * blen;
          segments.push({ x1: bx, y1: by, x2: bnx, y2: bny, seedIndex: i, main: false });
          bx = bnx;
          by = bny;
          ba += (rand() - 0.5) * jitter;
        }
      }
      x = nx;
      y = ny;
    }
    chains.push(chain);
  }

  return { segments, chains };
}

function drawSegments(
  ctx: CanvasRenderingContext2D,
  segs: Segment[],
  W: number,
  H: number,
  opacity: number,
  lineWidth: number,
  dash: number[],
) {
  ctx.setLineDash(dash);
  ctx.strokeStyle = "#0A0A0A";
  ctx.lineWidth = lineWidth;
  for (const s of segs) {
    ctx.globalAlpha = (s.main ? opacity : opacity * 0.7);
    ctx.beginPath();
    ctx.moveTo(s.x1 * W, s.y1 * H);
    ctx.lineTo(s.x2 * W, s.y2 * H);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}

export default function IceCrack({
  seed = 7,
  seedCount = 6,
  density = 0.4,
  variant = "default",
  loop = false,
  resolveProgress,
  paused,
  className,
}: IceCrackProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const pausedRef = useRef(false);
  const reducedRef = useRef(false);
  const t0Ref = useRef(0);
  const rpRef = useRef<number | undefined>(resolveProgress);
  const staticDrawnRef = useRef(false);

  const fieldRef = useRef<ReturnType<typeof buildField> | null>(null);
  const overlayFieldRef = useRef<ReturnType<typeof buildField> | null>(null);
  const flagSeedRef = useRef(0);

  useEffect(() => {
    pausedRef.current = paused ?? false;
  }, [paused]);

  useEffect(() => {
    rpRef.current = resolveProgress;
  }, [resolveProgress]);

  useEffect(() => {
    fieldRef.current = buildField(seed, seedCount, density);
    overlayFieldRef.current = buildField(seed + 5000, Math.max(3, Math.round(seedCount * 0.7)), density);
    flagSeedRef.current = Math.floor(seededRandom(seed + 999)() * seedCount);
    reducedRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    staticDrawnRef.current = false;
  }, [seed, seedCount, density]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = (ctx: CanvasRenderingContext2D, W: number, H: number, time: number) => {
      const field = fieldRef.current;
      if (!field) return;
      const rm = reducedRef.current;
      ctx.clearRect(0, 0, W, H);

      const perSeed: Segment[][] = Array.from({ length: seedCount }, () => []);
      for (const s of field.segments) perSeed[s.seedIndex]?.push(s);

      const revealedFor = (segs: Segment[], frac: number) => segs.slice(0, Math.ceil(segs.length * frac));

      if (loop && !rm) {
        const cycleMs = 5200;
        const growEnd = 0.5;
        const fadeStart = 0.82;
        for (let i = 0; i < seedCount; i++) {
          const phaseOffset = (i / seedCount) * cycleMs;
          const local = ((time + phaseOffset) % cycleMs) / cycleMs;
          const growFrac = local < growEnd ? local / growEnd : 1;
          const alpha =
            local < growEnd ? 0.8 : local < fadeStart ? 0.8 : Math.max(0, 0.8 * (1 - (local - fadeStart) / (1 - fadeStart)));
          if (alpha <= 0.01) continue;
          drawSegments(ctx, revealedFor(perSeed[i], growFrac), W, H, alpha, 1.1, []);
        }
      } else {
        const rp = rm ? 1 : Math.max(0, Math.min(1, rpRef.current ?? 1));
        for (let i = 0; i < seedCount; i++) {
          drawSegments(ctx, revealedFor(perSeed[i], rp), W, H, 0.85, 1.2, []);
        }

        if (variant === "flagged" && rp > 0.4) {
          const flagIdx = flagSeedRef.current;
          drawSegments(ctx, revealedFor(perSeed[flagIdx] ?? [], rp), W, H, 1, 2.6, []);
        }

        if (variant === "overlay-diff" && overlayFieldRef.current && rp > 0.2) {
          const overlaySegs = overlayFieldRef.current.segments;
          const overCount = Math.ceil(overlaySegs.length * Math.min(1, rp * 1.15));
          drawSegments(ctx, overlaySegs.slice(0, overCount), W, H, 0.6, 1, [4, 4]);
        }

        if (variant === "twin-ghost" && rp > 0.15) {
          const off = 0.045;
          ctx.save();
          ctx.translate(off * W, off * H);
          const ghostAlpha = 0.28 * Math.min(1, rp * 1.3);
          for (let i = 0; i < seedCount; i++) {
            drawSegments(ctx, revealedFor(perSeed[i], rp), W, H, ghostAlpha, 1, []);
          }
          ctx.restore();

          const cx = 0.5 * W + (off * W) / 2;
          const cy = 0.5 * H + (off * H) / 2;
          const rad = Math.min(W, H) * 0.42;
          ctx.strokeStyle = "#0A0A0A";
          ctx.globalAlpha = 0.3 * Math.min(1, rp * 1.3);
          ctx.lineWidth = 1;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.arc(cx, cy, rad, 0, TAU);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
        }

        if (variant === "traveling-point" && !rm && rp >= 0.98 && field.chains.length > 0) {
          const chain = field.chains[0];
          const period = 3600;
          const segCountC = chain.length - 1;
          if (segCountC > 0) {
            const t = (time % period) / period;
            const scaled = t * segCountC;
            const idx = Math.min(segCountC - 1, Math.floor(scaled));
            const frac = scaled - idx;
            const a = chain[idx];
            const b = chain[idx + 1];
            const px = (a.x + (b.x - a.x) * frac) * W;
            const py = (a.y + (b.y - a.y) * frac) * H;
            ctx.fillStyle = "#0A0A0A";
            ctx.globalAlpha = 1;
            ctx.beginPath();
            ctx.arc(px, py, 3, 0, TAU);
            ctx.fill();
          }
        }
      }
    };

    const tick = (ts: number) => {
      rafRef.current = requestAnimationFrame(tick);
      if (pausedRef.current) return;
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
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      const isStatic =
        reducedRef.current || (!loop && (rpRef.current ?? 1) >= 1 && variant !== "traveling-point");
      if (isStatic && staticDrawnRef.current) return;

      draw(ctx, W, H, time);
      if (isStatic) staticDrawnRef.current = true;
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [loop, variant, seedCount]);

  return <canvas ref={canvasRef} className={className} style={{ display: "block", width: "100%", height: "100%" }} />;
}
