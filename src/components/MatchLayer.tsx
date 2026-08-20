import { worldToPixel } from "@/lib/coordinates";
import {
  eventPhrase,
  eventRole,
  EVENT_SHAPE,
  isDeathEvent,
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
    // `key` on the match id so React mounts a fresh node per match, restarting the
    // entrance animation rather than reusing the previous match's element.
    <g key={match.match_id} className="match-layer">
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

        const playerColor = player.is_bot ? "var(--color-bot)" : "var(--color-human)";
        const first = events[0];
        const last = events[events.length - 1];
        const start = worldToPixel(first.x, first.z, map);
        const end = worldToPixel(last.x, last.z, map);
        // Whether the journey contains a death AT ALL -- deliberately not "is the last
        // event a death". Logging frequently continues past the fatal event: 28% of
        // journeys containing a death have later events, sometimes a stray position
        // sample 1ms afterwards. Keying off the last event alone therefore labelled
        // those as "no death recorded", which is simply wrong.
        const death = events.find((ev) => isDeathEvent(ev.e));
        const endsInDeath = death !== undefined;
        // Deliberately NOT called "survived"/"extracted": the schema has no extraction
        // event (PRD.md §2), so all we can honestly claim is that recording stopped.
        const endText = death
          ? `ends in death — ${eventPhrase(death.e, player.is_bot).sentence}`
          : "ends at last recorded position (no death recorded)";

        return (
          <g
            key={`journey-${playerIndex}`}
            role="img"
            tabIndex={0}
            className="journey"
            aria-label={`${player.is_bot ? "Bot" : "Human player"} ${player.id}: journey path with ${
              positions.length
            } position samples, ${endText}`}
            /* Tooltip content is read off these by MapViewport rather than rendered as
               an SVG <title>: <title> produces the browser's native tooltip, which has a
               fixed ~1s delay and can't be styled to match the app's surfaces. */
            data-tt-title={`${player.is_bot ? "Bot" : "Human"} ${player.id}`}
            data-tt-sub={`${positions.length} position samples`}
            data-tt-meta={endText}
            data-tt-color={playerColor}
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

            {/* Journey endpoints, drawn last so they sit above the position samples.
                They carry no separate aria-label or tab stop: they're properties of
                this journey, already described in the group's label above, and making
                them focusable would triple the tab count for no new information. */}
            {events.length > 1 && (
              <EventMarkerShape
                shape="ring"
                cx={start.px}
                cy={start.py}
                r={positionRadius * 3.2}
                color={playerColor}
                opacity={player.is_bot ? BOT_OPACITY : 1}
                strokeWidth={pathWidth * 3}
              />
            )}
            {events.length > 1 && !endsInDeath && (
              <EventMarkerShape
                shape="bullseye"
                cx={end.px}
                cy={end.py}
                r={positionRadius * 3.2}
                color={playerColor}
                opacity={player.is_bot ? BOT_OPACITY : 1}
                strokeWidth={pathWidth * 3}
              />
            )}
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
