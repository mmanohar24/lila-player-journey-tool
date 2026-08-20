#!/usr/bin/env python3
"""
Stage 8: generate the Open Graph preview image used for link unfurls.

Built from a real minimap rather than an abstract graphic, so a shared link previews as
what the tool actually shows. Written as a script (not a one-off) so the asset can be
regenerated if the palette or source art changes.

Run: python3 scripts/build_og_image.py   (after measure_maps.py)
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

REPO_ROOT = Path(__file__).resolve().parent.parent
SOURCE = REPO_ROOT / "public" / "minimaps" / "AmbroseValley_Minimap.webp"
OUTPUT = REPO_ROOT / "public" / "og.jpg"

W, H = 1200, 630
BACKGROUND = (0x14, 0x15, 0x1B)   # design.md `background`
HUMAN = (0x5D, 0xF8, 0xF4)        # design.md `human`
TEXT_PRIMARY = (0xED, 0xE9, 0xE2) # design.md `textPrimary`
TEXT_SECONDARY = (0x9A, 0x97, 0xA6)

TITLE = "LILA BLACK — Player Journey Tool"
SUBTITLE = "Match journeys · timeline playback · density heatmaps"

# Font availability varies by machine, so try a few and degrade to no text rather than
# crashing the asset build.
FONT_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]


def load_font(size: int):
    for path in FONT_CANDIDATES:
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    return None


def main() -> None:
    with Image.open(SOURCE) as src:
        img = src.convert("RGB")
        # Centre-crop the populated part of the map, then fit the OG aspect.
        side = int(min(img.size) * 0.62)
        cx, cy = img.size[0] // 2, img.size[1] // 2
        crop = img.crop((cx - side // 2, cy - side // 2, cx + side // 2, cy + side // 2))
        crop = crop.resize((W, int(W * crop.size[1] / crop.size[0])), Image.LANCZOS)

    canvas = Image.new("RGB", (W, H), BACKGROUND)
    canvas.paste(crop, (0, (H - crop.size[1]) // 2))
    # Darken so text stays legible -- design.md keeps the ground dark and lets a few
    # saturated accents carry the signal.
    canvas = Image.blend(canvas, Image.new("RGB", (W, H), BACKGROUND), 0.66)

    draw = ImageDraw.Draw(canvas)
    title_font = load_font(58)
    sub_font = load_font(30)
    if title_font and sub_font:
        draw.text((72, H // 2 - 60), TITLE, font=title_font, fill=TEXT_PRIMARY)
        draw.text((72, H // 2 + 20), SUBTITLE, font=sub_font, fill=TEXT_SECONDARY)
    else:
        print("note: no usable system font found -- image generated without text")

    draw.rectangle([0, H - 8, W, H], fill=HUMAN)

    canvas.save(OUTPUT, "JPEG", quality=82, optimize=True, progressive=True)
    print(f"wrote {OUTPUT.relative_to(REPO_ROOT)}  {OUTPUT.stat().st_size // 1024} KB  {W}x{H}")


if __name__ == "__main__":
    main()
