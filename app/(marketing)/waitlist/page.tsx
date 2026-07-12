"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export default function WaitlistPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [focused, setFocused] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitted(true);
  };

  return (
    <section style={{ position: "relative", padding: "180px 24px 100px" }}>
      <div className="arctic-topo" />
      <div style={{ position: "relative", zIndex: 1, maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--ink)", marginBottom: 16 }}>
        Early access
      </p>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.75rem, 4vw, 2.75rem)", fontWeight: 700, lineHeight: 1.15, color: "var(--ink)", marginBottom: 16, textShadow: "0 2px 28px rgba(95,168,211,0.16)" }}>
        Early access is open for teams building agentic workflows.
      </h1>
      <p style={{ fontFamily: "var(--font-body)", fontSize: "1rem", lineHeight: 1.6, color: "var(--slate)", marginBottom: 40 }}>
        No spam. Unsubscribe any time.
      </p>

      <AnimatePresence mode="wait">
        {!submitted ? (
          <motion.form
            key="form"
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3 }}
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "stretch",
                width: "100%",
                height: 52,
                border: "1px solid var(--ink)",
                borderRadius: 2,
                overflow: "hidden",
                boxShadow: focused ? "0 0 0 3px rgba(95,168,211,0.22)" : "0 0 0 0 rgba(95,168,211,0)",
                transition: "box-shadow 0.2s",
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
                className="frost-halo transition-[filter] hover:brightness-[1.6]"
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
                }}
              >
                Request access
              </button>
            </div>
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
            <p style={{ fontFamily: "var(--font-body)", fontSize: "0.9375rem", color: "var(--slate)" }}>
              We&apos;ll be in touch at <span style={{ color: "var(--ink)" }}>{email}</span>
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <a
        href="/dashboard"
        className="hover:opacity-90"
        style={{ display: "block", marginTop: 72, position: "relative", textDecoration: "none", transition: "opacity 0.2s" }}
      >
        <div className="transition-shadow hover:shadow-[var(--shadow-md)]" style={{ position: "relative", border: "1px solid rgba(190,220,239,0.5)", overflow: "hidden" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/dashboard-preview.png"
            alt="Floe trace console dashboard showing traces, LLM calls, tool calls, and span composition"
            style={{ display: "block", width: "100%", height: "auto" }}
          />
        </div>
        <p style={{ marginTop: 12, fontFamily: "var(--font-mono)", fontSize: "0.6875rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink)" }}>
          View the console →
        </p>
      </a>
      </div>
    </section>
  );
}
