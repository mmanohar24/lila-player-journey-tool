import fs from "fs";
import path from "path";
import type { MapConfig, MapId, MatchData, MatchIndexEntry, PickerEntry } from "./types";

const DATA_DIR = path.join(process.cwd(), "public", "data");

export function getMapConfigs(): Record<MapId, MapConfig> {
  const raw = fs.readFileSync(path.join(DATA_DIR, "maps.json"), "utf-8");
  return JSON.parse(raw);
}

export function getMapConfig(mapId: MapId): MapConfig {
  const maps = getMapConfigs();
  const map = maps[mapId];
  if (!map) throw new Error(`Unknown map_id: ${mapId}`);
  return map;
}

export function getMatchesIndex(): MatchIndexEntry[] {
  const raw = fs.readFileSync(path.join(DATA_DIR, "matches-index.json"), "utf-8");
  return JSON.parse(raw);
}

/**
 * Picker rows, sorted richest-first. 743 of 796 matches have exactly one participant
 * (PRD.md §8), so surfacing the informative ones by default is what keeps the picker
 * from presenting 796 equivalent-looking entries. Ties break by date then id so the
 * order is stable across renders.
 */
export function getPickerEntries(): PickerEntry[] {
  return getMatchesIndex()
    .map((m) => ({
      id: m.match_id,
      map: m.map_id,
      date: m.date,
      n: m.participant_count,
      combat: m.combat_count,
    }))
    .sort((a, b) => b.n - a.n || a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

/** The match to show when none is specified: the richest one in the current filter set. */
export function getDefaultMatchId(map?: string, date?: string): string | null {
  const entries = getPickerEntries().filter(
    (e) => (!map || e.map === map) && (!date || e.date === date)
  );
  return entries[0]?.id ?? null;
}

export function getMatch(matchId: string): MatchData | null {
  const filePath = path.join(DATA_DIR, "matches", `${matchId}.json`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}
