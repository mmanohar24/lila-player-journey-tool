import { notFound } from "next/navigation";
import { getMapConfig, getMatch } from "@/lib/data";
import { worldToPixel } from "@/lib/coordinates";
import { MapViewport } from "@/components/MapViewport";

interface PageProps {
  params: Promise<{ matchId: string }>;
}

export default async function MatchPage({ params }: PageProps) {
  const { matchId } = await params;
  const match = getMatch(matchId);
  if (!match) notFound();

  const map = getMapConfig(match.map_id);
  // Visible dot size scaled to each map's own resolution (Lockdown is 9000px,
  // AmbroseValley 4320px) rather than a fixed pixel radius.
  const markerRadius = Math.round(map.width / 250);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-background">
      <MapViewport
        map={map}
        ariaLabel={`Interactive map: player paths on ${map.displayName} for match ${match.match_id}.`}
      >
        {match.events.map((ev, i) => {
          const { px, py } = worldToPixel(ev.x, ev.z, map);
          return (
            <circle key={i} cx={px} cy={py} r={markerRadius} fill="var(--color-human)" fillOpacity={0.85} />
          );
        })}
      </MapViewport>

      <div className="pointer-events-none absolute inset-0 p-3">
        <div className="pointer-events-auto w-fit max-w-sm rounded-md border border-border bg-surface/90 p-3 backdrop-blur-sm">
          <h1 className="text-heading">{map.displayName}</h1>
          <p className="text-ui text-textSecondary">
            {match.date} · {match.participant_count} participants ({match.human_count} human,{" "}
            {match.bot_count} bot) · {match.events.length} events
          </p>
          <p className="text-data text-textSecondary">match_id: {match.match_id}</p>
        </div>
      </div>
    </main>
  );
}
