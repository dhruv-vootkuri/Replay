@AGENTS.md

# Floe — Design System Reference

Formerly "Alioth" → "Replay AI" → "Polerr" → renamed to **Floe** (a floe is
a flat sheet of floating ice — reinforces the arctic theme). The header
icon is `public/floe-header-icon.png` (cropped from a user-supplied source
lockup image that originally paired the icon with a baked-in blue-gradient
"Floe" wordmark — that raster wordmark was tried briefly and reverted:
the wordmark stays real DOM text, `<span>Floe</span>` in `var(--ink)`, not
an image, so it keeps the accessible text node and stays on-palette black
rather than introducing off-brand blue into the header). The old `public/
alioth-logo.svg` mark has been deleted — `Header.tsx` was its only
consumer, replaced by `floe-header-icon.png`. `public/dashboard-preview.png`
(a static screenshot of `/dashboard`) is currently an orphaned asset — the
"View the console" preview that displayed it at the bottom of Landing was
removed. Nothing renders it today; leave the file alone rather than
"fixing" the stale-wordmark risk that used to apply to it.

## Stack
- Next.js 16 (App Router), TypeScript, Tailwind v4, Framer Motion 12
- Marketing site is `app/(marketing)/page.tsx` plus two utility routes,
  `/privacy` and `/terms` (see below), all in the same route group so they
  share a layout (`Header`) without that chrome leaking onto
  `app/dashboard/`, which has its own layout/Sidebar and is a separate
  product surface (the real console — as of the arctic-console pass below,
  it now shares the marketing site's light palette and typography, though
  it's still a distinct route group/layout, not literally the arctic
  redesign's markup). `Footer` is not in the
  layout — it's rendered inside `WaitlistForm.tsx` (see Atmospheric video
  below) so the closing video can span behind it, which means `/privacy`
  and `/terms` don't get a footer of their own (they carry a "← Back to
  Floe" link instead — see `LegalDoc.tsx`).
- Fonts loaded via Google Fonts in `app/globals.css`

---

## Site structure — one marketing page, two legal utility pages, plus the console

A prior version of this site was a single scroll-hijacked page (~1172vh,
`scrollYProgress`-driven pinning) — that's gone (different mechanism, same
instinct: it really is one page). A later version split Traces, Replays,
and Waitlist into their own routes, then briefly kept `/traces` and
`/replays` alive as redirect shims — all of that is gone too. Everything
marketing-*narrative* content lives at `/` in normal document flow (no
scroll-jacking, just `scroll-behavior: smooth` + anchor links):

Landing (`/`) — hero (real replay-diff UI as the hero visual, not
decoration, `minHeight: 100vh` so the next section never peeks above the
fold; its bottom padding and the following ReplayDiff section's top
padding are both intentionally tight — 32px/36px (tightened further from
an original 48px/56px, itself already tighter than the ~100px/120px an
earlier pass used) — so the trace visual rises into view soon after the
fold instead of after a long dead scroll, and the hero's background video
layer carries a bottom mask-fade so it dissolves into the page rather than
cutting off on a hard line; the ReplayDiff wrapper's `maxWidth` matches the
`#traces`/`#replays` wrapper at 1100, not a wider one, so all three real-UI
blocks share one column width), real KPI numbers as immediate credibility
— the ReplayDiff dashboard image and the KPI strip now live in one
combined `<section>` with no divider between them (an earlier pass had
them as two sections split by a hairline border, removed per explicit
direction so the stat numbers read as glued to the dashboard image rather
than a separate block; the section now carries **no** border of its own —
it used to also keep a bottom border, which combined with `#traces`'
own top border to render as a doubled line, since removed so every
chapter boundary is a single hairline rather than each boundary having
its own ad hoc treatment — and the same 60px/140px bottom/top padding
pattern used before #replays still carries it into the Traces chapter
below),
`#traces` (real trace waterfall + log stream, large), `#replays` (the real
recorded fork example
— `get_capital`, country Zorblax→Paris, 6 downstream spans — with
cached/forked/downstream callouts), then `#waitlist` (`WaitlistForm`,
`app/components/WaitlistForm.tsx` — email capture, then `Footer`) as the
close. There's no dashboard-screenshot preview here anymore — see the
`dashboard-preview.png` note above.

The hairline rule across the middle chapters is now uniform: each of
`#traces` and `#replays` owns exactly one `borderTop`, and the section
before it carries no matching `borderBottom` — one line per boundary,
not zero or two. `#waitlist` is the deliberate exception: instead of a
hairline, the `#replays`→`#waitlist` boundary is now a gradient dissolve,
the same technique as the hero's bottom mask-fade (see below) — a
`maskImage`/`WebkitMaskImage` on `floe-waitlist-still.jpg` fading it in
from `transparent` to fully visible over its first 160px, so the section
starts blending in rather than cutting on a hard line. Don't add back a
`borderTop`/`borderBottom` hairline at that specific boundary.

