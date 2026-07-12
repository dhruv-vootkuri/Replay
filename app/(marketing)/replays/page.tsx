import Link from "next/link";
import ReplayDiff from "@/app/components/product/ReplayDiff";

export default function ReplaysPage() {
  return (
    <>
      <section style={{ position: "relative", padding: "160px 24px 60px" }}>
        <div className="arctic-topo" />
        <div style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto" }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--ink)", marginBottom: 20 }}>
          Replays
        </p>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(2rem, 4.5vw, 3.25rem)",
            fontWeight: 700,
            lineHeight: 1.1,
            color: "var(--ink)",
            maxWidth: 760,
            marginBottom: 20,
            textShadow: "0 2px 28px rgba(95,168,211,0.16)",
          }}
        >
          Fork a span. Get a real{" "}
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 400, fontSize: "0.72em", background: "var(--frost-100)", padding: "0 10px", borderRadius: 6 }}>
            diff
          </span>
          , not a guess.
        </h1>
        <p style={{ fontFamily: "var(--font-body)", fontSize: "1.0625rem", lineHeight: 1.7, color: "var(--slate)", maxWidth: 620 }}>
          Pick a forkable span, edit its input, and Floe replays the trace
          from that point. Every other span gets classified relative to the
          fork: reused untouched, changed, or re-run because it depended on
          the change.
        </p>
        </div>
      </section>

      {/* The strongest, most differentiated material — shown large, faithful */}
      <section style={{ padding: "0 24px 40px", maxWidth: 1100, margin: "0 auto" }}>
        <ReplayDiff />
      </section>

      <section style={{ padding: "40px 24px 60px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 24 }}>
          <Callout label="Cached" color="#6B7280" body="Spans before the fork point. Nothing about them could have changed, so they're reused untouched — no re-execution." />
          <Callout label="Forked" color="#F59E0B" body="The span you edited. Its changed fields show as a real diff — a minus for what left, a plus for what replaced it." />
          <Callout label="Downstream" color="#38BDF8" body="Every span after the fork point that depended on the changed value — re-run for real, with its new output shown." />
        </div>
      </section>

      <section style={{ padding: "40px 24px 100px", textAlign: "center" }}>
        <p style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.125rem, 1.8vw, 1.5rem)", fontWeight: 600, color: "var(--ink)", marginBottom: 20 }}>
          This is what changes when your agent's tools change underneath it.
        </p>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href="/waitlist"
            className="frost-halo transition-[box-shadow,opacity] hover:opacity-90 hover:shadow-[var(--glow-frost)]"
            style={{ display: "inline-flex", padding: "13px 26px", background: "var(--ink)", color: "var(--arctic-bg)", borderRadius: 999, fontFamily: "var(--font-body)", fontSize: "0.9375rem", fontWeight: 500, textDecoration: "none" }}
          >
            Join the waitlist →
          </Link>
          <Link
            href="/traces"
            className="border-[var(--hairline)] transition-colors hover:border-[var(--frost-500)]"
            style={{ display: "inline-flex", padding: "13px 26px", background: "transparent", color: "var(--ink)", border: "1px solid", borderRadius: 999, fontFamily: "var(--font-body)", fontSize: "0.9375rem", fontWeight: 500, textDecoration: "none" }}
          >
            See how tracing works
          </Link>
        </div>
      </section>
    </>
  );
}

function Callout({ label, color, body }: { label: string; color: string; body: string }) {
  return (
    <div style={{ borderTop: `2px solid ${color}`, paddingTop: 12 }}>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", letterSpacing: "0.06em", color, marginBottom: 8, fontWeight: 700 }}>{label.toUpperCase()}</p>
      <p style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", lineHeight: 1.6, color: "var(--slate)" }}>{body}</p>
    </div>
  );
}
