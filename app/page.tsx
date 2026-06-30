"use client";

import { useEffect, useState } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import LandingSection  from "./components/LandingSection";
import ProblemSection  from "./components/ProblemSection";
import FeaturesSection from "./components/FeaturesSection";
import WhySection      from "./components/WhySection";
import WaitlistSection from "./components/WaitlistSection";
import Header          from "./components/Header";

// ── Scroll timeline (total = 1065 vh) ────────────────────────────────────
//
//   0 –  43 vh   Landing: display                                   (43 vh)
//  43 – 135 vh   Problem slides in; Landing dims + scales back      (92 vh)
// 135 – 178 vh   Problem: pure display                              (43 vh)
// 178 – 270 vh   Market Gap slides in; Problem dims + scales back   (92 vh)
// 270 – 313 vh   Market Gap: pure display                           (43 vh)
// 313 – 397 vh   Features slides in; Market Gap dims + scales back  (84 vh)
// ── FT range 397–853 vh (456 vh = 4×24 vh holds + 3×120 vh entrances) ──
// 397 – 421 vh   Tab 1 (Insights): display hold                     (24 vh)
// 421 – 541 vh   Tab 2 (Pressure Tests) enters                     (120 vh)
// 541 – 565 vh   Tab 2: display hold                                (24 vh)
// 565 – 685 vh   Tab 3 (Sandboxes) enters                          (120 vh)
// 685 – 709 vh   Tab 3: display hold                                (24 vh)
// 709 – 829 vh   Tab 4 (Agent) enters                              (120 vh)
// 829 – 853 vh   Tab 4: display hold (the "final one")              (24 vh)
// ─────────────────────────────────────────────────────────────────────────
// 853 – 945 vh   Waitlist slides in; Features dims + scales back    (92 vh)
// 945 – 1065 vh  Waitlist: pure display                            (120 vh)

const T     = 1065;
const P_IN  = [ 43/T,  135/T] as const; // Problem entrance        (92 vh)
const MG_IN = [178/T,  270/T] as const; // Market Gap entrance     (92 vh)
const F_IN  = [313/T,  397/T] as const; // Features entrance       (84 vh)
const FT    = [397/T,  853/T] as const; // Features tab-scroll (4×24+3×120=456 vh)
const W_IN  = [853/T,  945/T] as const; // Waitlist entrance       (92 vh)

// Snap anchor vh positions — no anchors inside the Features range (4th page)
const SNAP_VH = [0, 135, 270, 945];

