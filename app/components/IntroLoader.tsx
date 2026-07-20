"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

const SEEN_KEY = "floe-intro-seen";

const INK = "#0B0E14";
const F_FLASH_COLOR = "#4781bc";
const LOE_FLASH_COLOR = "#99bcda";

// ── Motion tokens — one source of truth so entry/impact/part share a
// consistent rhythm (ui-ux-pro-max: motion-consistency). The letter
// convergence uses a spring rather than a cubic-bezier (spring-physics:
// prefer physics-based curves for anything meant to feel like real
// motion — two objects pulled together into a collision reads as
// physical, not a UI reveal).
// Stiffness/damping scaled down from an earlier {130, 19} to slow the
// convergence itself by ~15% (not just the ending — see below) while
// preserving the same damping ratio (for a spring, settle time scales
// with stiffness/k^2 and damping/k for a k-times-slower feel without
// changing how bouncy it looks): 130/1.15^2 ≈ 98 and 19/1.15 ≈ 16.5,
// each rounded to a nearby round number.
const CONVERGE_SPRING = { type: "spring" as const, stiffness: 100, damping: 17, mass: 1 };
// 0.93 ≈ 0.805 * 1.15, rounded to a nice number — a second ~15%
// slowdown stacked on the ending's earlier 0.7 -> 0.805 bump (see
// design history in CLAUDE.md), this time requested for the whole
// sequence rather than just the parting leg, and rounded instead of
// kept as an exact multiple per explicit direction ("until the first
// nice number").
const PART_TRANSITION = { duration: 0.93, ease: [0.65, 0, 0.35, 1] as const }; // expo-style ease-in-out
const IMPACT_DELAY_MS = 550; // 480 * 1.15 = 552, rounded to 550 — matches the slowed spring's new settle point, the "knock"

// ── Color pulse — a single continuous black->color->black motion
// centered on the knock: it starts fading in before the letters
// collide, reaches full color right around the knock, holds there for
// only a brief pause, then fades back out. The fade-out leg
// (FLASH_RAMP_OUT_MS) is deliberately longer than the fade-in leg
// (FLASH_RAMP_IN_MS) — not symmetric — so the color is still visibly
// draining away while the letters are moving out, rather than finishing
// beforehand.
// Each ~15% slower than its prior value (250/400) and rounded to a nice
// number: 250*1.15=287.5 -> 290, 400*1.15=460 (already round).
const FLASH_RAMP_IN_MS = 290;
const FLASH_RAMP_OUT_MS = 460;
// The hold at peak was a single symmetric FLASH_HOLD_MS (140, i.e. 70ms
// each side of the knock) until this pair replaced it: the "before" half
// (peak color reached -> knock) stays at the original 70, but the
// "after" half (knock -> fade-out starts, i.e. when the letters are
// moving away) is now its own ~15%-later value — 70 * 1.15 = 80.5,
// rounded to 80 — per explicit direction that the color fade specifically
// during the parting motion should start later, without also delaying
// when full color is first reached (which the old symmetric HOLD_MS
// would have done as a side effect).
const FLASH_HOLD_BEFORE_MS = 70;
const FLASH_HOLD_AFTER_MS = 80;
const FLASH_START_MS = IMPACT_DELAY_MS - FLASH_RAMP_IN_MS - FLASH_HOLD_BEFORE_MS; // 190 — fade-in begins
const FLASH_PEAK_START_MS = IMPACT_DELAY_MS - FLASH_HOLD_BEFORE_MS; // 480 — full color reached
const FLASH_PEAK_END_MS = IMPACT_DELAY_MS + FLASH_HOLD_AFTER_MS; // 630 — pause ends, fade-out begins
const FLASH_END_MS = IMPACT_DELAY_MS + FLASH_RAMP_OUT_MS + FLASH_HOLD_AFTER_MS; // 1090 — back to black
const FLASH_KEYFRAME_TIMES = [
  0,
  (FLASH_PEAK_START_MS - FLASH_START_MS) / (FLASH_END_MS - FLASH_START_MS),
  (FLASH_PEAK_END_MS - FLASH_START_MS) / (FLASH_END_MS - FLASH_START_MS),
  1,
];
// Played once as a fixed keyframe sequence (delay + duration + times)
// rather than toggled via state — a constant keyframe target that never
// changes value across re-renders is exactly the case where Framer
// Motion's keyframe arrays are reliable (see CLAUDE.md for the contrast
// with the earlier, state-toggled version that this replaced).
const F_COLOR_TRANSITION = { delay: FLASH_START_MS / 1000, duration: (FLASH_END_MS - FLASH_START_MS) / 1000, times: FLASH_KEYFRAME_TIMES, ease: "easeInOut" as const };
const LOE_COLOR_TRANSITION = F_COLOR_TRANSITION;
const F_COLOR_KEYFRAMES = [INK, F_FLASH_COLOR, F_FLASH_COLOR, INK];
const LOE_COLOR_KEYFRAMES = [INK, LOE_FLASH_COLOR, LOE_FLASH_COLOR, INK];

