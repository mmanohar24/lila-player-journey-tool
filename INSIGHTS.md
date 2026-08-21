# Insights

These are three things that actually caught my eye once the tool was working and I could click through real matches instead of just reading rows in a terminal. Every number below comes straight from `public/data/*.json`.

## 1. This dataset barely has any humans playing together

I opened one of the "richest" matches in the picker expecting to see a real multiplayer fight. Sixteen participants sounded like a proper server, but it's one human and 15 bots.

So I checked how common that actually is. Out of all 796 matches, exactly **one** has more than one human player: an AmbroseValley match on 2026-02-12 with 2 humans and, notably, 0 bots. Every other match with more than one file breaks down two ways: 36 of them are one human plus a pile of bots, and 16 of them, surprisingly, **have zero humans at all.** No player, just bots, and the data still records it as a "match" with a participant count like any other.

```
matches with >1 human:        1 / 796
matches, 1 human + bots:      36 / 796
matches, 0 humans (bots only): 16 / 796
```

(source: `public/data/matches-index.json`, which lists `human_count` and `bot_count` per match)

Participant count on its own isn't a safe proxy for "a real player was engaged here." A match showing 12 participants could be one human's session, or it could be a lobby nobody ever logged into. If anyone downstream wants to pull "engagement" or "session richness" metrics from this data, they need to filter on human presence first, not just count files. Otherwise you'd be measuring bot activity and calling it player behavior.

For a Level Designer, the honest read is: this snapshot is mostly "how does one player's run look surrounded by AI," not "how do players interact with each other." That's still useful (it's exactly what the tool is built to show), but worth knowing going in, so nobody draws a multiplayer-balance conclusion from what's actually a mostly solo dataset.

## 2. The GrandRift combat heatmap can't be trusted day-by-day

GrandRift is the least-played map by a wide margin: 59 of 796 matches, 7.4%, versus AmbroseValley's 71%. I noticed this mattered once I started switching the heatmap between dates. On some days GrandRift's kill/death layers looked almost empty, and I wasn't sure if that was a real pattern or just not enough data.

Mostly it's the latter. Across all three maps, five dates, and the kills/deaths layers (30 combinations total), 12 fall under the 30-event threshold the pipeline uses to flag a grid as too sparse to read, and 8 of those 12 are GrandRift. Its deaths layer is under-threshold on every single day (15, 10, 4, 15, and 8 events across the five dates) and only clears the bar once you pool the entire week together (52 events).

```
GrandRift deaths, per day:  15 / 10 / 4 / 15 / 8   -> all under 30
GrandRift deaths, pooled:   52                      -> clears it
```

(source: `public/data/heatmaps/GrandRift.json`, per-date `events` counts and the pipeline's own `meaningful` flag)

The actionable part: if anyone uses this tool to make a call about GrandRift's combat balance, they should only look at the "all dates" view, never a single day. A single-day reading there is basically noise dressed up as a heatmap. The traffic layer doesn't have this problem on any map or date; it's specifically combat density on the least-played map that runs thin.

## 3. There are real chokepoints, and the tool found one without knowing it existed

Density isn't close to evenly spread on any map. AmbroseValley's traffic, kills, and deaths all peak in the same southwest region (40-42% share). Lockdown does the same in the northeast (33-37%). GrandRift is more interesting: traffic and kills both peak northwest (32-34%), but deaths peak southwest instead (39%). (source: `public/data/heatmaps/*.json`, each layer's precomputed `peak.quadrant` and `peak.share`)

GrandRift's northwest traffic hotspot sits almost exactly on "Mine Pit," a named landmark baked into the map art. Nothing in the pipeline or the tool knows that name (it has no concept of map landmarks at all), so watching the aggregate player data independently rediscover a spot the level designers clearly built as a chokepoint felt like a decent sanity check that the coordinate math is landing markers in the right place, not just somewhere plausible. (That last part, the landmark name itself, is a visual check against the minimap art, not something any data file names. No JSON here knows what "Mine Pit" is.)

A Kill row logs at the killer's position, Killed at the victim's, so for a ranged fight those can land in different parts of the map. That's exactly what happens on GrandRift: the kill quadrant and the death quadrant diverge. "Kill hotspot" and "death hotspot" aren't always the same region, and shouldn't be read as interchangeable when eyeballing the map.

For a Level Designer, AmbroseValley's southwest corner and GrandRift's Mine Pit area both look like real, worth-checking chokepoints. Loot density, cover, and nearby extraction routes there seem like the obvious first things to review for balance.

---

### A few smaller things I noticed along the way

- **True human-vs-human combat (`Kill`/`Killed`) is 3 events total, across the entire 89K-row, 5-day dataset,** and all three sit in matches where there's only one participant file recorded, meaning there's no second file showing who the other side was. That's about as thin as a sample can get; I wouldn't build any PvP-balance conclusion on it without a longer capture window.
- **Bots fight each other, and the README's own event table has no name for it.** It defines `BotKill`/`BotKilled` only from a human's point of view, but 183 `BotKill` and 297 `BotKilled` rows are filed under a bot's own journey: bot-on-bot combat the table just doesn't describe.
- **A small number of bots emit "human" events too.** 636 `Position` and 115 `Loot` rows show up under bot journeys, even though the README says bots only emit the `Bot*`-prefixed events. Small in volume, but it's why the tool colors markers off the actual player ID shape rather than trusting the event name.
- **Bots seem to hold local zones; the rare human run covers real ground.** Comparing a bot-heavy match to the one genuinely sparse human match, bot paths bundle into a handful of tight clusters while the human's path is one long traverse across the map. I'll say upfront this is a read from a couple of matches, not a large enough sample to treat as a confirmed pattern. More of a "worth watching for" than a finding.