import Link from "next/link";
import Waterfall from "@/app/components/product/Waterfall";
import LogStream from "@/app/components/product/LogStream";

export default function TracesPage() {
  return (
    <>
      <section style={{ position: "relative", padding: "160px 24px 60px" }}>
        <div className="arctic-topo" />
        <div style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto" }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--ink)", marginBottom: 20 }}>
          Traces
        </p>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(2rem, 4.5vw, 3.25rem)",
            fontWeight: 700,
            lineHeight: 1.1,
            color: "var(--ink)",
            maxWidth: 720,
            marginBottom: 20,
            textShadow: "0 2px 28px rgba(95,168,211,0.16)",
          }}
        >
          Every{" "}
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 400, fontSize: "0.72em", background: "var(--frost-100)", padding: "0 10px", borderRadius: 6 }}>
            span
          </span>{" "}
          captured, automatically.
        </h1>
        <p style={{ fontFamily: "var(--font-body)", fontSize: "1.0625rem", lineHeight: 1.7, color: "var(--slate)", maxWidth: 620 }}>
          A trace is one query handled by an agent, broken into spans — agent,
          task, LLM, and tool calls, nested by depth. No manual
          instrumentation: Floe registers every span as it happens.
        </p>
        </div>
      </section>

      <section style={{ padding: "0 24px 40px", maxWidth: 1100, margin: "0 auto" }}>
        <Waterfall />
      </section>

      <section style={{ padding: "20px 24px 60px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 24 }}>
          <Callout label="Kind badges" body="Every span is tagged agent, task, llm, or tool — colored to match the real console, so a waterfall is scannable at a glance." />
          <Callout label="The ◆ marker" body="Marks which spans are forkable — an LLM or tool call whose input you can edit to generate a replay." />
          <Callout label="Depth" body="Indentation mirrors the real parent/child call structure — an agent invoking a workflow invoking a task invoking a model." />
        </div>
      </section>

      <section style={{ padding: "40px 24px 60px", maxWidth: 1100, margin: "0 auto" }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.6875rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--slate-dim)", marginBottom: 14 }}>
          And every step is logged live
        </p>
        <LogStream />
      </section>

      <section style={{ padding: "40px 24px 100px", textAlign: "center" }}>
        <p style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.125rem, 1.8vw, 1.5rem)", fontWeight: 600, color: "var(--ink)", marginBottom: 20 }}>
          Now pick a forkable span and see what happens when you change it.
        </p>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href="/replays"
            className="frost-halo transition-[box-shadow,opacity] hover:opacity-90 hover:shadow-[var(--glow-frost)]"
            style={{ display: "inline-flex", padding: "13px 26px", background: "var(--ink)", color: "var(--arctic-bg)", borderRadius: 999, fontFamily: "var(--font-body)", fontSize: "0.9375rem", fontWeight: 500, textDecoration: "none" }}
          >
            See how forking works →
          </Link>
          <Link
            href="/waitlist"
            className="border-[var(--hairline)] transition-colors hover:border-[var(--frost-500)]"
            style={{ display: "inline-flex", padding: "13px 26px", background: "transparent", color: "var(--ink)", border: "1px solid", borderRadius: 999, fontFamily: "var(--font-body)", fontSize: "0.9375rem", fontWeight: 500, textDecoration: "none" }}
          >
            Join the waitlist
          </Link>
        </div>
      </section>
    </>
  );
}

function Callout({ label, body }: { label: string; body: string }) {
  return (
    <div style={{ borderTop: "2px solid var(--ink)", paddingTop: 12 }}>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", letterSpacing: "0.04em", color: "var(--ink)", marginBottom: 8 }}>{label}</p>
      <p style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", lineHeight: 1.6, color: "var(--slate)" }}>{body}</p>
    </div>
  );
}
