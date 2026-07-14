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
  product surface (the real console, still dark-themed with functional
  chart color — not part of the arctic redesign). `Footer` is not in the
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
padding are both intentionally tight — 48px/56px, not the ~100px/120px an
earlier pass used — so the trace visual rises into view soon after the
fold instead of after a long dead scroll, and the hero's background video
layer carries a bottom mask-fade so it dissolves into the page rather than
cutting off on a hard line; the ReplayDiff wrapper's `maxWidth` matches the
`#traces`/`#replays` wrapper at 1100, not a wider one, so all three real-UI
blocks share one column width), real KPI numbers as immediate credibility,
`#traces` (real trace waterfall + log stream, large), `#replays` (the real
recorded fork example
— `get_capital`, country Zorblax→Paris, 6 downstream spans — with
cached/forked/downstream callouts), then `#waitlist` (`WaitlistForm`,
`app/components/WaitlistForm.tsx` — email capture, then `Footer`) as the
close. There's no dashboard-screenshot preview here anymore — see the
`dashboard-preview.png` note above.

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
faint hand-authored contour-line SVG, ~7% opacity, used behind every page's
hero only — deliberately not tiled sitewide, so it reads as atmosphere,
not wallpaper), and `.arctic-code-block` (applied to the outer wrapper of
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

`#waitlist` (`WaitlistForm`) no longer uses `AtmosphericVideo` — per
explicit direction, it now shows a static still, `public/floe-waitlist-
still.jpg`, extracted via `ffmpeg -sseof -0.5 -i public/floe-hero.mp4
-update 1 -frames:v 1 -q:v 3 ...` (the actual last frame of the same
source footage) and rendered as a plain absolutely-positioned `<img>` with
the same filter/opacity treatment the video used. If asked to touch this
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
