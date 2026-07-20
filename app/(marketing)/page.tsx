import Waterfall from "@/app/components/product/Waterfall";
import ReplayDiff from "@/app/components/product/ReplayDiff";
import LogStream from "@/app/components/product/LogStream";
import CommandLog from "@/app/components/product/CommandLog";
import InstallCommand from "@/app/components/product/InstallCommand";
import InputCycler from "@/app/components/InputCycler";
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
        {/* Three tiers, decreasing size — tier 1 is the primary <h1>
            (brand hook), tier 2 (the animated "Change ... mid-trace."
            line) is an <h2> subordinate to it, tier 3 is the lead
            sentence that used to be the plain body paragraph. Only one
            <h1> on the page, and it's still the visually largest tier,
            so heading hierarchy and visual hierarchy still agree.
            The old "Git for agent execution" mono eyebrow above all of
            this was removed outright, not just visually hidden — tier 1
            now leads instead.
            Tier 1's font-size is capped rather than scaling further with
            viewport width like the other tiers, to keep the line clear
            of the video color-reveal mask (VideoColorWindow, becomes
            visible at 52% of the hero's width — ~x=749 on a 1440px
            hero). The cap has been re-measured twice: 56px (3.5rem) was
            the original safe max for the plain text alone (~17px
            buffer), but adding the bordered box around "Floe" (see
            below) added enough width on its own to push 56px 0.2px past
            the boundary — confirmed via getBoundingClientRect before
            dropping to the current 54px (3.375rem), which restores a
            ~22px buffer including the box. Re-measure the same way
            (probe candidate sizes against the box's own right edge, not
            just the text) before raising this cap again, or before
            changing the box's border-width/padding, both of which add
            to the same budget. */}
        <Reveal delay={0.1}>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(2.25rem, 4vw, 3.375rem)",
            fontWeight: 800,
            lineHeight: 1.04,
            color: "var(--ink)",
            maxWidth: 650,
            marginBottom: 36,
            letterSpacing: "-0.02em",
            textShadow: "0 2px 28px rgba(95,168,211,0.16)",
          }}
        >
          {/* "Floe" hover (F/loe fading to the intro's two blues) reuses
              the exact .wordmark-f/.wordmark-loe classes from the header
              wordmark. A sun-ray SVG decoration (radiating strokes above/
              below the word, iterated through several sizes/spacings)
              was tried here and explicitly removed — back to a plain
              hover-only two-tone text color fade, no surrounding
              graphic. Don't reintroduce rays without a fresh explicit
              ask. */}
          Fine-Tune Agents to{" "}
          <span className="hero-floe-hover">
            <span className="wordmark-f">F</span><span className="wordmark-loe">loe</span>
          </span>
        </h1>
        </Reveal>
        <Reveal delay={0.15}>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(1.625rem, 3.2vw, 2.5rem)",
            fontWeight: 700,
            lineHeight: 1.15,
            color: "var(--ink)",
            maxWidth: 750,
            // Tier1->tier2 gap (this element's marginBottom) is 36px; this
            // gap (tier2->tier3) was also 36px, but tier3's text is much
            // smaller than tier2's (21px vs 40px), so the equal gap read
            // as disproportionately large next to it. 24px keeps roughly
            // the same gap-to-text-size ratio as the tier1->tier2 pairing
            // instead of a flat, size-agnostic number.
            marginBottom: 24,
            letterSpacing: "-0.01em",
          }}
        >
          Change{" "}
          <InputCycler />{" "}
          mid-trace.
        </h2>
        </Reveal>
        <Reveal delay={0.2}>
        <p
          style={{
            fontFamily: "var(--font-body)",
            // 1.46vw/1.3125rem (not the round 1.5vw/1.375rem this was
            // before) — measured directly: at the previous size this
            // paragraph wrapped to 3 lines at 1440px width; 21px is the
            // largest size that still wraps to exactly 2 (confirmed via
            // Range.getClientRects() grouped by line, since a raw rect
            // count is unreliable here — the bolded "you" splits the
            // text into multiple inline fragments per line, not one rect
            // per visual line).
            fontSize: "clamp(1.125rem, 1.46vw, 1.3125rem)",
            lineHeight: 1.65,
            color: "var(--slate)",
            maxWidth: 620,
            marginBottom: 56,
          }}
        >
          Fork spans, edit inputs, and get a step-by-step diff, manually or
          autonomously, so developers ship quicker to clients that trust{" "}
          <strong style={{ fontWeight: 700, color: "var(--ink)" }}>you</strong>.
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
        {/* Two-column: the trace visual and the KPI numbers used to stack
            (diff on top, a full-width stat row underneath) — now the stats
            live beside it in a crafted .frost-panel aside instead of
            trailing below, so the whole block reads as one deliberately
            composed dashboard rather than a hero image with a stat footer.
            flex-grow ratios (72/28, not equal) give the trace visual most
            of the row; flex-wrap (no media query) drops the aside below
            the diff once the row can't fit both basis widths.
            Both sides use the same stretch trick: Reveal itself becomes a
            grid container (display:grid, height:100%), so its single child
            (ReplayDiff's own root div on the left, the frost-panel on the
            right) stretches to fill it via CSS Grid's default stretch —
            that's the only way to reach into ReplayDiff's own height
            without ReplayDiff accepting a style prop (grid over flex here
            specifically because a flex column's align-items:stretch only
            affects the cross axis, i.e. width, not height — an earlier
            version of this used flexDirection:"column" and silently never
            stretched the height at all). minHeight:600 (not height:600) on
            both column wrappers is the explicit "make them both 600px"
            target — minHeight rather than a hard height because ReplayDiff
            wraps to more lines at mobile's narrower stacked width and can
            genuinely need more than 600px; a hard height there doesn't
            clip the overflow, it just renders past the box's declared
            size without flex-wrap's line-break math accounting for it,
            which visibly collided with the aside wrapped below it. */}
        <div style={{ maxWidth: 1240, margin: "0 auto", display: "flex", flexWrap: "wrap", gap: 32, alignItems: "stretch" }}>
          <div style={{ flex: "72 1 560px", minHeight: 600 }}>
            <Reveal style={{ height: "100%", display: "grid" }}>
            <ReplayDiff />
            </Reveal>
          </div>
          <div style={{ flex: "28 1 240px", maxWidth: 320, minHeight: 600 }}>
            <Reveal delay={0.15} style={{ height: "100%", display: "grid" }}>
            <div
              className="frost-panel"
              style={{
                borderRadius: 4,
                padding: "20px 24px",
                height: "100%",
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                border: "1.5px solid rgba(46,110,150,0.55)",
              }}
            >
              {/* flex:1 + space-between spreads the 5 rows across the box's
                  full height (matching ReplayDiff's 600px via minHeight
                  above) instead of bunching at the top with a big gap
                  before the caption. Label now uses the mono/uppercase/
                  tracked treatment every other label on this page uses
                  (chapter eyebrows, Callout labels, kind badges) instead of
                  display-font sentence case — this reintroduces a size
                  difference between value and label (0.6em), a deliberate
                  update to the earlier "same size" single-line request:
                  no mono/uppercase/tracked label anywhere else on this
                  page sits at the same size as the emphasis next to it,
                  so matching that established pattern took priority once
                  it was visible side-by-side with the rest of the site.
                  Still one line, not stacked — that part of the earlier
                  request stands. */}
              <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between" }}>
                {STATS.map((s, i) => (
                  <Reveal key={s.label} delay={0.15 + i * 0.06}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10, fontSize: "clamp(1rem, 1.8vw, 1.25rem)" }}>
                      <span className="tabular-nums" style={{ fontFamily: "var(--font-display)", fontWeight: 800, color: "var(--ink)" }}>{s.value}</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", fontSize: "0.6em", color: "var(--slate-dim)" }}>{s.label}</span>
                    </div>
                  </Reveal>
                ))}
              </div>
              <p style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--hairline)", fontFamily: "var(--font-mono)", fontSize: "0.6875rem", color: "var(--slate-dim)" }}>
                from a real recorded session — see it live at{" "}
                <a href="/dashboard" style={{ color: "var(--slate-dim)", textDecoration: "underline" }}>
                  /dashboard
                </a>
              </p>
            </div>
            </Reveal>
          </div>
        </div>
        </div>
      </section>

      {/* Install — a short prelude before the numbered Traces/Replays
          chapters, not one of them (numbered "00" rather than folded into
          "01 — Traces"), since it's about getting the CLI running locally
          rather than explaining a concept. "Floe's REPLAY" plays on the
          real naming gotcha documented elsewhere in this file: the actual
          installed package is still literally `replay` even though the
          product is branded Floe everywhere else — this headline is that
          in one phrase, not just a section title (the headline itself is
          uppercase — REPLAY — as a stylistic emphasis; the real command
          text below it stays real lowercase `replay`/`pip install replay`,
          since that's an actual case-sensitive Python package name, not
          copy). The macOS/Windows
          toggle in InstallCommand only actually changes one line (the
          REPLAY=1 env-var shortcut, real bash/zsh vs PowerShell syntax) —
          pip install and replay.init() are identical on both, so those
          lines don't change when you switch. */}
      <section
        id="install"
        style={{ position: "relative", borderTop: "1px solid var(--hairline)", padding: "140px 24px 60px", scrollMarginTop: 110 }}
      >
        <div className="arctic-topo" />
        <div style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto" }}>
          <Reveal>
          <p style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--font-mono)", fontSize: "1.125rem", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink)", marginBottom: 20 }}>
            <span aria-hidden="true" style={{ display: "inline-block", width: 3, height: 20, background: "var(--ink)" }} />
            01 — Install
          </p>
          </Reveal>
          <Reveal delay={0.1}>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(1.75rem, 4.1vw, 3rem)",
              fontWeight: 800,
              lineHeight: 1.08,
              color: "var(--ink)",
              maxWidth: 720,
              marginBottom: 20,
              textShadow: "0 2px 28px rgba(95,168,211,0.16)",
            }}
          >
            Floe's Replay.
          </h2>
          </Reveal>
          <Reveal delay={0.2}>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "1.0625rem", lineHeight: 1.7, color: "var(--slate)", maxWidth: 620, marginBottom: 56 }}>
            One real CLI, installed locally, no hosted account needed to
            start capturing traces, running the exact same way on macOS,
            Linux, and Windows alike.
          </p>
          </Reveal>

          <Reveal>
          <InstallCommand />
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
          <p style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--font-mono)", fontSize: "1.125rem", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink)", marginBottom: 20 }}>
            <span aria-hidden="true" style={{ display: "inline-block", width: 3, height: 20, background: "var(--ink)" }} />
            02 — Traces
          </p>
          </Reveal>
          <Reveal delay={0.1}>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(1.75rem, 4.1vw, 3rem)",
              fontWeight: 800,
              lineHeight: 1.08,
              color: "var(--ink)",
              maxWidth: 850,
              marginBottom: 20,
              textShadow: "0 2px 28px rgba(95,168,211,0.16)",
            }}
          >
            Every{" "}
            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 400, fontSize: "0.72em", background: "var(--frost-100)", padding: "0 10px", borderRadius: 6 }}>
              span
            </span>{" "}
            Captured, Automatically.
          </h2>
          </Reveal>
          <Reveal delay={0.2}>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "1.0625rem", lineHeight: 1.7, color: "var(--slate)", maxWidth: 620, marginBottom: 56 }}>
            A trace is one query handled by an agent, made of spans: agent,
            task, LLM, and tool calls, nested by depth. Add{" "}
            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 400, fontSize: "0.85em", background: "var(--frost-100)", padding: "0 8px", borderRadius: 6 }}>
              replay.init()
            </span>
            , and Floe auto-instruments OpenAI, LangChain/LangGraph, and
            LlamaIndex automatically.
          </p>
          </Reveal>

          <Reveal>
          <Waterfall />
          </Reveal>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 24, margin: "56px 0" }}>
            <Reveal><Callout label="Type Badges" color="#818CF8" body="Every span is tagged & colored to match the real console, so a waterfall is scannable at a glance by both humans and agents." /></Reveal>
            <Reveal delay={0.1}><Callout label="The ◆ Marker" color="#34D399" body="Marks forkable spans automatically— LLM and tool calls whose input you can edit to generate a replay." /></Reveal>
            <Reveal delay={0.2}><Callout label="Depth" color="#38BDF8" body="Indentation mirrors the real parent/child call structure: an agent invoking a workflow invoking a task invoking a model." /></Reveal>
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
            <p style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.125rem, 1.9vw, 1.5rem)", fontWeight: 600, color: "var(--ink)" }}>
              Now pick a forkable span and see what happens when you change it.
            </p>
          </div>
          </Reveal>
        </div>
      </section>

      {/* Replays chapter — ties back to the diff already shown in the hero */}
      <section
        id="replays"
        style={{ position: "relative", borderTop: "1px solid var(--hairline)", padding: "140px 24px 60px", scrollMarginTop: 110 }}
      >
        <div className="arctic-topo" />
        <div style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto" }}>
          <Reveal>
          <p style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--font-mono)", fontSize: "1.125rem", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink)", marginBottom: 20 }}>
            <span aria-hidden="true" style={{ display: "inline-block", width: 3, height: 20, background: "var(--ink)" }} />
            03 — Replays
          </p>
          </Reveal>
          <Reveal delay={0.1}>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(1.75rem, 4.1vw, 3rem)",
              fontWeight: 800,
              lineHeight: 1.08,
              color: "var(--ink)",
              maxWidth: 1000,
              marginBottom: 20,
              textShadow: "0 2px 28px rgba(95,168,211,0.16)",
            }}
          >
            Fork a{" "}
            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 400, fontSize: "0.72em", background: "var(--frost-100)", padding: "0 10px", borderRadius: 6 }}>
              span
            </span>
            , Get a Real{" "}
            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 400, fontSize: "0.72em", background: "var(--frost-100)", padding: "0 10px", borderRadius: 6 }}>
              diff
            </span>
            .
          </h2>
          </Reveal>
          <Reveal delay={0.2}>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "1.0625rem", lineHeight: 1.7, color: "var(--slate)", maxWidth: 620, marginBottom: 56 }}>
            Pick a forkable span and edit its input, that&apos;s the diff
            shown up top. Fork a <strong>tool call</strong> and just that
            call reruns, threading downstream. Fork an{" "}
            <strong>LLM call</strong> and Floe replays the whole loop
            instead. Every span is classified relative to the fork:
          </p>
          </Reveal>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 24, marginBottom: 56 }}>
            <Reveal><Callout label="Cached" color="#6B7280" body="Spans before the fork point. Nothing about them could have changed, so they're reused untouched — no re-execution." /></Reveal>
            <Reveal delay={0.1}><Callout label="Forked" color="#F59E0B" body="The span you edited. Its changed fields show as a real diff — a minus for what left, a plus for what replaced it." /></Reveal>
            <Reveal delay={0.2}><Callout label="Downstream" color="#38BDF8" body="Every span after the fork point that depended on the changed value — re-run for real, with its new output shown." /></Reveal>
          </div>

          <Reveal>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.9375rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--slate)", marginBottom: 14 }}>
            The Command Behind It
          </p>
          </Reveal>
          <Reveal>
          <div style={{ marginBottom: 56 }}>
          <CommandLog />
          </div>
          </Reveal>

          <Reveal>
          <div style={{ marginBottom: 56 }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.9375rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--slate)", marginBottom: 14 }}>
              Side Effects
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
              replay right there. Prefer to do this interactively?{" "}
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 400, fontSize: "0.9em", background: "var(--frost-100)", padding: "0 8px", borderRadius: 6 }}>
                replay explore
              </span>{" "}
              opens a terminal TUI — arrow keys to a ◆ span, Enter to fork it in place.
            </p>
          </div>
          </Reveal>

          <Reveal>
          <div style={{ marginTop: 72, textAlign: "center" }}>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.125rem, 1.9vw, 1.5rem)", fontWeight: 600, color: "var(--ink)" }}>
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
  // Hex colors get the same "1A"-suffixed alpha tint the real-UI components
  // (ReplayDiff/Waterfall badges) already use; the ink default gets a
  // near-invisible neutral tint instead, since "var(--ink)1A" isn't valid CSS.
  const tint = color.startsWith("#") ? `${color}1A` : "rgba(11,14,20,0.05)";
  return (
    <div
      className="callout-lift"
      style={{ borderTop: `2px solid ${color}`, borderRadius: 4, padding: "12px 0 16px", "--callout-tint": tint } as React.CSSProperties}
    >
      <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", letterSpacing: "0.06em", color, marginBottom: 8, fontWeight: color === "var(--ink)" ? 400 : 700 }}>
        {color === "var(--ink)" ? label : label.toUpperCase()}
      </p>
      <p style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", lineHeight: 1.6, color: "var(--slate)" }}>{body}</p>
    </div>
  );
}
