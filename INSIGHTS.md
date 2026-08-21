# Insights

Everything below comes from actually running the finished pipeline output
through the finished tool — filtering, opening matches, and switching heatmap
layers — not written before the tool existed. Every number here is
reproducible from `public/data/*.json`; the exact queries are noted inline so
they can be re-run.

## 1. This is a solo-player dataset wearing a multiplayer schema

The single most consequential finding, and the one that explains several
smaller ones below: **only one match in the entire 796-match dataset has more
than one human player.** That match (`AmbroseValley`, 2026-02-12) has exactly
2 humans and 0 bots. Every other match with more than one participant — all
36 of them, including every one of the "richest" matches the picker
surfaces — is exactly **1 human plus N bots**. There is no organic multiplayer
in this dataset; "populated" and "AI-filled" are, with one exception, the
same thing.

```
matches with >1 human:  1 / 796   (0.13%)
matches with >1 bot:    36 / 796  (4.5%) — all of them exactly 1 human + N bots
```

This reframes what the richer matches actually show a Level Designer: not
"how do groups of players interact," but "how does a single player's run
look against an AI-populated lobby." The tool doesn't misrepresent this —
the legend always shows the real human/bot split per match — but it's worth
stating plainly rather than letting "16 participants" imply something the
data doesn't contain.

## 2. True human-vs-human combat is a data anomaly, not just rare

`Kill`/`Killed` — the README's definition of human-killed-human — total
**3 events each**, out of 89,104 rows across 5 days. Finding #1 already makes
this population-level expected: with only one match containing two humans,
there's barely a match where this event *could* fire under the README's own
definition.

What's stranger: checking which matches those 6 rows actually belong to
shows all three `Kill`/`Killed` pairs sit in matches with **1 human, 0
bots** — a single-participant match, with no second file of any kind for
that `match_id` in this dataset. Whoever the counterparty was has no
corresponding row here. This is the same category of README-vs-data gap
PRD.md §2 already documented for minimap size, match duration, and files-
per-match — surfaced by checking the schema's own claims against what the
data contains, not by trusting the event name.

```python
# public/data/matches/*.json, filtered to events with e in ("Kill","Killed")
711c9a67…  1 human / 0 bot  → Kill, Killed
042774ea…  1 human / 0 bot  → Kill, Killed
c4a250c9…  1 human / 0 bot  → Kill, Killed
```

## 3. Bots fight each other, and the README's event table has no name for it

The README's Combat Events table defines `BotKill`/`BotKilled` only from a
human's perspective ("a human player killed a bot" / "was killed by a bot").
Checking which player's own file each row actually sits in tells a different
story:

| Event | Filed under a human's journey | Filed under a **bot's own** journey |
|---|---|---|
| `BotKill` | 2,232 (92.4%) | **183 (7.6%)** |
| `BotKilled` | 403 (57.6%) | **297 (42.4%)** |

A bot being the subject of its own `BotKill`/`BotKilled` row means bot-on-bot
combat is real and reasonably common — 297 bot-filed deaths is the same order
of magnitude as the 403 human-filed ones. The README's table simply has no
category for this, since it only names two of the three possible parties to
a kill. `eventPhrase()` (see ARCHITECTURE.md §7) resolves this by wording
bot-owned rows neutrally ("got a kill" / "was killed") rather than asserting
a counterparty the schema can't support.

## 4. Bots occasionally emit "human" events too

Separately from combat: 636 `Position` rows and 115 `Loot` rows are filed
under a bot's own journey, even though the README states bots only emit
`BotPosition`/`BotKill`/`BotKilled`. Small in volume (1.2% of all `Position`-
named rows, 0.9% of all `Loot`), but real, and the reason marker color in the
tool resolves from the pipeline's `user_id`-shape classification rather than
the event name (ARCHITECTURE.md §7).

## 5. Map popularity is heavily skewed toward one map

```
AmbroseValley  566 matches  (71.1%)
Lockdown       171 matches  (21.5%)
GrandRift       59 matches  ( 7.4%)
```

