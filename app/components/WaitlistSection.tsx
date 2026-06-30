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
}

export default function WaitlistSection({ isActive = false, canvasPaused }: WaitlistSectionProps) {
  const rm          = useReducedMotion() ?? false;
  const startedRef  = useRef(false);
  const [rp, setRp] = useState(0);
  const [email, setEmail]         = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [focused, setFocused]     = useState(false);

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

    const timer = setTimeout(() => { raf = requestAnimationFrame(tick); }, RESOLVE_DELAY);
    return () => { clearTimeout(timer); cancelAnimationFrame(raf); };
  }, [isActive, rm]);

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
        <motion.p
          animate={{ opacity: rp > 0.5 ? 1 : 0 }}
          transition={{ duration: 0.6 }}
          style={{
            fontFamily: "Space Mono, monospace",
            fontSize: "0.6875rem",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "#38BDF8",
            opacity: 0,
            marginBottom: 28,
          }}
        >
          Early access
        </motion.p>

        <motion.h2
          animate={{ opacity: rp > 0.6 ? 1 : 0, y: rp > 0.6 ? 0 : 10 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          style={{
            fontFamily: "Syne, sans-serif",
            fontSize: "clamp(2rem, 5vw, 3.75rem)",
            fontWeight: 700,
            lineHeight: 1.08,
            color: "#FFFFFF",
            marginBottom: 16,
            maxWidth: 620,
            opacity: 0,
          }}
        >
          The guidance is
          <br />
          available to you now.
        </motion.h2>

        <motion.p
          animate={{ opacity: rp > 0.75 ? 1 : 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          style={{
            fontFamily: "Outfit, sans-serif",
            fontSize: "clamp(0.9375rem, 1.4vw, 1.0625rem)",
            lineHeight: 1.7,
            color: "#FFFFFF",
            marginBottom: 44,
            maxWidth: 420,
            opacity: 0,
          }}
        >
          Early access is open for engineering teams
          building agentic workflows.
        </motion.p>

        <motion.div
          animate={{ opacity: rp > 0.8 ? 1 : 0, y: rp > 0.8 ? 0 : 8 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          style={{ width: "100%", maxWidth: 480, opacity: 0 }}
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
                      fontFamily: "Outfit, sans-serif",
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
                      fontFamily: "Syne, sans-serif",
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
                    fontFamily: "Outfit, sans-serif",
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
                    fontFamily: "Syne, sans-serif",
                    fontSize: "1rem",
                    fontWeight: 500,
                    color: "#FFFFFF",
                  }}
                >
                  You&apos;re on the list.
                </p>
                <p
                  style={{
                    fontFamily: "Outfit, sans-serif",
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
        </motion.div>
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
                fontFamily: "Outfit, sans-serif",
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
        <p style={{ fontFamily: "Outfit, sans-serif", fontSize: "0.6875rem", color: "rgba(255,255,255,0.42)", letterSpacing: "0.02em" }}>
          © 2026 Alioth
        </p>
      </div>
    </section>
  );
}
