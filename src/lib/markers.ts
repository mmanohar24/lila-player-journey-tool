import type { EventType } from "./types";

export type MarkerShape = "circle" | "diamond" | "cross" | "triangle" | "square";

/**
 * Shape per event type, per design.md's Components section. Shape (not colour alone)
 * carries the event-type distinction so the view stays readable for anyone who can't
 * rely on hue.
 */
export const EVENT_SHAPE: Record<EventType, MarkerShape> = {
  Position: "circle",
  BotPosition: "circle",
  Kill: "diamond",
  BotKill: "diamond",
  Killed: "cross",
  BotKilled: "cross",
  KilledByStorm: "triangle",
  Loot: "square",
};

/**
 * Colour per event type, per design.md's Colors section. Position samples are the one
 * case that resolves by PLAYER kind rather than event name -- see `markerColor`.
 */
export const EVENT_COLOR: Record<EventType, string> = {
  Position: "var(--color-human)",
  BotPosition: "var(--color-bot)",
  Kill: "var(--color-kill)",
  BotKill: "var(--color-kill)",
  Killed: "var(--color-killed)",
  BotKilled: "var(--color-killed)",
  KilledByStorm: "var(--color-storm)",
  Loot: "var(--color-loot)",
};

/** Short noun label, for hover tooltips and the legend. */
export const EVENT_LABEL: Record<EventType, string> = {
  Position: "Position sample",
  BotPosition: "Position sample",
  Kill: "Kill (player)",
  BotKill: "Kill (bot)",
  Killed: "Death (by player)",
  BotKilled: "Death (by bot)",
  KilledByStorm: "Death (storm)",
  Loot: "Loot pickup",
};

/** Verb phrase, so an aria-label reads as a sentence rather than stacked fragments. */
const EVENT_DESCRIPTION: Record<EventType, string> = {
  Position: "position sample",
  BotPosition: "position sample",
  Kill: "killed another player",
  BotKill: "killed a bot",
  Killed: "was killed by another player",
  BotKilled: "was killed by a bot",
  KilledByStorm: "was killed by the storm",
  Loot: "picked up loot",
};

export function isPositionEvent(event: EventType): boolean {
  return event === "Position" || event === "BotPosition";
}

/**
 * Resolve a marker's colour.
 *
 * Position samples colour by whether the PLAYER is a human or a bot, not by whether the
 * event happens to be named `Position` vs `BotPosition`. Verified against the actual
 * data: those two don't line up -- bots emit 636 `Position` events (and 115 `Loot`),
 * contradicting the assignment README's claim that bots only ever emit `Bot*` events.
 * `user_id` shape (UUID vs numeric, classified in the pipeline) is the reliable signal;
 * the event name is not.
 */
export function markerColor(event: EventType, isBot: boolean): string {
  if (isPositionEvent(event)) {
    return isBot ? "var(--color-bot)" : "var(--color-human)";
  }
  return EVENT_COLOR[event];
}

/**
 * Normalized progress through the match, 0-100. PRD.md §6: per-file `ts` ranges are
 * ~300-800ms, which is not literal elapsed match time, so position in the match is
 * expressed as a percentage rather than a fake mm:ss clock.
 */
export function normalizedProgress(t: number, minT: number, maxT: number): number {
  if (maxT === minT) return 0;
  return ((t - minT) / (maxT - minT)) * 100;
}

export function markerAriaLabel(
  event: EventType,
  isBot: boolean,
  progressPercent: number
): string {
  return `${isBot ? "Bot" : "Human player"} ${EVENT_DESCRIPTION[event]}, ${Math.round(
    progressPercent
  )}% into match`;
}
