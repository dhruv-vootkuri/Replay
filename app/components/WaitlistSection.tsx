"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import Constellation from "@/app/components/constellation/Constellation";
import { heroPoints, heroEdges } from "@/app/components/constellation/presets";

const RESOLVE_DELAY    = 100;
const RESOLVE_DURATION = 1200;

interface WaitlistSectionProps {
  isActive?: boolean;
  canvasPaused?: boolean;
  // True once scroll has carried this section to its own fully-arrived
  // position (see the identical mechanism in LandingSection/WhySection).
  // Without this, a fast scroll straight to the bottom of the page can
  // outrun the fixed-duration reveal timer, leaving the headline, eyebrow,
  // and CTA copy sitting at opacity 0 with nothing else after this section
  // to scroll to.
  forceResolved?: boolean;
}

export default function WaitlistSection({ isActive = false, canvasPaused, forceResolved }: WaitlistSectionProps) {
  const rm          = useReducedMotion() ?? false;
  const startedRef  = useRef(false);
  const forceResolvedRef = useRef(false);
  const [rp, setRp] = useState(0);
  const [email, setEmail]         = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [focused, setFocused]     = useState(false);

  useEffect(() => {
    if (forceResolved) {
      forceResolvedRef.current = true;
      setRp(1);
    }
  }, [forceResolved]);

  useEffect(() => {
    if (!isActive || startedRef.current) return;
    startedRef.current = true;
    if (rm) { setRp(1); return; }

    let start: number | undefined;
    let raf: number;

    const tick = (ts: number) => {
      if (forceResolvedRef.current) return; // scroll already forced full resolve — stop tracking wall-clock time
      if (start === undefined) start = ts;
      const t = Math.min((ts - start) / RESOLVE_DURATION, 1);
      setRp(t);
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    const timer = setTimeout(() => { raf = requestAnimationFrame(tick); }, RESOLVE_DELAY);
    return () => { clearTimeout(timer); cancelAnimationFrame(raf); };
  }, [isActive, rm]);

  const c    = (v: number) => Math.max(0, Math.min(1, v));
  const ease = (x: number) => { const t = c(x); return t * t * (3 - 2 * t); };

  // Reveal trigger points normalized: headline (h2Op) reaches full opacity
  // at exactly 50% of this page's own reveal timer, matching Landing/
  // Problem/Market Gap. Continuous eases replace the old binary rp>X
  // threshold snaps (which had no gradual ramp at all). Every value below
  // is a clean multiple of 5%.
  const eyebrowOp = ease(c(rp / 0.35));
  const h2Op      = ease(c((rp - 0.10) / 0.40));
  const h2Y       = (1 - h2Op) * 10;
  const bodyOp    = ease(c((rp - 0.25) / 0.35));
  const formOp    = ease(c((rp - 0.40) / 0.35));
  const formY     = (1 - formOp) * 8;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitted(true);
  };

  return (
    <section
      id="waitlist"
      style={{
        height: "100%",
        position: "relative",
        overflow: "hidden",
        background: "#080C14",
      }}
    >
      <div style={{ position: "absolute", inset: 0 }}>
        <Constellation
          mode="canvas"
          points={heroPoints}
          edges={heroEdges}
          state="unresolved"
          resolveProgress={rp}
          paused={canvasPaused}
        />
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse 65% 55% at 50% 55%, transparent 0%, #080C14 90%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "0 24px 100px",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.6875rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "#38BDF8",
            opacity: eyebrowOp,
            marginBottom: 15,
          }}
        >
          Early access
        </p>

        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(2rem, 4.5vw, 3.5rem)",
            fontWeight: 700,
            lineHeight: 1.08,
            color: "#FFFFFF",
            marginBottom: 16,
            maxWidth: 620,
            opacity: h2Op,
            transform: `translateY(${h2Y}px)`,
          }}
        >
          The guidance is
          <br />
          available to you now.
        </h2>

        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "clamp(0.9375rem, 1.35vw, 1.0625rem)",
            lineHeight: 1.7,
            color: "#FFFFFF",
            marginBottom: 44,
            maxWidth: 420,
            opacity: bodyOp,
          }}
        >
          Early access is open for engineering teams
          building agentic workflows.
        </p>

        <div
          style={{ width: "100%", maxWidth: 480, opacity: formOp, transform: `translateY(${formY}px)` }}
        >
          <AnimatePresence mode="wait">
            {!submitted ? (
              <motion.form
                key="form"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.3 }}
                onSubmit={handleSubmit}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    width: "100%",
                    flexWrap: "wrap",
                    justifyContent: "center",
                  }}
                >
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    placeholder="you@company.com"
                    aria-label="Work email"
                    style={{
                      flex: "1 1 220px",
                      minWidth: 200,
                      maxWidth: 300,
                      padding: "12px 18px",
                      background: "#0F172A",
                      border: `1px solid ${focused ? "#38BDF8" : "#1E293B"}`,
                      borderRadius: 6,
                      color: "#FFFFFF",
                      fontFamily: "var(--font-body)",
                      fontSize: "0.9375rem",
                      outline: "none",
                      transition: "border-color 0.2s",
                    }}
                  />
                  <button
                    type="submit"
                    style={{
                      flexShrink: 0,
                      padding: "12px 26px",
                      background: "#38BDF8",
                      color: "#080C14",
                      border: "none",
                      borderRadius: 6,
                      fontFamily: "var(--font-body)",
                      fontSize: "0.9375rem",
                      fontWeight: 600,
                      letterSpacing: "0.02em",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Request access
                  </button>
                </div>

                <p
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "0.75rem",
                    color: "#FFFFFF",
                    marginTop: 4,
                  }}
                >
                  No spam. Unsubscribe any time.
                </p>
              </motion.form>
            ) : (
              <motion.div
                key="confirmation"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    border: "1.5px solid #38BDF8",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 4,
                  }}
                >
                  <svg width="14" height="11" viewBox="0 0 14 11" fill="none">
                    <path
                      d="M1 5.5L5 9.5L13 1.5"
                      stroke="#38BDF8"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <p
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "1rem",
                    fontWeight: 500,
                    color: "#FFFFFF",
                  }}
                >
                  You&apos;re on the list.
                </p>
                <p
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "0.875rem",
                    color: "#FFFFFF",
                  }}
                >
                  We&apos;ll be in touch at{" "}
                  <span style={{ color: "#38BDF8" }}>{email}</span>
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Footer ── */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingBottom: 10,
          gap: 10,
        }}
      >
        {/* Border — 60% width */}
        <div style={{ width: "60%", height: 1, background: "rgba(255,255,255,0.28)" }} />

        {/* Nav links — centered in 50% */}
        <nav style={{ width: "50%", display: "flex", justifyContent: "center", gap: 96 }}>
          {["Privacy", "Terms", "Contact"].map((label) => (
            <a
              key={label}
              href="#"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "0.8125rem",
                color: "rgba(255,255,255,0.72)",
                textDecoration: "none",
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#FFFFFF"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.72)"; }}
            >
              {label}
            </a>
          ))}
        </nav>

        {/* Copyright */}
        <p style={{ fontFamily: "var(--font-body)", fontSize: "0.6875rem", color: "rgba(255,255,255,0.42)", letterSpacing: "0.02em" }}>
          © 2026 Alioth
        </p>
      </div>
    </section>
  );
}
