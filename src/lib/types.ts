export type MapId = "AmbroseValley" | "GrandRift" | "Lockdown";

export type EventType =
  | "Position"
  | "BotPosition"
  | "Kill"
  | "Killed"
  | "BotKill"
  | "BotKilled"
  | "KilledByStorm"
  | "Loot";

export interface MapConfig {
  id: MapId;
  displayName: string;
  /** Public path to the minimap image, e.g. "/minimaps/AmbroseValley_Minimap.png" */
  image: string;
  /** Measured directly from the image file -- see scripts/measure_maps.py. Do not hardcode. */
  width: number;
  height: number;
  scale: number;
  originX: number;
  originZ: number;
}

export interface MatchPlayer {
  id: string;
  is_bot: boolean;
}

export interface MatchEvent {
  /** Index into the match's `players` array. */
  p: number;
  x: number;
  y: number;
  z: number;
  /** Raw ts from the source data (ms). NOT literal elapsed match time -- see PRD.md §6. */
  t: number;
  e: EventType;
}

export interface MatchData {
  match_id: string;
  raw_match_id: string;
  map_id: MapId;
  date: string;
  participant_count: number;
  human_count: number;
  bot_count: number;
  players: MatchPlayer[];
  event_counts: Partial<Record<EventType, number>>;
  events: MatchEvent[];
}

export interface MatchIndexEntry {
  match_id: string;
  map_id: MapId;
  date: string;
  participant_count: number;
  human_count: number;
  bot_count: number;
  event_count: number;
}