// Parting starts shortly after the hold ends — deliberately *before*
// FLASH_END_MS, so the longer fade-out overlaps with the letters moving
// out instead of finishing beforehand. The +60 buffer (was +50, scaled
// ~15% and rounded along with everything else) is just a small gap
// after the hold, not part of the flash timeline itself.
const PART_DELAY_MS = FLASH_PEAK_END_MS + 60;
const PART_DURATION_MS = PART_TRANSITION.duration * 1000;

type Phase = "cover" | "playing" | "parting" | "gone";

const letterBaseStyle: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: 700,
  fontSize: "clamp(3rem, 11vw, 7.5rem)",
  letterSpacing: "-0.01em",
  display: "inline-block",
};

// One-time splash played the first time a visitor lands on / this
// session — "F" and "loe" spring in from opposite edges of the screen
// and meet in the center, tinting from black to a color and back in one
// continuous motion timed around the collision. The letters keep moving
// on across the screen past center while the background fades out
// underneath them, revealing the real page. No particle/shard burst and
// no curtain of solid panels (both tried and removed — see CLAUDE.md's
// design-history note); don't reintroduce either without a fresh
// explicit ask.
//
// Phase machine: "cover" (SSR + the instant before the mount effect
// decides anything — a plain, deterministic solid-color cover, so
// there's no flash of the real page underneath while JS is still
// booting) -> "playing" (converge + color pulse) -> "parting" (letters
// continue moving outward past center while the background fades) ->
// "gone" (fully unmounted, once parting has genuinely finished).
//
// The play/skip decision and the sessionStorage write are both guarded
// by a ref so they only ever happen once per real mount — React Strict
// Mode's dev-only double effect invocation (mount -> cleanup -> mount)
// would otherwise see its own sessionStorage write on the second pass
// and think it's a repeat visit, canceling the animation before it can
// play in development.
//
// ui-ux-pro-max checks applied: reduced-motion respected; every animated
// property is x/opacity/color (transform-performance — color isn't a
// layout property either, so this still never triggers reflow); a
// tap/click anywhere fast-forwards straight to gone (interruptible,
// no-blocking-animation); converge/flash/part timing follow the named
// constants above (motion-consistency).
//
// `onDone` fires exactly once, the moment `phase` reaches "gone" —
// whether that's after the full sequence or immediately (skipped via
// reduced-motion or an already-seen session). `IntroGate.tsx` uses this
// to gate mounting the rest of the page until the intro has genuinely
// finished, rather than relying on a fixed timeout guess.
export default function IntroLoader({ onDone }: { onDone?: () => void }) {
  const [phase, setPhase] = useState<Phase>("cover");
  const shouldPlay = useRef<boolean | null>(null);

  useEffect(() => {
    if (phase === "gone") onDone?.();
  }, [phase, onDone]);

  useEffect(() => {
    if (shouldPlay.current === null) {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const seen = sessionStorage.getItem(SEEN_KEY);
      shouldPlay.current = !reduced && !seen;
      if (shouldPlay.current) sessionStorage.setItem(SEEN_KEY, "1");
    }

    if (!shouldPlay.current) {
      setPhase("gone");
      return;
    }

    setPhase("playing");
    const partTimer = setTimeout(() => setPhase("parting"), PART_DELAY_MS);
    const goneTimer = setTimeout(() => setPhase("gone"), PART_DELAY_MS + PART_DURATION_MS + 60);

    return () => {
      clearTimeout(partTimer);
      clearTimeout(goneTimer);
    };
  }, []);

  if (phase === "gone") return null;

  if (phase === "cover") {
    return <div aria-hidden="true" style={{ position: "fixed", inset: 0, zIndex: 300, background: "var(--arctic-bg)" }} />;
  }

  const parting = phase === "parting";

  return (
    <div
      role="presentation"
      aria-hidden="true"
      onClick={() => setPhase("gone")}
      style={{ position: "fixed", inset: 0, zIndex: 300, overflow: "hidden", cursor: "pointer" }}
    >
      {/* Background — fades out as the letters move on across the
          screen, instead of two solid panels physically sliding apart. */}
      <motion.div
        initial={false}
        animate={{ opacity: parting ? 0 : 1 }}
        transition={PART_TRANSITION}
        style={{ position: "absolute", inset: 0, background: "var(--arctic-bg)" }}
      />

      <div style={{ position: "relative", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <motion.span
          initial={{ x: "-50vw", opacity: 0, color: INK }}
          animate={{
            x: parting ? "-50vw" : 0,
            opacity: 1,
            color: F_COLOR_KEYFRAMES,
          }}
          transition={{ ...(parting ? PART_TRANSITION : CONVERGE_SPRING), color: F_COLOR_TRANSITION }}
          style={letterBaseStyle}
        >
          F
        </motion.span><motion.span
          initial={{ x: "50vw", opacity: 0, color: INK }}
          animate={{
            x: parting ? "50vw" : 0,
            opacity: 1,
            color: LOE_COLOR_KEYFRAMES,
          }}
          transition={{ ...(parting ? PART_TRANSITION : CONVERGE_SPRING), color: LOE_COLOR_TRANSITION }}
          style={letterBaseStyle}
        >
          loe
        </motion.span>
      </div>
    </div>
  );
}
