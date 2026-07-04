"use client";

import { useEffect, useState } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import LandingSection  from "./components/LandingSection";
import ProblemSection  from "./components/ProblemSection";
import FeaturesSection from "./components/FeaturesSection";
import WhySection      from "./components/WhySection";
import WaitlistSection from "./components/WaitlistSection";
import Header, { type NavTarget } from "./components/Header";

// ── Scroll timeline ───────────────────────────────────────────────────────
// Every per-page entrance/hold distance is a named, deliberately-chosen
// round number (all multiples of 5 or existing clean values reused from
// elsewhere in this file), and every boundary below is *derived* by summing
// those durations rather than hardcoded — there are no independent magic
// numbers left to drift out of sync with each other.
//
// Distances were bumped ~20% from their previous values and rounded to a
// clean number:
//   Landing hold      43 -> 50   vh  (43*1.2=51.6, rounds to 50)
//   Problem entrance  92 -> 120  vh  (92*1.2=110.4, rounds closer to 120
//                                     than 100, and 120vh already exists
//                                     below as the Features tab-entrance
//                                     length -- reuses an established value)
//   Market Gap entr.  92 -> 120  vh  (same reasoning as Problem)
//   Features entrance 84 -> 100  vh  (84*1.2=100.8, effectively exact)
//   Waitlist entrance 92 -> 120  vh  (same reasoning as Problem)
// Problem/Market Gap's own holds (43vh) and Features' internal tab-scroll
// breakdown (4x24vh hold + 3x120vh entrance = 456vh) were not part of the
// audited "scroll length" list and are left unchanged.
const LANDING_HOLD    = 50;
const PROBLEM_ENTER   = 120;
const PROBLEM_HOLD    = 43;
const MARKETGAP_ENTER = 120;
const MARKETGAP_HOLD  = 43;
const FEATURES_ENTER  = 100;
const FT_LENGTH       = 456; // 4x24vh hold + 3x120vh entrance, unchanged
const WAITLIST_ENTER  = 120;
const WAITLIST_HOLD   = 120;

const PROBLEM_START     = LANDING_HOLD;
const PROBLEM_ARRIVED   = PROBLEM_START + PROBLEM_ENTER;
const MARKETGAP_START   = PROBLEM_ARRIVED + PROBLEM_HOLD;
const MARKETGAP_ARRIVED = MARKETGAP_START + MARKETGAP_ENTER;
const FEATURES_START    = MARKETGAP_ARRIVED + MARKETGAP_HOLD;
const FEATURES_ARRIVED  = FEATURES_START + FEATURES_ENTER;
const FT_END             = FEATURES_ARRIVED + FT_LENGTH;
const WAITLIST_START    = FT_END;
const WAITLIST_ARRIVED  = WAITLIST_START + WAITLIST_ENTER;
const T                  = WAITLIST_ARRIVED + WAITLIST_HOLD; // 1172 vh total
//
//    0 –  50 vh   Landing: display                                   (50 vh)
//   50 – 170 vh   Problem slides in; Landing dims + scales back      (120 vh)
//  170 – 213 vh   Problem: pure display                              (43 vh)
//  213 – 333 vh   Market Gap slides in; Problem dims + scales back   (120 vh)
//  333 – 376 vh   Market Gap: pure display                           (43 vh)
//  376 – 476 vh   Features slides in; Market Gap dims + scales back  (100 vh)
// ── FT range 476–932 vh (456 vh = 4x24vh holds + 3x120vh entrances) ──
//  476 – 500 vh   Tab 1 (Insights): display hold                     (24 vh)
//  500 – 620 vh   Tab 2 (Pressure Tests) enters                     (120 vh)
//  620 – 644 vh   Tab 2: display hold                                (24 vh)
//  644 – 764 vh   Tab 3 (Sandboxes) enters                          (120 vh)
//  764 – 788 vh   Tab 3: display hold                                (24 vh)
//  788 – 908 vh   Tab 4 (Agent) enters                              (120 vh)
//  908 – 932 vh   Tab 4: display hold (the "final one")              (24 vh)
// ─────────────────────────────────────────────────────────────────────────
//  932 – 1052 vh  Waitlist slides in; Features dims + scales back   (120 vh)
// 1052 – 1172 vh  Waitlist: pure display                            (120 vh)

