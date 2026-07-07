import Link from "next/link";
import type { SpanKind, ReplayType, SpanStatus } from "@/lib/replay/types";
import { KIND_META, REPLAY_TYPE_META } from "@/lib/replay/format";

// ── Page header ──────────────────────────────────────────────────────
export function PageHeader({
  title,
  subtitle,
  right,
  breadcrumb,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  breadcrumb?: { label: string; href: string }[];
}) {
  return (
    <div className="sticky top-0 z-10 border-b border-white/[0.06] bg-deep-space/80 px-8 py-5 backdrop-blur-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          {breadcrumb && (
            <nav className="mb-1.5 flex items-center gap-1.5 font-[family-name:var(--font-mono)] text-[11px] text-dim-starlight/60">
              {breadcrumb.map((b, i) => (
                <span key={b.href} className="flex items-center gap-1.5">
                  <Link href={b.href} className="transition-colors hover:text-signal">
                    {b.label}
                  </Link>
                  {i < breadcrumb.length - 1 && <span className="text-dim-starlight/30">/</span>}
                </span>
              ))}
            </nav>
          )}
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-starlight">
            {title}
          </h1>
          {subtitle && <p className="mt-1 text-sm text-dim-starlight">{subtitle}</p>}
        </div>
        {right && <div className="flex-shrink-0">{right}</div>}
      </div>
    </div>
  );
}

// ── Card ─────────────────────────────────────────────────────────────
export function Card({
  children,
  className = "",
  title,
  hint,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  hint?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-white/[0.06] bg-surface/40 p-5 ${className}`}
    >
      {title && (
        <div className="mb-4 flex items-baseline justify-between">
          <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold text-starlight">
            {title}
          </h3>
          {hint && <span className="text-[11px] text-dim-starlight/60">{hint}</span>}
        </div>
      )}
      {children}
    </div>
  );
}

// ── Kind badge ───────────────────────────────────────────────────────
export function KindBadge({ kind }: { kind: SpanKind }) {
  const m = KIND_META[kind];
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-wide"
      style={{ color: m.color, backgroundColor: `${m.color}1A` }}
    >
      {m.label}
    </span>
  );
}

// ── Replay-type badge ────────────────────────────────────────────────
export function ReplayBadge({ type }: { type: ReplayType }) {
  const m = REPLAY_TYPE_META[type];
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-wide"
      style={{ color: m.color, backgroundColor: `${m.color}1A` }}
    >
      {m.label}
    </span>
  );
}

// ── Status pill ──────────────────────────────────────────────────────
export function StatusPill({ status }: { status: SpanStatus | "OK" | "ERROR" }) {
  const err = status === "ERROR";
  const color = err ? "#F43F5E" : "#34D399";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ color, backgroundColor: `${color}14` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {err ? "Error" : "OK"}
    </span>
  );
}

// ── Mono chip (ids, values) ──────────────────────────────────────────
export function Mono({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`font-[family-name:var(--font-mono)] text-dim-starlight ${className}`}>
      {children}
    </span>
  );
}

// ── Empty state ──────────────────────────────────────────────────────
export function EmptyState({ icon, text }: { icon?: string; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <div className="text-3xl text-dim-starlight/30">{icon ?? "◈"}</div>
      <p className="text-sm text-dim-starlight/60">{text}</p>
    </div>
  );
}
