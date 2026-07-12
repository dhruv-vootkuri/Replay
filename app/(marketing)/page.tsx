import Link from "next/link";
import Waterfall from "@/app/components/product/Waterfall";
import ReplayDiff from "@/app/components/product/ReplayDiff";

const STATS = [
  { label: "Traces", value: "7" },
  { label: "LLM calls", value: "20" },
  { label: "Tool calls", value: "13" },
  { label: "Spans", value: "80" },
  { label: "Avg duration", value: "4.7s" },
];

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section style={{ position: "relative", padding: "160px 24px 80px" }}>
        <div className="arctic-topo" />
        <div style={{ position: "relative", zIndex: 1, maxWidth: 1240, margin: "0 auto" }}>
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.75rem",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "var(--ink)",
            marginBottom: 20,
          }}
        >
          Replay diff
        </p>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(2.25rem, 5.5vw, 4.25rem)",
            fontWeight: 700,
            lineHeight: 1.06,
            color: "var(--ink)",
            maxWidth: 820,
            marginBottom: 24,
            letterSpacing: "-0.01em",
            textShadow: "0 2px 28px rgba(95,168,211,0.16)",
          }}
        >
          Change{" "}
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: 400,
              fontSize: "0.72em",
              background: "var(--frost-100)",
              padding: "0 10px",
              borderRadius: 6,
            }}
          >
            one input
          </span>{" "}
          mid-trace.
          <br />
          See exactly what reruns.
        </h1>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "clamp(1rem, 1.3vw, 1.1875rem)",
            lineHeight: 1.65,
            color: "var(--slate)",
            maxWidth: 560,
            marginBottom: 36,
          }}
        >
          Floe traces every LLM call, tool call, and span your agent makes.
          Fork any point, edit the input, and get a span-by-span diff —
          cached, forked, downstream — instead of a guess.
        </p>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 64 }}>
          <Link
            href="/waitlist"
            className="frost-halo transition-[box-shadow,opacity] hover:opacity-90 hover:shadow-[var(--glow-frost)]"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "13px 26px",
              background: "var(--ink)",
              color: "var(--arctic-bg)",
              borderRadius: 999,
              fontFamily: "var(--font-body)",
              fontSize: "0.9375rem",
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Join the waitlist →
          </Link>
          <Link
            href="/replays"
            className="border-[var(--hairline)] transition-colors hover:border-[var(--frost-500)]"
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "13px 26px",
              background: "transparent",
              color: "var(--ink)",
              border: "1px solid",
              borderRadius: 999,
              fontFamily: "var(--font-body)",
              fontSize: "0.9375rem",
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            See a real replay diff
          </Link>
        </div>

        {/* Full-scale real UI as the literal hero visual */}
        <ReplayDiff />
        </div>
      </section>

      {/* Immediate credibility: real Overview numbers, not decoration */}
      <section
        style={{
          borderTop: "1px solid var(--hairline)",
          borderBottom: "1px solid var(--hairline)",
          padding: "36px 24px",
        }}
      >
        <div
          style={{
            maxWidth: 1240,
            margin: "0 auto",
            display: "flex",
            flexWrap: "wrap",
            gap: "28px 48px",
            justifyContent: "space-between",
          }}
        >
          {STATS.map((s) => (
            <div key={s.label}>
              <div
                className="tabular-nums"
                style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.5rem, 3vw, 2.25rem)", fontWeight: 700, color: "var(--ink)" }}
              >
                {s.value}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.6875rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--slate-dim)", marginTop: 4 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
        <p style={{ maxWidth: 1240, margin: "16px auto 0", fontFamily: "var(--font-mono)", fontSize: "0.6875rem", color: "var(--slate-dim)" }}>
          from a real recorded session — see it live at{" "}
          <a href="/dashboard" style={{ color: "var(--slate-dim)", textDecoration: "underline" }}>
            /dashboard
          </a>
        </p>
      </section>

      {/* Two-path split — distinct real visuals, not matching icon cards */}
      <section style={{ padding: "80px 24px", maxWidth: 1240, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 48 }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 20 }}>
            <TwoPath
              eyebrow="01 — Traces"
              heading="Every call, captured automatically."
              body="Spans for every LLM call, tool call, and agent step — kind-tagged, timed, nested by depth. No manual instrumentation."
              href="/traces"
              cta="How tracing works"
            >
              <Waterfall compact />
            </TwoPath>
            <TwoPath
              eyebrow="02 — Replays"
              heading="Fork a span. Get a real diff."
              body="Pick a forkable span, change one input, and Floe classifies everything else: cached, forked, or downstream — with exact field-level diffs."
              href="/replays"
              cta="How forking works"
            >
              <ReplayDiff compact />
            </TwoPath>
          </div>
        </div>
      </section>

      {/* Close */}
      <section style={{ padding: "60px 24px 100px", textAlign: "center" }}>
        <p style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.25rem, 2vw, 1.75rem)", fontWeight: 600, color: "var(--ink)", marginBottom: 20 }}>
          Early access is open for teams building agentic workflows.
        </p>
        <Link
          href="/waitlist"
          className="frost-halo transition-[box-shadow,opacity] hover:opacity-90 hover:shadow-[var(--glow-frost)]"
          style={{
            display: "inline-flex",
            padding: "13px 28px",
            background: "var(--ink)",
            color: "var(--arctic-bg)",
            borderRadius: 999,
            fontFamily: "var(--font-body)",
            fontSize: "0.9375rem",
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          Join the waitlist →
        </Link>
      </section>
    </>
  );
}

function TwoPath({
  eyebrow,
  heading,
  body,
  href,
  cta,
  children,
}: {
  eyebrow: string;
  heading: string;
  body: string;
  href: string;
  cta: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
      <div
        className="frost-panel frost-hover"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 24,
          padding: 28,
          borderRadius: 12,
        }}
      >
        <div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.6875rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--slate-dim)", marginBottom: 10 }}>
            {eyebrow}
          </p>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.375rem, 2vw, 1.75rem)", fontWeight: 700, color: "var(--ink)", marginBottom: 10 }}>
            {heading}
          </h3>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.9375rem", lineHeight: 1.6, color: "var(--slate)", marginBottom: 14, maxWidth: 460 }}>
            {body}
          </p>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", letterSpacing: "0.06em", color: "var(--ink)" }}>{cta} →</span>
        </div>
        <div style={{ overflow: "auto" }}>{children}</div>
      </div>
    </Link>
  );
}