const P_IN  = [PROBLEM_START,    PROBLEM_ARRIVED   ].map(v => v / T) as [number, number];
const MG_IN = [MARKETGAP_START,  MARKETGAP_ARRIVED ].map(v => v / T) as [number, number];
const F_IN  = [FEATURES_START,   FEATURES_ARRIVED  ].map(v => v / T) as [number, number];
const FT    = [FEATURES_ARRIVED, FT_END            ].map(v => v / T) as [number, number];
const W_IN  = [WAITLIST_START,   WAITLIST_ARRIVED  ].map(v => v / T) as [number, number];

// Snap anchor vh positions — no anchors inside the Features range (4th page)
const SNAP_VH = [0, PROBLEM_ARRIVED, MARKETGAP_ARRIVED, WAITLIST_ARRIVED];

// Ease-in-out curve for scroll-linked transforms — linear reads as
// mechanical; smoothstep gives the same "natural" deceleration feel as the
// rest of the page's hand-tuned transitions.
const smoothstep = (t: number) => t * t * (3 - 2 * t);

// ── Stable useTransform range arrays ────────────────────────────────────
// Every input/output range below is a module-level constant, not an inline
// array literal or spread (`[...P_IN]`) built inside the component body --
// good practice regardless, since Home re-renders often during a scroll
// (canvas-pause / section-active state flips), and there's no reason to
// build fresh array objects on every one of those renders.
//
// The opacity ranges specifically are also *widened to span the full [0, 1]
// scrollYProgress domain*, with the edge value repeated at 0 and 1. This
// isn't cosmetic: `useScroll()` with no target makes Framer Motion 12 drive
// these `style={{ opacity: someMotionValue }}` bindings with a native,
// GPU-accelerated CSS ScrollTimeline animation instead of plain JS updates
// (confirmed via `element.getAnimations()` -- each opacity-driven wrapper
// had a `timeline: "ScrollTimeline"` Web Animation attached). That native
// animation's own progress tracks scroll across the *entire* page (0 at the
// top, 1 at the very bottom), but our opacity curves are only defined over
// a short sub-range in the middle (e.g. Market Gap fades out by ~80% of the
// page, not 100%). Past the last breakpoint we supply, the generated
// keyframe animation does not hold the clamped value -- it drifts back
// toward the element's natural CSS default (opacity: 1) as scroll
// approaches the bottom of the page. This was fully confirmed: `.get()` on
// the underlying MotionValue read exactly 0 at 1000vh, while the actual
// rendered opacity (and a live-inspected `getAnimations()` keyframe
// progress) showed it climbing back toward 1 -- which is exactly what made
// Market Gap (and Problem) visibly bleed through during the Features→
// Waitlist transition. Supplying explicit breakpoints at 0 and 1 (holding
// the same value as the nearest real breakpoint) removes the gap the native
// converter was filling in with a drift back to default.
const LANDING_OP_IN      = [0, P_IN[0], P_IN[1], MG_IN[1], 1] as [number, number, number, number, number];
const LANDING_OP_OUT     = [1, 1, 0.55, 0, 0] as [number, number, number, number, number];
const LANDING_OP_OUT_RM  = [1, 1, 0, 0, 0] as [number, number, number, number, number];

const SCALE_OUT    = [1, 0.93] as [number, number];
const SCALE_OUT_RM = [1, 1] as [number, number];
const RAD_OUT      = [0, 16] as [number, number];
const RAD_OUT_RM   = [0, 0] as [number, number];
const Y_OUT        = ["100%", "0%"] as [string, string];
const Y_OUT_RM     = ["0%", "0%"] as [string, string];

const PROBLEM_OP_IN     = [0, P_IN[0], P_IN[1], MG_IN[0], MG_IN[1], F_IN[1], 1] as [number, number, number, number, number, number, number];
const PROBLEM_OP_OUT    = [1, 1, 1, 1, 0.55, 0, 0] as [number, number, number, number, number, number, number];
const PROBLEM_OP_OUT_RM = [0, 0, 1, 1, 0, 0, 0] as [number, number, number, number, number, number, number];

const MARKETGAP_OP_IN     = [0, MG_IN[0], MG_IN[1], F_IN[0], F_IN[1], WAITLIST_START / T, 1] as [number, number, number, number, number, number, number];
const MARKETGAP_OP_OUT    = [1, 1, 1, 1, 0.55, 0, 0] as [number, number, number, number, number, number, number];
const MARKETGAP_OP_OUT_RM = [0, 0, 1, 1, 0, 0, 0] as [number, number, number, number, number, number, number];

