#!/usr/bin/env python3
"""
Stage 2 (PRD.md §9.2): measure each minimap's ACTUAL pixel dimensions.

The assignment's README.md claims all minimaps are 1024x1024. PRD.md §2 verified
that's wrong (AmbroseValley is 4320x4320). Don't trust the README's number for
GrandRift or Lockdown either -- measure all three directly from the image files
and emit the result as static config the app reads, alongside the world->pixel
scale/origin table (that part of the README IS verified correct, per PRD.md §2 --
only the image dimensions claim was wrong).

Run: python3 scripts/measure_maps.py
"""

import json
from pathlib import Path

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parent.parent
MINIMAPS_DIR = REPO_ROOT / "public" / "minimaps"
OUTPUT_PATH = REPO_ROOT / "public" / "data" / "maps.json"

# Scale/origin values from player_data/README.md's "Map Configuration" table.
# PRD.md §2 only flagged the *image size* claim (1024x1024) as wrong; this table
# wasn't part of that discrepancy, so it's used as given.
MAP_CONFIG = {
    "AmbroseValley": {
        "displayName": "Ambrose Valley",
        "image": "AmbroseValley_Minimap.png",
        "scale": 900,
        "originX": -370,
        "originZ": -473,
    },
    "GrandRift": {
        "displayName": "Grand Rift",
        "image": "GrandRift_Minimap.png",
        "scale": 581,
        "originX": -290,
        "originZ": -290,
    },
    "Lockdown": {
        "displayName": "Lockdown",
        "image": "Lockdown_Minimap.jpg",
        "scale": 1000,
        "originX": -500,
        "originZ": -500,
    },
}


def main() -> None:
    maps = {}
    for map_id, cfg in MAP_CONFIG.items():
        image_path = MINIMAPS_DIR / cfg["image"]
        with Image.open(image_path) as im:
            width, height = im.size

        maps[map_id] = {
            "id": map_id,
            "displayName": cfg["displayName"],
            "image": f"/minimaps/{cfg['image']}",
            "width": width,
            "height": height,
            "scale": cfg["scale"],
            "originX": cfg["originX"],
            "originZ": cfg["originZ"],
        }
        print(f"{map_id}: measured {width}x{height}px (image: {cfg['image']})")
        if width != height:
            print(f"  note: not square ({width}x{height}) -- pixel math uses width/height independently, not a shared side length")

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(maps, indent=2))
    print(f"\nWrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
