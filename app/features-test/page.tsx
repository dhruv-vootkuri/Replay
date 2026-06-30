"use client";

import { useEffect, useState } from "react";
import FeaturesSection from "@/app/components/FeaturesSection";

// Standalone scroll driver for the Features tab mechanic.
// Layout: 100 vh entry spacer + 400 vh Features (sticky) + 100 vh exit spacer.
// Tab scroll progress: starts when the sticky panel pins (at scrollY = 100 vh)
// and completes at scrollY = 400 vh, giving 300 vh for 3 tab transitions.

export default function FeaturesTestPage() {
  const [tabProgress, setTabProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const iH = window.innerHeight;
      // After the 100 vh entry spacer, 300 vh drives the tabs
      const p = Math.max(0, Math.min(1, (window.scrollY - iH) / (iH * 3)));
      setTabProgress(p);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div style={{ background: "#080C14" }}>

      {/* Entry spacer */}
      <div
        style={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
        }}
      >
        <p
          style={{
            fontFamily: "IBM Plex Mono, monospace",
            fontSize: "0.6875rem",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "#334155",
          }}
        >
          features section — scroll test
        </p>
        <p
          style={{
            fontFamily: "IBM Plex Sans, sans-serif",
            fontSize: "0.875rem",
            color: "#1E293B",
          }}
        >
          ↓ scroll to enter
        </p>
      </div>

      {/* 400 vh scroll range with sticky Features panel */}
      <div style={{ height: "400vh", position: "relative" }}>
        <div style={{ position: "sticky", top: 0, height: "100vh" }}>
          <FeaturesSection tabScrollProgress={tabProgress} />
        </div>
      </div>

      {/* Exit spacer */}
      <div
        style={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderTop: "1px solid #0F172A",
        }}
      >
        <p
          style={{
            fontFamily: "IBM Plex Mono, monospace",
            fontSize: "0.6875rem",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "#1E293B",
          }}
        >
          features end · waitlist follows in main page
        </p>
      </div>

    </div>
  );
}
