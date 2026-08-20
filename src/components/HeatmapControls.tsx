"use client";

import { useEffect, useState } from "react";
import { useHeatmap, type HeatmapLayerData, type HeatmapLayerKey } from "./HeatmapContext";

const LAYERS: { key: HeatmapLayerKey; label: string }[] = [
  { key: "traffic", label: "Traffic" },
  { key: "kills", label: "Kills" },
  { key: "deaths", label: "Deaths" },
];

const LAYER_NOUN: Record<HeatmapLayerKey, string> = {
  traffic: "position samples",
  kills: "kills",
  deaths: "deaths",
};

interface HeatmapFile {
  dates: Record<string, Record<HeatmapLayerKey, HeatmapLayerData>>;
}

export function HeatmapControls({ dateLabel }: { dateLabel: string }) {
  const { layer, setLayer, mapId, dateKey } = useHeatmap();
  const [file, setFile] = useState<HeatmapFile | null>(null);

  // Fetch the map's grids once; the summary for the active layer is then derived
  // during render, so no effect has to synchronously set state when the layer changes.
  useEffect(() => {
    let cancelled = false;
    fetch(`/data/heatmaps/${mapId}.json`)
      .then((r) => r.json())
      .then((f) => {
        if (!cancelled) setFile(f);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [mapId]);

  const summary: HeatmapLayerData | null = layer ? file?.dates?.[dateKey]?.[layer] ?? null : null;

  return (
    <div className="shrink-0 border-t border-border pt-5">
      <h2 className="text-ui-emphasis text-textPrimary">Density heatmap</h2>
      {/* PRD.md §5: the heatmap aggregates every match on this map within the date
          filter and is deliberately NOT limited to the selected match -- one match
          carries too few combat events to be a density surface. */}
      <p className="text-ui mt-1 text-textSecondary">
        All matches on this map, {dateLabel}. Not limited to the selected match.
      </p>

      <div className="mt-2 flex flex-wrap gap-1" role="group" aria-label="Heatmap layer">
        <button
          type="button"
          onClick={() => setLayer(null)}
          aria-pressed={layer === null}
          className={`h-11 rounded-sm border border-border px-3 text-ui ${
            layer === null ? "bg-surfaceRaised text-textPrimary" : "text-textSecondary"
          }`}
        >
          Off
        </button>
        {LAYERS.map((l) => (
          <button
            key={l.key}
            type="button"
            onClick={() => setLayer(l.key)}
            aria-pressed={layer === l.key}
            className={`h-11 rounded-sm border border-border px-3 text-ui ${
              layer === l.key ? "bg-surfaceRaised text-textPrimary" : "text-textSecondary"
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>

      {/* The canvas layer is a raster with nothing for a screen reader to enumerate, so
          the same finding is stated as text (design.md, Heatmap toggle/legend). */}
      {layer && summary && (
        <p className="text-ui mt-2 text-textSecondary" role="status">
          {summary.events === 0 ? (
            <>No {LAYER_NOUN[layer]} recorded for this map and date.</>
          ) : !summary.meaningful ? (
            <>
              Only <span className="text-data text-textPrimary">{summary.events}</span>{" "}
              {LAYER_NOUN[layer]} in this selection — too few to read as a density pattern.
              Widen the date filter.
            </>
          ) : (
            <>
              <span className="text-data text-textPrimary">{summary.events}</span>{" "}
              {LAYER_NOUN[layer]}. Highest density:{" "}
              <span className="text-textPrimary">{summary.peak.quadrant}</span> quadrant (
              {Math.round(summary.peak.share * 100)}% of total).
            </>
          )}
        </p>
      )}
    </div>
  );
}
