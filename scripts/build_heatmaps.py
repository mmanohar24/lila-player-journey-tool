#!/usr/bin/env python3
"""
Stage 6 (PRD.md §9.6): precompute aggregate density grids for the heatmap layer.

Per PRD.md §5 the heatmap aggregates across ALL matches within the current map+date
selection and is deliberately NOT gated by the match filter -- a single match carries
1-15 combat events, which is a scatter of dots rather than a density surface.

Density is computed here, offline, rather than as KDE in the browser (per the agreed
architecture): the smoothing is identical for every viewer, costs the client nothing,
and the output is a few KB per map.

Run: python3 scripts/build_heatmaps.py   (after build_data.py and measure_maps.py)
"""

import base64
import json
from pathlib import Path

import numpy as np

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "public" / "data"
MATCHES_DIR = DATA_DIR / "matches"
OUTPUT_DIR = DATA_DIR / "heatmaps"

GRID = 64
# Smoothing radius in cells. Wide enough to read as a density surface rather than
# confetti, narrow enough that distinct hotspots don't merge into one blob.
SIGMA = 1.6
# Below this many events a "density" surface says more about noise than about the map,
# so the UI labels it as too sparse rather than rendering a confident-looking gradient.
MIN_MEANINGFUL = 30

KILL_EVENTS = {"Kill", "BotKill"}
DEATH_EVENTS = {"Killed", "BotKilled", "KilledByStorm"}
LAYERS = ("traffic", "kills", "deaths")


def gaussian_blur(grid: np.ndarray, sigma: float) -> np.ndarray:
    """Separable Gaussian convolution -- two 1-D passes rather than one 2-D kernel."""
    radius = max(1, int(sigma * 3))
    xs = np.arange(-radius, radius + 1)
    kernel = np.exp(-(xs**2) / (2 * sigma**2))
    kernel /= kernel.sum()

    out = np.apply_along_axis(lambda row: np.convolve(row, kernel, mode="same"), 1, grid)
    out = np.apply_along_axis(lambda col: np.convolve(col, kernel, mode="same"), 0, out)
    return out


def quadrant_summary(grid: np.ndarray) -> dict:
    """Which quadrant holds the most density, and how concentrated it is.

    The canvas layer is a raster with no per-point DOM nodes, so this is what gives the
    same information to a screen reader (design.md, Heatmap toggle/legend).
    """
    half = GRID // 2
    # Row 0 is the top of the image, which is NORTH -- the renderer flips v, so north
    # is low row index.
    quads = {
        "northwest": grid[:half, :half].sum(),
        "northeast": grid[:half, half:].sum(),
        "southwest": grid[half:, :half].sum(),
        "southeast": grid[half:, half:].sum(),
    }
    total = sum(quads.values())
    if total <= 0:
        return {"quadrant": None, "share": 0.0}
    top = max(quads, key=quads.get)
    return {"quadrant": top, "share": round(float(quads[top] / total), 3)}


def main() -> None:
    maps = json.loads((DATA_DIR / "maps.json").read_text())

    # (map_id, date, layer) -> raw count grid
    grids: dict[tuple[str, str, str], np.ndarray] = {}
    counts: dict[tuple[str, str, str], int] = {}

    def cell(map_cfg, x, z):
        u = (x - map_cfg["originX"]) / map_cfg["scale"]
        v = (z - map_cfg["originZ"]) / map_cfg["scale"]
        col = int(u * GRID)
        row = int((1 - v) * GRID)  # v flipped, matching the renderer's pixel mapping
        if 0 <= col < GRID and 0 <= row < GRID:
            return row, col
        return None

    dates: set[str] = set()
    skipped_out_of_bounds = 0
    total_events = 0

    for path in sorted(MATCHES_DIR.glob("*.json")):
        match = json.loads(path.read_text())
        map_id = match["map_id"]
        date = match["date"]
        dates.add(date)
        map_cfg = maps[map_id]

        for ev in match["events"]:
            layer = (
                "kills" if ev["e"] in KILL_EVENTS
                else "deaths" if ev["e"] in DEATH_EVENTS
                else "traffic"
            )
            total_events += 1
            rc = cell(map_cfg, ev["x"], ev["z"])
            if rc is None:
                skipped_out_of_bounds += 1
                continue
            for date_key in (date, "all"):
                key = (map_id, date_key, layer)
                if key not in grids:
                    grids[key] = np.zeros((GRID, GRID), dtype=np.float64)
                    counts[key] = 0
                grids[key][rc] += 1
                counts[key] += 1

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    date_keys = sorted(dates) + ["all"]

    for map_id in maps:
        payload: dict[str, dict] = {}
        for date_key in date_keys:
            layers: dict[str, dict] = {}
            for layer in LAYERS:
                key = (map_id, date_key, layer)
                raw = grids.get(key)
                n = counts.get(key, 0)
                if raw is None:
                    layers[layer] = {
                        "events": 0,
                        "meaningful": False,
                        "peak": {"quadrant": None, "share": 0.0},
                        "cells": "",
                    }
                    continue

                smoothed = gaussian_blur(raw, SIGMA)
                peak = smoothed.max()
                # Quantised to a byte per cell: plenty for a colour ramp, and keeps the
                # payload at a few KB rather than a JSON array of floats.
                norm = (smoothed / peak * 255.0) if peak > 0 else smoothed
                cells = norm.astype(np.uint8).tobytes()

                layers[layer] = {
                    "events": n,
                    "meaningful": n >= MIN_MEANINGFUL,
                    "peak": quadrant_summary(smoothed),
                    "cells": base64.b64encode(cells).decode("ascii"),
                }
            payload[date_key] = layers

        out_path = OUTPUT_DIR / f"{map_id}.json"
        out_path.write_text(json.dumps({"grid": GRID, "dates": payload}, separators=(",", ":")))
        size_kb = out_path.stat().st_size / 1024
        print(f"{map_id:16s} -> {out_path.name} ({size_kb:.0f} KB)")

    print(f"\nGrid {GRID}x{GRID}, sigma {SIGMA} cells, min meaningful {MIN_MEANINGFUL} events")
    print(f"Events binned: {total_events - skipped_out_of_bounds}/{total_events}", end="")
    print(f"  ({skipped_out_of_bounds} outside the map's UV range)" if skipped_out_of_bounds else "")

    print("\nSparsest layers (PRD.md §10 flagged this risk -- surfaced in the UI, not hidden):")
    thin = sorted(
        ((k, v) for k, v in counts.items() if v < MIN_MEANINGFUL and k[1] != "all"),
        key=lambda kv: kv[1],
    )
    for (map_id, date_key, layer), n in thin[:6]:
        print(f"  {map_id:16s} {date_key:12s} {layer:8s} {n:4d} events")
    if not thin:
        print("  (none below threshold)")


if __name__ == "__main__":
    main()
