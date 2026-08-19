# PRD — LILA BLACK Player Journey Visualization Tool

**Author:** Manoj Venkatesun · **Context:** Take-home assessment, LILA Games Product Engineer role
**Status:** Draft v2 · **Last updated:** 2026-08-19

---

## 1. Problem

LILA's Level Design team has raw player telemetry from LILA BLACK (an extraction-shooter battle-royale) but no visual way to answer basic questions: where do players actually move, where do fights happen, where do people die to the storm, and which parts of each map get ignored. This tool turns that raw parquet telemetry into something a Level Designer can open in a browser and use without touching a data pipeline themselves.

**Who this is for:** Level Designers — not data scientists. The tool should read like a map inspector, not a notebook. No SQL, no code, no file wrangling from the user.

## 2. Ground truth about the data (verified directly, not assumed from the README)

The assignment's own README documents the schema and coordinate system, but three claims in it don't match the actual dataset we were given. Building against the README's prose instead of the real data would fail the assessment's own "attention to detail" criterion, so this PRD is written against what we verified:

| README claim | What we actually found | Why it matters |
|---|---|---|
| Minimaps are 1024×1024px | `AmbroseValley_Minimap.png` measured **4320×4320px** | Coordinate-to-pixel formula must read the loaded image's real dimensions, not a hardcoded 1024, or every point clusters in the top-left ~24% of the image. All three minimaps must be measured at load time — don't assume the other two are 1024 either. |
| Matches "last several minutes" | Sampled files (small and largest-in-day) show `ts` ranges of ~300–800ms per file, not minutes | Literal real-time playback would finish in under a second. Playback needs a documented rescaling assumption (see §6). |
| Illustrative example: "10 humans + 40 bots = 50 files" per match | Feb 10 sample: 437 files / 285 matches = **1.53 files/match average**, most matches = exactly 1 file, max seen = 15. Consistent with the dataset-wide total (1,243 files / 796 matches ≈ 1.56). | Multi-player comparison and combat reconstruction only work on the sparse subset of richer matches. Drives the heatmap and match-picker design (see §5, §8). |

Additional verified facts:
- Schema is exactly `user_id, match_id, map_id, x, y, z (float32), ts (timestamp ms), event (binary)` — confirmed against a live sample file.
- **There is no killer/victim ID column.** `Kill` / `Killed` / `BotKill` / `BotKilled` tell you *that* and *where* something died, not *who* did it to *whom*. Cross-file attribution (which player killed which) would have to be inferred by matching `match_id` + close `ts` + close `x/z` — not guaranteed correct, and out of scope for v1 (see §4, Won't Have).
- Total dataset is small: ~89K rows across ~1,243 files, all under ~11KB each. This is cheap to fully precompute; no live backend or in-browser parquet parsing (e.g. duckdb-wasm) is justified for this data volume.

## 3. Goals

1. A Level Designer can open a shared link and, with zero setup, see player paths rendered correctly on the right minimap.
2. Human vs. bot and event type (kill/death/loot/storm) are visually unambiguous at a glance.
3. Filtering (map/date/match) and a match timeline/playback let someone reconstruct "what happened" in a specific match.
4. A heatmap layer answers the map-level question ("where do fights/deaths/traffic actually cluster") that no single match's sparse data can answer alone.
5. Everything above is honest about the data's real shape — no polished feature that quietly lies about statistical significance it doesn't have.
6. The tool works and is usable on a phone, not just a desktop, and doesn't exclude anyone relying on a keyboard or screen reader (see §7).

## 4. Scope

**Must have (v1, in build order — see §9):**
- Precomputed data pipeline: parquet → compact static format (all 1,243 files, humans + bots, event-decoded).
- Coordinate mapping: world `(x,z)` → minimap pixel, using each map's real scale/origin and *actual* image dimensions.
- Path rendering for a selected match, on the correct minimap.
- Visual distinction: human vs. bot; Position/BotPosition vs. Kill/Killed/BotKill/BotKilled/KilledByStorm/Loot.
- Filters: map, date (Feb 10–14), match (see §8 for match-picker behavior given sparsity).
- Timeline/playback for a selected match (see §6 for the timing-assumption).
- Heatmap overlay: kill zones, death zones, traffic density — aggregated across matches within the current map/date filter (see §5).
- Hosted, shareable URL.
- Responsive layout (mobile/tablet/desktop) and WCAG 2.1 AA accessibility, including baseline SEO/discoverability (see §7).

**Won't have (v1) — explicitly deferred, not forgotten:**
- Cross-file kill attribution ("player A killed player B") — the schema doesn't support this reliably; noting it as a data limitation is more honest than guessing.
- Live/streaming data ingestion — this is a static, historical dataset; no need to over-build for a "new matches arrive" scenario that doesn't exist here.
- Player-level profile/history views across matches (e.g. "show me everywhere this UUID has played") — interesting, but secondary to the map-centric ask in the brief. Candidate for a fast-follow if time allows after the must-haves are solid.
- Authentication / access control — a shareable link is the explicit requirement; nothing here is sensitive.

## 5. Heatmap scope decision

The brief lists "filter by match" and "heatmap overlays" as separate requirements, not one combined feature — and treating them as combined doesn't hold up against the data: a single match with 1–15 events isn't dense enough to produce a meaningful heatmap; it's a scatter of dots. Decision: **heatmaps respect the map and date filters (aggregating across all matches in that selection) but are not gated by the match filter.** Selecting a specific match instead drives the path/timeline view. This gives two honest, distinct views instead of one that overstates significance: "here's the map-wide danger pattern" (heatmap) vs. "here's this one match's specific story" (path + timeline).

## 6. Playback timing assumption

Per-file `ts` ranges (~300–800ms) don't represent literal real-world match duration, and the brief explicitly invites reasonable assumptions where data is ambiguous ("make a reasonable assumption and note it, don't get blocked"). Decision: normalize each match's `ts` range to 0–100% progress, **preserving relative spacing between events** within that normalized range (so a burst of rapid events still reads as a burst, a gap still reads as a gap — no signal is discarded, only the axis is rescaled), played back over a fixed watchable duration (default ~15–20s) with speed controls (0.5×/1×/2×/4×). This is stated as an explicit, documented assumption in `ARCHITECTURE.md`, not hidden.

## 7. Responsiveness, accessibility & discoverability

Added late (v2 of this PRD) at Manoj's request — but it changes one real architecture decision, so it's called out on its own rather than folded silently into an existing section.

**Responsive layout.** The tool's primary use case is inherently data-dense (a coordinate-precise minimap, filters, a timeline scrubber, a heatmap toggle) — that's genuinely a desktop/tablet-first task, and it's worth saying so rather than pretending a phone is the ideal way to do spatial analysis. That said, "responsive" is being treated as a hard requirement, not a stretch goal: mobile-first CSS with breakpoints (~375px / 768px / 1440px, matching `design.md`'s `spacing` scale), touch targets at a 44×44px minimum (WCAG 2.5.5 / Apple HIG), and pan/zoom controls on the map viewport since a 4320px-wide minimap cannot simply shrink to fit a phone screen without losing legibility. Assumption, stated plainly: full feature parity is required on all breakpoints, but the *ideal* experience is still assumed to be tablet+ — nothing about "responsive" should be read as "redesign this as a mobile-first app."

