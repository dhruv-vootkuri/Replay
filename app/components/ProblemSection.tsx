"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import Constellation from "@/app/components/constellation/Constellation";
import { problemPoints, problemEdges } from "@/app/components/constellation/presets";

const RESOLVE_DURATION = 1100;

const PAIN_POINTS = [
  "No audit trail for agent decisions",
  "Failures that won't reproduce",
  "Incidents you can describe but not explain",
] as const;

interface ProblemSectionProps {
  canvasPaused?: boolean;
  isActive?: boolean;
}

export default function ProblemSection({ canvasPaused, isActive = false }: ProblemSectionProps) {
  const rm         = useReducedMotion() ?? false;
  const startedRef = useRef(false);
  const [rp, setRp] = useState(0);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const h = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  useEffect(() => {
    if (!isActive || startedRef.current) return;
    startedRef.current = true;
    if (rm) { setRp(1); return; }

    let start: number | undefined;
    let raf: number;
    const tick = (ts: number) => {
      if (start === undefined) start = ts;
      const t = Math.min((ts - start) / RESOLVE_DURATION, 1);
      setRp(t);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isActive, rm]);

  const c    = (v: number) => Math.max(0, Math.min(1, v));
  const ease = (x: number) => { const t = c(x); return t * t * (3 - 2 * t); };

  // Reveal trigger points normalized: headline (h2Op) reaches full opacity
  // at exactly 50% of this page's own reveal timer, matching Landing/Market
  // Gap/Waitlist. Every value below is a clean multiple of 5%.
  const labelOp = ease(c(rp / 0.35));
  const labelY  = (1 - labelOp) * 14;
  const h2Op    = ease(c((rp - 0.10) / 0.40));
  const h2Y     = (1 - h2Op) * 14;
  const p1Op    = ease(c((rp - 0.25) / 0.35));
  const p1Y     = (1 - p1Op) * 10;
  const p2Op    = ease(c((rp - 0.40) / 0.35));
  const p2Y     = (1 - p2Op) * 10;
  const ppOp    = (i: number) => ease(c((rp - 0.55 - i * 0.10) / 0.30));
  const ppY     = (i: number) => (1 - ppOp(i)) * 8;

  return (
    <section
      id="problem"
      style={{
        height: "100%",
        position: "relative",
        overflow: "hidden",
        background: "#080C14",
      }}
    >
      {/* Tangled constellation — always unresolved, never settles */}
      <div style={{ position: "absolute", inset: 0 }}>
        <Constellation
          mode="canvas"
          points={problemPoints}
          edges={problemEdges}
          state="unresolved"
          paused={canvasPaused}
        />
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          background: isMobile
            ? "linear-gradient(180deg, #080C14 0%, #080C14cc 40%, transparent 80%)"
            : "linear-gradient(105deg, #080C14 0%, #080C14cc 45%, transparent 100%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          height: "100%",
          maxWidth: 620,
          padding: isMobile ? "0 24px" : "0 64px",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.6875rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "#38BDF8",
            marginBottom: 15,
            opacity: labelOp,
            transform: `translateY(${labelY}px)`,
          }}
        >
          The problem
        </p>

        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(2rem, 4.5vw, 3.5rem)",
            fontWeight: 700,
            lineHeight: 1.08,
            color: "#FFFFFF",
            marginBottom: 32,
            opacity: h2Op,
            transform: `translateY(${h2Y}px)`,
          }}
        >
          You can&apos;t trust
          <br />
          what you can&apos;t read.
        </h2>

        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "clamp(0.9375rem, 1.35vw, 1.0625rem)",
            lineHeight: 1.75,
            color: "#FFFFFF",
            marginBottom: 16,
            opacity: p1Op,
            transform: `translateY(${p1Y}px)`,
          }}
        >
          Your agent made a call you didn&apos;t expect. You pulled the logs:
          inputs, outputs, latency, token counts. Nothing about the reasoning.
          You tried to reproduce it. Different run, different behavior.
          You shipped a fix. You don&apos;t know if it held.
        </p>

        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "clamp(0.9375rem, 1.35vw, 1.0625rem)",
            lineHeight: 1.75,
            color: "#FFFFFF",
            marginBottom: 40,
            opacity: p2Op,
            transform: `translateY(${p2Y}px)`,
          }}
        >
          This is agentic work without interpretability. The behavior is
          observable. The reasoning is gone.
        </p>

        <ul
          style={{
            listStyle: "none",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {PAIN_POINTS.map((point, i) => (
            <li
              key={point}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                fontFamily: "var(--font-body)",
                fontSize: "0.9375rem",
                color: "#FFFFFF",
                lineHeight: 1.4,
                opacity: ppOp(i),
                transform: `translateY(${ppY(i)}px)`,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  color: "#38BDF8",
                  fontSize: "0.75rem",
                  flexShrink: 0,
                }}
              >
                —
              </span>
              {point}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
