"use client";

import { useEffect, useState } from "react";

export type NavTarget = "landing" | "problem" | "why" | "features" | "waitlist";

interface HeaderProps {
  onNavigate?: (target: NavTarget) => void;
}

export default function Header({ onNavigate }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    setIsMobile(mq.matches);
    const h = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", h);

    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      mq.removeEventListener("change", h);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const NAV_LINKS: { label: string; target: NavTarget }[] = [
    { label: "Problem",      target: "problem"  },
    { label: "Market gap",   target: "why"      },
    { label: "How it works", target: "features" },
  ];

  return (
    <header
      style={{
        position: "fixed",
        top: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 200,
        width: "calc(min(100% - 32px, 880px))",
        pointerEvents: "auto",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "9px 18px",
          background: scrolled
            ? "rgba(8, 12, 20, 0.88)"
            : "rgba(8, 12, 20, 0.55)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          borderRadius: 10,
          transition: "background 0.4s ease",
          gap: 16,
        }}
      >
        {/* Wordmark */}
        <a
          href="#landing"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            textDecoration: "none",
            flexShrink: 0,
          }}
          onClick={(e) => {
            e.preventDefault();
            onNavigate?.("landing");
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <circle cx="4" cy="9" r="2" fill="#38BDF8" opacity="0.85" />
            <circle cx="14" cy="5" r="1.5" fill="#38BDF8" opacity="0.55" />
            <circle cx="14" cy="13" r="1.5" fill="#38BDF8" opacity="0.55" />
            <line x1="5.7" y1="8.1" x2="12.6" y2="5.7" stroke="#38BDF8" strokeWidth="0.75" strokeOpacity="0.45" />
            <line x1="5.7" y1="9.9" x2="12.6" y2="12.3" stroke="#38BDF8" strokeWidth="0.75" strokeOpacity="0.45" />
          </svg>
          <span
            style={{
              fontFamily: "Syne, sans-serif",
              fontSize: "0.9375rem",
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
                justifyContent: "space-evenly",
              }}
            >
              {NAV_LINKS.map((link) => (
                <button
                  key={link.target}
                  onClick={() => onNavigate?.(link.target)}
                  style={{
                    background: "none",
                    border: "none",
                    padding: "6px 12px",
                    cursor: "pointer",
                    fontFamily: "Outfit, sans-serif",
                    fontSize: "0.8125rem",
                    color: "#FFFFFF",
                    borderRadius: 6,
                    transition: "color 0.2s",
                    letterSpacing: "0.005em",
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
                padding: "7px 16px",
                background: "rgba(56, 189, 248, 0.12)",
                color: "#38BDF8",
                border: "1px solid rgba(56, 189, 248, 0.25)",
                borderRadius: 7,
                fontFamily: "Syne, sans-serif",
                fontSize: "0.8125rem",
                fontWeight: 600,
                cursor: "pointer",
                letterSpacing: "0.01em",
                transition: "background 0.2s, border-color 0.2s",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = "rgba(56, 189, 248, 0.18)";
                el.style.borderColor = "rgba(56, 189, 248, 0.4)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = "rgba(56, 189, 248, 0.12)";
                el.style.borderColor = "rgba(56, 189, 248, 0.25)";
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
                background: "rgba(56, 189, 248, 0.12)",
                color: "#38BDF8",
                border: "1px solid rgba(56, 189, 248, 0.25)",
                borderRadius: 7,
                fontFamily: "Syne, sans-serif",
                fontSize: "0.8125rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Request access
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
