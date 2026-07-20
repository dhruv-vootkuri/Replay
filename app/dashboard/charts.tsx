"use client";

import { useState } from "react";

const INK = "#6B7480";
const INK_MUTED = "#48505C";
const GRID = "rgba(11,14,20,0.08)";
const SURFACE = "#EEF2F6";

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const norm = v / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * mag;
}

// ── Tooltip shell (leftPct 0..100 for responsive width; topPx fixed) ─
function Tip({ leftPct, topPx, children }: { leftPct: number; topPx: number; children: React.ReactNode }) {
  return (
    <div
      className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-xs shadow-xl"
      style={{ left: `${leftPct}%`, top: topPx - 8, whiteSpace: "nowrap" }}
    >
      {children}
    </div>
  );
}

// ── Time-series: line + area, two series (traces, errors) ────────────
export function TimeSeriesChart({
  data,
  height = 200,
}: {
  data: { label: string; count: number; errors: number }[];
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = height;
  const padL = 34;
  const padR = 16;
  const padT = 16;
  const padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const max = niceMax(Math.max(1, ...data.map((d) => d.count)));
  const n = data.length;
  const x = (i: number) => padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => padT + plotH - (v / max) * plotH;

  const line = data.map((d, i) => `${x(i)},${y(d.count)}`).join(" ");
  const area = `${padL},${padT + plotH} ${line} ${x(n - 1)},${padT + plotH}`;
  const ticks = [0, max / 2, max];

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }}>
        <defs>
          <linearGradient id="ts-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
            <text x={padL - 8} y={y(t) + 3} textAnchor="end" fontSize={10} fill={INK_MUTED}>
              {Math.round(t)}
            </text>
          </g>
        ))}
        <polygon points={area} fill="url(#ts-fill)" />
        <polyline points={line} fill="none" stroke="#38BDF8" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => (
          <g key={i}>
            {d.errors > 0 && <circle cx={x(i)} cy={y(d.count)} r={4.5} fill="#F43F5E" stroke={SURFACE} strokeWidth={2} />}
            <circle cx={x(i)} cy={y(d.count)} r={hover === i ? 5 : 3} fill="#38BDF8" stroke={SURFACE} strokeWidth={2} />
            <text x={x(i)} y={H - 9} textAnchor="middle" fontSize={10} fill={INK_MUTED}>
              {d.label}
            </text>
            <rect
              x={x(i) - plotW / n / 2}
              y={padT}
              width={plotW / n}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          </g>
        ))}
      </svg>
      {hover !== null && (
        <Tip leftPct={(x(hover) / W) * 100} topPx={(y(data[hover].count) / H) * height}>
          <span className="font-[family-name:var(--font-mono)] text-starlight">{data[hover].count} traces</span>
          {data[hover].errors > 0 && <span className="ml-2 text-divergence">{data[hover].errors} err</span>}
          <span className="ml-2 text-dim-starlight/60">{data[hover].label}</span>
        </Tip>
      )}
    </div>
  );
}

// ── Horizontal bar chart with labels + values ────────────────────────
export function HBarChart({
  data,
  unit = "",
  color = "#38BDF8",
  colorByStatus = false,
}: {
  data: { label: string; value: number; status?: string; sublabel?: string }[];
  unit?: string;
  color?: string;
  colorByStatus?: boolean;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex flex-col gap-2.5">
      {data.map((d, i) => {
        const pct = (d.value / max) * 100;
        const c = colorByStatus && d.status === "ERROR" ? "#F43F5E" : color;
        return (
          <div key={i} className="group flex items-center gap-3">
            <div className="w-28 flex-shrink-0 truncate text-right font-[family-name:var(--font-mono)] text-[11px] text-dim-starlight">
              {d.label}
            </div>
            <div className="relative h-5 flex-1 overflow-hidden rounded bg-black/[0.05]">
              <div
                className="absolute inset-y-0 left-0 rounded transition-all"
                style={{ width: `${Math.max(pct, 1.5)}%`, backgroundColor: c }}
              />
            </div>
            <div className="w-20 flex-shrink-0 font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-starlight">
              {d.value.toLocaleString()}
              {unit}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Donut chart with legend ──────────────────────────────────────────
export function DonutChart({
  data,
  centerLabel,
  centerValue,
}: {
  data: { label: string; value: number; color: string }[];
  centerLabel?: string;
  centerValue?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const total = data.reduce((a, d) => a + d.value, 0) || 1;
  const R = 54;
  const C = 2 * Math.PI * R;
  const strokeW = 18;
  let offset = 0;
  const size = 140;

  return (
    <div className="flex items-center gap-6">
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="flex-shrink-0 -rotate-90">
        {data.map((d, i) => {
          const frac = d.value / total;
          const len = frac * C;
          const gap = 2; // 2px surface gap between segments
          const dash = `${Math.max(len - gap, 0)} ${C - Math.max(len - gap, 0)}`;
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={R}
              fill="none"
              stroke={d.color}
              strokeWidth={hover === i ? strokeW + 3 : strokeW}
              strokeDasharray={dash}
              strokeDashoffset={-offset}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{ transition: "stroke-width 0.15s" }}
            />
          );
          offset += len;
          return el;
        })}
        <text x={size / 2} y={size / 2 - 4} textAnchor="middle" className="rotate-90" fontSize={22} fontWeight={700} fill="#0B0E14" transform={`rotate(90 ${size / 2} ${size / 2})`}>
          {centerValue}
        </text>
        <text x={size / 2} y={size / 2 + 14} textAnchor="middle" fontSize={9} fill={INK} transform={`rotate(90 ${size / 2} ${size / 2})`}>
          {centerLabel}
        </text>
      </svg>
      <div className="flex flex-col gap-1.5">
        {data.map((d, i) => (
          <div
            key={i}
            className={`flex items-center gap-2 text-xs transition-opacity ${hover !== null && hover !== i ? "opacity-40" : ""}`}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="h-2.5 w-2.5 flex-shrink-0 rounded-sm" style={{ backgroundColor: d.color }} />
            <span className="text-dim-starlight">{d.label}</span>
            <span className="ml-auto font-[family-name:var(--font-mono)] tabular-nums text-starlight">{d.value}</span>
            <span className="w-9 text-right font-[family-name:var(--font-mono)] text-[10px] text-dim-starlight/50">
              {Math.round((d.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Sparkline for KPI tiles ──────────────────────────────────────────
export function Sparkline({ points, color = "#38BDF8", width = 96, height = 30 }: { points: number[]; color?: string; width?: number; height?: number }) {
  if (points.length < 2) return null;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const step = width / (points.length - 1);
  const pts = points.map((p, i) => `${i * step},${height - ((p - min) / range) * (height - 4) - 2}`).join(" ");
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
    </svg>
  );
}
