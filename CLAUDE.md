### TODO: CONSIDER CHANGING NAME TO polari JUST TO MAKE IT SOUND BETTER WHEN SAYING polari's (polaris).
### consider changing it to "serious" (double entendre- we're serious & sirious)


@AGENTS.md

# Replay AI — Design System Reference

## Stack
- Next.js 16 (App Router), TypeScript, Tailwind v4, Framer Motion 12
- Single route: `app/page.tsx` → four section components in `app/components/`
- Fonts loaded via Google Fonts in `app/globals.css`

---

## Color Palette

### Core
| Name           | Hex       | Role                                          |
|----------------|-----------|-----------------------------------------------|
| Deep Space     | `#080C14` | Global background                             |
| Surface        | `#0F172A` | Overlaid page panels, cards                   |
| Starlight      | `#F1F5F9` | Display headlines                             |
| Dim Starlight  | `#94A3B8` | Body copy                                     |
| Signal         | `#38BDF8` | Primary accent — resolved constellation, CTA  |

### Per-Tab Accent Sub-system
| Tab            | Name             | Hex       | What it marks                                   |
|----------------|------------------|-----------|-------------------------------------------------|
| Insights       | Anomaly Amber    | `#F59E0B` | Deviating cluster — warm against Signal base    |
| Pressure Tests | Divergence Rose  | `#F43F5E` | Diff-color for changed edges between traces     |
| Sandboxes      | Boundary Indigo  | `#818CF8` | Live system + dashed clone boundary             |
| Agent          | Pulse Emerald    | `#34D399` | Traveling verification point                    |

---

## Typefaces
- **Display:** Space Grotesk (weights 300–700) — geometric, technically credible, distinctive letterforms
- **Body:** IBM Plex Sans (weights 300–600 + italic) — IBM technical authority, legible at small sizes
- **Mono:** IBM Plex Mono — for trace IDs, technical labels, code detail text

---

## Constellation Metaphor — Per-Page Mapping

> Raw, unconnected stars = an agent's behavior before anyone has made sense of it.
> Nondeterministic, scattered, illegible. Drawing the edges — guiding the eye from star
> to star until a shape resolves — is Replay's whole act of interpretability.

| Page         | Constellation state                                                                                   | What it's arguing                                                              |
|--------------|-------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------|
| 1. Landing   | Scattered stars resolve into one clean, simple shape as "let us guide you" lands.                    | This is what guidance/interpretability feels like.                             |
| 2. Problem   | A denser, tangled, unresolved cluster — lines that cross and double back without settling.            | This is what it looks like when you can't see why an agent did what it did.    |
| 3. Features  | Each of the 4 tabs gets its own resolved constellation variant (see tab table below).                 | Here's specifically how we do it.                                              |
| 4. Waitlist  | A single calm, fully resolved constellation — callback to the hero's exact shape.                    | The guidance is available to you now.                                          |

### Features Page — Per-Tab Constellation Variants

| Tab            | Constellation translation                                                                                                            |
|----------------|--------------------------------------------------------------------------------------------------------------------------------------|
| Insights       | Most edges calm; one cluster glows Anomaly Amber — the deviating pattern, flagged at a glance.                                      |
| Pressure Tests | Two constellations overlaid — original trace vs. replayed trace. Diverging edges light up in Divergence Rose.                       |
| Sandboxes      | A constellation inside a faint dashed boundary (Boundary Indigo), with a fainter ghost copy just outside — live system and clone.   |
| Agent          | A point of light (Pulse Emerald) travels along the constellation's edges on a slow loop — the agent actively verifying.             |

---

## Features Tab Pop-in Decision

**Approach chosen: left-edge fan / slivers**

As the user scrolls through the Features section (400vh total, 4 × 100vh steps):
- Each tab slides in from the right and takes the viewport.
- The previous tab slides ~52px to the left, revealing a vertical sliver strip at the left edge.
- Each sliver shows: the tab's accent color as a left border + the tab label in rotated small-caps.
- By the final (Agent) tab, three slivers are visible at the left edge: Insights | Pressure Tests | Sandboxes.
- Slivers are clickable — tapping one jumps back to that internal scroll step.

Rationale: gives the user a persistent progress indicator and light navigation affordance without
fighting the vertical scroll axis. Horizontal browser-tab layout was rejected because it competes
with the vertical page-overlay motion.

---

## Page Structure

| Section  | Height | Notes                                              |
|----------|--------|----------------------------------------------------|
| Landing  | 100vh  | Sticky backdrop for Problem overlay                |
| Problem  | 100vh  | Overlays Landing; sticky for Features overlay      |
| Features | 400vh  | Sticky inner panel; 4 internal scroll steps        |
| Waitlist | 100vh  | Overlays Features; final resolved constellation    |

## Signature Element
The hero resolve animation on Landing (Page 1) — scattered stars draw edges tentatively,
resolve into a locked shape, headline sharpens, "let us guide you" lands last.
This animation repeats on Waitlist at ~1.0s (compressed) as a bookend callback.
