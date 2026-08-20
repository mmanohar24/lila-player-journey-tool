import type { MapConfig } from "./types";

export interface PixelPosition {
  px: number;
  py: number;
}

/**
 * World (x, z) -> minimap pixel (px, py), per player_data/README.md's documented
 * formula, using each map's ACTUAL measured width/height (PRD.md §2/§10 -- the
 * README's "1024x1024" claim is wrong for all three maps, verified via
 * scripts/measure_maps.py). Width and height are applied independently rather
 * than assuming a shared square side length, since GrandRift measures 2160x2158,
 * not perfectly square.
 */
/** Pixel-space bounding box of a set of world coordinates, for framing the view. */
export function pixelBounds(
  points: { x: number; z: number }[],
  map: MapConfig
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (points.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    const { px, py } = worldToPixel(p.x, p.z, map);
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  }
  return { minX, minY, maxX, maxY };
}

export function worldToPixel(x: number, z: number, map: MapConfig): PixelPosition {
  const u = (x - map.originX) / map.scale;
  const v = (z - map.originZ) / map.scale;
  const px = u * map.width;
  const py = (1 - v) * map.height; // Y flipped: image origin is top-left.
  return { px, py };
}
