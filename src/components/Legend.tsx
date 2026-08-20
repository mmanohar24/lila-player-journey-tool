import { EventMarkerShape } from "./EventMarker";
import { isDeathEvent, type MarkerShape } from "@/lib/markers";
import type { MatchData } from "@/lib/types";

interface LegendEntry {
  shape: MarkerShape;
  color: string;
  label: string;
  count: number;
  opacity?: number;
}

/**
 * One legend row.
 *
 * The label and its count are visually two elements (the count is monospace), and React
 * additionally emits a `<!-- -->` separator between adjacent expressions. A screen reader
 * chunks on both, which split "Human 1" apart and ran the stray count into the next row
 * ("1 Bot 14"). Naming the row explicitly and hiding its innards makes it announce as a
 * single phrase while looking exactly the same.
 */
function Swatch({ entry }: { entry: LegendEntry }) {
  const absent = entry.count === 0;
  return (
    <li
      className={`flex items-center gap-2 ${absent ? "opacity-40" : ""}`}
      aria-label={`${entry.label}: ${entry.count}`}
    >
      <span aria-hidden="true" className="flex items-center gap-2">
        <svg width={14} height={14} viewBox="0 0 14 14" className="shrink-0">
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
    </li>
  );
}

export function Legend({ match }: { match: MatchData }) {
  const counts = match.event_counts;
  const n = (...keys: (keyof typeof counts)[]) =>
    keys.reduce((sum, k) => sum + (counts[k] ?? 0), 0);

  // Mirrors MatchLayer's rule: a journey is drawn only when it has >1 event, and an
  // end marker only when that journey contains no death at all (a death already has
  // its own marker). Checking for any death rather than the last event matters --
  // logging often continues past the fatal event.
  const journeyCounts = (() => {
    const byPlayer = match.players.map(() => [] as typeof match.events);
    for (const ev of match.events) byPlayer[ev.p]?.push(ev);
    const drawn = byPlayer.filter((evs) => evs.length > 1);
    return {
      starts: drawn.length,
      openEnds: drawn.filter((evs) => !evs.some((ev) => isDeathEvent(ev.e))).length,
    };
  })();

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

  // Journey endpoints. A journey ending in a death is already marked by its death
  // marker, so only non-death endings get an explicit end marker -- hence the two
  // counts differ. "Last position" is deliberately not "survived": the schema has no
  // extraction event, so all that's known is that recording stopped.
  const journeyEntries: LegendEntry[] = [
    {
      shape: "ring",
      color: "var(--color-textSecondary)",
      label: "Journey start",
      count: journeyCounts.starts,
    },
    {
      shape: "bullseye",
      color: "var(--color-textSecondary)",
      label: "Last position",
      count: journeyCounts.openEnds,
    },
  ];

  // Each group is a real list, and the panel is a labelled region: without either, a
  // screen reader entering the legend announced nothing about where it had arrived and
  // read the rows as loose text rather than as discrete items.
  const groups: { label: string; entries: LegendEntry[] }[] = [
    { label: "Participants", entries: playerEntries },
    { label: "Event types", entries: eventEntries },
    { label: "Journey endpoints", entries: journeyEntries },
  ];

  return (
    <section
      aria-labelledby="legend-heading"
      className="rounded-md border border-border bg-surface/90 p-3 backdrop-blur-sm"
    >
      <h2 id="legend-heading" className="text-ui-emphasis mb-2 text-textPrimary">
        Legend
      </h2>

      {groups.map((group, i) => (
        /* A grid, not a wrapping flex row. Wrapping broke wherever it ran out of width,
           orphaning entries ("Storm death 0" and "Loot 7" alone on a line) with nothing
           lining up. Two fixed columns align every label and count, and cost about half
           the height a single column would in an already-scrolling drawer -- verified at
           393px that no entry overflows or wraps. */
        <ul
          key={group.label}
          aria-label={group.label}
          className={`grid grid-cols-2 gap-x-4 gap-y-2 ${
            i > 0 ? "mt-2 border-t border-border pt-2" : ""
          }`}
        >
          {group.entries.map((entry) => (
            <Swatch key={entry.label} entry={entry} />
          ))}
        </ul>
      ))}
    </section>
  );
}
