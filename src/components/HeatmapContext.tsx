"use client";

import { createContext, useContext, useMemo, useState } from "react";

export type HeatmapLayerKey = "traffic" | "kills" | "deaths";

export interface HeatmapLayerData {
  events: number;
  /** False when too few events back the grid for a density surface to mean anything. */
  meaningful: boolean;
  peak: { quadrant: string | null; share: number };
  cells: string;
}

interface HeatmapState {
  layer: HeatmapLayerKey | null;
  setLayer: (l: HeatmapLayerKey | null) => void;
  /** Map currently on screen -- the heatmap is always drawn for this map. */
  mapId: string;
  /** Date filter, or "all". The heatmap honours map+date but NOT the match selection. */
  dateKey: string;
}

const Ctx = createContext<HeatmapState | null>(null);

export function useHeatmap() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useHeatmap must be used inside HeatmapProvider");
  return ctx;
}

/**
 * Holds which density layer is showing. Client state rather than a URL parameter so
 * toggling is instant -- a search param would re-run the route on every toggle, and the
 * heatmap is a view mode rather than part of the data selection.
 *
 * The provider wraps both the rail and the map viewport, and its children are still
 * server-rendered: passing server components through as `children` keeps MatchLayer's
 * ~1000 markers off the client bundle.
 */
export function HeatmapProvider({
  mapId,
  dateKey,
  children,
}: {
  mapId: string;
  dateKey: string;
  children: React.ReactNode;
}) {
  const [layer, setLayer] = useState<HeatmapLayerKey | null>(null);
  const value = useMemo(() => ({ layer, setLayer, mapId, dateKey }), [layer, mapId, dateKey]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
