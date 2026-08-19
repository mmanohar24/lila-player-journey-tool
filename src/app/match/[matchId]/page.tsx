import { notFound } from "next/navigation";
import { getMapConfig, getMatch } from "@/lib/data";
import { MapViewport } from "@/components/MapViewport";
import { MatchLayer } from "@/components/MatchLayer";
import { Legend } from "@/components/Legend";

interface PageProps {
  params: Promise<{ matchId: string }>;
}

export default async function MatchPage({ params }: PageProps) {
  const { matchId } = await params;
  const match = getMatch(matchId);
  if (!match) notFound();

  const map = getMapConfig(match.map_id);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-background">
      <MapViewport
        map={map}
        ariaLabel={`Interactive map: player paths and events on ${map.displayName} for match ${match.match_id}.`}
      >
        <MatchLayer match={match} map={map} />
      </MapViewport>

      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3">
        <div className="pointer-events-auto w-fit max-w-sm rounded-md border border-border bg-surface/90 p-3 backdrop-blur-sm">
          <h1 className="text-heading">{map.displayName}</h1>
          <p className="text-ui text-textSecondary">
            {match.date} · {match.participant_count} participants ({match.human_count} human,{" "}
            {match.bot_count} bot) · {match.events.length} events
          </p>
          <p className="text-data text-textSecondary">match_id: {match.match_id}</p>
        </div>

        {/* Bottom-left, clear of the zoom controls in the bottom-right. */}
        <div className="pointer-events-auto w-fit max-w-md">
          <Legend />
        </div>
      </div>
    </main>
  );
}
