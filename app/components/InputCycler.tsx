"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

const PHRASES = ["one input", "two inputs", "any inputs"];
// Both slowed ~30% from the original 55/35 (55*1.3=71.5, 35*1.3=45.5,
// rounded) per explicit direction — typing and deleting scaled together
// rather than just one, so the type/delete rhythm stays proportional
// instead of deleting suddenly feeling relatively much faster than typing.
const TYPE_MS = 72; // per character while typing
const DELETE_MS = 46; // per character while deleting
const HOLD_MS = 2000; // stay on each phrase for two seconds

type Phase = "typing" | "holding" | "deleting";

// "any inputs" (10 chars) is the longest phrase — the pill's width is
// fixed to exactly that many monospace characters (Space Mono is a true
// monospace font, so `ch` sizing is pixel-exact here, no ghost-element
// measurement needed) so the box never grows/shrinks and "mid-trace."
// after it in the headline never moves, no matter which phrase is
// showing. Text is left-aligned inside that fixed box, so shorter
// phrases just leave blank space to the right rather than centering —
// that's what makes it still read as "typing into a fixed-size field"
// rather than text drifting around inside a static box. Computed from
// PHRASES rather than hardcoded so the fit stays correct automatically
// if the phrase list changes again.
const MAX_CHARS = Math.max(...PHRASES.map((p) => p.length));

// Cycles the hero headline's mono-pill badge through "one input" -> "two
// inputs" -> "any inputs" -> loop, with a real type/hold/delete rhythm
// (not a crossfade) — same pill styling as the static badge it replaces
// (frost-100 background), just animated content in a fixed-width field.
export default function InputCycler() {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [text, setText] = useState(PHRASES[0]);
  const [phase, setPhase] = useState<Phase>("holding");

  useEffect(() => {
    if (reduceMotion) return;
    const current = PHRASES[index];

    if (phase === "typing") {
      if (text.length < current.length) {
        const t = setTimeout(() => setText(current.slice(0, text.length + 1)), TYPE_MS);
        return () => clearTimeout(t);
      }
      setPhase("holding");
      return;
    }

    if (phase === "holding") {
      const t = setTimeout(() => setPhase("deleting"), HOLD_MS);
      return () => clearTimeout(t);
    }

    // deleting
    if (text.length > 0) {
      const t = setTimeout(() => setText(text.slice(0, -1)), DELETE_MS);
      return () => clearTimeout(t);
    }
    setIndex((i) => (i + 1) % PHRASES.length);
    setPhase("typing");
  }, [text, phase, index, reduceMotion]);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "flex-start",
        // `${MAX_CHARS}ch` alone clipped the last couple pixels of "any
        // inputs" plus the cursor — measured via Playwright at the exact
        // moment the longest phrase is fully typed: the cursor's own
        // border-right+padding-right (4px) plus a bit of font-metric
        // rounding slop pushed the real content ~10.4px past the box's
        // ch-only width, and overflow:hidden below silently clipped that
        // overflow instead of visibly breaking the layout, which is why
        // this read as "the text gets cut off" rather than an obvious
        // visual bug. +14px covers the measured 10.4px with a small
        // safety margin; re-verify with the same
        // getBoundingClientRect-at-"any inputs" method if PHRASES or the
        // cursor's own box model changes again.
        width: `calc(${MAX_CHARS}ch + 14px)`,
        // An empty cursor span (the instant between the last deleted
        // character and the first typed one) doesn't establish a line
        // box on its own — confirmed via getBoundingClientRect polling
        // through a full cycle: the pill's rendered height dropped to 0
        // at exactly that moment (width/background/opacity all stayed
        // normal), which is what read as the box "disappearing." A
        // minHeight in em (relative to this element's own font-size, so
        // it still scales with the responsive headline) keeps the pill's
        // height constant regardless of whether there's any text inside
        // it right now.
        minHeight: "1.4em",
        // The pill's OWN box height is rock-solid (confirmed via
        // getBoundingClientRect polling: identical at every point in the
        // cycle, including when text is empty). But the *surrounding*
        // h2's line-box height still jumped ~10px whenever the cursor's
        // text content was empty — a `vertical-align: baseline` (the
        // default) quirk: an inline-flex element with no text inside it
        // has nothing to establish a baseline from, so the browser falls
        // back to aligning it by its margin edge instead of matching it
        // to the surrounding text's baseline like it does when there IS
        // text, and that shift in alignment reference point changes how
        // much vertical room the line needs — even though the pill's own
        // box never resizes. `vertical-align: middle` sidesteps the
        // whole baseline calculation (which is what was content-
        // dependent) in favor of a fixed reference point, so the line's
        // height stops depending on whether the cursor currently has
        // text in it. Confirmed via the same polling method: h2's height
        // and the paragraph below it now hold one exact value across a
        // full type/hold/delete cycle instead of two.
        verticalAlign: "middle",
        fontFamily: "var(--font-mono)",
        fontWeight: 400,
        fontSize: "0.8em",
        background: "var(--frost-100)",
        padding: "0 10px",
        borderRadius: 6,
        whiteSpace: "nowrap",
        overflow: "hidden",
      }}
    >
      {/* Cursor is a blinking border, not a text character — a glyph
          would need its own ch of space inside an already-exactly-sized
          box, which would either overflow at "any inputs" (the box's
          exact-fit case) or force the box wider than the tight fit just
          established. A border consumes ~2px, not a full character
          width, so it can sit flush after the last letter even at the
          longest phrase without breaking the tight fit. */}
      <span className="typewriter-cursor" aria-hidden="true">{reduceMotion ? PHRASES[0] : text}</span>
    </span>
  );
}
