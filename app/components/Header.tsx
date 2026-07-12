"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV_LINKS: { label: string; href: string }[] = [
  { label: "Traces", href: "/traces" },
  { label: "Replays", href: "/replays" },
];

export default function Header() {
  const pathname = usePathname();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    setIsMobile(mq.matches);
    const h = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

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
        className="frost-panel"
        style={{
          display: "flex",
          alignItems: "center",
          maxWidth: 1100,
          margin: "0 auto",
          padding: isMobile ? "10px 16px" : "10px 14px 10px 18px",
          borderRadius: 999,
        }}
      >
        {/* Wordmark */}
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            textDecoration: "none",
            flexShrink: 0,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="frost-halo" src="/alioth-logo.svg" alt="" width={24} height={24} aria-hidden="true" style={{ display: "block" }} />
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.0625rem",
              fontWeight: 700,
              color: "var(--ink)",
              letterSpacing: "-0.01em",
            }}
          >
            Floe
          </span>
        </Link>

        {!isMobile && (
          <>
            <nav style={{ display: "flex", alignItems: "center", flex: 1, gap: 32, marginLeft: 40 }}>
              {NAV_LINKS.map((link) => {
                const active = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.75rem",
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: active ? "var(--frost-700)" : "var(--ink)",
                      textDecoration: "none",
                      opacity: active ? 1 : 0.6,
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
                      el.style.opacity = active ? "1" : "0.6";
                      if (!active) el.style.color = "var(--ink)";
                    }}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            <a
              href="/dashboard"
              style={{
                flexShrink: 0,
                marginRight: 20,
                textDecoration: "none",
                fontFamily: "var(--font-mono)",
                fontSize: "0.75rem",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--ink)",
                opacity: 0.6,
                whiteSpace: "nowrap",
                transition: "opacity 0.2s, color 0.2s",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.opacity = "1";
                el.style.color = "var(--frost-700)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.opacity = "0.6";
                el.style.color = "var(--ink)";
              }}
            >
              Console
            </a>
          </>
        )}

        <Link
          href="/waitlist"
          className="frost-halo"
          style={{
            flexShrink: 0,
            marginLeft: isMobile ? "auto" : 0,
            padding: isMobile ? "8px 16px" : "8px 18px",
            background: "var(--ink)",
            color: "var(--arctic-bg)",
            borderRadius: 999,
            fontFamily: "var(--font-body)",
            fontSize: "0.8125rem",
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
    </header>
  );
}
