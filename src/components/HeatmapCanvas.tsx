"use client";

import { useEffect, useRef, useState } from "react";
import { useHeatmap, type HeatmapLayerData, type HeatmapLayerKey } from "./HeatmapContext";
import type { MapConfig } from "@/lib/types";

interface HeatmapFile {
  grid: number;
  dates: Record<string, Record<HeatmapLayerKey, HeatmapLayerData>>;
}

/** One fetch per map for the session, shared across mounts. */
const fileCache = new Map<string, Promise<HeatmapFile>>();

function loadHeatmap(mapId: string): Promise<HeatmapFile> {
  let p = fileCache.get(mapId);
  if (!p) {
    p = fetch(`/data/heatmaps/${mapId}.json`).then((r) => r.json());
    fileCache.set(mapId, p);
  }
  return p;
}

function decodeCells(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Density ramp, per design.md: a sequential gradient anchored on the `storm` and `kill`
 * hues, running low -> high. Alpha climbs with density so sparse regions stay out of the
 * way. It reads as a continuous surface rather than discrete marks, which is what keeps
 * "aggregate density" from being mistaken for "this specific event".
 */
function ramp(v: number): [number, number, number, number] {
  const t = v / 255;
  if (t <= 0) return [0, 0, 0, 0];
  // storm #d34dd9 -> kill #f63d4c
  const r = Math.round(0xd3 + (0xf6 - 0xd3) * t);
  const g = Math.round(0x4d + (0x3d - 0x4d) * t);
  const b = Math.round(0xd9 + (0x4c - 0xd9) * t);
  // Ease alpha so the faint tail doesn't wash the whole map.
  const a = Math.round(Math.pow(t, 0.75) * 0.72 * 255);
  return [r, g, b, a];
}

interface HeatmapCanvasProps {
  map: MapConfig;
  /** Current SVG viewBox, so the raster lines up with the map under pan and zoom. */
  viewBox: { x: number; y: number; w: number; h: number };
}

export function HeatmapCanvas({ map, viewBox }: HeatmapCanvasProps) {
  const { layer, mapId, dateKey } = useHeatmap();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [grid, setGrid] = useState<HTMLCanvasElement | null>(null);

  // Build a small offscreen canvas holding the grid itself; the visible canvas just
  // scales that up. Rasterising 64x64 once and letting the GPU smooth it is far cheaper
  // than painting thousands of cells on every pan frame.
  //
  // The effect bails out when no layer is active rather than clearing state: with no
  // layer this component renders nothing, so a stale grid is never visible, and this
  // avoids a synchronous setState inside the effect body.
  useEffect(() => {
    if (!layer) return;
    let cancelled = false;
    loadHeatmap(mapId).then((file) => {
      if (cancelled) return;
      const data = file.dates?.[dateKey]?.[layer];
      if (!data || !data.cells) {
        setGrid(null);
        return;
      }
      const g = file.grid;
      const cells = decodeCells(data.cells);
      const off = document.createElement("canvas");
      off.width = g;
      off.height = g;
      const octx = off.getContext("2d");
      if (!octx) return;
      const img = octx.createImageData(g, g);
      for (let i = 0; i < cells.length; i++) {
        const [r, gg, b, a] = ramp(cells[i]);
        img.data[i * 4] = r;
        img.data[i * 4 + 1] = gg;
        img.data[i * 4 + 2] = b;
        img.data[i * 4 + 3] = a;
      }
      octx.putImageData(img, 0, 0);
      setGrid(off);
    });
    return () => {
      cancelled = true;
    };
  }, [layer, mapId, dateKey]);

  // Repaint whenever the view moves. The grid covers the whole map, so it is placed by
  // transforming map-pixel space into the canvas using the same viewBox the SVG uses.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const rect = parent.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    if (!grid) return;

    const scaleX = rect.width / viewBox.w;
    const scaleY = rect.height / viewBox.h;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      grid,
      -viewBox.x * scaleX,
      -viewBox.y * scaleY,
      map.width * scaleX,
      map.height * scaleY
    );
  });

  if (!layer) return null;

  return (
    <canvas
      ref={canvasRef}
      // Purely decorative to assistive tech: the same information is given as text by
      // HeatmapControls, because a raster has no per-point nodes to describe.
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
