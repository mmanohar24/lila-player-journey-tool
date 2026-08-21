# Architecture

**Live:** [lila-player-journey-tool-gilt.vercel.app](https://lila-player-journey-tool-gilt.vercel.app/)

Written after the build, not before it. A few decisions changed mid-project, and this says what changed and why, rather than presenting the final shape as though it were the first idea.

## System shape

Everything the app reads is precomputed once, offline, by a Python pipeline, and served as static JSON. No database, no live backend.

```
player_data/*.nakama-0 (1,243 parquet files)
        │
        ▼  scripts/build_data.py      parse, decode events, classify human/bot, group by match
        │  scripts/build_heatmaps.py  bin + Gaussian-smooth density grids
        │  scripts/measure_maps.py    measure real minimap px, re-encode to WebP
        ▼
public/data/{matches/*.json, matches-index.json, maps.json, heatmaps/*.json}
public/minimaps/*.webp
        │
        ▼  src/lib/data.ts reads these with `fs` at request time
        ▼
Server Components (per-match markers, ~1000/match) ──▶ passed as `children` into
Client Components (pan/zoom, tooltips, playback, filters)
```

This follows from the data's real size: ~89K rows across 1,243 files, all under ~11KB each. Small enough to fully precompute and serve as static files. duckdb-wasm or a live query layer would solve a scale problem this dataset doesn't have.

**Pipeline, verified against the README's own stated totals:** 89,104 rows / 339 players (245 human, 94 bot) / 796 matches / 0 parse failures. The heatmap grids bin all 89,104 events with zero out-of-bounds, which doubles as an independent check on the coordinate transform below. Minimaps are re-measured at their true pixel size (next section) and re-encoded to WebP: 23MB of source PNG/JPG down to 2.19MB, with no resolution loss, since the size was almost entirely encoding overhead, not detail.

## Coordinate mapping

```ts
u = (x - map.originX) / map.scale
v = (z - map.originZ) / map.scale
px = u * map.width
py = (1 - v) * map.height   // v flipped: image origin is top-left, world Z isn't
```

`map.width`/`map.height` come from actually measuring each PNG/JPG, not a constant. The three maps are 4320×4320, 2160×2158 (not even square), and 9000×9000. The README's stated 1024×1024 is wrong for all three, and hardcoding it would have clustered every marker into the top-left 5-24% of the image depending on the map.

## Rendering split: SVG markers, canvas heatmap

The original plan used canvas for everything. That changed once the accessibility requirement was worked through: canvas has no DOM nodes, so a screen reader cannot perceive an individual player path or kill marker on it. That's a WCAG 1.1.1 failure, not a cosmetic gap. The performance case for canvas doesn't hold at this dataset's actual size (max 16 files in the richest match, ~89K rows total), so the fix was to change renderer, not add an accessibility workaround on top of the wrong one.

| | Canvas (original plan) | SVG (shipped) |
|---|---|---|
| Screen reader access to individual markers | None. A bitmap has no DOM nodes | Native. Each marker is a real, focusable element with an `aria-label` |
| Cost at this scale (~1000 markers/match) | Irrelevant; neither approach needs the headroom | Non-issue, verified in practice |
| Right tool for a density gradient (heatmap) | Yes, continuous raster content | No, would fabricate ~1000 discrete elements for one continuous signal |

Net decision: SVG for player paths and discrete event markers, canvas reserved for the aggregate heatmap layer only, matched to what each layer's content actually is.

## Assumptions where the data was ambiguous

The README's own prose didn't hold up against the actual files on three points:

| README claim | Verified | Consequence |
|---|---|---|
| Minimaps are 1024×1024px | 4320×4320 / 2160×2158 / 9000×9000 | Transform reads each image's real dimensions, never a constant |
| Matches "last several minutes" | Per-file `ts` ranges are ~300-800ms | Playback normalizes to 0-100% progress, not literal elapsed time |
| ~50 files/match implied (10 humans + 40 bots) | 1.56 files/match average; 743/796 matches (93.3%) have exactly one file | Match picker sorts richest-first, defaults to a populated match |

Two smaller assumptions, both made reversible rather than guessed permanently. Playback runs over a fixed ~18s window with 0.5x-4x speed controls, since there's no real elapsed time to play back. Deep-linked per-match pages default to `noindex` since this tool surfaces internal gameplay telemetry, while the landing page stays indexable. That's flagged as a call worth revisiting if LILA disagrees.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4, themed from `design.md`'s tokens · Python (pandas + pyarrow) for the offline pipeline · deployed on Vercel. No database, no in-browser parquet parsing, no edge runtime beyond what Next's static rendering already provides. That's matched to this dataset's actual ~89K-row size, not provisioned for a scale the project doesn't have.

---

## Deeper dives (optional reading)

The section above is the one-page core. Everything below is real and load-bearing to how the tool behaves, but it's detail rather than headline decisions: useful if you want to see the reasoning all the way down, not required to understand the system.

**Server/client split.** `src/lib/data.ts` reads JSON off disk inside Server Components. `MatchLayer` (per-match markers, ~1000 elements for the richest match) is a Server Component passed as `children` into `MapViewport`, a Client Component. That keeps marker markup off the client bundle entirely; only the pan/zoom/tooltip/playback *behavior* ships as client code. Separately, `next.config.ts`'s `outputFileTracingIncludes` exists because `/match/[matchId]` builds its data path from a runtime param that Next's static file tracing can't see at build time. Without it, the deployed function has no data to read. Verified against the emitted trace: all 796 match files, `maps.json`, the index, and the heatmap grids are listed.

**State model.**

| State | Lives in | Why |
|---|---|---|
| Selected match, map filter, date filter | URL (`/match/[matchId]?map=&date=`) | Shareable, back-button-correct, and doubles filter/match selection as free navigation |
| Heatmap layer (Off/Traffic/Kills/Deaths) | Client state | A view mode, not a data selection. A URL param would re-run the route on every toggle |
| Pan/zoom viewbox, playback progress, tooltip position | Client state, ref-backed where read every animation frame | Pure interaction state, no reason to survive a reload |

The heatmap is deliberately not gated by the match filter: a single match's 1-15 events is a scatter of dots, not a density surface. It aggregates across every match within the current map+date filter instead.

**Match picker.** With 93.3% of matches having exactly one participant, presenting all 796 as equivalent would bury the informative ones. The picker sorts richest-first with a participant-count badge and defaults to the richest match on load, while keeping the full list browsable. The sparsity is a real finding (see INSIGHTS.md), not something to engineer out of view.

**Responsive layout, four real bugs worth recording:**
- *Breakpoint model.* Below `md` (768px), the filter/legend rail collapses into a drawer. This was later refined from a width-only `md:` gate to a height-aware `rail:` variant (`min-width: 768px` AND `min-height: 600px`), once a landscape phone (852px wide, ~320px tall) qualified for the desktop rail under the width-only rule and got a fixed 320px side panel with no way to dismiss it.
- *The `100vh` bug.* iOS Safari's `100vh` is the viewport height with browser toolbars *hidden*. They weren't, so the page rendered ~90px taller than what was visible, and everything scrolled by that difference (playback bar invisible on load, drawer's Close button off-screen). Fixed with `100dvh` plus `overflow: hidden` on `html`/`body`. Locking scroll is what keeps `dvh` stable. Verified structurally in Chrome; final confirmation needed a real device, which happened after deploy.
- *Pan/zoom, pulled forward from a later stage.* The 9000×9000px Lockdown minimap made it obvious a phone-width viewport needed pan/zoom to be usable at all, not as a polish pass, so it moved earlier in the build than planned.
- *Default view is full-bleed and pre-zoomed, not centered.* An early version centered the map with padding and a "fit the whole map" default zoom; one sparse match measured only 9.3% of its markers inside that default view. Replaced with a full-bleed cover fit tightened by a fixed margin, plus a match's own event bounds framing sparse matches instead of the generic fit.
- *Mobile HUD compaction.* The playback panel measured 175px tall (26% of a phone viewport). Below `sm`, speed controls collapse behind a disclosure button and the caption goes `sr-only` rather than being dropped.

**Accessibility (WCAG 2.1 AA).** Contrast checked against the actual palette, not assumed. `textPrimary` 15.05:1, `human` 14.05:1, `bot` 5.49:1, `loot` 12.23:1, `kill` 4.94:1, `storm` 5.06:1 all pass the 4.5:1 text bar; `killed` (3.35:1) fails it but clears the 3:1 non-text bar, so it's reserved for markers/icons, never text. Roving tabindex on the match list (only the active row is a tab stop) rather than 839 individually focusable rows. The map viewport takes arrow-key pan and +/-/0 zoom once focused. VoiceOver testing (by hand, after the initial audit missed it, since the accessibility tree flattens DOM structure and can't show chunking issues) found React's whitespace separator splitting announced sentences apart; fixed by building each announced string as one literal and naming regions/lists explicitly. A journey's death event gets its own marker; a separate end-of-journey marker is drawn only when the journey contains no death at all, since 28% of journeys log further Position samples after the fatal event.

**Event schema, two things the README's own tables don't quite cover.** Bots occasionally emit `Position`/`Loot` rows under their own journey (636 and 115 respectively), even though the README says bots only emit `BotPosition`/`BotKill`/`BotKilled`, so marker color resolves from the pipeline's `user_id`-shape classification, never the event name. Separately, the README's Combat Events table defines `BotKill`/`BotKilled` only from a human's perspective, but 183 `BotKill` and 297 `BotKilled` rows are filed under a bot's own journey: combat the table doesn't name at all. `eventPhrase()` (`src/lib/markers.ts`) resolves wording against the row's actual subject; bot-owned rows get neutral wording ("got a kill") rather than asserting a counterparty the schema can't support. See INSIGHTS.md for what this looks like in aggregate.

**What shipped beyond the original plan.** Selecting a match or filter navigates (`next/link`/`router.push`), which remounts the mobile drawer with `open` reset. That's a side effect the user liked, so it was extended deliberately to the heatmap toggle via a shared `DrawerContext`, even though the heatmap toggle itself is client state with no navigation to piggyback on. Tooltips are styled elements, not native SVG `<title>`, since the native ~1s hover delay read as broken.

**Known limitations, stated rather than hidden.**
- GrandRift is the least-played map (59 of 796 matches, 7.4%) and its kills/deaths heatmap layers fall below the "too few events" threshold (30 events) in 8 of the 12 map×date×layer combinations that are under-threshold dataset-wide (12 of 30 total; traffic never falls under it on any map). Every single per-date slice of GrandRift's deaths layer is under-threshold. Only pooling all 5 days (52 events) clears it. Practical read: trust GrandRift's combat heatmap only at "all dates."
- True human-vs-human combat (`Kill`/`Killed`) is 3 events total across the whole 89K-row dataset, and all three occur in matches where this dataset contains only one participant file, meaning no second file recording a counterparty exists for any of them.
- No cross-file kill attribution ("player A killed player B"). The schema has no killer/victim ID column, out of scope by data limitation, not oversight.
- Safari's toolbar-collapse behavior could only be verified structurally in Chrome, not literally reproduced. Final confirmation needed a real device.