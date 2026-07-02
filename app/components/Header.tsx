"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useTransform, useMotionTemplate, type MotionValue } from "framer-motion";

export type NavTarget = "landing" | "problem" | "why" | "features" | "waitlist";

interface HeaderProps {
  onNavigate?: (target: NavTarget) => void;
  // 0 = fully transparent (Landing, first paint), 1 = fully opaque.
  // A MotionValue (not plain state) so background/blur update on every
  // scroll frame without a React re-render — state-driven updates read as
  // stepped/laggy next to the rest of the page's motion-value-driven scroll.
  opacity?: MotionValue<number>;
}

export default function Header({ onNavigate, opacity }: HeaderProps) {
  const fallbackOpacity = useMotionValue(0);
  const op = opacity ?? fallbackOpacity;

  const bgAlpha     = useTransform(op, [0, 1], [0, 0.92]);
  const blurPx      = useTransform(op, [0, 1], [0, 16]);
  const borderAlpha = useTransform(op, [0, 1], [0, 0.06]);
  const background     = useMotionTemplate`rgba(8, 12, 20, ${bgAlpha})`;
  const backdropFilter = useMotionTemplate`blur(${blurPx}px)`;
  const borderBottom   = useMotionTemplate`1px solid rgba(255,255,255,${borderAlpha})`;

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    setIsMobile(mq.matches);
    const h = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  const NAV_LINKS: { label: string; target: NavTarget }[] = [
    { label: "Problem",      target: "problem"  },
    { label: "Market gap",   target: "why"      },
    { label: "How it works", target: "features" },
  ];

  return (
    <motion.header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 200,
        pointerEvents: "auto",
        background,
        backdropFilter,
        WebkitBackdropFilter: backdropFilter,
        borderBottom,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "18px 48px",
          gap: 0,
        }}
      >
        {/* Wordmark */}
        <a
          href="#landing"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            textDecoration: "none",
            flexShrink: 0,
          }}
          onClick={(e) => {
            e.preventDefault();
            onNavigate?.("landing");
          }}
        >
          <svg width="20" height="20" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <circle cx="4" cy="9" r="2" fill="#38BDF8" opacity="0.85" />
            <circle cx="14" cy="5" r="1.5" fill="#38BDF8" opacity="0.55" />
            <circle cx="14" cy="13" r="1.5" fill="#38BDF8" opacity="0.55" />
            <line x1="5.7" y1="8.1" x2="12.6" y2="5.7" stroke="#38BDF8" strokeWidth="0.75" strokeOpacity="0.45" />
            <line x1="5.7" y1="9.9" x2="12.6" y2="12.3" stroke="#38BDF8" strokeWidth="0.75" strokeOpacity="0.45" />
          </svg>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.25rem",
              fontWeight: 700,
              color: "#FFFFFF",
              letterSpacing: "-0.01em",
            }}
          >
            Alioth
          </span>
        </a>

        {/* Desktop nav */}
        {!isMobile && (
          <>
            <nav
              style={{
                display: "flex",
                alignItems: "center",
                flex: 1,
                gap: 44,
                marginLeft: 56,
              }}
            >
              {NAV_LINKS.map((link) => (
                <button
                  key={link.target}
                  onClick={() => onNavigate?.(link.target)}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    fontFamily: "var(--font-body)",
                    fontSize: "1rem",
                    fontWeight: 400,
                    color: "#FFFFFF",
                    borderRadius: 0,
                    transition: "color 0.2s",
                    letterSpacing: "0.012em",
                    whiteSpace: "nowrap",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#38BDF8"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#FFFFFF"; }}
                >
                  {link.label}
                </button>
              ))}
            </nav>

            <button
              onClick={() => onNavigate?.("waitlist")}
              style={{
                flexShrink: 0,
                padding: "6px 16px",
                background: "transparent",
                color: "#38BDF8",
                border: "1px solid #38BDF8",
                borderRadius: 2,
                fontFamily: "var(--font-body)",
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: "pointer",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                transition: "color 0.2s, border-color 0.2s",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.color = "#FFFFFF";
                el.style.borderColor = "#FFFFFF";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.color = "#38BDF8";
                el.style.borderColor = "#38BDF8";
              }}
            >
              Request access
            </button>
          </>
        )}

        {/* Mobile: CTA only */}
        {isMobile && (
          <div style={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={() => onNavigate?.("waitlist")}
              style={{
                padding: "6px 14px",
                background: "transparent",
                color: "#38BDF8",
                border: "1px solid #38BDF8",
                borderRadius: 2,
                fontFamily: "var(--font-body)",
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: "pointer",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              Request access
            </button>
          </div>
        )}
      </div>
    </motion.header>
  );
}
