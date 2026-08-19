import { EventMarkerShape } from "./EventMarker";
import type { MarkerShape } from "@/lib/markers";
import type { MatchData } from "@/lib/types";

interface LegendEntry {
  shape: MarkerShape;
  color: string;
  label: string;
  count: number;
  opacity?: number;
}

function Swatch({ entry }: { entry: LegendEntry }) {
  const absent = entry.count === 0;
  return (
    <span className={`flex items-center gap-2 ${absent ? "opacity-40" : ""}`}>
      <svg width={14} height={14} viewBox="0 0 14 14" aria-hidden="true" className="shrink-0">
        <EventMarkerShape
          shape={entry.shape}
          cx={7}
          cy={7}
          r={5}
          color={entry.color}
          opacity={entry.opacity ?? 1}
          strokeWidth={2}
        />
      </svg>
      <span className="text-ui text-textSecondary">
        {entry.label} <span className="text-data">{entry.count}</span>
      </span>
    </span>
  );
}

export function Legend({ match }: { match: MatchData }) {
  const counts = match.event_counts;
  const n = (...keys: (keyof typeof counts)[]) =>
    keys.reduce((sum, k) => sum + (counts[k] ?? 0), 0);

  const playerEntries: LegendEntry[] = [
    { shape: "circle", color: "var(--color-human)", label: "Human", count: match.human_count },
    { shape: "circle", color: "var(--color-bot)", label: "Bot", count: match.bot_count, opacity: 0.7 },
  ];

  // Counts are per-match, and zero-count rows stay visible but dimmed: the encoding
  // stays learnable, while it's immediately obvious which event types this particular
  // match doesn't contain. Most matches have no storm deaths (39/796) and almost none
  // have human-vs-human kills (3/796), so a static key would otherwise send someone
  // hunting for markers that aren't there.
  const eventEntries: LegendEntry[] = [
    {
      shape: "circle",
      color: "var(--color-textSecondary)",
      label: "Position",
      count: n("Position", "BotPosition"),
    },
    { shape: "diamond", color: "var(--color-kill)", label: "Kill", count: n("Kill", "BotKill") },
    { shape: "cross", color: "var(--color-killed)", label: "Death", count: n("Killed", "BotKilled") },
    {
      shape: "triangle",
      color: "var(--color-storm)",
      label: "Storm death",
      count: n("KilledByStorm"),
    },
    { shape: "square", color: "var(--color-loot)", label: "Loot", count: n("Loot") },
  ];

  return (
    <div className="rounded-md border border-border bg-surface/90 p-3 backdrop-blur-sm">
      <h2 className="text-ui-emphasis mb-2 text-textPrimary">Legend</h2>

      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {playerEntries.map((entry) => (
          <Swatch key={entry.label} entry={entry} />
        ))}
      </div>

      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-2">
        {eventEntries.map((entry) => (
          <Swatch key={entry.label} entry={entry} />
        ))}
      </div>
    </div>
  );
}
