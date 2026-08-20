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
SOURCE_DIR = REPO_ROOT / "player_data" / "minimaps"
MINIMAPS_DIR = REPO_ROOT / "public" / "minimaps"
OUTPUT_PATH = REPO_ROOT / "public" / "data" / "maps.json"

# The source PNG/JPGs total ~23MB, which the browser downloads and decodes before the
# map can draw -- enough to show a visibly half-rendered map on load. Re-encoding to
# WebP at the SAME pixel dimensions cuts that ~90% (23.3MB -> 2.2MB, measured), so no
# resolution is lost and zooming stays exactly as sharp. Downscaling would save a
# little more but would cost sharpness at high zoom, which this tool depends on.
WEBP_QUALITY = 82

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
    MINIMAPS_DIR.mkdir(parents=True, exist_ok=True)
    maps = {}
    total_src = 0
    total_out = 0

    for map_id, cfg in MAP_CONFIG.items():
        source_path = SOURCE_DIR / cfg["image"]
        webp_name = f"{Path(cfg['image']).stem}.webp"
        webp_path = MINIMAPS_DIR / webp_name

        with Image.open(source_path) as im:
            width, height = im.size
            # Full resolution preserved -- only the encoding changes.
            im.convert("RGB").save(webp_path, "WEBP", quality=WEBP_QUALITY, method=6)

        src_mb = source_path.stat().st_size / 1048576
        out_mb = webp_path.stat().st_size / 1048576
        total_src += src_mb
        total_out += out_mb

        maps[map_id] = {
            "id": map_id,
            "displayName": cfg["displayName"],
            "image": f"/minimaps/{webp_name}",
            "width": width,
            "height": height,
            "scale": cfg["scale"],
            "originX": cfg["originX"],
            "originZ": cfg["originZ"],
        }
        print(
            f"{map_id}: measured {width}x{height}px  "
            f"{src_mb:5.1f}MB -> {out_mb:4.2f}MB webp ({100 * out_mb / src_mb:.0f}%)"
        )
        if width != height:
            print(f"  note: not square ({width}x{height}) -- pixel math uses width/height independently, not a shared side length")

    print(f"\nTotal minimap payload: {total_src:.1f}MB -> {total_out:.1f}MB ({100 * total_out / total_src:.0f}%)")

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(maps, indent=2))
    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
