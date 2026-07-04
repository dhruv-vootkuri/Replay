"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

const FADE_WINDOW = 2;

interface LandingSectionProps {
  canvasPaused?: boolean;
  // True once the user has started scrolling away from Landing. The resolve
  // sequence is normally paced by hero-video playback time, but that has no
  // relationship to scroll — a user who scrolls before the video reaches its
  // fade window would leave Landing without ever seeing the headline resolve.
  // Forcing rp to 1 here guarantees it's visible by the time they leave.
  forceResolved?: boolean;
}

export default function LandingSection({ canvasPaused, forceResolved }: LandingSectionProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [rp, setRp]       = useState(0);
  const rpRef             = useRef(0);
  const forceResolvedRef  = useRef(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (forceResolved && rpRef.current < 1) {
      forceResolvedRef.current = true;
      rpRef.current = 1;
      setRp(1);
    }
  }, [forceResolved]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const h = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let raf: number;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (forceResolvedRef.current) return; // scroll already forced full resolve — stop tracking video time
      if (!video.duration) return;
      const fadeStart = video.duration - FADE_WINDOW;
      const next = Math.max(0, Math.min(1, (video.currentTime - fadeStart) / FADE_WINDOW));
      if (Math.abs(next - rpRef.current) > 0.002) {
        rpRef.current = next;
        setRp(next);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const clamp = (v: number) => Math.max(0, Math.min(1, v));

  // Reveal trigger points normalized to a shared target: the headline
  // reaches full opacity at exactly 50% of this page's own reveal timer,
  // matching Problem/Market Gap/Waitlist. Every other element's start/full
  // point rescaled proportionally from its old value and rounded to the
  // nearest 5% -- no leftover per-page magic decimals.
  const headlineOpacity = clamp(rp / 0.50);
  const headlineBlur    = (1 - headlineOpacity) * 12;
  const subheadOpacity  = clamp((rp - 0.20) / 0.40);
  const ctaOpacity      = clamp((rp - 0.40) / 0.35);
  const ctaY            = (1 - ctaOpacity) * 6;
  const guideOpacity    = clamp((rp - 0.55) / 0.25);
  const guideY          = (1 - guideOpacity) * 8;
  const audOpacity      = clamp((rp - 0.65) / 0.25);
  const scrollOpacity   = rp >= 1 ? 0.4 : 0;

  return (
    <section
      id="landing"
      style={{ height: "100vh", position: "relative", overflow: "hidden", background: "#080C14" }}
    >
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        onEnded={() => {
          if (rpRef.current < 1) { rpRef.current = 1; setRp(1); }
        }}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center",
          display: "block",
        }}
      >
        <source src="/BEST_hero.mp4" type="video/mp4" />
      </video>

      <div
        style={{
          position: "absolute",
          inset: 0,
          background: isMobile
            ? "linear-gradient(180deg, rgba(8,12,20,0.82) 0%, rgba(8,12,20,0.65) 50%, rgba(8,12,20,0.45) 100%)"
            : "linear-gradient(to right, rgba(8,12,20,0.92) 0%, rgba(8,12,20,0.78) 30%, rgba(8,12,20,0.35) 60%, rgba(8,12,20,0.08) 100%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          height: "100%",
          display: "flex",
          alignItems: "center",
          padding: isMobile ? "0 28px" : "0 0 0 7vw",
        }}
      >
        <div
          style={{
            maxWidth: isMobile ? "100%" : 540,
            width: isMobile ? "100%" : "46%",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
          }}
        >
          {/* "let us guide you" */}
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.6875rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "#38BDF8",
              marginBottom: 15,
              height: "1.4em",
              opacity: guideOpacity,
              transform: `translateY(${guideY}px)`,
            }}
          >
            let us guide you
          </div>

          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(2.25rem, 6vw, 4.5rem)",
              fontWeight: 700,
              lineHeight: 1.08,
              color: "#FFFFFF",
              marginBottom: 22,
              opacity: headlineOpacity,
              filter: `blur(${headlineBlur}px)`,
              willChange: "filter, opacity",
            }}
          >
            Your agents are live.
            <br />
            Their reasoning
            <br />
            is invisible.
          </h1>

          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "clamp(0.9375rem, 1.35vw, 1.0625rem)",
              lineHeight: 1.7,
              color: "#FFFFFF",
              maxWidth: 460,
              marginBottom: 36,
              opacity: subheadOpacity,
            }}
          >
            Alioth makes every agent decision legible, and tells you whether it
            would make the same one again.
          </p>

          <a
            href="#waitlist"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 24px",
              background: "#38BDF8",
              color: "#080C14",
              border: "1px solid #38BDF8",
              borderRadius: 2,
              fontFamily: "var(--font-body)",
              fontSize: "0.875rem",
              fontWeight: 500,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              textDecoration: "none",
              cursor: "pointer",
              marginBottom: 16,
              opacity: ctaOpacity,
              transform: `translateY(${ctaY}px)`,
              transition: "color 0.2s, background 0.2s, border-color 0.2s",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = "transparent";
              el.style.color = "#38BDF8";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = "#38BDF8";
              el.style.color = "#080C14";
            }}
          >
            Request early access
            <span aria-hidden="true" style={{ fontSize: "1.1em", lineHeight: 1 }}>→</span>
          </a>

          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "0.8125rem",
              color: "#FFFFFF",
              opacity: audOpacity,
            }}
          >
            For engineering teams building agentic workflows.
          </p>
        </div>
      </div>

      <motion.div
        animate={{ opacity: scrollOpacity }}
        transition={{ duration: 0.5 }}
        style={{
          position: "absolute",
          bottom: 28,
          left: isMobile ? "50%" : "7vw",
          transform: isMobile ? "translateX(-50%)" : "none",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
          opacity: 0,
        }}
      >
        <p style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.625rem",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "#38BDF8",
        }}>scroll</p>
        <svg width="1" height="24" viewBox="0 0 1 24" fill="none">
          <line x1="0.5" y1="0" x2="0.5" y2="24" stroke="#38BDF8" strokeOpacity="0.35" />
        </svg>
      </motion.div>
    </section>
  );
}
