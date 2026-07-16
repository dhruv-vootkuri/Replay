"use client";

import { useState } from "react";
import IntroLoader from "./IntroLoader";

// Gates mounting the rest of the landing page behind IntroLoader's own
// completion — `children` (the actual sections: hero, ReplayDiff, Traces,
// Replays, WaitlistForm, all their images/video) isn't rendered into the
// DOM at all until IntroLoader reports `onDone`, so none of that content's
// network requests (video sources, images) fire while the intro overlay
// is still covering the screen. Explicit direction: "ensure that things
// on the website are only loaded in after the very first intro
// disappears." This applies uniformly whether the intro actually played
// or was skipped instantly (reduced-motion / already-seen-this-session)
// — either way `children` waits for the same `onDone` signal, so repeat
// views within a session still gate correctly rather than special-casing
// the skip path.
//
// Trade-off worth knowing: because `ready` starts `false` and only
// flips via a client effect, the server-rendered HTML (and what a
// no-JS/crawler request sees) does not include `children` either — this
// is a deliberate consequence of "only loaded in after," not a bug, but
// it does mean the page's real content isn't present until JS runs and
// the gate opens. If that regresses SEO/no-JS behavior more than
// expected, that's the tradeoff to revisit, not this gating mechanism.
// Same file AtmosphericVideo/VideoColorWindow default to — kept as a
// literal here (not a shared constant) matching how those components
// already hardcode their own default, per repo convention of inline
// values over cross-file constants for a single string.
const HERO_VIDEO_SRC = "/floe-hero.mp4";

export default function IntroGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  return (
    <>
      {/* Warms the browser's cache for the hero video while the intro
          plays, so the real <video> layers (AtmosphericVideo,
          VideoColorWindow — both point at this same file) can start
          playback the instant they mount instead of stalling on a cold
          fetch right as the headline text appears, which read as an
          awkward gap between text and video. Never played, never visible
          — `preload="auto"` alone is enough to trigger the fetch; it's
          kept in normal layout (not display:none) with 1x1 size and zero
          opacity because some browsers deprioritize loading on
          display:none media. This does mean a network request for the
          video now starts before the intro overlay is gone, a narrow,
          deliberate exception to "no network requests fire while the
          intro is covering the screen" — the video itself still isn't
          visible or playing until the real page mounts, only its bytes
          are fetched early. */}
      <video
        src={HERO_VIDEO_SRC}
        preload="auto"
        muted
        playsInline
        aria-hidden="true"
        style={{ position: "fixed", top: 0, left: 0, width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
      />
      <IntroLoader onDone={() => setReady(true)} />
      {ready ? children : null}
    </>
  );
}
