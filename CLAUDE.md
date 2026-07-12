@AGENTS.md

# Floe — Design System Reference

Formerly "Alioth" → "Replay AI" → "Polerr" → renamed to **Floe** (a floe is
a flat sheet of floating ice — reinforces the arctic theme). `public/
alioth-logo.svg` keeps its old filename (not user-facing, safe to leave)
but is a name-agnostic mark, used as-is. If you rename the brand again,
also regenerate `public/dashboard-preview.png` (a static screenshot of
`/dashboard` embedded on `/waitlist` — it bakes in whatever wordmark the
sidebar showed at capture time and goes stale silently otherwise; this has
already been missed twice).

## Stack
- Next.js 16 (App Router), TypeScript, Tailwind v4, Framer Motion 12
- Marketing site lives in the `app/(marketing)/` route group (4 pages, see
  below) so it can share a layout (`Header` + `Footer`) without that chrome
  leaking onto `app/dashboard/`, which has its own layout/Sidebar and is a
  separate product surface (the real console, still dark-themed with
  functional chart color — not part of the arctic redesign).
- Fonts loaded via Google Fonts in `app/globals.css`

---

## Site structure — 4 pages, no scroll-jacking

A prior version of this site was a single scroll-hijacked page (~1172vh,
`scrollYProgress`-driven pinning). That's gone. The site is now four
ordinary pages in normal document flow, each reachable from the nav:

| Route | Purpose |
|---|---|
| `/` | Landing — hero (real replay-diff UI as the hero visual, not decoration), real KPI numbers as immediate credibility, a two-path split into the two intro pages, close CTA |
| `/traces` | How tracing works — real trace waterfall, shown large, annotated |
| `/replays` | How forking works — the real recorded fork example (`get_capital`, country Zorblax→Paris, 6 downstream spans), shown large — this is the single strongest, most differentiated piece of material in the product, so it gets its own page |
| `/waitlist` | Dedicated CTA page — email capture + the real `/dashboard` screenshot |

If you're asked to add a new marketing page, put it in `app/(marketing)/`
so it inherits the shared header/footer automatically. Do **not** add
`Header`/`Footer` to the root `app/layout.tsx` — that wraps `/dashboard`
too and would leak marketing chrome onto the console.

Nav (all 4 pages): wordmark · Traces · Replays · Console (→ `/dashboard`) ·
Join Waitlist. It's real page links now, not scroll anchors.

---

## Why this shape, specifically (read before changing structure again)

Two prior redesigns were rejected as looking AI-generated even after the
theme and mechanics were solid. Research into what actually causes that
(screenshotted deepmind.google, appliedintuition.com, corgi.insure,
vercel.com, linear.app, raycast.com) found the tell isn't color or scroll
mechanics — it's **generic structure**: centered hero text over a
decorative/abstract background, uniform icon-over-heading feature grids,
checkmark comparison tables. Those patterns are what every AI page-builder
produces regardless of theme.

The fix applied here, concretely:
- **Real product UI is the hero visual**, full scale, not a decorative
  background behind centered copy (`ReplayDiff` on `/`, same pattern
  Linear and Applied Intuition use with their own real UI/photography).
- **No uniform feature grid.** The three real-UI components
  (`app/components/product/{Waterfall,ReplayDiff,LogStream}.tsx`) are
  differently shaped and reused as themselves, not shrunk into matching
  icon cards.
- **No checkmark comparison table.** Dropped entirely — the two intro
  pages (`/traces`, `/replays`) carry the differentiation instead.
- **One typographic personality move per headline**, not zero and not
  many — a phrase set in Space Mono with a light-gray inline-code
  background, breaking the Space Grotesk display face on purpose (see the
  `<span>` around "one input" / "diff" in the hero and `/replays`
  headlines). Same device Vercel uses for its mono eyebrow copy.
- **Real data immediately after the hero as credibility** — the KPI strip
  on `/` uses the actual Overview numbers (7 traces, 20 LLM calls, 13 tool
  calls, 80 spans, 4.7s avg), not decoration.

If you're asked to redesign this again, don't reach for a new color theme
or a new scroll gimmick first — check whether the *content* backing each
section is real and specific before touching layout.

---

## Color Palette — Arctic Monochrome

Still monochrome, still no scan-line, but evolved from flat white/pure
black to an actual "arctic" rendering: cold icy whites, a charcoal-navy ink
instead of warm/neutral black, and a restrained frost-blue accent reserved
**only** for hover/active/focus states — never body text, never a fill.
Defined once as plain CSS custom properties in `app/globals.css` (`:root`,
separate from the Tailwind `@theme` block) and referenced via `var(--x)`
from inline styles across every marketing component. If you add new UI,
use the tokens below rather than new hex values.

| Token | Hex / value | Role |
|---|---|---|
| `--arctic-bg` | `#F7FAFC` | Global background (body also carries a faint radial gradient toward `--arctic-bg-2` + SVG grain — see `body` rule) |
| `--arctic-bg-2` | `#EEF3F7` | Gradient stop, cools toward page edges |
| `--arctic-surface` | `#EEF2F6` | Input fills |
| `--ink` | `#0B0E14` | Headlines, primary CTA, borders — charcoal-navy, not pure black |
| `--slate` / `--slate-dim` | `#48505C` / `#6B7480` | Body copy, secondary text |
| `--hairline` | `#DCE3EA` | Dividers, default borders |
| `--frost-100/300/500/700` | `#EAF3FA` → `#2E6E96` | Hover/active/focus **only** — nav underline, link hover, focus rings, button glow |
| `--shadow-sm/md/depth`, `--glow-frost` | see `globals.css` | Diffused blue-gray shadows (`--shadow-depth` layers a soft far shadow under a tighter near one — stacked-ice-sheet feel) and the frost focus/hover glow |

