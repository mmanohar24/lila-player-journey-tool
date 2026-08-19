import { worldToPixel } from "@/lib/coordinates";
import {
  eventPhrase,
  eventRole,
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
      {/* One focusable group per player: journey path + that player's position samples.
          Position samples are the bulk of the data (~82% of rows) and are labelled once
          per player rather than per dot -- individually labelling ~800 "position sample"
          nodes would bury the meaningful combat/loot events for a screen-reader user and
          create a ~1000-stop tab trap. Grouping keeps every player keyboard-reachable
          (~16 stops) while still conveying the same content (WCAG 1.1.1). */}
      {eventsByPlayer.map((events, playerIndex) => {
        if (events.length === 0) return null;
        const player = match.players[playerIndex];
        const positions = events.filter((ev) => isPositionEvent(ev.e));
        const points = events
          .map((ev) => {
            const { px, py } = worldToPixel(ev.x, ev.z, map);
            return `${px},${py}`;
          })
          .join(" ");

        return (
          <g
            key={`journey-${playerIndex}`}
            role="img"
            tabIndex={0}
            className="journey"
            aria-label={`${player.is_bot ? "Bot" : "Human player"} ${player.id}: journey path with ${
              positions.length
            } position samples`}
            /* Tooltip content is read off these by MapViewport rather than rendered as
               an SVG <title>: <title> produces the browser's native tooltip, which has a
               fixed ~1s delay and can't be styled to match the app's surfaces. */
            data-tt-title={`${player.is_bot ? "Bot" : "Human"} ${player.id}`}
            data-tt-meta={`${positions.length} position samples`}
          >

            {/* Focus/hover halo: highlights this player's whole route. */}
            {events.length > 1 && (
              <polyline
                className="journey-halo"
                points={points}
                fill="none"
                stroke="var(--color-focusRing)"
                strokeWidth={pathWidth * 5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}

            {events.length > 1 && (
              <polyline
                points={points}
                fill="none"
                stroke={player.is_bot ? "var(--color-bot)" : "var(--color-human)"}
                strokeOpacity={player.is_bot ? 0.35 : 0.5}
                strokeWidth={pathWidth}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}

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
                />
              );
            })}
          </g>
        );
      })}

      {/* Discrete events (kills, deaths, storm, loot): the story of the match. Each is
          individually focusable with its own aria-label, and carries data-tt-* attributes
          that MapViewport turns into a styled hover/focus tooltip. */}
      {match.events.map((ev, i) => {
        if (isPositionEvent(ev.e)) return null;
        const player = match.players[ev.p];
        const { px, py } = worldToPixel(ev.x, ev.z, map);
        const progress = normalizedProgress(ev.t, minT, maxT);
        const label = markerAriaLabel(ev.e, player.is_bot, progress);

        return (
          <g
            key={`event-${i}`}
            role="img"
            aria-label={label}
            tabIndex={0}
            className="marker"
            data-tt-title={eventPhrase(ev.e, player.is_bot).short}
            /* Name the role ("Victim:" / "Killer:") rather than just the id: a bare
               "Death (by a bot)" above a human's UUID reads as though the bot died,
               when the row in fact belongs to the victim. */
            data-tt-sub={`${eventRole(ev.e)}: ${player.is_bot ? "Bot" : "Human"} ${player.id}`}
            data-tt-meta={`${Math.round(progress)}% into match`}
            data-tt-color={markerColor(ev.e, player.is_bot)}
          >
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
