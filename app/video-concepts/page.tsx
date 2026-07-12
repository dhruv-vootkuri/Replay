import Link from "next/link";
import Header from "@/app/components/Header";
import ReplayDiff from "@/app/components/product/ReplayDiff";
import AtmosphericVideo from "./AtmosphericVideo";

// Spin-off concept page — NOT linked from nav, NOT part of the (marketing)
// route group, touches zero existing files. Shows four placement options
// for a real arctic-pan video against the actual site chrome/tokens, using
// public/hero-bg.mp4 as a stand-in clip until a real one is dropped in.
// Delete this whole app/video-concepts/ directory once you've picked one.

function OptionLabel({ n, title, verdict, body }: { n: string; title: string; verdict: "recommended" | "caution" | "neutral"; body: string }) {
  const color = verdict === "recommended" ? "#2E6E96" : verdict === "caution" ? "#B45309" : "#48505C";
  return (
    <div style={{ maxWidth: 720, margin: "0 auto 24px", padding: "0 24px" }}>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.6875rem", letterSpacing: "0.2em", textTransform: "uppercase", color, marginBottom: 8 }}>
        {n} — {verdict === "recommended" ? "recommended" : verdict === "caution" ? "use with caution" : "situational"}
      </p>
      <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>
        {title}
      </h2>
      <p style={{ fontFamily: "var(--font-body)", fontSize: "0.9375rem", lineHeight: 1.6, color: "var(--slate)" }}>{body}</p>
    </div>
  );
}