`/privacy` and `/terms` (`app/(marketing)/privacy`, `app/(marketing)/terms`,
both built on the shared `LegalDoc.tsx`) are a deliberate, narrow exception
to "one scroll" — standard legal utility pages, linked from `Footer`. They
don't carry the arctic-topo/video treatment (plain readable typography is
the right call for a document you're supposed to actually read) and they
don't get the shared `Footer` back (they use a simple "← Back to Floe"
link instead, since `Footer` lives inside `WaitlistForm` on Landing, not
in the layout).

Do **not** re-split the Landing sections into their own routes, and don't
add a new marketing *narrative* page without a real reason — that part of
the site is deliberately one scroll. If you're asked to add marketing
content, extend a section (or add a new one) in `app/(marketing)/page.tsx`
instead of creating a route. Utility pages like `/privacy`/`/terms` are
fine to add when there's a real (non-narrative) reason — follow the
`LegalDoc.tsx` pattern rather than reaching for the arctic hero treatment.
Do **not** add `Header`/`Footer` to the root `app/layout.tsx` either —
that wraps `/dashboard` too and would leak marketing chrome onto the
console.

Nav: wordmark · Traces · Replays · Console (→ `/dashboard`) · Join
Waitlist. Traces/Replays/Waitlist are `/#traces`, `/#replays`, `/#waitlist`
anchor links, not page navigations. `Header.tsx` tracks which section is
in view (underlines the active nav item) by computing it directly from
`getBoundingClientRect()` on scroll/resize, rAF-throttled — **not**
`IntersectionObserver`, which was tried first and reliably missed updates
after one large/fast scroll (confirmed: incremental small scrolls kept the
active item correct, one big jump to the same final position didn't,
because IntersectionObserver reports crossings it witnessed rather than
"am I inside this element right now"). Only wired when `pathname === "/"`
(Join Waitlist is styled as a CTA button, not a nav link, so it doesn't
participate in this tracking). The header itself (`.header-panel` in
`globals.css`) is fully opaque, not the translucent `.frost-panel` glass
used elsewhere — it needs to stay legible
floating over any section it scrolls past. Traces/Replays/Console are
grouped together and centered in the header (`justifyContent: "center"`,
`gap: 40`) rather than spread edge-to-edge — Floe and Join Waitlist stay
anchored at the ends.

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
- **No checkmark comparison table.** Dropped entirely — the Traces and
  Replays sections on `/` carry the differentiation instead.
- **One typographic personality move per headline**, not zero and not
  many — a phrase set in Space Mono with a light-gray inline-code
  background, breaking the Space Grotesk display face on purpose (see the
  `<span>` around "one input" / "diff" in the hero and Replays section
  headlines). Same device Vercel uses for its mono eyebrow copy.
- **Real data immediately after the hero as credibility** — the KPI strip
  on `/` uses the actual Overview numbers (7 traces, 20 LLM calls, 13 tool
  calls, 80 spans, 4.7s avg), not decoration.

If you're asked to redesign this again, don't reach for a new color theme
or a new scroll gimmick first — check whether the *content* backing each
section is real and specific before touching layout.

---

## Color Palette — Arctic Monochrome

Still monochrome, still no scan-line. The background itself is now **flat
white** (`--arctic-bg`/`--arctic-bg-2` both `#FFFFFF`, no gradient) — an
earlier pass ran a radial gradient cooling toward `--arctic-bg-2` plus a
blue-tinted grain and a slow `arctic-drift` position animation on that
gradient, but that whole mechanism was deliberately removed per explicit
direction ("reverse the background... no need to have it blue"). Don't
reintroduce the gradient/drift — a future request to "add some atmosphere
back to the background" should go through the user first, not be assumed.
What's left of the "arctic" identity: a charcoal-navy ink instead of warm/
neutral black, a faint *neutral-gray* grain (retinted off its old blue
tint) purely for texture, and a restrained frost-blue accent reserved
**only** for hover/active/focus states — never body text, never a
background fill (the header logo is a separate, deliberate exception to
that last rule — see below). Defined once as plain CSS custom properties
in `app/globals.css` (`:root`, separate from the Tailwind `@theme` block)
and referenced via `var(--x)` from inline styles across every marketing
component. If you add new UI, use the tokens below rather than new hex
values.

