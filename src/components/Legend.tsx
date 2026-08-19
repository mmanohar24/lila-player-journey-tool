import { EventMarkerShape } from "./EventMarker";
import type { MarkerShape } from "@/lib/markers";

interface LegendEntry {
  shape: MarkerShape;
  color: string;
  label: string;
  opacity?: number;
}

const PLAYER_ENTRIES: LegendEntry[] = [
  { shape: "circle", color: "var(--color-human)", label: "Human" },
  { shape: "circle", color: "var(--color-bot)", label: "Bot", opacity: 0.7 },
];

const EVENT_ENTRIES: LegendEntry[] = [
  { shape: "circle", color: "var(--color-textSecondary)", label: "Position" },
  { shape: "diamond", color: "var(--color-kill)", label: "Kill" },
  { shape: "cross", color: "var(--color-killed)", label: "Death" },
  { shape: "triangle", color: "var(--color-storm)", label: "Storm death" },
  { shape: "square", color: "var(--color-loot)", label: "Loot" },
];

function Swatch({ entry }: { entry: LegendEntry }) {
  return (
    <span className="flex items-center gap-2">
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
      <span className="text-ui text-textSecondary">{entry.label}</span>
    </span>
  );
}

export function Legend() {
  return (
    <div className="rounded-md border border-border bg-surface/90 p-3 backdrop-blur-sm">
      <h2 className="text-ui-emphasis mb-2 text-textPrimary">Legend</h2>

      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {PLAYER_ENTRIES.map((entry) => (
          <Swatch key={entry.label} entry={entry} />
        ))}
      </div>

      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-2">
        {EVENT_ENTRIES.map((entry) => (
          <Swatch key={entry.label} entry={entry} />
        ))}
      </div>
    </div>
  );
}
