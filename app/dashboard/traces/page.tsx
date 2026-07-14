"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader, Card, KindBadge, StatusPill, Mono, EmptyState } from "../ui";
import { traces } from "@/lib/replay/data";
import { fmtDuration, fmtNumber, fmtRelativeTime, shortId } from "@/lib/replay/format";

type SortKey = "recent" | "duration" | "spans" | "tokens";

const AGENTS = ["all", ...Array.from(new Set(traces.map((t) => t.agent ?? "agent")))];

export default function TracesPage() {
  const [q, setQ] = useState("");
  const [agent, setAgent] = useState("all");
  const [status, setStatus] = useState<"all" | "OK" | "ERROR">("all");
  const [sort, setSort] = useState<SortKey>("recent");

  const filtered = useMemo(() => {
    let list = traces.filter((t) => {
      if (agent !== "all" && (t.agent ?? "agent") !== agent) return false;
      if (status !== "all" && t.status !== status) return false;
      if (q) {
        const hay = `${t.trace_id} ${t.agent} ${t.query}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
    list = [...list].sort((a, b) => {
      switch (sort) {
        case "duration":
          return (b.duration_ms ?? 0) - (a.duration_ms ?? 0);
        case "spans":
          return b.span_count - a.span_count;
        case "tokens":
          return b.total_tokens - a.total_tokens;
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
    return list;
  }, [q, agent, status, sort]);

  return (
    <div>
      <PageHeader
        title="Traces"
        subtitle={`${traces.length} captured traces · fork any step and see what would have happened`}
      />

      <div className="space-y-4 px-8 py-6">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-dim-starlight/50" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4-4" />
            </svg>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search trace id, agent, or query…"
              className="w-full rounded-lg border border-black/[0.10] bg-surface/40 py-2 pl-9 pr-3 text-sm text-starlight placeholder:text-dim-starlight/40 focus:border-signal/50 focus:outline-none"
            />
          </div>
          <Select label="Agent" value={agent} onChange={setAgent} options={AGENTS} />
          <Select
            label="Status"
            value={status}
            onChange={(v) => setStatus(v as "all" | "OK" | "ERROR")}
            options={["all", "OK", "ERROR"]}
          />
          <Select
            label="Sort"
            value={sort}
            onChange={(v) => setSort(v as SortKey)}
            options={["recent", "duration", "spans", "tokens"]}
          />
        </div>

        {/* List */}
        <Card>
          {filtered.length === 0 ? (
            <EmptyState text="No traces match your filters." />
          ) : (
            <div className="overflow-x-auto dash-scroll">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-black/[0.08] text-left text-[11px] uppercase tracking-wide text-dim-starlight/60">
                    <th className="px-3 py-2 font-medium">Trace ID</th>
                    <th className="px-3 py-2 font-medium">Agent</th>
                    <th className="px-3 py-2 font-medium">Query</th>
                    <th className="px-3 py-2 font-medium">Composition</th>
                    <th className="px-3 py-2 text-right font-medium">Tokens</th>
                    <th className="py-2 pl-8 pr-3 text-right font-medium">Duration</th>
                    <th className="py-2 pl-8 pr-3 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Captured</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => (
                    <tr key={t.trace_id} className="group border-b border-black/[0.05] transition-colors hover:bg-black/[0.02]">
                      <td className="px-3 py-3">
                        <Link href={`/dashboard/traces/${t.trace_id}`}>
                          <Mono className="text-signal group-hover:underline">{shortId(t.trace_id, 14)}</Mono>
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-dim-starlight">{t.agent}</td>
                      <td className="max-w-[260px] truncate px-3 py-3 text-dim-starlight/80" title={t.query}>
                        {t.query}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <CompoChip color="#38BDF8" n={t.llm_count} label="LLM" />
                          <CompoChip color="#34D399" n={t.tool_count} label="tool" />
                          <span className="text-[11px] text-dim-starlight/40">{t.span_count} spans</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right font-[family-name:var(--font-mono)] text-dim-starlight tabular-nums">
                        {fmtNumber(t.total_tokens)}
                      </td>
                      <td className="py-3 pl-8 pr-3 text-right font-[family-name:var(--font-mono)] text-dim-starlight tabular-nums">
                        {fmtDuration(t.duration_ms)}
                      </td>
                      <td className="py-3 pl-8 pr-3">
                        <StatusPill status={t.status} />
                      </td>
                      <td className="px-3 py-3 text-[11px] text-dim-starlight/60">{fmtRelativeTime(t.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-dim-starlight/60">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-black/[0.10] bg-surface/40 px-2.5 py-2 text-sm text-starlight focus:border-signal/50 focus:outline-none"
      >
        {options.map((o) => (
          <option key={o} value={o} className="bg-surface text-starlight">
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function CompoChip({ color, n, label }: { color: string; n: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px]" style={{ color, backgroundColor: `${color}14` }}>
      <span className="font-[family-name:var(--font-mono)] font-bold">{n}</span>
      {label}
    </span>
  );
}