| Token | Hex / value | Role |
|---|---|---|
| `--arctic-bg` | `#FFFFFF` | Global background — flat white, no gradient |
| `--arctic-bg-2` | `#FFFFFF` | Same as `--arctic-bg`; kept as a separate token only so consumers referencing it don't break, not because the two diverge anymore |
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
primary CTAs — "lit from within," not a UI glow), `.arctic-topo` (a
faint hand-authored contour-line SVG — the "background waves" — at 10%
opacity, bumped up slightly from an original ~7% per explicit direction.
Used behind the combined ReplayDiff+KPI section, `#traces`, and `#replays`
on `/` — deliberately removed from the hero and from `#waitlist`
(`WaitlistForm`) per explicit direction, and still not tiled sitewide, so
it reads as atmosphere on those section bodies rather than wallpaper
everywhere),
and `.arctic-code-block` (applied to the outer wrapper of
all three real-UI components — `Waterfall`, `ReplayDiff`, `LogStream` — a
thin gradient-border ring, same 3-stop icy gradient as
`AtmosphericVideo`'s reduced-motion fallback, faded in via a `::before`
mask-composite trick on `:hover`; it's a border glow, not a fill, so the
block's authentic dark console interior stays untouched). All three of
those components also open with `WindowChrome`
(`app/components/product/WindowChrome.tsx`) — macOS-style traffic-light
dots (drawn as one element via `box-shadow`, not three separate spans) on
a slightly lighter strip than the block's own `#0A0A0A` body, so they read
as real application windows rather than plain dark cards. It sits inside
the same `.arctic-code-block` wrapper as a sibling above the padded
content, so it doesn't interfere with that wrapper's hover glow — when
adding a new real-UI block, wrap it the same way: outer
`.arctic-code-block` div (background/border/glow, no padding) →
`<WindowChrome title="..." />` → a padded inner content div.

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

Two more confirmed instances of this same family of bug, both fixed by
moving off CSS-class-vs-CSS-class (or CSS-class-vs-inline-style) conflicts
onto something with unambiguous priority:
- `.arctic-code-block`'s hover glow: `Waterfall`/`ReplayDiff`/`LogStream`
  set their resting `box-shadow` via an inline `style` prop, which beats
  *any* stylesheet rule (not just unlayered-vs-Tailwind) regardless of
  specificity — so `.arctic-code-block:hover { box-shadow: ... }` on the
  block itself was dead code. Fixed by painting the glow on a dedicated
  `::after` pseudo-element instead (no inline style on it to compete).
- `WaitlistForm`'s "Request access" button: `.frost-halo` sets `filter:
  drop-shadow(...)` permanently, and the Tailwind `hover:brightness-[...]`
  utility that used to sit next to it also targets `filter` — same
  unlayered-beats-Tailwind rule as above, so the hover brightness never
  fired (confirmed via `getComputedStyle`, identical before/after hover).
  Fixed by dropping the Tailwind utility and adding an
  `onMouseEnter`/`onMouseLeave` pair that sets an inline `boxShadow`
  directly (matching the pattern `Header.tsx`'s Join Waitlist button
  already used) — a different CSS property than `.frost-halo` touches, so
  there's no conflict, and inline-via-JS has unambiguous priority. The
  input+button container's hover glow uses the same trick: a `boxHovered`
  state (not a CSS class) feeding the same inline `boxShadow` the
  focus-state glow already used, since that box-shadow was also inline.

**Exception, deliberate:** the three real-UI components in
`app/components/product/` render with the console's actual dark theme and
real functional colors (`KIND_META`: LLM `#38BDF8`, Tool `#34D399`, Agent
`#818CF8`, Task `#F59E0B`; cached/forked/downstream tag colors; red/green
diff lines) — because they're meant to read as an authentic window into
the real product, not marketing decoration (the same reasoning that used
to justify the now-removed `dashboard-preview.png` embed: a real colorful
screenshot inside a monochrome frame reads as considered, not
inconsistent). Don't monochrome these components to match the page — that
would make them *less* credible, not more on-brand.

### Arctic-console pass — `app/dashboard/*` now matches the marketing palette

