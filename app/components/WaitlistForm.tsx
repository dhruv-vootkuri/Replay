"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Footer from "@/app/components/Footer";
import Reveal from "@/app/components/Reveal";

// The waitlist CTA, form, console preview, and Footer — used as the closing
// section of Landing (id="waitlist") rather than a separate /waitlist
// route. Footer lives inside this same relatively-positioned section (not
// in the layout) so the atmospheric video spans behind it too, instead of
// cutting off at a hard edge above Privacy/Terms/Contact.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [focused, setFocused] = useState(false);
  const [boxHovered, setBoxHovered] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Enter your email to join the waitlist.");
      return;
    }
    if (!EMAIL_RE.test(trimmed)) {
      setError("Enter a valid email address.");
      return;
    }
    setError(null);
    setSubmitted(true);
  };

  return (
    <section
      id="waitlist"
      style={{ position: "relative", borderTop: "1px solid var(--hairline)", padding: "140px 24px 0", overflow: "hidden", scrollMarginTop: 90 }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/floe-waitlist-still.jpg"
        alt=""
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: "grayscale(1) brightness(1.25) contrast(0.85)",
          opacity: 0.2,
        }}
      />
      <div className="arctic-topo" />
      <div style={{ position: "relative", zIndex: 1, maxWidth: 640, margin: "0 auto", paddingBottom: 140, textAlign: "center" }}>
        <Reveal>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--ink)", marginBottom: 16 }}>
          Early access
        </p>
        </Reveal>
        <Reveal delay={0.1}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.75rem, 4vw, 2.75rem)", fontWeight: 700, lineHeight: 1.15, color: "var(--ink)", marginBottom: 16, textShadow: "0 2px 28px rgba(95,168,211,0.16)" }}>
          Early access is open for teams building agentic workflows.
        </h2>
        </Reveal>
        <Reveal delay={0.2}>
        <p style={{ fontFamily: "var(--font-body)", fontSize: "1rem", lineHeight: 1.6, color: "var(--ink)", marginBottom: 40 }}>
          No spam. Unsubscribe any time.
        </p>
        </Reveal>

        <AnimatePresence mode="wait">
          {!submitted ? (
            <motion.form
              key="form"
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
              onSubmit={handleSubmit}
              noValidate
              style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}
            >
              <div
                onMouseEnter={() => setBoxHovered(true)}
                onMouseLeave={() => setBoxHovered(false)}
                style={{
                  display: "flex",
                  alignItems: "stretch",
                  width: "100%",
                  height: 52,
                  border: `1px solid ${error ? "#B3261E" : "var(--ink)"}`,
                  borderRadius: 2,
                  overflow: "hidden",
                  boxShadow: focused || boxHovered ? "0 0 0 3px rgba(95,168,211,0.22)" : "0 0 0 0 rgba(95,168,211,0)",
                  transition: "box-shadow 0.2s, border-color 0.2s",
                }}
              >
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                  }}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  placeholder="you@company.com"
                  aria-label="Work email"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? "waitlist-email-error" : undefined}
                  style={{
                    flex: "1 1 auto",
                    minWidth: 0,
                    height: "100%",
                    boxSizing: "border-box",
                    padding: "0 18px",
                    background: "var(--arctic-surface)",
                    border: "none",
                    color: "var(--ink)",
                    fontFamily: "var(--font-body)",
                    fontSize: "0.9375rem",
                    outline: "none",
                  }}
                />
                <div style={{ width: 1, background: "var(--hairline)", flexShrink: 0 }} />
                <button
                  type="submit"
                  className="frost-halo press-scale"
                  style={{
                    flexShrink: 0,
                    padding: "0 28px",
                    background: "var(--ink)",
                    color: "var(--arctic-bg)",
                    border: "none",
                    fontFamily: "var(--font-body)",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    boxShadow: "0 0 0 0 rgba(95,168,211,0)",
                    transition: "box-shadow 0.25s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.boxShadow = "var(--glow-frost)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 0 rgba(95,168,211,0)";
                  }}
                >
                  Request access
                </button>
              </div>
              {error && (
                <p
                  id="waitlist-email-error"
                  role="alert"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "0.8125rem",
                    color: "#B3261E",
                    margin: 0,
                  }}
                >
                  {error}
                </p>
              )}
            </motion.form>
          ) : (
            <motion.div
              key="confirmation"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}
            >
              <div style={{ width: 36, height: 36, borderRadius: "50%", border: "1.5px solid var(--ink)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="14" height="11" viewBox="0 0 14 11" fill="none">
                  <path d="M1 5.5L5 9.5L13 1.5" stroke="var(--ink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p style={{ fontFamily: "var(--font-display)", fontSize: "1.125rem", fontWeight: 600, color: "var(--ink)" }}>You&apos;re on the list.</p>
              <p style={{ fontFamily: "var(--font-body)", fontSize: "0.9375rem", color: "var(--ink)" }}>
                We&apos;ll be in touch at <span style={{ fontWeight: 600 }}>{email}</span>
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div style={{ position: "relative", zIndex: 1 }}>
        <Footer />
      </div>
    </section>
  );
}
