import { getMapConfig, getMapConfigs, getPickerEntries } from "@/lib/data";
import { pixelBounds } from "@/lib/coordinates";
import { MapViewport } from "@/components/MapViewport";
import { MatchLayer } from "@/components/MatchLayer";
import { Legend } from "@/components/Legend";
import { FilterRail } from "@/components/FilterRail";
import { PlaybackControls } from "@/components/PlaybackControls";
import { HeatmapProvider } from "@/components/HeatmapContext";
import { HeatmapControls } from "@/components/HeatmapControls";
import type { MatchData } from "@/lib/types";

interface MatchViewProps {
  match: MatchData;
  mapFilter?: string;
  dateFilter?: string;
}

/**
 * The whole tool for one selected match. Shared by `/` and `/match/[matchId]` so the
 * landing route can render the tool directly rather than redirecting into a deep link:
 * with deep links set to noindex (PRD.md §10), a redirecting landing page would have
 * left the site with nothing indexable at all.
 */
export function MatchView({ match, mapFilter, dateFilter }: MatchViewProps) {
  const map = getMapConfig(match.map_id);
  const entries = getPickerEntries();
  const maps = Object.values(getMapConfigs()).map((m) => ({
    id: m.id,
    displayName: m.displayName,
  }));
  const dates = [...new Set(entries.map((e) => e.date))].sort();

  const dateKey = dateFilter ?? "all";
  const dateLabel = dateFilter ? `on ${dateFilter}` : "all dates";

  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const summary =
    `${match.date} · ${plural(match.participant_count, "participant")} ` +
    `(${match.human_count} human, ${match.bot_count} bot) · ` +
    `${plural(match.events.length, "event")}`;

  return (
    <main className="relative h-dvh w-screen overflow-hidden bg-background">
      {/* A skip link is the standard escape hatch for a keyboard user who does not want
          to tab through the filter rail to reach the map. */}
      <a
        href="#map-viewport"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:flex focus:min-h-11 focus:items-center focus:rounded-sm focus:border focus:border-border focus:bg-surfaceRaised focus:px-3 focus:text-ui-emphasis focus:text-textPrimary"
      >
        Skip to map
      </a>

      <HeatmapProvider mapId={map.id} dateKey={dateKey}>
        {/* The rail is rendered BEFORE the map so keyboard focus reaches the filters
            first. It is absolutely positioned, so DOM order doesn't affect where it
            appears -- but with the map first, tabbing had to cross ~37 journey and
            event markers before arriving at the controls. */}
        <div className="pointer-events-none absolute inset-0">
          <FilterRail
            entries={entries}
            maps={maps}
            dates={dates}
            selectedMatchId={match.match_id}
            map={mapFilter ?? "all"}
            date={dateFilter ?? "all"}
          >
            {/* Labelled "Now viewing" so selecting a match visibly updates a named
                readout, rather than only changing the map behind the rail.

                The summary is built as one string rather than interleaved JSX
                expressions: React inserts a `<!-- -->` separator between adjacent
                expressions, and a screen reader chunks on those, so this line was being
                read as several broken fragments instead of one sentence. */}
            <section
              aria-labelledby="now-viewing-heading"
              className="shrink-0 border-t border-border pt-5"
            >
              <p id="now-viewing-heading" className="text-ui text-textSecondary">
                Now viewing
              </p>
              <h1 className="text-heading text-textPrimary">{map.displayName}</h1>
              <p className="text-ui text-textSecondary">{summary}</p>
              <p className="text-data mt-1 truncate text-textSecondary" title={match.match_id}>
                {match.match_id}
              </p>
            </section>
            <Legend match={match} />
            <HeatmapControls dateLabel={dateLabel} />
          </FilterRail>
        </div>

        {/* Bottom-centre, clear of the left rail and the bottom-right zoom controls. */}
        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 flex justify-center md:left-[344px] md:right-20">
          <div className="w-full max-w-2xl">
            <PlaybackControls key={match.match_id} eventCount={match.events.length} />
          </div>
        </div>

        <MapViewport
          map={map}
          focusBounds={pixelBounds(match.events, map) ?? undefined}
          focusKey={match.match_id}
          ariaLabel={`Interactive map: player paths and events on ${map.displayName} for match ${match.match_id}.`}
        >
          <MatchLayer match={match} map={map} />
        </MapViewport>
      </HeatmapProvider>
    </main>
  );
}
