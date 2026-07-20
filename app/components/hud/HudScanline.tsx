"use client";

import { useEffect, useState } from "react";

interface HudScanlineProps {
  color?: string;
}

// Slow sweeping scan-line — the "live system" tell that separates a real
// trace-console read from a static HUD skin. Respects prefers-reduced-motion.
export default function HudScanline({ color = "255, 255, 255" }: HudScanlineProps) {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const h = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  if (reducedMotion) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div
        className="hud-scanline"
        style={
          {
            "--hud-scan-color": color,
          } as React.CSSProperties
        }
      />
    </div>
  );
}
