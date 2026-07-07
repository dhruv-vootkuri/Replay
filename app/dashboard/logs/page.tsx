"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader, Card, Mono } from "../ui";
import { logs } from "@/lib/replay/data";
import { LOG_LEVEL_META, fmtClock, fmtRelativeTime, shortId } from "@/lib/replay/format";
import type { LogLevel } from "@/lib/replay/types";

const LEVELS: LogLevel[] = ["debug", "info", "success", "warn", "error"];
const SOURCES = Array.from(new Set(logs.map((l) => l.source)));

export default function LogsPage() {
  const [q, setQ] = useState("");
  const [level, setLevel] = useState<"all" | LogLevel>("all");
  const [source, setSource] = useState<"all" | string>("all");
  const [wrap, setWrap] = useState(false);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const l of logs) c[l.level] = (c[l.level] ?? 0) + 1;
    return c;
  }, []);

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (level !== "all" && l.level !== level) return false;
      if (source !== "all" && l.source !== source) return false;
      if (q) {
        const hay = `${l.message} ${l.source} ${l.trace_id ?? ""}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [q, level, source]);

  return (
    <div>
      <PageHeader
        title="Logs"
        subtitle="Live activity from the tracer, engine, loader, and tools."
        right={
          <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] px-3 py-2 text-xs text-dim-starlight">
            <span className="dash-live-dot h-2 w-2 rounded-full bg-pulse" />
            streaming
          </div>
        }
      />

      <div className="space-y-4 px-8 py-6">
        {/* Level summary + filters */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setLevel("all")}
            className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
              level === "all" ? "border-signal/50 bg-signal/10 text-signal" : "border-white/[0.08] text-dim-starlight hover:text-starlight"
            }`}
          >
            all <span className="ml-1 tabular-nums opacity-60">{logs.length}</span>
          </button>
          {LEVELS.map((lv) => {
            const m = LOG_LEVEL_META[lv];
            const active = level === lv;
            return (
              <button
                key={lv}
                onClick={() => setLevel(active ? "all" : lv)}
                className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors"
                style={{
                  borderColor: active ? `${m.color}80` : "rgba(255,255,255,0.08)",
                  backgroundColor: active ? `${m.color}14` : "transparent",
                  color: active ? m.color : "#94A3B8",
                }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: m.color }} />
                {m.label} <span className="tabular-nums opacity-60">{counts[lv] ?? 0}</span>
              </button>
            );
          })}
          <div className="ml-auto flex items-center gap-2">
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="rounded-lg border border-white/[0.08] bg-surface/40 px-2.5 py-1.5 text-xs text-starlight focus:border-signal/50 focus:outline-none"
            >
              <option value="all" className="bg-surface">all sources</option>
              {SOURCES.map((s) => (
                <option key={s} value={s} className="bg-surface">
                  {s}
                </option>
              ))}
            </select>
            <button
              onClick={() => setWrap((w) => !w)}
              className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                wrap ? "border-signal/50 text-signal" : "border-white/[0.08] text-dim-starlight hover:text-starlight"
              }`}
            >
              wrap
            </button>
          </div>
        </div>

        <div className="relative">
          <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-dim-starlight/50" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4-4" />
          </svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter log lines…"
            className="w-full rounded-lg border border-white/[0.08] bg-surface/40 py-2 pl-9 pr-3 text-sm text-starlight placeholder:text-dim-starlight/40 focus:border-signal/50 focus:outline-none"
          />
        </div>

        {/* Terminal */}
        <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#070B12]">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2">
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#F43F5E]/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#F59E0B]/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#34D399]/60" />
            </div>
            <span className="font-[family-name:var(--font-mono)] text-[11px] text-dim-starlight/50">
              {filtered.length} lines
            </span>
          </div>
          <div className="dash-scroll max-h-[62vh] overflow-y-auto px-2 py-2 font-[family-name:var(--font-mono)] text-[12px] leading-relaxed">
            {filtered.length === 0 ? (
              <div className="px-3 py-8 text-center text-dim-starlight/40">No matching log lines.</div>
            ) : (
              filtered.map((l) => {
                const m = LOG_LEVEL_META[l.level];
                return (
                  <div
                    key={l.id}
                    className={`flex gap-3 rounded px-3 py-1 hover:bg-white/[0.03] ${wrap ? "" : "items-center"}`}
                  >
                    <span className="flex-shrink-0 text-dim-starlight/40" title={fmtRelativeTime(l.ts)}>
                      {fmtClock(l.ts)}
                    </span>
                    <span className="w-14 flex-shrink-0 font-bold" style={{ color: m.color }}>
                      {m.label}
                    </span>
                    <span className="w-16 flex-shrink-0 text-boundary/80">{l.source}</span>
                    <span className={`text-dim-starlight/90 ${wrap ? "break-words" : "truncate"}`}>{l.message}</span>
                    {l.trace_id && (
                      <Link
                        href={`/dashboard/traces/${l.trace_id}`}
                        className="ml-auto flex-shrink-0 text-signal/70 hover:text-signal"
                      >
                        {shortId(l.trace_id, 10)}
                      </Link>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