Per explicit direction ("change [the console] so that it matches the
styling of the landing page, namely the colors, typography... don't
touch the content"), the `@theme` tokens in `app/globals.css` that
`app/dashboard/*` consumes via Tailwind classes (`bg-deep-space`,
`text-starlight`, `text-dim-starlight`, `bg-signal`, etc.) were flipped
from their original dark values to light ones matching the marketing
site's arctic tokens:

| Token | Old (dark) | New (light) | Matches |
|---|---|---|---|
| `--color-deep-space` | `#000000` | `#FFFFFF` | `--arctic-bg` |
| `--color-surface` | `#0A0A0A` | `#EEF2F6` | `--arctic-surface` |
| `--color-starlight` | `#FFFFFF` | `#0B0E14` | `--ink` |
| `--color-dim-starlight` | `#8A8A8A` | `#48505C` | `--slate` |
| `--color-signal` | `#FFFFFF` | `#1F4E6B` | darker than `--frost-700` (`#2E6E96`) |
| `--color-anomaly/divergence/boundary/pulse` | `#FFFFFF` (flattened, shape/label not hue) | `#0B0E14` (same flattening intent, ink instead of white) | — |

`--color-signal` first landed at `#2E6E96` (exactly `--frost-700`) but was
darkened again to `#1F4E6B` per explicit follow-up ("make their text a
bit darker") — it no longer matches an arctic token exactly, it's just a
deeper shade in the same family. This token drives trace-ID/link text
sitewide in the dashboard *and* `bg-signal` buttons ("View all traces",
"Fork here", "Run replay") and the active-nav-item indicator, so darkening
it moved all of those together, not just link text — that was accepted as
in-scope rather than treated as a bug.

Typography needed no change — `--font-display`/`--font-body`/`--font-mono`
were already the same Space Grotesk/Outfit/Space Mono tokens shared by
both surfaces.

Because those four per-tab accent tokens were already flattened to a
single non-semantic color pre-change (differentiated by symbol — ✗ − + ◇
— and label, not hue, per their own comment), retinting them to ink
instead of white preserves that existing restraint rather than
introducing a break; it does **not** touch the real functional colors
(`KIND_META`, `LOG_LEVEL_META`, `REPLAY_TYPE_META` in
`lib/replay/format.ts` — llm blue/tool green/agent indigo/task amber, log
levels, red/green diff before-after cards in `DiffView.tsx`), which
remain exactly as they were: shared with the marketing site's product-UI
mockups, so changing them here would have altered those too.

Beyond the token flip, every dashboard component's own literal
Tailwind opacity utilities keyed to `white` (hairlines, hover fills —
`border-white/[0.06]`, `hover:bg-white/[0.04]`, etc.) were converted to
the `black` equivalent at roughly the same or slightly higher opacity
(low-opacity black-on-white reads fainter than the same opacity
white-on-black), since those don't ride on the theme tokens and wouldn't
have flipped automatically. A handful of hardcoded hex values also
changed by hand: `Sidebar.tsx`'s `#0B1120` panel background → `#EEF2F6`.
Its inline five-dot constellation-logo SVG (a leftover from before the
Alioth→Floe rebrand, never updated when the marketing header moved to
`floe-header-icon.png`) was first retinted `#38BDF8` → `#5FA8D3`
(`--frost-500`) as a stopgap, then replaced entirely per explicit
follow-up ("add the floe logo to the sidebar instead of the default
nodes & vertices") — `Brand()` and the mobile top bar in `Sidebar.tsx`
now render `/floe-header-icon.png` directly (same asset, same pattern as
`Header.tsx`), so the sidebar and marketing header show the same real
mark instead of two different logos. `charts.tsx`'s hardcoded
axis/grid/tooltip colors (`INK`, `INK_MUTED`, `GRID`, `SURFACE` consts,
donut center-label fill, `Tip` background) remapped to slate/ink
equivalents; and a couple of "recessed panel" backgrounds
(`bg-deep-space/50`/`/60` on `ForkForm`'s inputs and `Block`'s code
display in `traces/[id]/page.tsx`) switched to `bg-black/[0.04]` — a
plain opacity-on-white token flip would have made those *lighter* than
the card behind them instead of visually sunken, the opposite of the
original dark-theme effect. `ui.tsx`'s `PageHeader` sticky bar
(`bg-deep-space/80` + blur) needed no such fix — a translucent white
frosted bar over scrolling content is the same "glass" idiom as the
marketing site's `.frost-panel`, so the plain token flip already reads
correctly there.

**Deliberate exception — the Logs page's terminal panel stays dark.**
`logs/page.tsx`'s `{/* Terminal */}` block was first flipped to
`#EEF2F6` along with everything else in this pass, then explicitly
reverted per follow-up direction ("make the color scheme... macos's
default semi-dark scheme"): it's now a hand-picked semi-dark gray
(`#1E1E1E`, evoking macOS Terminal.app's dark profile — not `#0A0A0A`,
which reads as closer to pure black) rather than participating in the
page's light theme. This specifically mirrors
`app/components/product/LogStream.tsx`, the marketing mockup, whose own
top comment claims to be a "faithful reproduction of the real
terminal-styled log stream at app/dashboard/logs" — that relationship
would otherwise have broken silently when the rest of the dashboard went
light. Because the block is dark while its surrounding page is light, it
can't lean on the shared `starlight`/`dim-starlight`/`signal` Tailwind
tokens for its text (those now resolve to ink/slate/frost-blue, illegible
on a dark panel) — its timestamp/source/message/link colors are
hand-set literal light-on-dark hex (`#828282`/`#8B95A3`/`#D4D4D4`/
`#5FA8D3`) matching `LogStream.tsx`'s own literal values, and its
hairline/hover utilities use `white/[opacity]` instead of the `black/
[opacity]` used everywhere else on this page. If you touch this block
again, keep it dark and keep its text colors self-contained — don't
"fix" it back onto the shared light tokens.

The marketing site still doesn't consume these tokens at all — every
marketing component uses literal inline hex against the `--arctic-*`
custom properties — so this change doesn't create a new coupling between
the two surfaces, it just makes their *values* match by coincidence of
shared intent. Don't assume future arctic-palette tweaks (e.g. adjusting
`--frost-700`) propagate to the dashboard automatically, since the
dashboard's tokens are separate, independently-set values that merely
equal the arctic ones today.

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

Everything on the marketing site must trace to something real — either in
this repo (`app/dashboard/`, `lib/replay/`) or in the actual Python CLI,
which lives at `replay/` on the **`main`** branch (not checked out in this
worktree; read it with `git show main:path/to/file`). `main`'s
`README.md` is the product's own positioning doc and is worth re-reading
before writing new copy — it's where the "Git for agent execution."
tagline (now used as the hero eyebrow) comes from.

- **Trace** = one `query` handled by an `agent`, made of **spans**
  (`agent | task | llm | tool` — see `lib/replay/types.ts`). Real UI:
  indented waterfall, `◆` = forkable span.
- **Fork** = edit a forkable span's input → generates a **Replay**.
  `lib/replay/fork.ts` classifies every other span relative to the fork
  point: **cached** (before, reused untouched), **forked** (the edited
  span), **downstream** (after, re-run because it depended on the
  changed value). Real UI shows a literal red `−` / green `+` field diff
  on the forked span.
- **Two different fork paths**, per `replay/core/engine.py` on `main` —
  copy on `/` (Replays section) now distinguishes these: forking a
  **tool** span re-runs just that tool and threads the new result into
  downstream LLM calls; forking an **LLM** span discards downstream spans
  entirely and replays the *whole agent loop* from there, which can
  genuinely diverge onto a different path. The one real example baked
  into `lib/replay/sample-real.json` (`get_capital`, Zorblax→Paris) is a
  **tool** fork — there's no real captured LLM-fork trace to show, so
  don't fabricate a second visual example; explain the LLM-fork case in
  prose only, like the current copy does.
- **Tool registry / safety** (`replay/tools.py`, `replay/core/
  tool_registry.py` on `main`) — tools are declared
  `@replay.tool(safe=True)` (safe to actually re-run during a replay) or
  left unsafe. When a replay hits an unsafe tool downstream of a fork,
  the real engine pauses and asks: run for real / use a registered
  `replay_fn` alternative / manually provide the output / skip (reuse
  cached) / stop. This is covered in the Replays section's "What about
  side effects?" block — the single most differentiated mechanic in the
  real product, so don't let future edits cut it for space.
- **Real CLI commands worth naming in copy**: `replay.init()` (one-line
  setup, OTel auto-instruments OpenAI/LangChain-LangGraph/LlamaIndex),
  `replay explore <trace>` (interactive TUI — arrow keys, Enter to fork
  at a ◆ span, the actual UX behind "change one input"), `replay run
  script.py` (run + drop into explore in one command), `REPLAY=1 python
  script.py` (env-var shortcut, no code changes beyond `replay.init()`).
- **Naming gotcha, deliberate — do not "fix":** the real installed
  package is still literally named `replay` (`import replay`,
  `replay.init()`, `@replay.tool`) even though the product is branded
  Floe everywhere else. It was never renamed at the code level through
  the Alioth→Replay AI→Polerr→Floe rename cascade. When quoting real
  commands/code in marketing copy, use the real `replay.*` names — that's
  what actually runs today. Don't rebrand code snippets to `import floe`;
  that would be inventing something that doesn't exist, which is the one
  thing this section says not to do.
- **`replay serve`** (`replay/server/` on `main`) is a real, but much
  plainer, web UI already shipped with the CLI — GitHub-dark palette,
  only LLM (blue) and Tool (green) spans get distinct color, agent/task
  are just muted gray. `app/dashboard/`'s fuller 4-color kind system
  (agent=indigo, task=amber, on top of llm/tool) is polish beyond what
  `replay serve` actually looks like today — that's fine, normal
  marketing-site aspirational polish, not an inaccuracy (the underlying
  kind taxonomy is still correct) — just don't assume `replay serve`
  visually matches `app/dashboard/` if you're ever asked to reconcile them.
- **Logs**: terminal UI, level chips (DEBUG/INFO/OK/WARN/ERROR), source
  tags (tracer/engine/loader/tool/cli).
- Sidebar IA: Overview, Traces, Replays, Logs.

The pitch is the fork→diff mechanism specifically — "change one input
mid-trace, see exactly what reruns" — not generic
"legibility/interpretability" language. If new copy can't be pointed at a
real screenshot, a real field name, or a real file on `main`, don't add it.

---

## Page Structure

Each page is normal document flow — no `position: fixed` section pinning,
no scroll-percentage transforms. Where motion is used, it should be a
simple `whileInView`/CSS transition, not a shared scroll-timeline engine.
`app/components/hud/IceCrack.tsx` (procedural fracture-line canvas) still
exists and still works if a future page wants a background accent, but the
current pages deliberately don't use it — the real UI components carry
the visual weight instead (see "Why this shape" above).

## Intro loader — one-time "Floe" splash on first visit

`app/components/IntroLoader.tsx`, rendered by `app/components/
IntroGate.tsx`, which wraps all of `LandingPage`'s content
(`app/(marketing)/page.tsx`) — see the "Intro-gated content loading"
subsection below for what `IntroGate` does beyond just showing the
splash. The splash itself is the only exception so far to "no
scroll-jacking, but otherwise plain document flow": a `position: fixed`
full-viewport overlay, but it's a one-time pre-content splash, not a
scroll mechanism, so it doesn't conflict with the rule above.

**What it does:** "F" and "loe" spring in from the left/right edges of
the screen and collide in the center to form "Floe", each tinting from
black to a color and back in one continuous pulse timed around the
collision — "F" to `#4781bc`, "loe" to `#99bcda`. There is no
particle/shard burst at impact (removed — see history below) and no
"curtain" of two solid panels physically sliding apart to reveal the
page (also removed). The letters simply keep moving on across the
screen past center while the solid `--arctic-bg` background layer fades
out underneath them, revealing the real page. Don't reintroduce either
removed mechanic without a fresh explicit ask.

**Design history, in order (useful if asked to change this again):**
1. Fade-out overlay (single panel, `AnimatePresence` exit) + an icy
   shard/particle burst at impact.
2. Curtain: two solid `--arctic-bg` panels, each carrying half the
   wordmark, sliding apart to the edges, still with the shard burst —
   explicitly requested to replace (1)'s fade because it read as
   generic; the panel motion made the reveal itself feel like part of
   the "ice cracking" narrative.
3. Curtain panels removed again, back to a single fading background —
   explicitly requested to simplify (2), keeping the letters moving
   across the screen (inherited from (2)'s exit motion) but decoupling
   the reveal from any solid moving panel. Also added the
   black→color→black flash on the letters at impact (still with shards
   at this point).
4. The shard/particle burst removed entirely, and the black→color→black
   flash's transition duration slowed on both the in and out legs
   (`FLASH_TRANSITION` raised from 0.2s to 0.55s) — both explicitly
   requested together. `FLASH_HOLD_MS`/`PART_DELAY_MS` were recomputed
   off `FLASH_TRANSITION.duration` (rather than off shard timing, which
   no longer existed) so the pulse fully completed before parting began.
   At this point the flash was still a discrete `flashActive` boolean
   toggled true/false by two separate `setTimeout`s, starting only *at*
   the knock (`IMPACT_DELAY_MS`), not before it.
5. Reworked into one continuous keyframed color pulse, symmetric around
   the knock — explicitly requested ("the color starts fading... before
   knocking", "the point where the color starts fading in should be the
   point where the color is nearly faded out", "a continuous motion with
   a short pause in the middle"). `flashActive` state and its two timers
   were removed; each letter's `color` animates through a fixed
   4-keyframe array (`[INK, FLASH_COLOR, FLASH_COLOR, INK]`) via
   `times`/`delay`/`duration`, starting *before* the knock, reaching full
   color right around it, holding briefly (`FLASH_HOLD_MS` = 120ms,
   centered on the knock), then fading back out over the same duration
   it took to fade in. At this point `PART_DELAY_MS` waited for the
   whole pulse to finish (`FLASH_END_MS + 100`) before parting began.
6. Current: the fade-out leg made deliberately longer than the fade-in
   leg (`FLASH_RAMP_OUT_MS` = 400ms vs. `FLASH_RAMP_IN_MS` = 250ms —
   no longer symmetric) and `PART_DELAY_MS` moved earlier
   (`FLASH_PEAK_END_MS + 50`, right after the hold ends) so parting now
   *overlaps* with the fade-out instead of waiting for it to finish —
   both explicitly requested together ("make the color change last a
   little longer when the letters are moving out"). Confirmed via
   `getBoundingClientRect`/computed-color inspection that the letters
   are well off-center while the color is still measurably mid-fade, not
   yet back to pure ink. See the constants block above `IntroLoader`'s
   component definition for the exact math.

**Session/accessibility behavior:** plays once per browser session
(`sessionStorage`, key `floe-intro-seen` — not `localStorage`, so it
replays on a genuinely fresh visit later, just not on repeat
client-side navigation back to `/` within one session) and skips
entirely under `prefers-reduced-motion`. A tap/click anywhere on the
overlay fast-forwards straight to fully revealed (interruptible, per
ui-ux-pro-max's no-blocking-animation guidance).

**Implementation gotchas worth knowing before touching this file:**
- **The phase machine's very first render (`"cover"`) is a plain,
  deterministic solid-color div, not `null`.** Returning `null` there
  (i.e. rendering nothing until the mount effect decides something) let
  the real page flash through underneath for a frame before JS finished
  booting, which read as a bug, not a feature — the SSR-safe cover div
  fixes that without introducing any hydration risk since it has zero
  dynamic content, matching what the server rendered. (This project
  previously also generated random shard-particle trajectories inside a
  `useEffect` callback rather than during render, for the same
  SSR/hydration-safety reason — the shard system itself is gone now,
  but if any future effect needs `Math.random()`-derived render output,
  keep it effect-scoped, never render-scoped.)
- **React Strict Mode's dev-only double effect invocation
  (mount→cleanup→mount) will cancel the animation on the second pass in
  development if the play/skip decision and the `sessionStorage` write
  aren't guarded.** The component's own effect writes
  `sessionStorage.setItem(SEEN_KEY, "1")`; that write survives the
  cleanup between the two Strict Mode invocations (unlike component
  state/refs), so an unguarded second invocation would read its own
  "seen" flag back and think it's a repeat visit, hiding the intro
  before it plays — dev-mode only, but confirmed via direct testing.
  Fixed with a `useRef<boolean | null>` that caches the play/skip
  decision on the *first* invocation only; the second invocation reuses
  the cached decision and schedules its own fresh timers (the first
  invocation's timers get legitimately cleared by Strict Mode's
  cleanup — that part is normal and expected).
- **If a future version reintroduces a solid panel wrapping each
  letter, don't also give the letter its own independent "parting"
  animate target "to make sure it moves with the panel."** This was
  tried during the curtain version and produces a doubling bug: a
  letter nested inside a panel `motion.div` already inherits the
  panel's `translateX` via ordinary CSS transform composition —
  confirmed by direct `getBoundingClientRect`/computed-style inspection
  (the letter's screen position tracked its panel's transform exactly,
  1:1). Giving the letter its own equal-and-independent transform on
  top of that made it travel twice the intended distance. In the
  current (panel-free) version this doesn't apply — each letter owns
  its `x` target directly since there's no panel to inherit from.
- **The black→color→black flash is now a single constant 4-keyframe
  array on `color` (`[INK, FLASH_COLOR, FLASH_COLOR, INK]`), not a
  state-toggled two-step transition.** An earlier version toggled a
  `flashActive` boolean true/false via two `setTimeout`s and switched
  `color`'s target between two plain (non-array) values — that only
  supported a flash that *starts* exactly at the knock, not one that
  ramps in beforehand. The constant-keyframe version is safe here
  specifically because the array's *values* never change across
  re-renders (unlike an earlier documented case in this file where a
  keyframe array's target depended on a boolean that kept changing) —
  Framer Motion plays a keyframe array reliably as long as its resolved
  value is stable, which this is. The keyframe `times` are derived from
  `FLASH_START_MS`/`FLASH_PEAK_START_MS`/`FLASH_PEAK_END_MS`/
  `FLASH_END_MS`, all computed from `IMPACT_DELAY_MS ± FLASH_RAMP_IN_MS`/
  `FLASH_RAMP_OUT_MS`/`FLASH_HOLD_MS` — don't hardcode the `times` array
  or the `delay`/`duration` numbers directly; if any of those constants
  change, the pulse's in/out legs and its hold centered on the knock
  should recompute automatically. The ramp durations are deliberately
  *not* equal (`FLASH_RAMP_OUT_MS` > `FLASH_RAMP_IN_MS`, see design
  history above) — don't "fix" them back to a single shared constant
  without a fresh explicit ask. The `x`/`opacity` and `color` transitions
  are intentionally different
  objects on the same `animate` call (`{ ...(parting ? PART_TRANSITION :
  CONVERGE_SPRING), color: F_COLOR_TRANSITION }`) so the color pulse
  always runs on its own fixed timeline regardless of which position
  transition (spring vs. tween) is active at that moment.
- Verify any future timing change by checking `getComputedStyle(...).
  transform`/`getBoundingClientRect()` at specific millisecond
  checkpoints via Playwright, not just eyeballing screenshots — several
  of the bugs above produced identical-looking screenshots whether the
  underlying motion was correct or not, and a stale Next.js dev-server
  bundle (test running before HMR finished recompiling a just-edited
  file) can also produce misleading "no change" results — insert a
  throwaway navigation/wait before timing-sensitive checks if the file
  was just saved.

## Atmospheric video

`app/components/hud/AtmosphericVideo.tsx` plays `public/floe-hero.mp4` (real
footage — an ice floe with a polar bear, licensed/sourced by the user, not
stock) as a muted/looped background layer. Falls back to a static icy
gradient under `prefers-reduced-motion` instead of autoplaying. Used in
two places on Landing, both deliberately subtle (heavily desaturated, 14%
opacity, same flat full-bleed treatment, no vignette so it persists across
the whole section rather than fading to solid background) — never as the
hero visual itself, same reasoning as "Why this shape" above:
- The hero (plays once, `loop={false}`, plus a bottom mask-fade so the
  video dissolves into the next section instead of cutting off on a hard
  edge — see the Landing structure note above)
- The KPI strip (behind the real Overview numbers, looping)

The hero also has `app/components/hud/VideoColorWindow.tsx` — **not** a
separate framed video (a boxed/bordered version of this was tried and
explicitly rejected — "i dont want the video in a new window"). It's a
second full-bleed `<video>` playing the same `floe-hero.mp4` source,
positioned identically (`inset: 0`, same `objectFit: cover`) to the
desaturated `AtmosphericVideo` layer beneath it, so it reads as the same
background rather than a distinct element. It's masked to an open-ended
horizontal reveal — transparent up to 52%, fully opaque by 60%, and
opaque the rest of the way to the hero's right edge (`maskImage:
linear-gradient(to right, transparent 0%, transparent 52%, black 60%)`)
— so everything from 60% of the hero's width onward is in color/fully
opaque. A bounded rectangle version (padded in from all four edges, not
spanning to the hero's edge) was tried in between and explicitly reverted
back to this open-ended band — don't reintroduce the rectangle/nested
vertical-mask wrapper without a fresh explicit ask. Its `grayscale()`
filter amount and opacity are both driven off that video's own
`currentTime`/`duration`, tracked via a
`requestAnimationFrame` loop rather than the `timeupdate` event —
`timeupdate` only fires a handful of times per second in most browsers,
which reads as visibly stepped when driving a continuous CSS filter off
it, so it was swapped for rAF's per-frame updates specifically to make
the transition smoother. Raw progress is then rescaled by a
`fullColorAt` prop (default `0.8`) via `Math.min(1, progress /
fullColorAt)` before easing, so the reveal finishes — grayscale fully
resolved, opacity fully ramped — 80% through the clip rather than at
100%, then holds there for the remaining 20% (was explicitly requested;
don't reset this back to reaching full color only at the very end). The
rescaled value runs through a smootherstep ease (`6p^5-15p^4+10p^3`,
Perlin's improved version of an earlier plain smoothstep `p*p*(3-2p)`) —
its derivative peaks higher at the midpoint than smoothstep while staying
flatter at both ends, so more of the change happens through the middle
of the reveal rather than at a constant rate, per explicit "more
mid-range heavy" direction. A future ask to tune the easing curve or
`fullColorAt` further isn't a correction of a bug, it's the next
deliberate step (a `filterExtras` prop appends the same
`brightness(1.25) contrast(0.85)` the background layer uses, so the two
layers match in tone everywhere except saturation). Within the masked
region, grayscale runs 1→0 (gray to full color) and opacity runs the
`baseOpacity` prop (`0.2`, matching the `AtmosphericVideo` layer's own
"standard" opacity) →1 (fully opaque) in lockstep — so the masked region
goes from "standard, subtle background" to fully dominant at the same
eased rate it goes from gray to color, per explicit direction that this
region should end up "mostly background dominated rather than intro text
dominated," independent of and not synced frame-for-frame with the
`AtmosphericVideo` layer (separate `<video>` element, same src). Renders
nothing under `prefers-reduced-motion` rather than a static frame, since
the reveal-over-time is the entire point.

`#waitlist` (`WaitlistForm`) no longer uses `AtmosphericVideo` — per
explicit direction, it now shows a static still, `public/floe-waitlist-
still.jpg`, extracted via `ffmpeg -sseof -0.5 -i public/floe-hero.mp4
-update 1 -frames:v 1 -q:v 3 ...` (the actual last frame of the same
source footage) and rendered as a plain absolutely-positioned `<img>` with
the same filter/opacity treatment the video used, plus a top
`maskImage`/`WebkitMaskImage` fade (`transparent` at 0 to fully visible
by 160px) so the `#replays`→`#waitlist` boundary reads as the same kind
of gradient dissolve as the hero's bottom mask-fade, rather than the hard
`borderTop` hairline this boundary used to have. If asked to touch this
section's background again, don't reach for `AtmosphericVideo` there —
the still is the deliberate choice, not a placeholder.

Because that whole `#waitlist` region sits over a textured image (no
longer moving, but still desaturated footage rather than flat
`--arctic-bg`), its text uses `var(--ink)` throughout
(headline, body copy, Footer links, copyright) rather than the
`--slate`/`--slate-dim` used for body/secondary text everywhere else on
the page — the lighter slate tones read fine against flat white but lose
contrast against the video. Keep this section on `--ink` even if you're
tempted to reach for `--slate` for a "secondary" line.

`app/video-concepts/` (the exploratory spin-off that surveyed four
placement options against this component) has been deleted — options A
and D from that exploration are the two placements actually live, above.

**Source file**: the original export was `floe_hero.mov` at the repo root
— 105MB ProRes 1080p, not web-usable as-is. Transcoded via `ffmpeg -map
0:v:0 -an -c:v libx264 -preset slow -crf 24 -vf scale=1600:-2 -pix_fmt
yuv420p -movflags +faststart` down to the 2.2MB `public/floe-hero.mp4`
actually served. The raw `.mov` is **not** gitignored — don't let it get
swept into a `git add -A`; either add it to `.gitignore` or move it
outside the repo if it's still needed as an archival source.