const FEATURES_OP_IN     = [0, F_IN[0], F_IN[1], W_IN[0], W_IN[1], 1] as [number, number, number, number, number, number];
const FEATURES_OP_OUT    = [1, 1, 1, 1, 0, 0] as [number, number, number, number, number, number];
const FEATURES_OP_OUT_RM = [0, 0, 1, 1, 0, 0] as [number, number, number, number, number, number];

const WAITLIST_OP_IN     = [0, W_IN[0], W_IN[1], 1] as [number, number, number, number];
const WAITLIST_OP_OUT    = [1, 1, 1, 1] as [number, number, number, number];
const WAITLIST_OP_OUT_RM = [0, 0, 1, 1] as [number, number, number, number];

const FEATTAB_OUT       = [0, 1] as [number, number];
const HEADER_OP_IN      = [0, P_IN[0], P_IN[1], 1] as [number, number, number, number];
const HEADER_OP_OUT     = [0, 0, 1, 1] as [number, number, number, number];
const HEADER_OP_OPTIONS = { ease: [smoothstep] };

export default function Home() {
  const { scrollYProgress } = useScroll();
  const rm = useReducedMotion() ?? false;

  // ── Landing ── stays pinned, dims while Problem covers it, then fades the
  // rest of the way to fully hidden by the time Market Gap has arrived —
  // previously floored at 0.55 forever, which left a legible ghost that
  // collided with every section stacked on top of it from then on.
  const landingOp    = useTransform(scrollYProgress, LANDING_OP_IN, rm ? LANDING_OP_OUT_RM : LANDING_OP_OUT);
  const landingScale = useTransform(scrollYProgress, P_IN, rm ? SCALE_OUT_RM : SCALE_OUT);
  const landingRad   = useTransform(scrollYProgress, P_IN, rm ? RAD_OUT_RM   : RAD_OUT);

  // ── Problem ── enters from below, dims while Market Gap covers it, then
  // fades fully out by the time Features has arrived (same fix as Landing).
  const problemY     = useTransform(scrollYProgress, P_IN, rm ? Y_OUT_RM : Y_OUT);
  const problemOp    = useTransform(scrollYProgress, PROBLEM_OP_IN, rm ? PROBLEM_OP_OUT_RM : PROBLEM_OP_OUT);
  const problemScale = useTransform(scrollYProgress, MG_IN, rm ? SCALE_OUT_RM : SCALE_OUT);
  const problemRad   = useTransform(scrollYProgress, MG_IN, rm ? RAD_OUT_RM   : RAD_OUT);

  // ── Market Gap (Why) ── enters from below, dims while Features covers it,
  // then fades fully out by the time Features itself finishes its hold/tab
  // range (WAITLIST_START) -- NOT by Waitlist's arrival. Features' own
  // opacity drops from 1 straight to 0 across W_IN (no 0.55 floor, since
  // that floor was removed earlier to stop Features' tab slivers bleeding
  // through Waitlist) -- so if Market Gap were still fading during that same
  // W_IN window, it would show through Features as Features itself became
  // transparent. Landing/Problem don't have this problem because the layer
  // directly covering them (Problem/Market Gap) never drops below its own
  // 0.55 floor during their equivalent overlap window.
  const marketGapY     = useTransform(scrollYProgress, MG_IN, rm ? Y_OUT_RM : Y_OUT);
  const marketGapOp    = useTransform(scrollYProgress, MARKETGAP_OP_IN, rm ? MARKETGAP_OP_OUT_RM : MARKETGAP_OP_OUT);
  const marketGapScale = useTransform(scrollYProgress, F_IN, rm ? SCALE_OUT_RM : SCALE_OUT);
  const marketGapRad   = useTransform(scrollYProgress, F_IN, rm ? RAD_OUT_RM   : RAD_OUT);

  // ── Features ── enters from below, fades fully out (not floored at 0.55)
  // once Waitlist has fully arrived — this is also what was bleeding the
  // colored tab slivers through behind Waitlist at the tail end of the page.
  const featuresY     = useTransform(scrollYProgress, F_IN, rm ? Y_OUT_RM : Y_OUT);
  const featuresOp    = useTransform(scrollYProgress, FEATURES_OP_IN, rm ? FEATURES_OP_OUT_RM : FEATURES_OP_OUT);
  const featuresScale = useTransform(scrollYProgress, W_IN, rm ? SCALE_OUT_RM : SCALE_OUT);
  const featuresRad   = useTransform(scrollYProgress, W_IN, rm ? RAD_OUT_RM   : RAD_OUT);

  // ── Waitlist ── enters from below, never exits
  const waitlistY  = useTransform(scrollYProgress, W_IN, rm ? Y_OUT_RM : Y_OUT);
  const waitlistOp = useTransform(scrollYProgress, WAITLIST_OP_IN, rm ? WAITLIST_OP_OUT_RM : WAITLIST_OP_OUT);

  // ── Canvas pause states ──────────────────────────────────────────────────
  const [lpPaused, setLpPaused] = useState(false);
  const [ppPaused, setPpPaused] = useState(true);
  const [mpPaused, setMpPaused] = useState(true);
  const [wpPaused, setWpPaused] = useState(true);
  useEffect(() => {
    return scrollYProgress.on("change", v => {
      setLpPaused(v > (PROBLEM_ARRIVED + 25) / T);      // 25vh into Problem's hold
      setPpPaused(v < (PROBLEM_START - 10) / T || v > (MARKETGAP_ARRIVED + 30) / T); // 10vh head-start; 30vh into Market Gap's hold
      setMpPaused(v < MG_IN[0] || v > (FEATURES_ARRIVED + 50) / T);                  // 50vh past Features fully arriving
      setWpPaused(v < (WAITLIST_START - 30) / T);        // 30vh head-start before Waitlist's entrance
    });
  }, [scrollYProgress]);

  // ── Section entrance animation triggers ─────────────────────────────────
  const [problemActive,   setProblemActive]   = useState(false);
  const [marketGapActive, setMarketGapActive] = useState(false);
  const [featuresActive,  setFeaturesActive]  = useState(false);
  const [waitlistActive,  setWaitlistActive]  = useState(false);
  const [landingForceResolved, setLandingForceResolved] = useState(false);
  // Same fix as Landing's headline: Market Gap's comparison table and
  // Waitlist's headline/eyebrow are gated behind fixed-duration reveal
  // timers (1.1s / 1.2s) started when each section becomes active, fully
  // decoupled from scroll speed. A fast scroll through either section's
  // entrance + hold window can outrun the timer, leaving real content at
  // opacity 0. Force each section's reveal once scroll has carried it to
  // its own "fully arrived" position — the same milestone that already
  // governs its positional transform (marketGapY/waitlistY reaching 0%).
  const [marketGapForceResolved, setMarketGapForceResolved] = useState(false);
  const [waitlistForceResolved,  setWaitlistForceResolved]  = useState(false);
  useEffect(() => {
    return scrollYProgress.on("change", v => {
      if (v >= P_IN[0])  setProblemActive(true);
      if (v >= MG_IN[0]) setMarketGapActive(true);
      if (v >= F_IN[0])  setFeaturesActive(true);
      if (v >= W_IN[0])  setWaitlistActive(true);
      if (v > 5 / T)     setLandingForceResolved(true);
      if (v >= MG_IN[1]) setMarketGapForceResolved(true);
      if (v >= W_IN[1])  setWaitlistForceResolved(true);
    });
  }, [scrollYProgress]);

  // ── Features internal tab progress (0–1 across the 360 vh tab range) ────
  const featTabMV = useTransform(scrollYProgress, FT, FEATTAB_OUT);
  const [tabProgress, setTabProgress] = useState(0);
  useEffect(() => {
    return featTabMV.on("change", v =>
      setTabProgress(Math.max(0, Math.min(1, v)))
    );
  }, [featTabMV]);

  // ── Header opacity — transparent on first paint (full hero visible),
  // solidifies across the Landing→Problem crossfade (P_IN), fully opaque by
  // the moment Problem finishes arriving. Kept as a MotionValue (not React
  // state) so it updates on the same render-free scroll tick as every other
  // transform on this page — state-driven updates lag a frame behind and
  // read as a stepped, artificial fade next to everything else.
  const headerOpacityMV = useTransform(scrollYProgress, HEADER_OP_IN, HEADER_OP_OUT, HEADER_OP_OPTIONS);

  // Header nav: scroll to the fully-arrived position of each section.
  // The scrollable distance is `document height - one viewport`, not the
  // raw document height -- scaling by `vh * innerHeight / 100` ignores that
  // and overshoots every target by a growing margin the further down the
  // page it is (confirmed: ~9% overshoot at every link, proportional to
  // distance). scrollYProgress (which every other position on this page is
  // derived from) is defined as scrollY / (scrollHeight - innerHeight), so
  // the nav targets need to match that same normalization.
  const handleNavigate = (target: NavTarget) => {
    const arrivedVh: Record<NavTarget, number> = {
      landing:  0,
      problem:  PROBLEM_ARRIVED,
      why:      MARKETGAP_ARRIVED,
      features: FEATURES_ARRIVED,
      waitlist: WAITLIST_ARRIVED,
    };
    const max = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({ top: (arrivedVh[target] / T) * max, behavior: "smooth" });
  };

  return (
    <div style={{ height: `${T}vh`, position: "relative" }}> {/* 1172 vh */}
      {/* ── Snap anchors — Landing, Problem, Market Gap, Waitlist only ───
          `top` is NOT a raw `${vh}vh` -- that positions the anchor using
          the container's full height as the basis, but the scroll-snap
          engine (and window.scrollTo) work in terms of *scrollable*
          distance, which is one viewport shorter (scrollHeight - innerHeight,
          the same basis scrollYProgress itself uses). Left as raw vh, each
          anchor sat further down than the scrollYProgress fraction it was
          meant to mark, and `scroll-snap-type: y proximity` (globals.css)
          would pull nav-link clicks toward that wrong position -- confirmed
          via Playwright: clicking "Problem" landed ~9% past PROBLEM_ARRIVED
          every time. This converts each vh label to the same fraction of
          scrollable distance that scrollYProgress uses everywhere else. */}
      {SNAP_VH.map(vh => (
        <div
          key={vh}
          aria-hidden="true"
          style={{
            position: "absolute",
            top: `${(vh * (T - 100)) / T}vh`,
            left: 0,
            width: 1,
            height: 1,
            scrollSnapAlign: "start",
            pointerEvents: "none",
          }}
        />
      ))}

      {/* ── Header — floats above all pages ──────────────────────────── */}
      <Header onNavigate={handleNavigate} opacity={headerOpacityMV} />

      <div style={{ position: "fixed", inset: 0, overflow: "hidden" }}>

        {/* ── Landing — z 1 ──────────────────────────────────────────── */}
        <motion.div
          style={{
            position: "absolute", inset: 0, zIndex: 1,
            opacity:      landingOp,
            scale:        landingScale,
            borderRadius: landingRad,
            originX: 0.5, originY: 0.5,
          }}
        >
          <LandingSection canvasPaused={lpPaused} forceResolved={landingForceResolved} />
        </motion.div>

        {/* ── Problem — z 2 ──────────────────────────────────────────── */}
        <motion.div
          style={{
            position: "absolute", inset: 0, zIndex: 2,
            y:            problemY,
            opacity:      problemOp,
            scale:        problemScale,
            borderRadius: problemRad,
            originX: 0.5, originY: 0.5,
          }}
        >
          <ProblemSection canvasPaused={ppPaused} isActive={problemActive} />
        </motion.div>

        {/* ── Market Gap (Why) — z 3 ─────────────────────────────────── */}
        <motion.div
          style={{
            position: "absolute", inset: 0, zIndex: 3,
            y:            marketGapY,
            opacity:      marketGapOp,
            scale:        marketGapScale,
            borderRadius: marketGapRad,
            originX: 0.5, originY: 0.5,
          }}
        >
          <WhySection canvasPaused={mpPaused} isActive={marketGapActive} forceResolved={marketGapForceResolved} />
        </motion.div>

        {/* ── Features — z 4 ─────────────────────────────────────────── */}
        <motion.div
          style={{
            position: "absolute", inset: 0, zIndex: 4,
            y:            featuresY,
            opacity:      featuresOp,
            scale:        featuresScale,
            borderRadius: featuresRad,
            originX: 0.5, originY: 0.5,
          }}
        >
          <FeaturesSection tabScrollProgress={tabProgress} isActive={featuresActive} />
        </motion.div>

        {/* ── Waitlist — z 5 ─────────────────────────────────────────── */}
        <motion.div
          style={{
            position: "absolute", inset: 0, zIndex: 5,
            y:       waitlistY,
            opacity: waitlistOp,
          }}
        >
          <WaitlistSection isActive={waitlistActive} canvasPaused={wpPaused} forceResolved={waitlistForceResolved} />
        </motion.div>

      </div>
    </div>
  );
}
