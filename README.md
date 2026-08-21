# LILA BLACK — Player Journey Visualization Tool

**Live:** [lila-player-journey-tool-gilt.vercel.app](https://lila-player-journey-tool-gilt.vercel.app/)

A web tool for LILA's Level Design team to see how players actually move, fight,
and die in LILA BLACK matches — built from real gameplay telemetry, not guesswork.

Pick a map and a date, and you get every player's path drawn on the minimap,
color-coded human vs. bot, with kills, deaths, and loot marked along the way.
Scrub through a single match to watch it play out, or switch to the heatmap to
see where players die most across many matches at once.

## Running it locally

You'll need Node 18 or newer.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The data is already baked
in, so this works right away — no extra setup needed.

No environment variables are required. There's one optional one,
`NEXT_PUBLIC_SITE_URL`, used to build canonical links and Open Graph tags —
without it, the app just falls back to Vercel's own production URL when
deployed, or `localhost:3000` when running locally.

## Where the data comes from

The raw gameplay data lives in `player_data/` — one parquet file per player per
match — along with the assignment's own README describing its schema.
`scripts/` has the Python pipeline that turns that raw data into what the app
actually reads (`public/data/`). You don't need to run it to use the app, the
output is already committed. If you change the raw data or want to regenerate
it yourself:

```bash
pip install pandas pyarrow
python3 scripts/build_data.py
python3 scripts/build_heatmaps.py
```

## The docs behind this

- `PRD.md` — what we're building and why, including a few things the
  assignment's own README got wrong that surfaced by actually opening the
  data (minimap size, match length, how many players share a match).
- `design.md` / `brandguidelines.md` — the visual system, and where every
  color actually came from (sampled straight from LILA BLACK's concept art,
  not picked by eye).
- `CLAUDE.md` — notes for Claude Code, since this was built with it.
- `ARCHITECTURE.md` — system design, the canvas→SVG rendering change and why,
  the responsive/accessibility fixes and the bugs behind them, and every
  verified discrepancy against the assignment's own README.
- `INSIGHTS.md` — what the tool actually shows once run against the real
  data: match/map skew, the near-total absence of true human-vs-human
  combat, bot-on-bot kills the assignment's own event table doesn't name,
  and where players actually die on each map.