# Claude Code kickoff prompt

Paste everything in the fenced block below into Claude Code, run from the root of a fresh git repo that has `PRD.md`, `design.md`, `brandguidelines.md`, the assignment's `README.md`, and the `player_data/` folder (parquet files + minimaps) already in it.

```
You're helping me build a take-home assessment project: a web-based Player Journey
Visualization Tool for LILA BLACK, an extraction-shooter game. Read these files in
this repo before writing any code, in this order:

1. README.md (in player_data/) — the data schema, exactly as given.
2. PRD.md — the product spec, including verified discrepancies between README.md's
   prose and the actual data (minimap image size, match duration, match density).
   Section 2 of PRD.md lists what's actually true about the data vs. what the README
   claims — trust PRD.md's verified facts over README.md's prose wherever they conflict.
   Section 7 covers responsive/accessibility/SEO requirements and why they changed
   the rendering approach (canvas -> SVG) — read this one carefully, it's not optional.
3. design.md — the visual design system (Google Labs DESIGN.md spec format: YAML
   token frontmatter + prose sections). This is the UI's source of truth for colors,
   typography, spacing, component styling, responsive breakpoints, and accessibility
   rules (contrast-verified color usage, touch target sizing, SVG-not-canvas for
   markers). If the `design.md` CLI tooling is available (`npx @google/design.md`),
   use `export --format tailwind` to generate a Tailwind theme from it rather than
   hand-translating tokens, and run `npx @google/design.md lint` to re-verify contrast
   before you consider the UI done.
4. brandguidelines.md — rationale for design.md's choices, for your own context.

Tech stack (already decided in PRD.md's architecture reasoning — don't relitigate
this without telling me why):
- Next.js + TypeScript, deployed to Vercel. Use Next's built-in metadata API for
  page titles/descriptions/Open Graph tags (SEO — see PRD.md §7); this doesn't
  require anything beyond normal Next.js usage.
- Tailwind CSS, themed from design.md's tokens.
- Data pipeline: a Python script (pandas + pyarrow) that runs ONCE, offline, over
  all ~1,243 files in player_data/{FebruaryXX}/, decodes the `event` column from
  bytes, classifies each file's user_id as human (UUID) or bot (short numeric ID),
  and emits compact static JSON — one file per match (or per day, whichever proves
  easier to fetch/filter client-side) — into a data/ or public/data/ directory that
  the Next.js app reads. Also precompute the aggregate heatmap density grids here
  (per map, per date range) rather than computing KDE in the browser.
- No live backend, no database, no in-browser parquet parsing (duckdb-wasm etc.) —
  the dataset is small (~89K rows total) and doesn't justify that complexity.
- Rendering: SVG (NOT canvas) for player paths and discrete event markers — this
  was Canvas in an earlier draft, changed because canvas has no DOM nodes and is
  invisible to screen readers, and the dataset is small enough (max ~15 files per
  match, ~89K rows total) that SVG's per-marker cost is a non-issue. Canvas is
  reserved ONLY for the aggregate heatmap layer, which is a continuous gradient,
  not discrete semantic content. See design.md's Components section for exact
  marker shapes and required aria-labels.
- Responsive: mobile-first CSS, breakpoints at <768px / 768-1279px / >=1280px
  (design.md's Layout section). Below tablet width, the filter/legend rail
  collapses into a bottom sheet or drawer instead of a fixed side panel.
- Accessibility target: WCAG 2.1 AA. Every interactive control (filters, playback
  scrubber, match picker entries) needs a 44x44px minimum touch target, full
  keyboard operability (tab order, Enter/Space, visible focus ring using the
  focusRing token), and — for SVG markers — an aria-label describing event type,
  human/bot, and playback position. The map viewport needs pinch-zoom/pan support
  at all breakpoints, since the source minimaps are up to 4320px square and can't
  just shrink to fit a phone screen.

Build in this order, from PRD.md §9. After each stage, show me what you built and
wait for me to say "continue" before starting the next stage — don't build all
features shallowly and then polish; get each stage right before moving on:

1. Data pipeline (parse all files, decode events, classify human/bot, group by
   match_id, emit static JSON + heatmap grids). Verify: total row count and event-
   type distribution roughly match README.md's stated totals (~89K rows, 339
   players, 796 matches).
2. Coordinate mapping + a static single-match SVG render on one map, no filters, no
   animation yet. CRITICAL: measure each minimap PNG/JPG's actual pixel dimensions
   in code — do NOT hardcode 1024x1024 from README.md, it's wrong (verified:
   AmbroseValley is actually 4320x4320). Verify by hand-calculating 2-3 known
   (x,z) -> pixel conversions and confirming the rendered marker lands there before
   moving on.
3. Human vs. bot visual distinction + event-type markers (Position/BotPosition,
   Kill/Killed/BotKill/BotKilled, KilledByStorm, Loot), styled per design.md's
   Components section (shape-coded, not color-coded alone, each marker gets a
   real aria-label — this is the whole point of using SVG here).
4. Filtering UI: map, date, match. Match picker shows a participant-count badge
   per match (most matches have exactly 1 file — see PRD.md §2 and §8) and
   defaults to a richer match on load rather than a sparse one. Filters must be
   keyboard-operable, not mouse/touch-only.
5. Timeline/playback for the selected match. Per PRD.md §6: don't use literal
   `ts` values as real elapsed time (per-file ts ranges are ~300-800ms, not
   minutes) — normalize to 0-100% progress, preserve relative spacing between
   events, play over a fixed ~15-20s default duration with speed controls. The
   scrubber thumb must be arrow-key operable once focused.
6. Heatmap overlay (kill/death/traffic density), rendered in canvas. Per PRD.md
   §5: this aggregates across ALL matches within the current map+date filter,
   NOT gated by the match filter — a single match's ~1-15 events isn't dense
   enough to be a meaningful heatmap. Pair it with a short text summary (e.g.
   "highest density: northeast quadrant") since the raster layer itself has no
   screen-reader-accessible content.
7. Responsive pass: verify every prior stage at all three breakpoints, confirm
   44x44px touch targets everywhere, confirm the map viewport pinch-zooms/pans
   on a narrow viewport.
8. Accessibility + SEO pass: full keyboard-only walkthrough (no mouse), spot-check
   with a screen reader on the SVG markers, re-verify contrast (design.md lint if
   available), add Next.js metadata/OG tags. Per PRD.md §7/§10: default to `noindex`
   on deep-linked per-match/per-player views (they expose granular internal
   telemetry) while keeping the landing page indexable — ask me if you think this
   default is wrong before shipping it either way.
9. Deploy to Vercel + write ARCHITECTURE.md and INSIGHTS.md per the assignment's
   own submission checklist (in README.md/the assignment brief) — INSIGHTS.md
   should come from you actually using the finished tool to look at the data,
   not be written in advance. ARCHITECTURE.md's tradeoffs table should include
   the canvas->SVG rendering change and why.

Ask me before making any assumption not already covered in PRD.md — don't guess
silently on anything ambiguous, note it and ask, or note it and move on per PRD.md's
existing documented assumptions.
```

## Notes for you (not part of the pasted prompt)

- This assumes you've already committed `PRD.md`, `design.md`, `brandguidelines.md`, and the assignment's data/README into a fresh repo before starting Claude Code.
- The prompt deliberately gates each stage on your "continue" — for a graded assessment where you need to be able to explain every decision in an interview, watching each stage land (rather than letting it run all 15+ hours unattended) matters more than raw speed.
- Stage count went from 7 to 9 with this update (added a dedicated responsive pass and a dedicated accessibility/SEO pass, per PRD.md §9) — budget time accordingly; PRD.md §10 already flags these as the stages most likely to get compressed if the 15-hour estimate runs tight, and says to be explicit about what wasn't fully verified if that happens, rather than implying full coverage.
- If Claude Code proposes deviating from the tech stack or staged order above, that's fine — just make sure it tells you *why*, and that the reasoning ends up in `ARCHITECTURE.md`'s tradeoffs table, not silently.
