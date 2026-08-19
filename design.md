---
version: "alpha"
name: "LILA Player Journey Visualization Tool"
description: >
  Internal Level Design tool for exploring LILA BLACK player telemetry.
  Dark, high-contrast data-visualization UI. The four accent tokens below
  (human, loot, kill, storm) are exact, unmodified hex values sampled
  directly from LILA BLACK concept art supplied with this assessment —
  see brandguidelines.md for the sampling method. Neutral/structural
  tones (background, surface, border, text) are adjusted from the art's
  dominant background tones for on-screen contrast, not used verbatim.
  This is a tool-specific design system, not a claim about LILA's
  official brand identity (no brand kit, logo, or typography spec was
  provided alongside the assignment).
colors:
  background: "#14151b"
  surface: "#1f212a"
  surfaceRaised: "#2a2d38"
  border: "#3e424c"
  textPrimary: "#ede9e2"
  textSecondary: "#9a97a6"
  human: "#5df8f4"
  bot: "#7e8fa0"
  loot: "#f8cf65"
  kill: "#f63d4c"
  killed: "#c23440"
  storm: "#d34dd9"
  focusRing: "{colors.human}"
typography:
  ui:
    fontFamily: "Inter, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "0px"
  uiEmphasis:
    fontFamily: "{typography.ui.fontFamily}"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.45
    letterSpacing: "0px"
  heading:
    fontFamily: "{typography.ui.fontFamily}"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  data:
    fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0px"
    fontFeature: "tnum"
rounded:
  none: "0px"
  sm: "4px"
  md: "8px"
  lg: "14px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "20px"
  xl: "32px"
  xxl: "48px"
components:
  panel:
    background: "{colors.surface}"
    border: "{colors.border}"
    rounded: "{rounded.md}"
  mapViewport:
    background: "{colors.background}"
    rounded: "{rounded.lg}"
    minTouchTarget: "44px"
  heatmapLayer:
    renderer: "canvas"
  filterControl:
    background: "{colors.surfaceRaised}"
    text: "{colors.textPrimary}"
    rounded: "{rounded.sm}"
    minTouchTarget: "44px"
  legendSwatch:
    rounded: "{rounded.pill}"
  playbackScrubber:
    track: "{colors.border}"
    fill: "{colors.human}"
    rounded: "{rounded.pill}"
    minTouchTarget: "44px"
---

## Overview

This is a working tool for Level Designers, not a marketing surface — the design should read as precise and quiet, the way a map inspector or flight-radar display does, so the data itself stays the loudest thing on screen. The mood is drawn directly from LILA BLACK's own concept art (a player diving through a bright vortex; a lone figure facing a glowing red signal tower against a dark, wired-up sky): dark, high-contrast, slightly ominous environments, punctuated by a small number of saturated accent colors that mean something specific rather than decorating. That translates directly to a UI convention: **the background stays dark and desaturated everywhere, and every saturated color on screen is a data signal (human vs. bot, event type), never a decoration.** If a color appears, it should be answering "what is this."

## Colors

The full palette is a small, direct extraction from the concept art's own pixels (measured, not eyeballed) — a set of dark neutrals for structure, plus four saturated accents pulled from the art's own highlights:

- `background` (`#14151b`) and `surface` (`#1f212a`) come from the near-black tones anchoring both pieces of concept art. `surfaceRaised` (`#2a2d38`) lifts interactive elements (panels, filter controls) one step off the base without introducing a new hue.
- `human` (`#5df8f4`, a bright cyan/teal) is the single highest-contrast, coolest color in the vortex artwork — reserved exclusively for human player paths and their default interactive state (focus rings, active filters), so a Level Designer's eye goes straight to "the person" on a busy map.
- `bot` (`#7e8fa0`, a muted slate-blue) is deliberately recessive — visible, distinguishable, but never competing with `human`. Bots should read as background context unless specifically being inspected.
- `loot` (`#f8cf65`, gold) is lifted from the warmest highlight in the vortex art and doubles as an intuitive "treasure" convention.
- `kill` (`#f63d4c`) is the saturated red anchoring the signal-tower artwork — used only for combat-death markers (`Kill`/`Killed`/`BotKill`/`BotKilled`), with `killed` as a darker derived variant (`#c23440` — computed by darkening `kill`, not separately sampled from the art) to distinguish "this player got a kill" from "this player died" at a glance without relying on shape alone.
- `storm` (`#d34dd9`, magenta/purple) comes from the vortex art's portal core and is reserved for `KilledByStorm` — visually tying "environmental death" back to the otherworldly imagery it's drawn from, and keeping it unambiguous against `kill`/`killed` red.

