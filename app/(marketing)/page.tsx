import Waterfall from "@/app/components/product/Waterfall";
import ReplayDiff from "@/app/components/product/ReplayDiff";
import LogStream from "@/app/components/product/LogStream";
import AtmosphericVideo from "@/app/components/hud/AtmosphericVideo";
import VideoColorWindow from "@/app/components/hud/VideoColorWindow";
import WaitlistForm from "@/app/components/WaitlistForm";
import Reveal from "@/app/components/Reveal";
import IntroGate from "@/app/components/IntroGate";

const STATS = [
  { label: "Traces", value: "7" },
  { label: "LLM calls", value: "20" },
  { label: "Tool calls", value: "13" },
  { label: "Spans", value: "80" },
  { label: "Avg duration", value: "4.7s" },
];

export default function LandingPage() {
  return (
    <IntroGate>
      {/* Hero — fills the viewport so the KPI strip doesn't peek in below
          the fold on tall/short content alike. */}
      <section
        style={{
          position: "relative",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          padding: "160px 24px 32px",
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        <AtmosphericVideo
          loop={false}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "grayscale(1) brightness(1.25) contrast(0.85)",
            opacity: 0.2,
            maskImage: "linear-gradient(to bottom, black 55%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(to bottom, black 55%, transparent 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            overflow: "hidden",
            pointerEvents: "none",
            maskImage: "linear-gradient(to bottom, black 55%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(to bottom, black 55%, transparent 100%)",
          }}
        >
          <VideoColorWindow
            filterExtras="brightness(1.25) contrast(0.85)"
            baseOpacity={0.2}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              maskImage: "linear-gradient(to right, transparent 0%, transparent 52%, black 60%)",
              WebkitMaskImage: "linear-gradient(to right, transparent 0%, transparent 52%, black 60%)",
            }}
          />
        </div>
        <div style={{ position: "relative", zIndex: 1, maxWidth: 1240, margin: "0 auto", width: "100%" }}>
        <Reveal>
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
          Git for agent execution
        </p>
        </Reveal>
        <Reveal delay={0.1}>
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
        </Reveal>
        <Reveal delay={0.2}>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "clamp(1rem, 1.3vw, 1.1875rem)",
            lineHeight: 1.65,
            color: "var(--slate)",
            maxWidth: 560,
            marginBottom: 56,
          }}
        >
          Floe traces every LLM call, tool call, and span your agent makes.
          Fork any point, edit the input, and get a span-by-span diff —
          cached, forked, downstream — instead of a guess.
        </p>
        </Reveal>
        </div>
      </section>

      {/* Trace visual + immediate credibility numbers, combined into one
          section (no divider between them) so the dashboard image and the
          real Overview numbers beneath it read as a single credibility
          beat, deliberately kept out of the hero's own viewport (that
          section plays the atmospheric video once instead) so it's
          invisible on load and only rises into view once the visitor
          scrolls, with real breathing room above it rather than sitting
          flush against the hero. The same 60px/140px bottom/top pattern
          used before #replays carries this section into the Traces
          chapter below. */}
      <section
        style={{
          position: "relative",
          padding: "36px 24px 60px",
        }}
      >
        <div className="arctic-topo" />
        <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <Reveal>
        <ReplayDiff />
        </Reveal>
        </div>
        <div
          style={{
            maxWidth: 1240,
            margin: "40px auto 0",
            display: "flex",
            flexWrap: "wrap",
            gap: "28px 48px",
            justifyContent: "space-between",
          }}
        >
          {STATS.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.08}>
              <div
                className="tabular-nums"
                style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.5rem, 3vw, 2.25rem)", fontWeight: 700, color: "var(--ink)" }}
              >
                {s.value}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.6875rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--slate-dim)", marginTop: 4 }}>
                {s.label}
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={0.4}>
        <p style={{ maxWidth: 1240, margin: "16px auto 0", fontFamily: "var(--font-mono)", fontSize: "0.6875rem", color: "var(--slate-dim)" }}>
          from a real recorded session — see it live at{" "}
          <a href="/dashboard" style={{ color: "var(--slate-dim)", textDecoration: "underline" }}>
            /dashboard
          </a>
        </p>
        </Reveal>
        </div>
      </section>

      {/* Traces chapter */}
      <section
        id="traces"
        style={{ position: "relative", borderTop: "1px solid var(--hairline)", padding: "140px 24px 60px", scrollMarginTop: 110 }}
      >
        <div className="arctic-topo" />
        <div style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto" }}>
          <Reveal>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--ink)", marginBottom: 20 }}>
            01 — Traces
          </p>
          </Reveal>
          <Reveal delay={0.1}>
          <h2
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
          </h2>
          </Reveal>
          <Reveal delay={0.2}>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "1.0625rem", lineHeight: 1.7, color: "var(--slate)", maxWidth: 620, marginBottom: 56 }}>
            A trace is one query handled by an agent, broken into spans — agent,
            task, LLM, and tool calls, nested by depth. One line —{" "}
            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 400, fontSize: "0.85em", background: "var(--frost-100)", padding: "0 8px", borderRadius: 6 }}>
              replay.init()
            </span>{" "}
            — and Floe auto-instruments OpenAI, LangChain/LangGraph, and
            LlamaIndex via OpenTelemetry. No manual span creation.
          </p>
          </Reveal>

          <Reveal>
          <Waterfall />
          </Reveal>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 24, margin: "56px 0" }}>
            <Reveal><Callout label="Kind badges" color="#818CF8" body="Every span is tagged agent, task, llm, or tool — colored to match the real console, so a waterfall is scannable at a glance." /></Reveal>
            <Reveal delay={0.1}><Callout label="The ◆ marker" color="#34D399" body="Marks which spans are forkable — an LLM or tool call whose input you can edit to generate a replay." /></Reveal>
            <Reveal delay={0.2}><Callout label="Depth" color="#38BDF8" body="Indentation mirrors the real parent/child call structure — an agent invoking a workflow invoking a task invoking a model." /></Reveal>
          </div>

          <Reveal>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.9375rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--slate)", marginBottom: 14 }}>
            And every step is logged live
          </p>
          </Reveal>
          <Reveal>
          <LogStream />
          </Reveal>

          <Reveal>
          <div style={{ marginTop: 72, textAlign: "center" }}>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.125rem, 1.8vw, 1.5rem)", fontWeight: 600, color: "var(--ink)" }}>
              Now pick a forkable span and see what happens when you change it.
            </p>
          </div>
          </Reveal>
        </div>
      </section>

      {/* Replays chapter — ties back to the diff already shown in the hero */}
      <section
        id="replays"
        style={{ position: "relative", borderTop: "1px solid var(--hairline)", padding: "140px 24px 100px", scrollMarginTop: 110 }}
      >
        <div className="arctic-topo" />
        <div style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto" }}>
          <Reveal>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--ink)", marginBottom: 20 }}>
            02 — Replays
          </p>
          </Reveal>
          <Reveal delay={0.1}>
          <h2
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
          </h2>
          </Reveal>
          <Reveal delay={0.2}>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "1.0625rem", lineHeight: 1.7, color: "var(--slate)", maxWidth: 620, marginBottom: 32 }}>
            Pick a forkable span and edit its input — that&apos;s the diff
            shown up top. Fork a <strong>tool call</strong> and just that
            call reruns, with the new result threaded into everything
            downstream. Fork an <strong>LLM call</strong> and Floe replays
            the agent&apos;s whole decision loop from there instead — it can
            take a different path than it did the first time. Either way,
            every span gets classified relative to the fork:
          </p>
          </Reveal>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 24, marginBottom: 56 }}>
            <Reveal><Callout label="Cached" color="#6B7280" body="Spans before the fork point. Nothing about them could have changed, so they're reused untouched — no re-execution." /></Reveal>
            <Reveal delay={0.1}><Callout label="Forked" color="#F59E0B" body="The span you edited. Its changed fields show as a real diff — a minus for what left, a plus for what replaced it." /></Reveal>
            <Reveal delay={0.2}><Callout label="Downstream" color="#38BDF8" body="Every span after the fork point that depended on the changed value — re-run for real, with its new output shown." /></Reveal>
          </div>

          <Reveal>
          <div style={{ paddingTop: 32, marginBottom: 56 }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.9375rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--slate)", marginBottom: 14 }}>
              What about side effects?
            </p>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "0.9375rem", lineHeight: 1.7, color: "var(--slate)", maxWidth: 660 }}>
              Tools are declared{" "}
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 400, fontSize: "0.9em", background: "var(--frost-100)", padding: "0 8px", borderRadius: 6 }}>
                @replay.tool(safe=True)
              </span>{" "}
              or left unsafe. If a replay reaches an unsafe tool downstream of
              your fork — an email send, a database write — Floe pauses
              instead of firing it again: run it for real, use a registered
              replay alternative, type the output yourself, or stop the
              replay right there.
            </p>
          </div>
          </Reveal>

          <Reveal>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.125rem, 1.8vw, 1.5rem)", fontWeight: 600, color: "var(--ink)" }}>
              This is what changes when your agent&apos;s tools change underneath it.
            </p>
          </div>
          </Reveal>
        </div>
      </section>

      {/* Close — the waitlist form itself, not another link to it */}
      <WaitlistForm />
    </IntroGate>
  );
}

function Callout({ label, body, color = "var(--ink)" }: { label: string; body: string; color?: string }) {
  return (
    <div style={{ borderTop: `2px solid ${color}`, paddingTop: 12 }}>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", letterSpacing: "0.06em", color, marginBottom: 8, fontWeight: color === "var(--ink)" ? 400 : 700 }}>
        {color === "var(--ink)" ? label : label.toUpperCase()}
      </p>
      <p style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", lineHeight: 1.6, color: "var(--slate)" }}>{body}</p>
    </div>
  );
}
