"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV_LINKS: { label: string; href: string; id: string }[] = [
  { label: "Install", href: "/#install", id: "install" },
  { label: "Traces", href: "/#traces", id: "traces" },
  { label: "Replays", href: "/#replays", id: "replays" },
];

export default function Header() {
  const pathname = usePathname();
  const [isMobile, setIsMobile] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the mobile dropdown on route change or on resize past the
  // breakpoint where the inline nav takes over again.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    setIsMobile(mq.matches);
    const h = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  // Traces/Replays live as sections on Landing now, not separate routes —
  // track scroll position so the nav can still show which one is in view.
  // Computed directly off getBoundingClientRect on scroll/resize (rAF-
  // throttled) rather than IntersectionObserver — IntersectionObserver
  // reliably misses updates after a single large/fast scroll (a normal
  // trackpad flick, or landing straight on a hash link), since it only
  // reports crossings it observed rather than "am I currently inside this
  // element" — confirmed by testing: incremental scroll steps kept the
  // active item correct, one big jump to the same position didn't.
  useEffect(() => {
    if (pathname !== "/") {
      setActiveId(null);
      return;
    }

    let ticking = false;
    const computeActive = () => {
      ticking = false;
      const refY = window.innerHeight * 0.4;
      let current: string | null = null;
      for (const link of NAV_LINKS) {
        const el = document.getElementById(link.id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.top <= refY && rect.bottom >= refY) {
          current = link.id;
          break;
        }
      }
      setActiveId(current);
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(computeActive);
      }
    };

    computeActive();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [pathname]);

  return (
    <header
      style={{
        position: "fixed",
        top: isMobile ? 12 : 20,
        left: isMobile ? 12 : 20,
        right: isMobile ? 12 : 20,
        zIndex: 200,
      }}
    >
      <div
        className="header-panel"
        style={{
          display: "flex",
          alignItems: "center",
          maxWidth: 1100,
          margin: "0 auto",
          padding: isMobile ? "7px 16px" : "7px 14px 7px 18px",
          borderRadius: 999,
        }}
      >
        {/* Wordmark — "F"/"loe" split into two spans with a hover-only
            color fade (see .wordmark-f/.wordmark-loe in globals.css)
            matching IntroLoader's F_FLASH_COLOR/LOE_FLASH_COLOR exactly,
            so hovering the wordmark reads as a callback to "the very
            first animation" a visitor sees. Resting color stays plain
            --ink per the sitewide rule (frost-blue only on hover/active/
            focus) — this isn't a static blue wordmark, just a hover
            easter egg referencing the intro. */}
        <Link
          href="/"
          className="wordmark-link"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            textDecoration: "none",
            flexShrink: 0,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="frost-halo" src="/floe-header-icon.png" alt="" width={26} height={26} aria-hidden="true" style={{ display: "block", height: 26, width: "auto" }} />
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.5rem",
              fontWeight: 700,
              color: "var(--ink)",
              letterSpacing: "-0.01em",
            }}
          >
            <span className="wordmark-f">F</span><span className="wordmark-loe">loe</span>
          </span>
        </Link>

        {/* Rendered via a CSS breakpoint (not the isMobile JS flag) so
            there's no hydration flash and, more importantly, no state
            where the nav has already vanished but the hamburger hasn't
            mounted yet — Install/Traces/Replays must always be reachable
            one way or the other. Console was removed outright (not just
            hidden) — with it gone, justifyContent:"center" alone
            recenters the remaining three within this flex:1 area, no
            extra centering logic needed. gap bumped up further now that
            it's only three items, not four, so they don't read as
            huddled in the middle of the freed-up space. */}
        <nav
          className="hidden sm:flex"
          style={{ alignItems: "center", flex: 1, justifyContent: "center", gap: 56, marginLeft: 48, marginRight: 32 }}
        >
            {NAV_LINKS.map((link) => {
              const active = pathname === "/" && activeId === link.id;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.875rem",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: active ? "var(--frost-700)" : "var(--ink)",
                    textDecoration: "none",
                    opacity: active ? 1 : 0.85,
                    borderBottom: active ? "1px solid var(--frost-500)" : "1px solid transparent",
                    paddingBottom: 2,
                    transition: "opacity 0.2s, color 0.2s",
                    whiteSpace: "nowrap",
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.opacity = "1";
                    if (!active) el.style.color = "var(--frost-700)";
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.opacity = active ? "1" : "0.85";
                    if (!active) el.style.color = "var(--ink)";
                  }}
                >
                  {link.label}
                </Link>
              );
            })}
        </nav>

        {/* Hamburger — only ever shown below the breakpoint where the
            inline nav above is CSS-hidden, so exactly one of the two is
            interactive at a time. */}
        <button
          type="button"
          className="flex sm:hidden"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={menuOpen}
          style={{
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            marginLeft: 4,
            marginRight: 8,
            flexShrink: 0,
            background: "transparent",
            border: "none",
            color: "var(--ink)",
            cursor: "pointer",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            {menuOpen ? <path d="M5 5l14 14M19 5L5 19" /> : <path d="M3 6h18M3 12h18M3 18h18" />}
          </svg>
        </button>

        <Link
          href="/#waitlist"
          className="frost-halo press-scale"
          style={{
            flexShrink: 0,
            marginLeft: isMobile ? "auto" : 0,
            padding: isMobile ? "8px 16px" : "8px 18px",
            background: "var(--ink)",
            color: "var(--arctic-bg)",
            borderRadius: 999,
            fontFamily: "var(--font-body)",
            fontSize: "1rem",
            fontWeight: 500,
            textDecoration: "none",
            letterSpacing: "0.01em",
            whiteSpace: "nowrap",
            boxShadow: "0 0 0 0 rgba(95,168,211,0)",
            transition: "box-shadow 0.25s, opacity 0.2s",
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.opacity = "0.9";
            el.style.boxShadow = "var(--glow-frost)";
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.opacity = "1";
            el.style.boxShadow = "0 0 0 0 rgba(95,168,211,0)";
          }}
        >
          Join Waitlist
        </Link>
      </div>

      {menuOpen && (
        <nav
          className="header-panel sm:hidden"
          style={{
            marginTop: 8,
            padding: "8px",
            borderRadius: 20,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {NAV_LINKS.map((link) => {
            const active = pathname === "/" && activeId === link.id;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.875rem",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: active ? "var(--frost-700)" : "var(--ink)",
                  textDecoration: "none",
                  padding: "12px 16px",
                  borderRadius: 12,
                }}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
