"use client";

import { useEffect, useRef, useState } from "react";

interface VideoColorWindowProps {
  src?: string;
  style?: React.CSSProperties;
  // Extra CSS filter functions appended after the animated grayscale() —
  // e.g. "brightness(1.25) contrast(0.85)" to match the desaturated
  // background layer's own look everywhere but saturation.
  filterExtras?: string;
  // Opacity at playback progress 0 — animates (eased, see below) up to 1
  // (fully opaque) by the time the clip reaches `fullColorAt`, in lockstep
  // with the grayscale→color ramp, so the masked region goes from
  // "standard background" to fully dominant at the same rate it goes from
  // gray to color.
  baseOpacity?: number;
  // Fraction of the clip's duration (0-1) at which the reveal should
  // finish — the mapping saturates here rather than at 1, then holds at
  // fully colored/opaque for the remainder of playback.
  fullColorAt?: number;
}

// A full-bleed masked layer over the hero's atmospheric footage — same
// source, same position/size as the desaturated AtmosphericVideo behind
// it, so it reads as part of the same background rather than a separate
// framed video. `style` is expected to carry a mask-image (see the hero
// in page.tsx) that limits where this layer is visible — typically the
// area right of the hero copy. Within that masked region, its grayscale
// amount and opacity are both driven off currentTime/duration: grayscale
// runs 1→0 (gray to full color) and opacity runs baseOpacity→1 (standard
// background to fully dominant). Progress is tracked via
// requestAnimationFrame rather than the `timeupdate` event — `timeupdate`
// only fires a handful of times per second in most browsers, which reads
// as visibly stepped once you're driving a continuous CSS filter off it;
// rAF gives one update per rendered frame instead. Raw progress is first
// rescaled by `fullColorAt` (default 0.8, i.e. fully revealed 80% through
// the clip rather than at the very end, then held there) and the result
// run through a smootherstep ease (`6p^5-15p^4+10p^3`, Perlin's improved
// version of the earlier `p*p*(3-2p)` smoothstep) — its derivative peaks
// higher at the midpoint than plain smoothstep while staying flatter at
// both ends, i.e. more of the change happens through the middle of the
// reveal rather than a constant-rate ramp, per explicit "more mid-range
// heavy" direction. Respects prefers-reduced-motion by rendering nothing
// rather than a static frame, since the whole point is the time-linked
// reveal.
export default function VideoColorWindow({ src = "/floe-hero.mp4", style, filterExtras = "", baseOpacity = 1, fullColorAt = 0.8 }: VideoColorWindowProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [progress, setProgress] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const h = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || reducedMotion) return;
    let raf = 0;
    const tick = () => {
      if (video.duration) {
        setProgress(Math.min(1, video.currentTime / video.duration));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reducedMotion]);

  if (reducedMotion) return null;

  const scaled = Math.min(1, progress / fullColorAt);
  const eased = 6 * scaled ** 5 - 15 * scaled ** 4 + 10 * scaled ** 3;
  const grayscale = 1 - eased;
  const opacity = baseOpacity + eased * (1 - baseOpacity);

  return (
    <video
      ref={videoRef}
      style={{ ...style, filter: `grayscale(${grayscale}) ${filterExtras}`.trim(), opacity }}
      autoPlay
      muted
      loop={false}
      playsInline
    >
      <source src={src} type="video/mp4" />
    </video>
  );
}