Reusable classes: `.frost-panel` (glass surface — 24px blur + 160%
saturate, a top-edge inset highlight for a light-catch, and a top-left/
bottom-right bevel via four separate border-side colors rather than one
flat border-color, so it reads as an ice edge, not a rectangle),
`.frost-hover` (opt-in hover intensification — see gotcha below),
`.frost-halo` (a soft `filter: drop-shadow` used on the wordmark and
primary CTAs — "lit from within," not a UI glow), and `.arctic-topo` (a
faint hand-authored contour-line SVG, ~7% opacity, used behind every page's
hero only — deliberately not tiled sitewide, so it reads as atmosphere,
not wallpaper). The body background also runs an extremely slow
(`arctic-drift`, 38s) `background-position` animation on the radial-gradient
layer — "light shifting through ice," fully disabled under
`prefers-reduced-motion` since it's decorative.

**Gotcha, confirmed by inspecting the compiled CSS twice:** Turbopack's
Tailwind v4 build hoists rules out of a manually-authored `@layer
components { }` block into unlayered CSS regardless of how you write it.
Unlayered CSS always beats every Tailwind layer (including `utilities`)
regardless of source order or selector specificity — so a Tailwind
`hover:border-[...]`/`hover:shadow-[...]` utility applied alongside
`.frost-panel` silently does nothing (this shipped broken once already).
If an element needs a hover/focus state and also uses `.frost-panel`,
write the `:hover`/`:focus` rule as its own plain-CSS class in
`globals.css` (see `.frost-hover`) — don't reach for a Tailwind arbitrary
hover utility on top of it. Verify any new hover interaction by checking
`getComputedStyle` before/after a real `.hover()` in Playwright, not just
by eyeballing a static screenshot — this bug produced no visual difference
to catch by inspection alone.

**Exception, deliberate:** the three real-UI components in
`app/components/product/` render with the console's actual dark theme and
real functional colors (`KIND_META`: LLM `#38BDF8`, Tool `#34D399`, Agent
`#818CF8`, Task `#F59E0B`; cached/forked/downstream tag colors; red/green
diff lines) — because they're meant to read as an authentic window into
the real product, not marketing decoration. Same logic as the
`dashboard-preview.png` screenshot on `/waitlist`: a real colorful
screenshot inside a monochrome frame reads as considered, not
inconsistent. Don't monochrome these components to match the page — that
would make them *less* credible, not more on-brand.

Shared CSS tokens in `app/globals.css` (`--color-deep-space`,
`--color-starlight`, etc.) still carry their **old dark values** because
`app/dashboard/*` consumes them directly via Tailwind classes
(`bg-deep-space`, `text-dim-starlight`). The marketing site does not use
those tokens — every marketing component uses literal inline hex — so the
two surfaces can diverge safely. Don't "fix" this by changing the tokens.

---

## Typefaces
- **Display:** Space Grotesk (400–700) — swapped from Syne this round
  specifically because Space Grotesk and Space Mono are companion faces
  from the same superfamily, giving real typographic coherence with the
  mono face instead of two unrelated fonts.
- **Body:** Outfit (300–700) — clean, neutral, legible at small sizes.
- **Mono:** Space Mono — technical labels, trace/span vocabulary, and the
  one-per-headline emphasis device described above.

---

## Product grounding — the real vocabulary, don't invent capabilities

Everything on the marketing site must trace to something real in
`app/dashboard/` or `lib/replay/`. Reference:

- **Trace** = one `query` handled by an `agent`, made of **spans**
  (`agent | task | llm | tool` — see `lib/replay/types.ts`). Real UI:
  indented waterfall, `◆` = forkable span.
- **Fork** = edit a forkable span's input → generates a **Replay**.
  `lib/replay/fork.ts` classifies every other span relative to the fork
  point: **cached** (before, reused untouched), **forked** (the edited
  span), **downstream** (after, re-run because it depended on the
  changed value). Real UI shows a literal red `−` / green `+` field diff
  on the forked span.
- **Logs**: terminal UI, level chips (DEBUG/INFO/OK/WARN/ERROR), source
  tags (tracer/engine/loader/tool/cli).
- Sidebar IA: Overview, Traces, Replays, Logs.

The pitch is the fork→diff mechanism specifically — "change one input
mid-trace, see exactly what reruns" — not generic
"legibility/interpretability" language. If new copy can't be pointed at a
real screenshot or a real field name, don't add it.

---

## Page Structure

Each page is normal document flow — no `position: fixed` section pinning,
no scroll-percentage transforms. Where motion is used, it should be a
simple `whileInView`/CSS transition, not a shared scroll-timeline engine.
`app/components/hud/IceCrack.tsx` (procedural fracture-line canvas) still
exists and still works if a future page wants a background accent, but the
current 4 pages deliberately don't use it — the real UI components carry
the visual weight instead (see "Why this shape" above).