This directly drives finding #6 below — GrandRift's low volume isn't a
pipeline artifact, it's the least-played map by a wide margin, and every
GrandRift-specific reading downstream inherits that small sample.

## 6. The heatmap sparsity risk PRD.md §10 anticipated is real, and concentrated on one map

Per date, per map, the kills and deaths layers fall below the "too few
events to read as a pattern" threshold (30 events, ARCHITECTURE.md §2) in
**12 of 30** map×date×layer combinations — and 9 of those 12 are GrandRift.
Every single per-date slice of GrandRift's `deaths` layer falls under the
threshold; only pooling all 5 days together (52 events) clears it:

```
GrandRift deaths   02-10:15  02-11:10  02-12:4  02-13:15  02-14:8   all:52 ✓
GrandRift kills    02-10:68✓ 02-11:77✓ 02-12:20 02-13:14  02-14:14  all:193 ✓
```

The `traffic` layer never hits this floor on any map or date — Position
events are common enough everywhere to stay meaningful even sliced thin. The
constraint is specifically combat density on the least-played map, exactly
the shape of risk PRD.md §10 flagged before the tool existed to check it
against. Practical read for a Level Designer: **trust GrandRift's combat
heatmap only at "all dates," never at a single day.**

## 7. Where players actually die isn't spread evenly — and on one map, the data rediscovers a named landmark on its own

Density is never close to an even 25%-per-quadrant split on any map:

```
              traffic peak         kills peak            deaths peak
AmbroseValley southwest 40.2%      southwest 42.1%        southwest 41.9%
GrandRift     northwest 32.1%      northwest 34.1%         southwest 39.1%
Lockdown      northeast 36.9%      northeast 35.4%         northeast 33.4%
```

On GrandRift, opening the traffic heatmap and looking at where the hottest
single spot lands shows it sitting almost exactly on **"Mine Pit"** — a named
point of interest baked into the map art itself. Nothing in the pipeline or
the tool knows map landmark names; the aggregate position data reproduced a
designed chokepoint independently, which is a reasonable sanity check that
the coordinate transform (ARCHITECTURE.md §3) is landing markers in the
right place, not just inside the right map.

AmbroseValley's kills hotspot is tighter still — a single bridge/junction
crossing rather than a whole quadrant — which reads as a genuine chokepoint,
not sampling noise.

**One caveat worth flagging to Level Design directly:** on GrandRift, the
*kills* peak (northwest) and the *deaths* peak (southwest) are different
quadrants. A `Kill` row is logged at the killer's position, a `Killed` row
at the victim's — for a ranged engagement those can genuinely be in
different places. "Kill hotspot" and "death hotspot" are not always the same
map region, and shouldn't be read as interchangeable.

## 8. Bots move in tight local clusters; the rare human runs cover real distance

Visually comparing a 16-participant AmbroseValley match against a 1-
participant one shows a consistent pattern: bot paths bundle into 4-5 dense
hub-and-spoke clusters, each centered on a small area, rather than traversing
the map. The lone human's path in the sparse match, by contrast, is one long
traverse following the river most of the way across the map, picking up loot
along the route. This is consistent with #1 and #5 — bots appear to hold
local zones rather than pathing across the map the way the one available
human trace does — but it's a qualitative read from a handful of matches,
not a claim backed by a population large enough to generalize confidently.

## 9. What this means for Level Design, concretely

- **AmbroseValley's southwest region and the Mine Pit area on GrandRift are
  real chokepoints**, not artifacts — worth a look for balance (loot density,
  cover, extraction routes nearby).
- **Don't read GrandRift's per-day combat heatmap** — pool the full date
  range, or wait for more data. The traffic layer doesn't have this problem.
- **"16 participants" in the picker almost always means "1 human, 15 bots,"**
  not a populated multiplayer lobby — worth knowing before drawing
  conclusions about player-vs-player behavior from a rich-looking match.
- **True PvP essentially isn't represented in this snapshot.** Any question
  about human-vs-human combat balance needs a different, larger capture
  window than these 5 days — 3 `Kill` events total isn't a sample size
  anything can be concluded from.
