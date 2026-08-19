# Brand & Visual Guidelines — LILA Player Journey Visualization Tool

**Scope note (read this first):** This is not LILA's official brand kit. No logo, brand color codes, or typography spec was provided with the assignment — I checked, and none exists anywhere in the assignment materials. What *was* provided are two pieces of LILA BLACK concept art, embedded directly in the written-test document. This file is the human-readable rationale for a **tool-specific** visual identity derived from that art — for you and for whoever evaluates this submission to read — as distinct from `design.md`, which is the machine-readable token contract an AI coding agent (Claude Code / Cursor) consumes while actually building the UI. Treat this file as "why," and `design.md` as "what."

## Source material

Two pieces of concept art, both extracted directly from the assignment document (`Product Engineer- Written Test- LILA.md`):

1. **"Vortex dive"** — a character diving through a bright, shattering purple-and-teal portal, debris and structure fragments suspended around them.
2. **"Signal tower"** — a lone figure in a yellow jacket, standing before a dark, wire-strewn skyline dominated by a glowing red tower.

Both pieces share a consistent visual language worth naming explicitly, since it's the actual justification for the palette below rather than a stylistic guess: **dark, moody, high-contrast environments, with a small number of saturated colors doing all the emotional work.** Nothing in either image is washed-out or pastel — the contrast between dark surroundings and a few vivid highlights is the entire visual identity. That's a real, load-bearing observation, not a vibe — it's directly why the tool's UI is dark-first rather than a typical light-mode dashboard.

## Palette — derived by direct pixel sampling, not eyeballing

I sampled the actual pixels of both images programmatically (dominant background tones via color quantization, plus a separate pass isolating the highest-saturation highlight pixels) rather than picking colors that "felt right." That's the same standard the rest of this project holds the data pipeline to, and it means every hex value below traces back to a specific pixel in a specific piece of official concept art, not to memory or convention.

| Swatch | Hex | Source | Assigned meaning in the tool |
|---|---|---|---|
| Near-black charcoal | `#14151b` / `#181a22` | Dominant background tone, both images | App background |
| Dark slate | `#1f212a` / `#29323a` | Secondary background regions | Panel/surface background |
| Muted steel-blue | `#3e424c` / `#4c6770` | Mid-tone structural elements (debris, wiring) | Borders, dividers |
| Warm off-white | `#dedde0` / `#f5f4e1` | Highlight/glow edges | Primary text |
| Bright cyan/teal | `#5df8f4` | Portal edge, vortex art | Human player paths (the coolest, highest-contrast color in either image — reserved for the thing we most want a Level Designer's eye drawn to) |
| Gold | `#f8cf65` | Warm highlight, vortex art | Loot markers (also just intuitively reads as "treasure") |
| Magenta/purple | `#d34dd9` | Portal core, vortex art | Storm/environmental death markers — ties back to the "otherworldly" imagery it's drawn from |
| Signal red | `#f63d4c` | Glowing tower, signal-tower art | Kill/death combat markers |

Neutral/structural tones came from the images' own dominant backgrounds (via k-means-style color quantization); the four accent colors came from isolating the highest-saturation, highest-brightness pixels in each image — i.e., the parts an artist deliberately made pop against a deliberately subdued backdrop. Reusing that same logic in the UI (subdued everywhere, saturated only where something specific is being signaled) is the actual design principle being borrowed here, not just the specific hex values.

## Why this matters for the assessment, not just aesthetics

The brief explicitly evaluates "product thinking" and asks whether a Level Designer would actually find the tool useful. A UI where color is decoration competes with a UI where color is data. Because this tool's whole job is helping someone spot patterns in colored markers on a map, the palette had to be built around restraint — few colors, each with exactly one meaning, high contrast against a dark base so nothing gets lost. That's a defensible design decision to walk an interviewer through, and it's traceable back to real source material rather than an arbitrary "dark mode looks modern" choice.

## Accessibility wasn't bolted on after the fact

Worth stating plainly, since it's a better interview story than it might sound: mobile responsiveness and WCAG 2.1 AA accessibility were added to scope after the palette and initial architecture were already drafted (Manoj flagged them mid-project). Rather than treating that as a late add-on, checking the actual palette against it changed a real technical decision — the original plan to render player paths and event markers in `<canvas>` doesn't work for a screen reader (canvas has no DOM, so individual markers are literally invisible to assistive tech), and given how small the real dataset turned out to be (verified in `PRD.md` §2 — at most 15 files per match, ~89K rows total), there was no performance reason to keep canvas for that layer. Switched to SVG for markers/paths, kept canvas only for the heatmap gradient where it belongs. Also ran the actual palette through the WCAG contrast math rather than assuming a dark UI is automatically accessible — one color (`killed`, the darker kill-variant) came back under the 4.5:1 text threshold, so it's restricted to markers/icons only, never text. That's documented in full in `design.md`'s Colors section.

## What this file deliberately does not claim

- This is not LILA's corporate/marketing brand identity — no logo usage rules, no company-wide type system, no claim about how LILA BLACK's *actual* in-game UI looks.
- Typography has no basis in the concept art (illustration, no UI text present) — see `design.md`'s Typography section, which is honest about that and treats font choice as a functional decision for a data-dense tool, not a brand-derived one.
- If LILA has a real, official brand kit that wasn't included in the assignment materials, this file should be treated as superseded by it, not as competing with it.
