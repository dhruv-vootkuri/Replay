import Link from "next/link";
import { PageHeader, Card, KindBadge, StatusPill, Mono } from "./ui";
import { KpiTile } from "./KpiTile";
import { TimeSeriesChart, HBarChart, DonutChart } from "./charts";
import {
  getTotals,
  getKindBreakdown,
  getTracesByDay,
  getLatencies,
  getToolFrequency,
  getAgentBreakdown,
} from "@/lib/replay/stats";
import { traces } from "@/lib/replay/data";
import { KIND_META, fmtDuration, fmtNumber, fmtRelativeTime, shortId } from "@/lib/replay/format";

export default function OverviewPage() {
  const totals = getTotals();
  const byDay = getTracesByDay();
  const kinds = getKindBreakdown();
  const latencies = [...getLatencies()].sort((a, b) => b.ms - a.ms).slice(0, 8);
  const tools = getToolFrequency();
  const agents = getAgentBreakdown();
  const recent = traces.slice(0, 5);

  const kindDonut = kinds.map((k) => ({
    label: KIND_META[k.kind].label,
    value: k.count,
    color: KIND_META[k.kind].color,
  }));

  return (
    <div>
      <PageHeader
        title="Overview"
        subtitle="Everything the tracer has captured, at a glance."
        right={
          <Link
            href="/dashboard/traces"
            className="rounded-lg bg-signal px-4 py-2 text-sm font-medium text-deep-space transition-opacity hover:opacity-90"
          >
            View all traces →
          </Link>
        }
      />

      <div className="space-y-6 px-8 py-6">
        {/* KPI row */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiTile
            label="Traces"
            value={fmtNumber(totals.traceCount)}
            accent="#38BDF8"
            spark={byDay.map((d) => d.count)}
          />
          <KpiTile
            label="LLM calls"
            value={fmtNumber(totals.llmCalls)}
            accent={KIND_META.llm.color}
            spark={traces.map((t) => t.llm_count).reverse()}
          />
          <KpiTile
            label="Tool calls"
            value={fmtNumber(totals.toolCalls)}
            accent={KIND_META.tool.color}
            spark={traces.map((t) => t.tool_count).reverse()}
          />
          <KpiTile
            label="Tokens"
            value={fmtNumber(totals.totalTokens)}
            accent={KIND_META.task.color}
            spark={traces.map((t) => t.total_tokens).reverse()}
          />
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiTile label="Avg duration" value={fmtDuration(totals.avgDurationMs)} accent="#818CF8" />
          <KpiTile
            label="Error rate"
            value={`${(totals.errorRate * 100).toFixed(0)}`}
            unit="%"
            accent={totals.errorRate > 0 ? "#F43F5E" : "#34D399"}
          />
          <KpiTile label="Replays" value={fmtNumber(totals.replayCount)} accent="#38BDF8" />
          <KpiTile label="Total spans" value={fmtNumber(totals.spanCount)} accent="#94A3B8" />
        </div>

        {/* Charts row 1 */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card title="Traces captured" hint="per day" className="lg:col-span-2">
            <TimeSeriesChart data={byDay} />
            <div className="mt-3 flex items-center gap-4 text-[11px] text-dim-starlight/70">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-signal" /> traces
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-divergence" /> days with errors
              </span>
            </div>
          </Card>
          <Card title="Span composition" hint="all traces">
            <DonutChart data={kindDonut} centerValue={fmtNumber(totals.spanCount)} centerLabel="spans" />
          </Card>
        </div>

        {/* Charts row 2 */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card title="Slowest traces" hint="wall-clock">
            <HBarChart
              data={latencies.map((l) => ({ label: l.agent, value: Math.round(l.ms), status: l.status }))}
              unit="ms"
              color="#818CF8"
              colorByStatus
            />
          </Card>
          <Card title="Tool call frequency" hint={`${tools.length} tools`}>
            <HBarChart data={tools.map((t) => ({ label: t.tool, value: t.count }))} color="#34D399" />
          </Card>
          <Card title="Agents" hint="by traces">
            <HBarChart data={agents.map((a) => ({ label: a.agent, value: a.traces }))} color="#38BDF8" />
          </Card>
        </div>

        {/* Recent traces */}
        <Card title="Recent traces" hint="newest first">
          <div className="-mx-1 overflow-x-auto dash-scroll">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-left text-[11px] uppercase tracking-wide text-dim-starlight/60">
                  <th className="px-2 py-2 font-medium">Trace</th>
                  <th className="px-2 py-2 font-medium">Agent</th>
                  <th className="px-2 py-2 font-medium">Query</th>
                  <th className="px-2 py-2 font-medium">Spans</th>
                  <th className="px-2 py-2 font-medium">Duration</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((t) => (
                  <tr key={t.trace_id} className="border-b border-white/[0.03] transition-colors hover:bg-white/[0.02]">
                    <td className="px-2 py-2.5">
                      <Link href={`/dashboard/traces/${t.trace_id}`} className="text-signal hover:underline">
                        <Mono className="text-signal">{shortId(t.trace_id, 12)}</Mono>
                      </Link>
                    </td>
                    <td className="px-2 py-2.5 text-dim-starlight">{t.agent}</td>
                    <td className="max-w-[240px] truncate px-2 py-2.5 text-dim-starlight/80">{t.query}</td>
                    <td className="px-2 py-2.5">
                      <span className="text-starlight">{t.span_count}</span>
                      <span className="ml-1.5 text-[11px] text-dim-starlight/50">
                        {t.llm_count}L · {t.tool_count}T
                      </span>
                    </td>
                    <td className="px-2 py-2.5 font-[family-name:var(--font-mono)] text-dim-starlight">
                      {fmtDuration(t.duration_ms)}
                    </td>
                    <td className="px-2 py-2.5">
                      <StatusPill status={t.status} />
                    </td>
                    <td className="px-2 py-2.5 text-[11px] text-dim-starlight/60">{fmtRelativeTime(t.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
