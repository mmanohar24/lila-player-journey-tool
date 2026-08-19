import { worldToPixel } from "@/lib/coordinates";
import {
  EVENT_LABEL,
  EVENT_SHAPE,
  isPositionEvent,
  markerAriaLabel,
  markerColor,
  normalizedProgress,
} from "@/lib/markers";
import type { MapConfig, MatchData } from "@/lib/types";
import { EventMarkerShape } from "./EventMarker";

/** Bots render recessive, per design.md: same shape language, reduced opacity. */
const BOT_OPACITY = 0.7;
const HUMAN_OPACITY = 0.95;

interface MatchLayerProps {
  match: MatchData;
  map: MapConfig;
}

export function MatchLayer({ match, map }: MatchLayerProps) {
  // Sizes are derived from each map's own pixel dimensions (4320 / 2160 / 9000) so
  // markers read at a consistent on-screen size across maps of very different scales.
  const positionRadius = map.width / 420;
  const discreteRadius = map.width / 170;
  const pathWidth = map.width / 1100;
  const crossStroke = map.width / 500;

  const times = match.events.map((ev) => ev.t);
  const minT = Math.min(...times);
  const maxT = Math.max(...times);

  // Group events per player so each player gets one continuous journey path. Events
  // arrive already sorted by ts from the pipeline, so per-player order is preserved.
  const eventsByPlayer = match.players.map(() => [] as typeof match.events);
  for (const ev of match.events) {
    eventsByPlayer[ev.p]?.push(ev);
  }

  return (
    <g>
      {/* Journey paths, drawn under the markers so markers stay legible on top. */}
      {eventsByPlayer.map((events, playerIndex) => {
        if (events.length < 2) return null;
        const player = match.players[playerIndex];
        const points = events
          .map((ev) => {
            const { px, py } = worldToPixel(ev.x, ev.z, map);
            return `${px},${py}`;
          })
          .join(" ");

        return (
          <polyline
            key={`path-${playerIndex}`}
            points={points}
            fill="none"
            stroke={player.is_bot ? "var(--color-bot)" : "var(--color-human)"}
            strokeOpacity={player.is_bot ? 0.35 : 0.5}
            strokeWidth={pathWidth}
            strokeLinejoin="round"
            strokeLinecap="round"
            aria-hidden="true"
          />
        );
      })}

      {/* Position samples: the bulk of the data (~82% of rows). Grouped per player and
          labelled once per group rather than per dot -- individually labelling ~800
          "position sample" nodes would bury the meaningful combat/loot events in noise
          for a screen-reader user, while the group label still conveys the same content
          (WCAG 1.1.1). The discrete events below are labelled and focusable one by one. */}
      {eventsByPlayer.map((events, playerIndex) => {
        const positions = events.filter((ev) => isPositionEvent(ev.e));
        if (positions.length === 0) return null;
        const player = match.players[playerIndex];

        return (
          <g
            key={`positions-${playerIndex}`}
            role="img"
            aria-label={`${player.is_bot ? "Bot" : "Human player"} ${player.id}: journey path with ${
              positions.length
            } position samples`}
          >
            {positions.map((ev, i) => {
              const { px, py } = worldToPixel(ev.x, ev.z, map);
              return (
                <circle
                  key={i}
                  cx={px}
                  cy={py}
                  r={positionRadius}
                  fill={markerColor(ev.e, player.is_bot)}
                  fillOpacity={player.is_bot ? BOT_OPACITY : HUMAN_OPACITY}
                  aria-hidden="true"
                />
              );
            })}
          </g>
        );
      })}

      {/* Discrete events (kills, deaths, storm, loot): the story of the match. Each is
          individually focusable with its own aria-label, and carries an SVG <title> so
          mouse users get a native hover tooltip too. */}
      {match.events.map((ev, i) => {
        if (isPositionEvent(ev.e)) return null;
        const player = match.players[ev.p];
        const { px, py } = worldToPixel(ev.x, ev.z, map);
        const progress = normalizedProgress(ev.t, minT, maxT);
        const label = markerAriaLabel(ev.e, player.is_bot, progress);

        return (
          <g key={`event-${i}`} role="img" aria-label={label} tabIndex={0} className="marker">
            <title>{`${EVENT_LABEL[ev.e]}\n${player.is_bot ? "Bot" : "Human"} ${
              player.id
            }\n${Math.round(progress)}% into match`}</title>
            {/* Focus ring: SVG doesn't render `outline` reliably across browsers, so the
                visible focus indicator (WCAG 2.4.7) is a real element toggled by CSS. */}
            <circle
              className="marker-focus-ring"
              cx={px}
              cy={py}
              r={discreteRadius * 2}
              fill="none"
              stroke="var(--color-focusRing)"
              strokeWidth={crossStroke}
            />
            <EventMarkerShape
              shape={EVENT_SHAPE[ev.e]}
              cx={px}
              cy={py}
              r={discreteRadius}
              color={markerColor(ev.e, player.is_bot)}
              opacity={player.is_bot ? BOT_OPACITY : 1}
              strokeWidth={crossStroke}
            />
          </g>
        );
      })}
    </g>
  );
}