export default function Home() {
  const { scrollYProgress } = useScroll();
  const rm = useReducedMotion() ?? false;

  // ── Landing ── stays pinned, dims while Problem covers it
  const landingOp    = useTransform(scrollYProgress, [...P_IN], rm ? [1, 0]        : [1, 0.55]);
  const landingScale = useTransform(scrollYProgress, [...P_IN], rm ? [1, 1]        : [1, 0.93]);
  const landingRad   = useTransform(scrollYProgress, [...P_IN], rm ? [0, 0]        : [0, 16]);

  // ── Problem ── enters from below, dims while Market Gap covers it
  const problemY     = useTransform(scrollYProgress, [...P_IN],
    rm ? ["0%", "0%"] : ["100%", "0%"]);
  const problemOp    = useTransform(
    scrollYProgress,
    [P_IN[0], P_IN[1], MG_IN[0], MG_IN[1]],
    rm ? [0, 1, 1, 0] : [1, 1, 1, 0.55],
  );
  const problemScale = useTransform(scrollYProgress, [...MG_IN], rm ? [1, 1]       : [1, 0.93]);
  const problemRad   = useTransform(scrollYProgress, [...MG_IN], rm ? [0, 0]       : [0, 16]);

  // ── Market Gap (Why) ── enters from below, dims while Features covers it
  const marketGapY     = useTransform(scrollYProgress, [...MG_IN],
    rm ? ["0%", "0%"] : ["100%", "0%"]);
  const marketGapOp    = useTransform(
    scrollYProgress,
    [MG_IN[0], MG_IN[1], F_IN[0], F_IN[1]],
    rm ? [0, 1, 1, 0] : [1, 1, 1, 0.55],
  );
  const marketGapScale = useTransform(scrollYProgress, [...F_IN], rm ? [1, 1]      : [1, 0.93]);
  const marketGapRad   = useTransform(scrollYProgress, [...F_IN], rm ? [0, 0]      : [0, 16]);

  // ── Features ── enters from below, dims while Waitlist covers it
  const featuresY     = useTransform(scrollYProgress, [...F_IN],
    rm ? ["0%", "0%"] : ["100%", "0%"]);
  const featuresOp    = useTransform(
    scrollYProgress,
    [F_IN[0], F_IN[1], W_IN[0], W_IN[1]],
    rm ? [0, 1, 1, 0] : [1, 1, 1, 0.55],
  );
  const featuresScale = useTransform(scrollYProgress, [...W_IN], rm ? [1, 1]       : [1, 0.93]);
  const featuresRad   = useTransform(scrollYProgress, [...W_IN], rm ? [0, 0]       : [0, 16]);

  // ── Waitlist ── enters from below, never exits
  const waitlistY  = useTransform(scrollYProgress, [...W_IN],
    rm ? ["0%", "0%"] : ["100%", "0%"]);
  const waitlistOp = useTransform(scrollYProgress, [...W_IN], rm ? [0, 1]          : [1, 1]);

  // ── Canvas pause states ──────────────────────────────────────────────────
  const [lpPaused, setLpPaused] = useState(false);
  const [ppPaused, setPpPaused] = useState(true);
  const [mpPaused, setMpPaused] = useState(true);
  const [fpPaused, setFpPaused] = useState(true);
  const [wpPaused, setWpPaused] = useState(true);
  useEffect(() => {
    return scrollYProgress.on("change", v => {
      setLpPaused(v > 160/T);
      setPpPaused(v < 30/T || v > 300/T);
      setMpPaused(v < MG_IN[0] || v > F_IN[1] + 50/T);
      setFpPaused(v < F_IN[0] || v > W_IN[0]);
      setWpPaused(v < W_IN[0] - 0.03);
    });
  }, [scrollYProgress]);

  // ── Section entrance animation triggers ─────────────────────────────────
  const [problemActive,   setProblemActive]   = useState(false);
  const [marketGapActive, setMarketGapActive] = useState(false);
  const [featuresActive,  setFeaturesActive]  = useState(false);
  const [waitlistActive,  setWaitlistActive]  = useState(false);
  useEffect(() => {
    return scrollYProgress.on("change", v => {
      if (v >= P_IN[0])  setProblemActive(true);
      if (v >= MG_IN[0]) setMarketGapActive(true);
      if (v >= F_IN[0])  setFeaturesActive(true);
      if (v >= W_IN[0])  setWaitlistActive(true);
    });
  }, [scrollYProgress]);

  // ── Features internal tab progress (0–1 across the 360 vh tab range) ────
  const featTabMV = useTransform(scrollYProgress, [...FT], [0, 1]);
  const [tabProgress, setTabProgress] = useState(0);
  useEffect(() => {
    return featTabMV.on("change", v =>
      setTabProgress(Math.max(0, Math.min(1, v)))
    );
  }, [featTabMV]);

  // Header nav: scroll to the fully-arrived position of each section
  const handleNavigate = (target: "features" | "waitlist") => {
    const vh = window.innerHeight;
    if (target === "features") window.scrollTo({ top: vh * 3.97, behavior: "smooth" }); // 397 vh
    if (target === "waitlist") window.scrollTo({ top: vh * 9.45, behavior: "smooth" }); // 945 vh
  };

  return (
    <div style={{ height: `${T}vh`, position: "relative" }}> {/* 1065 vh */}
      {/* ── Snap anchors — Landing, Problem, Market Gap, Waitlist only ─── */}
      {SNAP_VH.map(vh => (
        <div
          key={vh}
          aria-hidden="true"
          style={{
            position: "absolute",
            top: `${vh}vh`,
            left: 0,
            width: 1,
            height: 1,
            scrollSnapAlign: "start",
            pointerEvents: "none",
          }}
        />
      ))}

      {/* ── Header — floats above all pages ──────────────────────────── */}
      <Header onNavigate={handleNavigate} />

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
          <LandingSection canvasPaused={lpPaused} />
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
          <WhySection canvasPaused={mpPaused} isActive={marketGapActive} />
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
          <FeaturesSection tabScrollProgress={tabProgress} canvasPaused={fpPaused} isActive={featuresActive} />
        </motion.div>

        {/* ── Waitlist — z 5 ─────────────────────────────────────────── */}
        <motion.div
          style={{
            position: "absolute", inset: 0, zIndex: 5,
            y:       waitlistY,
            opacity: waitlistOp,
          }}
        >
          <WaitlistSection isActive={waitlistActive} canvasPaused={wpPaused} />
        </motion.div>

      </div>
    </div>
  );
}