**Accessibility (WCAG 2.1 AA).** This has one real, verified consequence for the rendering approach: pure `<canvas>` rendering (the original plan, chosen purely for simplicity) has no DOM nodes for individual markers, which means a screen reader cannot perceive a single player path or kill marker on it — that's a WCAG 1.1.1 failure, not a minor gap. Given the actual verified data volume (§2: max 15 files per match, ~100–300 events per file, ~89K rows total), the original justification for canvas — raw rendering performance at scale — doesn't hold; this dataset is small enough that **SVG markers/paths are entirely feasible and give native DOM accessibility for free** (each marker as a real, focusable element with an `aria-label` like "Kill — human player, 00:03 into match"). Revised decision: **SVG for player paths and discrete event markers; canvas/raster reserved only for the aggregate heatmap layer**, where the content is a density gradient rather than discrete semantic data and canvas is the right tool for that specific piece. I verified this isn't just a hand-wave — actual WCAG contrast ratios for the `design.md` palette against its background:

| Pair | Ratio | Text (4.5:1) | Non-text/UI (3:1) |
|---|---|---|---|
| textPrimary on background | 15.05:1 | Pass | Pass |
| human (`#5df8f4`) on background | 14.05:1 | Pass | Pass |
| bot (`#7e8fa0`) on background | 5.49:1 | Pass | Pass |
| loot (`#f8cf65`) on background | 12.23:1 | Pass | Pass |
| kill (`#f63d4c`) on background | 4.94:1 | Pass | Pass |
| storm (`#d34dd9`) on background | 5.06:1 | Pass | Pass |
| killed (`#c23440`) on background | 3.35:1 | **Fail** | Pass |

Every accent passes the 3:1 bar required for graphical/UI objects (markers, icons, legend swatches — their actual use), but `killed` fails the stricter 4.5:1 text bar. Consequence, folded into `design.md`: `killed` (and `kill`, which is marginal at 4.35:1 on the raised `surface` tone) must never be used for small text labels — reserve accent colors for markers/icons/graphical elements only, and use `textPrimary`/`textSecondary` for any actual text.

