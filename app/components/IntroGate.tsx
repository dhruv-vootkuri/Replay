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
export default function IntroGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  return (
    <>
      <IntroLoader onDone={() => setReady(true)} />
      {ready ? children : null}
    </>
  );
}