No other saturated colors should enter the palette without a specific data meaning attached to them.

**Verified contrast (WCAG 2.1 AA), computed against `background` (`#14151b`):** `textPrimary` 15.05:1, `human` 14.05:1, `loot` 12.23:1, `bot` 5.49:1, `storm` 5.06:1, `kill` 4.94:1 — all pass both the 4.5:1 text threshold and the 3:1 non-text/graphical-object threshold. `killed` (`#c23440`) is the one exception: 3.35:1, which passes the 3:1 bar for markers/icons/graphical objects but fails the stricter 4.5:1 text bar (`kill` is also only marginal, 4.35:1, on the raised `surface` tone). Consequence: `kill` and `killed` are approved for markers, icons, and legend swatches, but must never be used as text color for body copy or small labels — use `textPrimary`/`textSecondary` for any actual text, full stop.

## Typography

No typography was specified anywhere in the source material (the concept art is illustration, not a brand kit), so this section is a functional choice for a data-dense tool rather than something derived from LILA's assets — worth being explicit about rather than presenting it as if it came from somewhere it didn't. `Inter` (or the nearest system sans) for all UI chrome, legible at small sizes and neutral enough not to compete with the map. A monospace (`data` token) is used specifically for coordinates, timestamps, and match/user IDs, with tabular figures (`fontFeature: tnum`) so numbers in filter panels and tooltips align in columns instead of jittering as they update during playback.

## Layout

The map view is the primary surface and should dominate the viewport; filters, legend, and playback controls are secondary chrome that frames it rather than competing with it. Use a left or top control rail (map/date/match filters + legend) at a fixed width, with the map viewport filling the remaining space and scaling to it. Spacing follows the `spacing` scale strictly — `md` (12px) between related controls in a filter group, `lg` (20px) between distinct panel sections, `xl`/`xxl` only for separating the control rail from the canvas. Avoid dense grids of small stat tiles; this tool has one hero visualization (the map) and everything else supports it.

**Responsive breakpoints:** mobile (<768px), tablet (768–1279px), desktop (≥1280px). Below tablet, the control rail collapses into a bottom sheet or top drawer rather than sitting beside the map permanently — on a phone screen, a fixed side rail would leave the map too small to be useful. Every interactive element (`filterControl`, `playbackScrubber`, `legendSwatch` when tappable, filter chips) respects a 44×44px minimum touch target regardless of breakpoint, per the `minTouchTarget` token on those components — this isn't a mobile-only rule, it also improves precision on trackpads/touchscreens at desktop width. Because the source minimaps are up to 4320px square (§ verified in PRD.md) and cannot simply scale to fit a 375px viewport without losing legibility, the map viewport needs pinch-zoom and pan at all breakpoints, not just a passive `object-fit: contain` shrink. Note honestly: this tool's ideal use case (precise spatial analysis) is still desktop/tablet-first — "responsive" here means nothing breaks or becomes unusable on a phone, not that a phone is the intended primary device.

## Elevation & Depth

Depth is communicated by the `surface` → `surfaceRaised` step, not by heavy shadows — the concept art's own depth comes from lighting and contrast, not drop-shadow layering, and the UI should follow that logic. Reserve any shadow use for transient overlays only (tooltips, the playback scrubber's active thumb) and keep it subtle (soft, low-opacity, no more than 8px blur).

## Shapes

Corners are functional, not decorative: `rounded.sm` (4px) for compact controls (buttons, filter chips, dropdowns), `rounded.md` (8px) for panels, `rounded.lg` (14px) for the minimap canvas frame, and `rounded.pill` reserved for two specific uses — legend swatches (so color, not shape, is the signal) and the playback scrubber track/thumb.

## Components