**SEO / discoverability.** Manoj wants this indexable/discoverable, not just accessible — reasonable if this also functions as a portfolio piece. Next.js (already the chosen framework) supports this natively via server rendering and the metadata API, so this doesn't require an architecture change, just not skipping it: page titles/descriptions, Open Graph tags for link previews, semantic HTML landmarks. One real tension worth flagging rather than silently resolving: this tool surfaces LILA's internal gameplay telemetry (player behavior, kill locations). Making the top-level landing page discoverable is fine and probably the intent, but indexing deep-linked, specific-match views by default is a judgment call about whether LILA would want raw telemetry patterns crawlable — flagging it here as an open decision (§10) rather than assuming either way.

## 8. Match picker behavior

Given most matches have exactly one participant, the picker should not present all 796 matches as equivalent, nor hide the sparsity:
- Sort/badge matches by participant count (e.g. "👥 12") so richer matches are discoverable.
- Default the initial view to one of the richer matches so the tool isn't empty on first load.
- Keep the full, honestly sparse list browsable — the sparsity itself is a legitimate, evidence-backed observation worth surfacing in `INSIGHTS.md`, not something to engineer away.

## 9. Staged build plan

Each stage is built and tested before the next begins — deliberately, not "build all 7 features shallowly then polish," because the eval rubric weights coordinate-mapping correctness and end-to-end reliability above feature count, and the brief itself says quality over quantity.

1. **Data pipeline.** Parse all 1,243 parquet files once; decode `event` bytes; classify human/bot from `user_id` shape; group by `match_id`; emit compact static JSON (or SQLite). Test: row counts and event-type distribution match the README's dataset-wide totals (~89K rows, 339 players, 796 matches).
2. **Coordinate mapping + static single-match render.** No filters, no animation. One match, one map, pixel-perfect, rendered as SVG (§7). Test: hand-calculate expected pixel position for 2–3 known `(x,z)` points using each map's real (measured, not assumed) image dimensions, assert the rendered marker lands there.
3. **Human/bot distinction + event markers** on the same static view, each marker shape-coded and `aria-label`-ed per §7, not color-coded alone.
4. **Filtering UI** (map/date/match), wired to real data, match picker per §8, keyboard-operable controls.
5. **Timeline/playback**, per §6, with visible focus states and a non-color-dependent progress indicator.
6. **Heatmap aggregate layer** (canvas/raster), per §5.
7. **Responsive pass**: verify all prior stages at the breakpoints in §7, touch target sizing, pan/zoom on the map viewport.
8. **Accessibility + SEO pass**: keyboard nav end-to-end, screen-reader smoke test on the SVG markers, contrast spot-check, Next.js metadata/OG tags, decide and implement the indexability question from §7.
9. **Deploy, write `ARCHITECTURE.md` / `INSIGHTS.md`.** Insights come from actually using the finished tool, not pre-written before the tool exists.

## 10. Open questions / risks

- We've only measured one of the three minimap images directly (AmbroseValley, wrong in the README). GrandRift and Lockdown must be measured programmatically before coding their coordinate transforms — do not assume any stated dimension.
- Kill/death event volume is low overall; the heatmap may still look sparse even aggregated across all 5 days. If so, that's a legitimate finding to report in `INSIGHTS.md`, not a bug to hide.
- Should deep-linked per-match views be search-indexable, given they expose granular internal gameplay telemetry? Landing page: yes. Per-match/per-player deep links: unresolved — default assumption is `noindex` on deep links unless Manoj says otherwise, since restricting is the reversible choice and over-exposing internal data isn't.
- 15 hours is tight against 7 must-have features, responsive + accessibility + SEO work, and three documentation deliverables plus `design.md`/`brandguidelines.md`. If time runs out, cut from the bottom of §9's ordering and say so honestly in `ARCHITECTURE.md` — don't ship a shallow version of everything. Stages 7–8 (responsive/accessibility polish) are the most likely to get compressed if time runs short; if so, say explicitly which breakpoints/checks were and weren't verified rather than implying full coverage.

## 11. Success criteria (mapped to the assignment's own rubric)

| Rubric item | How this PRD addresses it |
|---|---|
| System design | Static-precompute architecture sized to the actual (small) dataset; SVG-for-markers/canvas-for-heatmap split justified by both data volume and accessibility (§7), not over-engineered either direction. |
| Attention to detail | §2's verified discrepancies (image size, ts scale, match density) and §7's verified contrast ratios are designed around, not glossed over or assumed. |
| End-to-end execution | Staged build (§9) with a test gate at each stage before moving on, including dedicated responsive and accessibility/SEO passes. |
| Product thinking | Match picker (§8) and heatmap scoping (§5) designed around the data's real shape; §7 treats accessibility and mobile use as real constraints on a spatial-analysis tool, not a checkbox. |
| Code quality | Out of PRD scope — addressed at implementation time. |
| Communication | This PRD + `ARCHITECTURE.md`'s assumptions section (§6, §7, §10) give a clear paper trail for every non-obvious decision, including the mid-project scope addition in §7. |
