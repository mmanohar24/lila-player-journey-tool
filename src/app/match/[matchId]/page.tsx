import { notFound } from "next/navigation";
import { getMapConfig, getMapConfigs, getMatch, getPickerEntries } from "@/lib/data";
import { pixelBounds } from "@/lib/coordinates";
import { MapViewport } from "@/components/MapViewport";
import { MatchLayer } from "@/components/MatchLayer";
import { Legend } from "@/components/Legend";
import { FilterRail } from "@/components/FilterRail";

interface PageProps {
  params: Promise<{ matchId: string }>;
  searchParams: Promise<{ map?: string; date?: string }>;
}

export default async function MatchPage({ params, searchParams }: PageProps) {
  const { matchId } = await params;
  const { map: mapFilter, date: dateFilter } = await searchParams;

  const match = getMatch(matchId);
  if (!match) notFound();

  const map = getMapConfig(match.map_id);
  const entries = getPickerEntries();
  const maps = Object.values(getMapConfigs()).map((m) => ({
    id: m.id,
    displayName: m.displayName,
  }));
  const dates = [...new Set(entries.map((e) => e.date))].sort();

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-background">
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
              readout, rather than only changing the map behind the rail. */}
          <div className="shrink-0 border-t border-border pt-5">
            <p className="text-ui text-textSecondary">Now viewing</p>
            <h1 className="text-heading text-textPrimary">{map.displayName}</h1>
            <p className="text-ui text-textSecondary">
              {match.date} · {match.participant_count} participant
              {match.participant_count === 1 ? "" : "s"} ({match.human_count} human,{" "}
              {match.bot_count} bot) · {match.events.length} events
            </p>
            <p className="text-data mt-1 truncate text-textSecondary" title={match.match_id}>
              {match.match_id}
            </p>
          </div>
          <Legend match={match} />
        </FilterRail>
      </div>

      <MapViewport
        map={map}
        focusBounds={pixelBounds(match.events, map) ?? undefined}
        focusKey={match.match_id}
        ariaLabel={`Interactive map: player paths and events on ${map.displayName} for match ${match.match_id}.`}
      >
        <MatchLayer match={match} map={map} />
      </MapViewport>
    </main>
  );
}
