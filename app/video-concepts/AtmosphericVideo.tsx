"use client";

import { useEffect, useState } from "react";

interface AtmosphericVideoProps {
  className?: string;
  style?: React.CSSProperties;
}

// Reusable pattern for any of the placements below: plays /hero-bg.mp4 (a
// stand-in clip already in public/ — swap in your real arctic pan at the
// same path, or change the src here) and falls back to a static icy
// gradient under prefers-reduced-motion instead of autoplaying.
export default function AtmosphericVideo({ className, style }: AtmosphericVideoProps) {
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
      loop
      playsInline
      poster="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10'><rect width='10' height='10' fill='%23EAF3FA'/></svg>"
    >
      <source src="/hero-bg.mp4" type="video/mp4" />
    </video>
  );
}