export default function VideoConceptsPage() {
  return (
    <>
      <Header />

      <section style={{ padding: "160px 24px 40px", maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.6875rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--slate-dim)", marginBottom: 12 }}>
          Internal concept page — not linked anywhere
        </p>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.75rem", fontWeight: 700, color: "var(--ink)", marginBottom: 12 }}>
          Four placements for the arctic pan video
        </h1>
        <p style={{ fontFamily: "var(--font-body)", fontSize: "0.9375rem", lineHeight: 1.6, color: "var(--slate)" }}>
          Playing <code style={{ background: "var(--frost-100)", padding: "1px 6px", borderRadius: 4 }}>public/hero-bg.mp4</code> as
          a stand-in — drop your real ice-cap clip at that path (or edit the <code style={{ background: "var(--frost-100)", padding: "1px 6px", borderRadius: 4 }}>src</code> in
          <code style={{ background: "var(--frost-100)", padding: "1px 6px", borderRadius: 4, marginLeft: 4 }}>AtmosphericVideo.tsx</code>) to see the real thing.
        </p>
      </section>

      {/* ─── Option A ─────────────────────────────────────────────── */}
      <OptionLabel
        n="Option A"
        verdict="recommended"
        title="Faint atmosphere behind the KPI strip"
        body="Heavily desaturated, ~15% opacity, sits behind the real stat numbers instead of the flat icy background. Reads as texture, not footage — text stays fully legible, nothing competes with the numbers."
      />
      <section style={{ position: "relative", borderTop: "1px solid var(--hairline)", borderBottom: "1px solid var(--hairline)", padding: "36px 24px", overflow: "hidden" }}>
        <AtmosphericVideo
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "grayscale(1) brightness(1.25) contrast(0.85)",
            opacity: 0.16,
          }}
        />
        <div style={{ position: "relative", zIndex: 1, maxWidth: 1240, margin: "0 auto", display: "flex", flexWrap: "wrap", gap: "28px 48px", justifyContent: "space-between" }}>
          {[
            ["Traces", "7"],
            ["LLM calls", "20"],
            ["Tool calls", "13"],
            ["Spans", "80"],
            ["Avg duration", "4.7s"],
          ].map(([label, value]) => (
            <div key={label}>
              <div className="tabular-nums" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.5rem, 3vw, 2.25rem)", fontWeight: 700, color: "var(--ink)" }}>
                {value}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.6875rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--slate-dim)", marginTop: 4 }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Option B ─────────────────────────────────────────────── */}
      <OptionLabel
        n="Option B"
        verdict="caution"
        title="Full-bleed hero background"
        body="Full color, full-bleed, behind the headline — the classic 'cinematic hero' pattern (this is close to what BEST_hero.mp4 did in an earlier version of this site). Visually the boldest option, but it's also the one that risks undoing the 'real product UI as hero, not decorative footage' fix from a couple of iterations ago. If you want this, I'd suggest it replaces the ReplayDiff hero rather than sitting alongside it — running both at once is a lot."
      />
      <section style={{ position: "relative", height: 420, overflow: "hidden" }}>
        <AtmosphericVideo style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to right, rgba(247,250,253,0.92) 0%, rgba(247,250,253,0.55) 45%, rgba(247,250,253,0.1) 100%)",
          }}
        />
        <div style={{ position: "relative", zIndex: 1, height: "100%", display: "flex", alignItems: "center", padding: "0 48px" }}>
          <div style={{ maxWidth: 480 }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--ink)", marginBottom: 16 }}>
              Replay diff
            </p>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.75rem, 4vw, 2.75rem)", fontWeight: 700, lineHeight: 1.08, color: "var(--ink)" }}>
              Change one input mid-trace.
            </h3>
          </div>
        </div>
      </section>

      {/* ─── Option C ─────────────────────────────────────────────── */}
      <OptionLabel
        n="Option C"
        verdict="neutral"
        title="Framed panel, same chrome as the real UI panels"
        body="Instead of atmosphere or a hero backdrop, the clip sits in a bordered frost-panel window — same visual language as the Waterfall/ReplayDiff/LogStream components. Treats the footage as one more piece of real content next to the product UI rather than decoration behind it."
      />
      <section style={{ padding: "20px 24px 60px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div className="frost-panel" style={{ borderRadius: 12, padding: 12 }}>
            <div style={{ position: "relative", aspectRatio: "4 / 3", overflow: "hidden", borderRadius: 6 }}>
              <AtmosphericVideo style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <p style={{ marginTop: 10, fontFamily: "var(--font-mono)", fontSize: "0.6875rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--slate-dim)" }}>
              Field capture — polar sink
            </p>
          </div>
          <div style={{ overflow: "hidden" }}>
            <ReplayDiff compact />
          </div>
        </div>
      </section>

      {/* ─── Option D ─────────────────────────────────────────────── */}
      <OptionLabel
        n="Option D"
        verdict="recommended"
        title="/waitlist closing bookend"
        body="Calm, muted, slow — plays low-opacity behind the final CTA as a closing moment rather than an opening statement. 'The ice settles' after the product tour, not before it. Pairs well with Option A if you want the motif to appear twice without it dominating either time."
      />
      <section style={{ position: "relative", padding: "80px 24px", textAlign: "center", overflow: "hidden" }}>
        <AtmosphericVideo
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "grayscale(1) brightness(1.3) contrast(0.85)",
            opacity: 0.12,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(ellipse 70% 60% at 50% 50%, transparent 0%, var(--arctic-bg) 85%)",
          }}
        />
        <div style={{ position: "relative", zIndex: 1 }}>
          <p style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.25rem, 2vw, 1.75rem)", fontWeight: 600, color: "var(--ink)", marginBottom: 20 }}>
            Early access is open for teams building agentic workflows.
          </p>
          <Link
            href="/waitlist"
            className="frost-halo"
            style={{ display: "inline-flex", padding: "13px 28px", background: "var(--ink)", color: "var(--arctic-bg)", borderRadius: 999, fontFamily: "var(--font-body)", fontSize: "0.9375rem", fontWeight: 500, textDecoration: "none" }}
          >
            Join the waitlist →
          </Link>
        </div>
      </section>

      <section style={{ padding: "40px 24px 100px", maxWidth: 720, margin: "0 auto" }}>
        <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: 20 }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--slate-dim)", marginBottom: 8 }}>
            Notes
          </p>
          <ul style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", lineHeight: 1.7, color: "var(--slate)", paddingLeft: 20 }}>
            <li>All four use <code style={{ background: "var(--frost-100)", padding: "1px 6px", borderRadius: 4 }}>AtmosphericVideo</code>, which swaps to a static gradient under <code style={{ background: "var(--frost-100)", padding: "1px 6px", borderRadius: 4 }}>prefers-reduced-motion</code> — copy that pattern wherever this lands for real.</li>
            <li>Compress whatever real footage you use — panning ice-cap 4K source footage will be large; aim well under 3MB for a background loop, similar to the existing <code style={{ background: "var(--frost-100)", padding: "1px 6px", borderRadius: 4 }}>hero-bg.mp4</code>.</li>
            <li>This whole <code style={{ background: "var(--frost-100)", padding: "1px 6px", borderRadius: 4 }}>app/video-concepts/</code> directory is disposable — nothing else imports from it.</li>
          </ul>
        </div>
      </section>
    </>
  );
}
