"use client";

import { useEffect, useState } from "react";

interface AtmosphericVideoProps {
  src?: string;
  className?: string;
  style?: React.CSSProperties;
  loop?: boolean;
}

// Background/atmosphere video pattern used across the marketing site
// (Landing's hero, KPI strip, Waitlist's closing moment). loop defaults to
// true (KPI strip / waitlist treatment — ambient, always-looping texture);
// the hero passes loop={false} so it plays once on load and rests on its
// final frame instead of looping, per the intended "watch it once" hero
// moment. Falls back to a static icy gradient under prefers-reduced-motion
// instead of autoplaying either way.
export default function AtmosphericVideo({ src = "/floe-hero.mp4", className, style, loop = true }: AtmosphericVideoProps) {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const h = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  if (reducedMotion) {
    return (
      <div
        className={className}
        style={{
          ...style,
          background: "linear-gradient(120deg, #EAF3FA 0%, #C9E2F1 50%, #EEF3F7 100%)",
        }}
      />
    );
  }

  return (
    <video
      className={className}
      style={style}
      autoPlay
      muted
      loop={loop}
      playsInline
      poster="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10'><rect width='10' height='10' fill='%23EAF3FA'/></svg>"
    >
      <source src={src} type="video/mp4" />
    </video>
  );
}
