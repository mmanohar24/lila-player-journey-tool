import fs from "fs";
import path from "path";
import type { MapConfig, MapId, MatchData, MatchIndexEntry } from "./types";

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

export function getMatch(matchId: string): MatchData | null {
  const filePath = path.join(DATA_DIR, "matches", `${matchId}.json`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}
