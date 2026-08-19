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

/** Generic category label, used by the legend (which aggregates across both player kinds). */
export const EVENT_LABEL: Record<EventType, string> = {
  Position: "Position sample",
  BotPosition: "Position sample",
  Kill: "Kill",
  BotKill: "Kill",
  Killed: "Death",
  BotKilled: "Death",
  KilledByStorm: "Death (storm)",
  Loot: "Loot pickup",
};

/**
 * Whether the event's subject is the killer, the victim, or neither -- so a label can
 * name the role explicitly. Without this, "Death (by bot)" next to a human's UUID reads
 * as though the bot died, when the row actually belongs to the victim.
 */
export function eventRole(event: EventType): "Killer" | "Victim" | "Player" {
  switch (event) {
    case "Kill":
    case "BotKill":
      return "Killer";
    case "Killed":
    case "BotKilled":
    case "KilledByStorm":
      return "Victim";
    default:
      return "Player";
  }
}

/**
 * Event wording, resolved against the SUBJECT of the row (the file's owner).
 *
 * The assignment README defines these events as though every row belongs to a human
 * ("BotKilled: A human player was killed by a bot"). The data disagrees: bots emit 183
 * `BotKill` and 297 `BotKilled` rows of their own. On those rows the README's reading
 * would have us assert the counterparty was a bot, and PRD.md §2 already establishes
 * there is no killer/victim ID column to support such a claim. So the counterparty is
 * only named where the README's definition actually applies -- human-owned rows -- and
 * bot-owned rows fall back to neutral wording that claims only what the row states.
 */
export function eventPhrase(event: EventType, isBot: boolean): { short: string; sentence: string } {
  if (isBot) {
    switch (event) {
      case "Kill":
      case "BotKill":
        return { short: "Kill", sentence: "got a kill" };
      case "Killed":
      case "BotKilled":
        return { short: "Death", sentence: "was killed" };
      case "KilledByStorm":
        return { short: "Death (storm)", sentence: "was killed by the storm" };
      case "Loot":
        return { short: "Loot pickup", sentence: "picked up loot" };
      default:
        return { short: "Position sample", sentence: "position sample" };
    }
  }

  switch (event) {
    case "Kill":
      return { short: "Kill (of a player)", sentence: "killed another player" };
    case "BotKill":
      return { short: "Kill (of a bot)", sentence: "killed a bot" };
    case "Killed":
      return { short: "Death (by a player)", sentence: "was killed by another player" };
    case "BotKilled":
      return { short: "Death (by a bot)", sentence: "was killed by a bot" };
    case "KilledByStorm":
      return { short: "Death (storm)", sentence: "was killed by the storm" };
    case "Loot":
      return { short: "Loot pickup", sentence: "picked up loot" };
    default:
      return { short: "Position sample", sentence: "position sample" };
  }
}

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
  return `${isBot ? "Bot" : "Human player"} ${eventPhrase(event, isBot).sentence}, ${Math.round(
    progressPercent
  )}% into match`;
}
