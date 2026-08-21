"use client";

import { useEffect, useState } from "react";
import { useCloseDrawer } from "./DrawerContext";
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
  /** Which map's fetch most recently failed, if any -- not a plain boolean, so switching
   *  to a map that hasn't failed doesn't need an explicit reset. Resetting synchronously
   *  in the effect body itself risked showing the OLD map's error while the new map's
   *  fetch was still in flight, for the render between the mapId change and that fetch
   *  resolving. */
  const [failedMapId, setFailedMapId] = useState<string | null>(null);
  const fetchFailed = failedMapId === mapId;
  const closeDrawer = useCloseDrawer();

  // Selecting a match or a filter already closes the mobile drawer, as a side effect of
  // the route change each triggers. The heatmap layer is deliberately client state, not
  // a route (see HeatmapContext), so it needs the same "show me the map" close done
  // explicitly. On the persistent desktop rail this is a no-op -- `open` no longer
  // affects visibility once the `rail:` breakpoint matches.
  const selectLayer = (l: HeatmapLayerKey | null) => {
    setLayer(l);
    closeDrawer();
  };

  // Fetch the map's grids once; the summary for the active layer is then derived
  // during render, so no effect has to synchronously set state when the layer changes.
  // A failed fetch used to be swallowed silently -- the layer buttons still worked, but
  // the summary text just went blank with nothing telling anyone why.
  useEffect(() => {
    let cancelled = false;
    fetch(`/data/heatmaps/${mapId}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`heatmap fetch failed: ${r.status}`);
        return r.json();
      })
      .then((f) => {
        if (!cancelled) setFile(f);
      })
      .catch(() => {
        if (!cancelled) setFailedMapId(mapId);
      });
    return () => {
      cancelled = true;
    };
  }, [mapId]);

  const summary: HeatmapLayerData | null = layer ? file?.dates?.[dateKey]?.[layer] ?? null : null;

  return (
    <section
      aria-labelledby="heatmap-heading"
      className="shrink-0 border-t border-border pt-5"
    >
      <h2 id="heatmap-heading" className="text-ui-emphasis text-textPrimary">
        Density heatmap
      </h2>
      {/* PRD.md §5: the heatmap aggregates every match on this map within the date
          filter and is deliberately NOT limited to the selected match -- one match
          carries too few combat events to be a density surface. */}
      <p className="text-ui mt-1 text-textSecondary">
        {`All matches on this map, ${dateLabel}. Not limited to the selected match.`}
      </p>

      <div className="mt-2 flex flex-wrap gap-1" role="group" aria-label="Heatmap layer">
        <button
          type="button"
          onClick={() => selectLayer(null)}
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
            onClick={() => selectLayer(l.key)}
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
          the same finding is stated as text (design.md, Heatmap toggle/legend).
          `role="status"` is a live region -- announced automatically, not just visible --
          so this covers the fetch-failure branch too, not only the summary text. */}
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
      {layer && !summary && fetchFailed && (
        <p className="text-ui mt-2 text-textSecondary" role="status">
          Couldn&apos;t load this heatmap layer. Try again in a moment.
        </p>
      )}
    </section>
  );
}
