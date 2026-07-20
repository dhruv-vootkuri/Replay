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
  const [company, setCompany] = useState("");
  const [comments, setComments] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [companyFocused, setCompanyFocused] = useState(false);
  const [commentsFocused, setCommentsFocused] = useState(false);
  const [boxHovered, setBoxHovered] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One shared glow across the whole rectangle (email/company/submit row +
  // comments row) rather than a per-field one — focusing/hovering any
  // part of the unified box should light up the same outer border, not
  // just whichever field happens to be active, since visually it reads
  // as one control.
  const boxActive = emailFocused || companyFocused || commentsFocused || boxHovered;

  const handleSubmit = async (e: React.FormEvent) => {
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
    setSubmitting(true);
    try {
      // app/api/waitlist/route.ts logs the submission to a Google Sheet
      // and emails a notification — see that file for the two env-var
      // groups it needs to actually do either.
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, company, comments }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Something went wrong. Please try again.");
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      id="waitlist"
      style={{
        position: "relative",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        scrollMarginTop: 90,
      }}
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
          maskImage: "linear-gradient(to bottom, transparent 0, black 160px)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0, black 160px)",
        }}
      />
      {/* Text + form block — vertically centered in the space between the
          fixed header and the footer, not just top-padded under the header
          the way it used to be. The 140px top padding is kept as a floor so
          on short viewports the centered content still clears the fixed
          header (`.header-panel`) rather than drifting underneath it. */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          flex: "1 1 auto",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "140px 24px 60px",
        }}
      >
      {/* Outer column widened from the old 640px so the headline (below)
          can fit each of its two sentences on one line apiece — measured
          directly: "Premium access is open for a limited time." needs
          ~892px at the clamp's ceiling font-size (44px, already reached
          at ordinary desktop widths, not just ultra-wide). The form
          itself keeps its own narrower 640px maxWidth + auto margins
          below so the input/button/textarea rectangle doesn't stretch to
          match — only the headline uses the wider column. */}
      <div style={{ maxWidth: 950, margin: "0 auto", width: "100%", textAlign: "center" }}>
        {/* Same eyebrow treatment as the numbered chapters' "01 —
            Install"/"03 — Replays" (1.125rem, weight 700, tick mark) —
            no chapter number here since Waitlist isn't part of that
            01/02/03 sequence, just matching their visual weight. */}
        <Reveal>
        <p style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, fontFamily: "var(--font-mono)", fontSize: "1.125rem", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink)", marginBottom: 16 }}>
          <span aria-hidden="true" style={{ display: "inline-block", width: 3, height: 20, background: "var(--ink)" }} />
          Early access
        </p>
        </Reveal>
        <Reveal delay={0.1}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.75rem, 4vw, 2.75rem)", fontWeight: 700, lineHeight: 1.15, color: "var(--ink)", marginBottom: 40, textShadow: "0 2px 28px rgba(95,168,211,0.16)" }}>
          {/* #4781bc = F_FLASH_COLOR in IntroLoader.tsx — the same dark
              blue "F" fades to in the one-time splash, and the same tone
              the header wordmark's "F" fades to on hover (see
              .wordmark-f in globals.css). Reusing it here for the
              strikethrough is the same "callback to the first animation"
              idea as the wordmark hover, not a new one-off blue. */}
          Ready to <span style={{ textDecoration: "line-through", color: "#4781bc" }}>cross off</span> risky agents?
          <br />
          Premium access is open for a limited time.
        </h2>
        </Reveal>

        <AnimatePresence mode="wait">
          {!submitted ? (
            <motion.form
              key="form"
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
              onSubmit={handleSubmit}
              noValidate
              style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center", maxWidth: 640, margin: "0 auto" }}
            >
              {/* One unified rectangle — email/company/submit row on top,
                  an optional comments row below, sharing a single outer
                  border with hairline dividers between cells instead of
                  separate floating controls. boxActive (any field focus
                  OR hover anywhere on the rectangle) drives one shared
                  glow on the outer border, so the whole block reads as a
                  single control regardless of which inner field is
                  active. */}
              <div
                onMouseEnter={() => setBoxHovered(true)}
                onMouseLeave={() => setBoxHovered(false)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  width: "100%",
                  border: `1px solid ${error ? "#B3261E" : "var(--ink)"}`,
                  borderRadius: 2,
                  overflow: "hidden",
                  boxShadow: boxActive ? "0 0 0 3px rgba(95,168,211,0.22)" : "0 0 0 0 rgba(95,168,211,0)",
                  transition: "box-shadow 0.2s, border-color 0.2s",
                }}
              >
                <div style={{ display: "flex", alignItems: "stretch", height: 52 }}>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError(null);
                    }}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                    placeholder="you@company.com"
                    aria-label="Work email"
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? "waitlist-email-error" : undefined}
                    style={{
                      flex: "1.3 1 0",
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
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    onFocus={() => setCompanyFocused(true)}
                    onBlur={() => setCompanyFocused(false)}
                    placeholder="Company"
                    aria-label="Company"
                    style={{
                      flex: "1 1 0",
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
                    disabled={submitting}
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
                      cursor: submitting ? "default" : "pointer",
                      opacity: submitting ? 0.7 : 1,
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
                    {submitting ? "Sending…" : "Contact Sales"}
                  </button>
                </div>
                {/* Divider between the email/submit row and the comments
                    row — deliberately stronger than the plain --hairline
                    token (#DCE3EA) used for the vertical divider above,
                    since --hairline reads as almost invisible against
                    this same --arctic-surface background (they're very
                    close in lightness); an ink-tinted line at partial
                    opacity is legible without the divider becoming as
                    visually heavy as the outer rectangle's own border. */}
                <div style={{ height: 1, background: "rgba(11,14,20,0.25)", flexShrink: 0 }} />
                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  onFocus={() => setCommentsFocused(true)}
                  onBlur={() => setCommentsFocused(false)}
                  placeholder="Anything else? Questions, use case, team size... (optional)"
                  aria-label="Comments or questions"
                  rows={3}
                  style={{
                    width: "100%",
                    minHeight: 84,
                    boxSizing: "border-box",
                    padding: "14px 18px",
                    background: "var(--arctic-surface)",
                    border: "none",
                    color: "var(--ink)",
                    fontFamily: "var(--font-body)",
                    fontSize: "0.9375rem",
                    lineHeight: 1.5,
                    outline: "none",
                    resize: "vertical",
                  }}
                />
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
              <p style={{ fontFamily: "var(--font-display)", fontSize: "1.125rem", fontWeight: 600, color: "var(--ink)" }}>We&apos;ll get back within 24 hours.</p>
              <p style={{ fontFamily: "var(--font-body)", fontSize: "0.9375rem", color: "var(--ink)" }}>
                Anytime, anywhere at <span style={{ fontWeight: 600 }}>{email}</span>
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      </div>

      <div style={{ position: "relative", zIndex: 1, flexShrink: 0 }}>
        <Footer />
      </div>
    </section>
  );
}
