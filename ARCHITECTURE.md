# Architecture

**Live:** [lila-player-journey-tool-gilt.vercel.app](https://lila-player-journey-tool-gilt.vercel.app/)

This is a system-design and decisions record, written after the build, not before it.
Where a decision changed mid-project — and a few did — this says what changed and why,
rather than presenting the final shape as though it were the first idea.

## 1. Shape of the system

Everything the app reads is precomputed once, offline, by a Python pipeline, and
served as static JSON. There is no database and no live backend.

```
player_data/*.nakama-0 (1,243 parquet files)
        │
        ▼  scripts/build_data.py   (parse, decode, classify, group by match)
        │  scripts/build_heatmaps.py  (bin + Gaussian-smooth density grids)
        │  scripts/measure_maps.py    (measure real minimap px, re-encode WebP)
        ▼
public/data/{matches/*.json, matches-index.json, maps.json, stats.json, heatmaps/*.json}
public/minimaps/*.webp
        │
        ▼  Next.js reads these with `fs` at request time (src/lib/data.ts)
        ▼
Server Components (per-match data, ~1000 markers) ──▶ passed as `children` into
Client Components (pan/zoom, tooltips, playback, filters)
```

This shape follows directly from the data's real size: ~89K rows across 1,243
files, all under ~11KB each (PRD.md §2). That's small enough to fully precompute
and serve as static files; duckdb-wasm or a live query layer would have solved a
scale problem this dataset doesn't have.

## 2. Data pipeline

`scripts/build_data.py` parses every parquet file, decodes the `event` column
from bytes, classifies each file's `user_id` as human (UUID) or bot (short
numeric) by regex, and groups files by `match_id` into one JSON document per
match. Verified output: 89,104 rows / 339 players (245 human, 94 bot) / 796
matches / 0 parse failures — matching the README's stated totals.

`scripts/build_heatmaps.py` bins every event into a 64×64 grid per map, per
date (plus an "all dates" pool), separately for traffic/kills/deaths, Gaussian-
smooths each grid (σ = 1.6 cells), and flags a grid `meaningful: false` when it
backs fewer than 30 events — so the UI can say "too few to read as a pattern"
instead of rendering a would-be misleading gradient from a handful of points.
All 89,104 events bin with zero out-of-bounds, which doubles as an independent
check on the coordinate transform below.