- **Map viewport**: renders on `background`, framed with `rounded.lg` and a 1px `border` edge. Player paths and discrete event markers render as **SVG**, not canvas — the dataset is small enough (max 15 files/match, ~89K rows total, per PRD.md §2) that SVG's per-marker performance cost is a non-issue, and unlike canvas, SVG gives each marker a real, focusable DOM node with an `aria-label` (e.g. "Kill — human player, 00:03 into match") so a screen reader can actually perceive individual events. Canvas is reserved for the `heatmapLayer` only, where the content is a continuous density gradient, not discrete semantic data a screen reader could meaningfully enumerate anyway — that gap is covered by a text summary instead (see below).
- **Event markers**: shape-coded in addition to color-coded, since color alone isn't accessible to everyone reading a fast-moving playback — e.g. a filled circle for `Position`/`BotPosition` samples, a diamond for `Kill`/`BotKill`, an X for `Killed`/`BotKilled`, a small triangle for `KilledByStorm`, a square for `Loot`. Human markers render solid; bot markers render at reduced opacity (~70%) using the same shape language, so the human/bot distinction survives even for someone who can't rely on `human`/`bot` hue alone. Every marker carries an `aria-label` describing event type, human/bot, and normalized playback time — this is what makes the SVG choice above actually pay off, not just a rendering-technology swap.
- **Filter controls** (map/date/match): live on `surfaceRaised`, `rounded.sm`, minimum 44×44px touch target, always visibly reflect the current selection — no filter should silently apply without a visible chip/label showing it's active. Fully operable by keyboard (tab order, `Enter`/`Space` to toggle, visible `focusRing`), not mouse/touch-only.
- **Match picker**: each match entry shows a participant-count badge (e.g. "👥 12") so richer, more informative matches are discoverable rather than the picker presenting all 796 matches as equivalent when most have exactly one participant.
- **Playback scrubber**: track in `border`, fill in `human` (regardless of what's being played back — this is a UI-state color, not a data color), with speed control (0.5×/1×/2×/4×), a visible "normalized progress" label so it's honest that this isn't literal elapsed match time (see PRD.md §6), and a 44px-minimum draggable thumb that's also operable via arrow keys once focused.
- **Heatmap toggle/legend**: heatmap layers use a sequential gradient anchored on `kill`/`storm` hues (low → high density), kept visually distinct from the discrete event-marker colors so "aggregate density" and "this specific event" are never confused. Because the heatmap itself is a raster gradient with no individual data points to label, pair it with a short text summary (e.g. "Highest kill density: northeast quadrant, near the tower") so the same information isn't visual-only.

## Do's and Don'ts

- Do keep the background dark and neutral everywhere except the four data-accent colors (`human`, `bot`, `loot`, `kill`/`killed`, `storm`) — five, counting the bot/human pair.
- Do pair every color-coded distinction with a shape or label, not color alone.
- Don't introduce new saturated colors for UI chrome (buttons, links, badges) — reuse `human` as the single interactive/focus color so the palette stays legible as "these colors mean data" throughout.
- Don't let heatmap gradients and discrete event markers share a color family in the same view — a Level Designer should never have to guess whether a red dot is a `kill` marker or a heatmap density cell.
- Don't present the storm/environmental color (`storm`, purple) anywhere except `KilledByStorm` markers and the vortex-inspired accents explicitly called out above — it's a specific signal, not a general decorative purple.
- Don't add drop shadows or gradients beyond what's specified here; the concept art's depth comes from contrast and lighting, and the UI should earn depth the same way.
- Don't use `kill` or `killed` as text color for labels or body copy — verified contrast fails or is marginal at text-sized thresholds (see Colors). They're approved for markers/icons/swatches only.
- Don't render discrete player paths or event markers in canvas — use SVG, so each marker is a real, screen-reader-perceivable DOM node (see Components). Canvas is for the aggregate heatmap layer only.
- Don't ship any interactive control below the 44×44px touch target minimum, at any breakpoint — this is a correctness rule, not a mobile-only nice-to-have.
- Don't let the map viewport go static-zoom-only on small screens; if it can't pinch-zoom/pan, it's not actually usable on a phone, just present on one.