`scripts/measure_maps.py` measures each minimap's actual pixel dimensions
(the README's stated 1024×1024 is wrong for all three — see §7) and re-encodes
them to WebP at full resolution: 23MB of source PNG/JPG → 2.19MB, zero
resolution loss, because the size gain was almost entirely encoding overhead,
not detail that could be safely downsampled.

## 3. Coordinate mapping

```ts
u = (x - map.originX) / map.scale
v = (z - map.originZ) / map.scale
px = u * map.width
py = (1 - v) * map.height   // v flipped: image origin is top-left, world Z isn't
```

`map.width`/`map.height` come from the pipeline's actual pixel measurement of
each PNG/JPG, not a constant — the three maps are 4320×4320, 2160×2158 (not even
square), and 9000×9000, and hardcoding 1024 (the README's number) would have
clustered every marker into the top-left ~5-24% of the image depending on the
map. `pixelBounds()` (src/lib/coordinates.ts) derives a match's bounding box in
the same space, used to frame the viewport on that match's actual footprint
(§6).

## 4. Rendering split: SVG markers, canvas heatmap

The original plan used canvas for everything, chosen for simplicity. That
changed once PRD.md §7's accessibility requirement was worked through: canvas
has no DOM nodes, so a screen reader cannot perceive an individual player path
or kill marker on it — a WCAG 1.1.1 failure, not a cosmetic gap. The
performance justification for canvas doesn't hold at this dataset's actual size
(max 15 files per match, ~89K rows total), so the fix was to change renderer,
not to add an accessibility workaround on top of the wrong one.

| | Canvas (original plan) | SVG (shipped) |
|---|---|---|
| Screen reader access to individual markers | None — a bitmap has no DOM nodes | Native — each marker is a real, focusable element with an `aria-label` |
| Cost at this dataset's scale (~1000 markers/match) | Irrelevant; headroom neither approach needs | Non-issue, verified in practice |
| Right tool for a density gradient (heatmap) | Yes — continuous raster content | No — would fabricate ~1000 discrete "marker" elements for what is really one continuous signal |

Net decision: **SVG for player paths and discrete event markers, canvas
reserved for the aggregate heatmap layer only** — matched to what each layer's
content actually is (design.md, per PRD.md §7). Three layers share one
`viewBox` rather than one combined SVG: the heatmap canvas has to sit above the
opaque base-map image but below the marker SVG, and a `<canvas>` cannot live
inside an `<svg>` — an early version put the image and markers in one SVG and
the canvas painted invisibly behind it.

## 5. Server/client split

`src/lib/data.ts` reads JSON off disk with `fs` inside Server Components —
`MatchLayer` (per-match markers, ~1000 elements for the richest match) is a
Server Component passed as `children` into `MapViewport`, a Client Component.
That keeps the marker markup off the client JS bundle entirely; only the pan/
zoom/tooltip/playback *behavior* ships as client code, not the ~1000 elements
it operates on.

`next.config.ts`'s `outputFileTracingIncludes` exists because
`/match/[matchId]` builds its data path from a runtime param — Next's static
file tracing can't see a path it can't read at build time, so without this the
deployed function has no data to read. Verified against the emitted trace: all
796 match files, `maps.json`, the index, and the heatmap grids are listed.

## 6. State model

| State | Lives in | Why |
|---|---|---|
| Selected match, map filter, date filter | URL (`/match/[matchId]?map=&date=`) | Shareable, back-button-correct, and it's what makes filter/match selection double as free navigation (see §8) |
| Heatmap layer (Off/Traffic/Kills/Deaths) | Client state (`HeatmapContext`) | A view mode, not a data selection — a URL param would re-run the route on every toggle, and switching layers needs to be instant |
| Pan/zoom viewbox, playback progress, tooltip position | Client state, ref-backed where it's read every animation frame | Pure interaction state with no reason to survive a reload or be shareable |

The heatmap is deliberately **not gated by the match filter** (PRD.md §5): a
single match's 1-15 events is a scatter of dots, not a density surface. It
aggregates across every match within the current map+date filter instead,
giving two honest, separately-scoped views rather than one that implies
statistical weight a single match doesn't have.

## 7. Verified discrepancies against the assignment's own README

Building against the README's prose instead of the actual data would have
failed on exactly the axis the assessment says it's grading. Three claims
didn't hold up once checked against the real files (PRD.md §2):

| README claim | Verified | Consequence |
|---|---|---|
| Minimaps are 1024×1024px | AmbroseValley 4320×4320, GrandRift 2160×2158 (not even square), Lockdown 9000×9000 | Coordinate transform reads each image's measured dimensions, never a constant (§3) |
| Matches "last several minutes" | Per-file `ts` ranges are ~300-800ms | Playback normalizes to 0-100% progress rather than playing literal elapsed time (§8) |
| Example implies ~50 files/match (10 humans + 40 bots) | Actual: 1.56 files/match average; 743/796 matches (93.3%) have exactly one file | Drove the match picker's richest-first ordering and default match (§9) |

A fourth surfaced later, in the event schema itself, not just the prose: the
README's "Bots vs Humans" section states bots only emit `BotPosition`/
`BotKill`/`BotKilled`, but the data disagrees — bots emit 636 `Position` rows
and 115 `Loot` rows of their own (src/lib/markers.ts `markerColor`). Marker
color therefore resolves from the pipeline's `user_id`-shape classification,
never from the event name.

A fifth, and the one with the most real consequence: the README's Combat
Events table defines `BotKill`/`BotKilled` only from a human's perspective
("a human player killed a bot" / "was killed by a bot"). The data contains
183 `BotKill` and 297 `BotKilled` rows filed under a **bot's own** journey —
combat the README's table doesn't describe at all, and structurally can't,
since it only names two of the three possible parties. Asserting the human-
perspective reading on those rows would assert a specific counterparty the
schema cannot support — PRD.md §2 already establishes there's no killer/victim
ID column. `eventPhrase()` (src/lib/markers.ts) resolves wording against the
row's actual subject instead: bot-owned rows get neutral wording ("got a
kill") that claims only what the row states, and the counterparty is named
only where the README's definition actually applies. See INSIGHTS.md for what
this bot-on-bot combat looks like in the aggregate.

## 8. Playback timing assumption (PRD.md §6)

Per-file `ts` ranges are ~300-800ms — not literal match duration. Decision:
normalize each match's actual `ts` span to 0-100% progress, **preserving
relative spacing between events** within that range (a burst of rapid events
still reads as a burst; a gap still reads as a gap — the axis is rescaled, no
signal is discarded), played back over a fixed ~18s default duration with
0.5×/1×/2×/4× speed controls. Stated here as the explicit, documented
assumption PRD.md §6 requires, not left implicit in the code.

## 9. Match picker (PRD.md §8)

Given 93.3% of matches have exactly one participant, presenting all 796 as
equivalent would bury the informative ones. The picker sorts richest-first
with a participant-count badge, defaults to the richest match on load, and
keeps the full list browsable rather than hiding the sparsity — the sparsity
itself is a real, evidence-backed finding (see INSIGHTS.md), not something to
engineer out of view.

## 10. Responsive layout

**Breakpoint model.** Below `md` (768px), the persistent 320px filter/legend
rail collapses into a drawer behind a toggle — a fixed side rail at that width
would leave the map itself unusably small. This was later refined to a
height-aware `rail:` custom variant (`min-width: 768px` **and**
`min-height: 600px`) rather than `md:`'s width-only gate, once a real gap
surfaced: a landscape phone is 852px wide but only ~320px tall, so it
qualified for the desktop rail under a width-only rule and got a 320px side
panel — 39% of the screen — with no way to dismiss it, since the mobile Close
button was suppressed by the very breakpoint that was misfiring.

**The `100vh` bug.** iOS Safari's `100vh` (and `height: 100%`, which resolves
against the same initial containing block) is the viewport height with the
browser's toolbars *hidden* — they weren't, so the document rendered ~90px
taller than what was visible on screen, and the whole page scrolled by that
difference. Every mobile symptom this produced (playback bar invisible on
first load, the drawer's Close button scrolling off-screen, content clipped
at the bottom) traced back to this one line, not to each individual layout.
Fixed with `100dvh` (the height actually on screen) plus `overflow: hidden`
on `html`/`body` — locking scroll is what keeps `dvh` stable, since with
nothing to scroll, Safari never collapses its toolbars mid-interaction. This
could only be verified structurally in Chrome (documentElement.scrollHeight
== innerHeight at every tested size); Safari's toolbar-collapse behavior
itself needed confirming on a real device, which the user did after deploy.

**Pan/zoom, pulled forward from Stage 7.** The build plan had pan/zoom as part
of the responsive pass. It moved earlier, into Stage 2/3 work, once the
90000×9000px Lockdown minimap made it obvious a phone-width viewport needed
zoom/pan to be usable *at all*, not just as a polish pass — the dependency
ran the other direction from how the stage plan had assumed it would.

**Default view: full-bleed and pre-zoomed, not centered.** The minimaps are
square-ish; most viewports aren't, and an early version centered the map with
padding on both sides, plus a large default zoomed-out "fit the whole map"
view. Per user feedback, this became a full-bleed "cover" fit (`coverViewBox`
in MapViewport.tsx) — the map fills the viewport edge-to-edge, tightened by a
fixed margin so both axes keep real pan room — with a blurred, scaled
extension of the same map art filling whatever letterbox bars remain, rather
than plain background color. A sparse match still gets framed on its own
event bounds (`boundsViewBox`) instead of the generic cover fit — one match
was measured with only 9.3% of its markers inside the default view before
this existed.

**Mobile HUD compaction.** The playback panel measured 175px tall (26% of a
phone viewport) and 51% of a landscape one, because the speed toggle and a
two-line caption each claimed a full row. Below `sm`, speeds collapse behind
a disclosure button and the caption goes `sr-only` (still reachable by
assistive tech, just not competing for vertical space) rather than being
dropped.

## 11. Accessibility (WCAG 2.1 AA)

**Contrast**, checked against the actual `design.md` palette, not assumed:

| Pair | Ratio | Text (4.5:1) | Non-text/UI (3:1) |
|---|---|---|---|
| textPrimary on background | 15.05:1 | Pass | Pass |
| human on background | 14.05:1 | Pass | Pass |
| bot on background | 5.49:1 | Pass | Pass |
| loot on background | 12.23:1 | Pass | Pass |
| kill on background | 4.94:1 | Pass | Pass |
| storm on background | 5.06:1 | Pass | Pass |
| killed on background | 3.35:1 | **Fail** | Pass |

`killed` (and `kill`, marginal at 4.35:1 on the raised `surface` tone) clears
the 3:1 bar required for graphical/UI objects — their actual use as markers
and legend swatches — but fails the stricter 4.5:1 text bar, so both are
reserved for markers/icons only and never used for text labels.

**Keyboard.** Roving tabindex on the match list (only the active row is a tab
stop; arrow keys move it) rather than making all filtered rows focusable —
an earlier version put 839 tab stops on the page doing that. The map viewport
takes arrow-key pan and +/-/0 for zoom/reset once focused.

**Screen reader chunking.** VoiceOver testing (by the user, after Stage 8's
own audit missed it — the accessibility tree flattens to name strings and
can't show DOM-structure-dependent chunking) found React's `<!-- -->`
separator between adjacent JSX expressions was splitting sentences apart —
"Human 1" read as two fragments, with the stray "1" running into the next
row. Fixed by building each announced string as one literal rather than
interleaved expressions, and by naming each region/list explicitly
(`aria-labelledby`, named `<ul>` lists) rather than letting a screen reader
guess at unlabelled structure.

**Death markers, doubly.** A journey's `Killed`/`BotKilled`/`KilledByStorm`
event gets its own marker; a separate end-of-journey marker is drawn only
when the journey contains **no** death at all — checked as "any event in this
journey is a death," not "is the last event a death," because 28% of
journeys log further Position samples after the fatal event.

## 12. SEO / discoverability (PRD.md §7, §10)

The landing page is indexable (server-rendered, real metadata/OG tags,
canonical URL). Deep-linked per-match views default to `noindex` — this tool
surfaces LILA's internal gameplay telemetry (kill locations, player
behavior), and PRD.md §10 flagged this as an open, reversible-by-default
decision: restricting indexing is the reversible choice, over-exposing
internal data by default isn't. Unresolved by design until LILA says
otherwise.

## 13. What shipped beyond the original plan, and why

Everything below was requested mid-project rather than planned upfront; each
is recorded here per the kickoff prompt's instruction that a deviation from
the staged plan needs its reasoning on record, not just the result.

- **Match/filter selection closing the mobile drawer "for free," then
  extended to the heatmap toggle deliberately.** Selecting a match or a
  map/date filter navigates (`next/link` / `router.push`), which remounts the
  drawer with `open` reset — an accidental side effect the user liked. The
  heatmap layer is client state precisely so it *doesn't* navigate (§6), so
  it had no such side effect to close on; a `DrawerContext` threads the same
  close function down to the heatmap buttons explicitly. Calling it on
  desktop is a deliberate no-op rather than something gated behind a media
  query in JS: `open` only controls the drawer's mobile-only display split,
  and the `rail:` breakpoint already overrides it once the screen qualifies.
- **Tooltips as styled elements, not native SVG `<title>`.** The native
  tooltip's ~1s hover delay read as broken; an in-app tooltip positioned off
  pointer/focus events matches the legend's visual treatment and appears
  immediately.

## 14. Known limitations, stated rather than hidden

- **GrandRift's combat layers are thin.** It's the least-played map (59 of
  796 matches, 7.4%) — see INSIGHTS.md for exactly how thin, and where the
  "too few events" threshold actually bites.
- **`Kill`/`Killed` (true human-vs-human combat) is 3 events total** across
  the entire 89K-row, 5-day dataset, and — per the ownership check in §7 —
  even those occur in matches this dataset contains only one participant
  file for. See INSIGHTS.md; this is reported as a finding, not silently
  smoothed over by the UI.
- **No cross-file kill attribution** ("player A killed player B") — the
  schema has no killer/victim ID column, so this is out of scope by data
  limitation, not oversight (PRD.md §2, §4).
- **Safari's toolbar-collapse behavior (§10) could only be structurally
  verified in Chrome**, not literally reproduced; final confirmation needed
  a real device.

## 15. Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS v4,
themed from `design.md`'s tokens · Python (pandas + pyarrow) for the offline
pipeline · deployed on Vercel. No database, no in-browser parquet parsing, no
edge runtime beyond what Next's static rendering already provides — matched
to the dataset's actual ~89K-row size, not provisioned for a scale this
project doesn't have.
