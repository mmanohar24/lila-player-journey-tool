#!/usr/bin/env python3
"""
Stage 1 data pipeline (PRD.md §9.1): parse all player_data/{FebruaryXX}/ parquet
files once, offline, decode the event column, classify human vs. bot, group by
match_id, and emit compact static JSON for the Next.js app to read from
public/data/.

Run: python3 scripts/build_data.py
"""

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

import pandas as pd
import pyarrow.parquet as pq

REPO_ROOT = Path(__file__).resolve().parent.parent
PLAYER_DATA_DIR = REPO_ROOT / "player_data"
OUTPUT_DIR = REPO_ROOT / "public" / "data"
MATCHES_DIR = OUTPUT_DIR / "matches"

UUID_RE = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)

DAY_DIRS = [
    "February_10",
    "February_11",
    "February_12",
    "February_13",
    "February_14",
]


def classify_user(user_id: str) -> bool:
    """Returns True if bot, False if human. Raises on anything that matches neither shape."""
    if UUID_RE.match(user_id):
        return False
    if user_id.isdigit():
        return True
    raise ValueError(f"user_id doesn't match known human (UUID) or bot (numeric) shape: {user_id!r}")


def strip_match_suffix(match_id: str) -> str:
    return match_id[: -len(".nakama-0")] if match_id.endswith(".nakama-0") else match_id


def day_to_date(day_dir_name: str) -> str:
    # "February_10" -> "2026-02-10"
    day_num = int(day_dir_name.split("_")[1])
    return f"2026-02-{day_num:02d}"


def main() -> None:
    match_events = defaultdict(list)  # clean_match_id -> list of event dicts
    match_players = defaultdict(dict)  # clean_match_id -> {user_id: is_bot}
    match_meta = {}  # clean_match_id -> {map_id, date, raw_match_id}

    total_rows = 0
    event_type_counts = defaultdict(int)
    all_user_ids = set()
    files_processed = 0
    failures = []

    for day_dir_name in DAY_DIRS:
        day_dir = PLAYER_DATA_DIR / day_dir_name
        if not day_dir.is_dir():
            failures.append((str(day_dir), "directory missing"))
            continue
        date_str = day_to_date(day_dir_name)

        files = sorted(p for p in day_dir.iterdir() if p.is_file() and not p.name.startswith("."))
        for filepath in files:
            try:
                table = pq.read_table(filepath)
                df = table.to_pandas()

                df["event"] = df["event"].apply(
                    lambda v: v.decode("utf-8") if isinstance(v, (bytes, bytearray)) else v
                )
                ts_ms = df["ts"].astype("int64")

                for i, row in enumerate(df.itertuples(index=False)):
                    user_id = row.user_id
                    is_bot = classify_user(user_id)
                    raw_match_id = row.match_id
                    match_id = strip_match_suffix(raw_match_id)
                    map_id = row.map_id
                    event_type = row.event

                    if match_id not in match_meta:
                        match_meta[match_id] = {
                            "map_id": map_id,
                            "date": date_str,
                            "raw_match_id": raw_match_id,
                        }
                    match_players[match_id][user_id] = is_bot
                    match_events[match_id].append(
                        {
                            "u": user_id,
                            "x": round(float(row.x), 2),
                            "y": round(float(row.y), 2),
                            "z": round(float(row.z), 2),
                            "t": int(ts_ms.iloc[i]),
                            "e": event_type,
                        }
                    )

                    total_rows += 1
                    event_type_counts[event_type] += 1
                    all_user_ids.add(user_id)

                files_processed += 1
            except Exception as exc:  # noqa: BLE001 - we want to record and report, not hide
                failures.append((str(filepath), repr(exc)))

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    MATCHES_DIR.mkdir(parents=True, exist_ok=True)

    matches_index = []
    for match_id, meta in match_meta.items():
        players = match_players[match_id]
        events = match_events[match_id]
        player_list = [{"id": uid, "is_bot": is_bot} for uid, is_bot in players.items()]
        player_index = {uid: idx for idx, uid in enumerate(players.keys())}

        indexed_events = [
            {
                "p": player_index[ev["u"]],
                "x": ev["x"],
                "y": ev["y"],
                "z": ev["z"],
                "t": ev["t"],
                "e": ev["e"],
            }
            for ev in events
        ]
        # Sort by ts so timeline/playback (stage 5) can consume this directly.
        indexed_events.sort(key=lambda ev: ev["t"])

        match_event_counts = defaultdict(int)
        for ev in events:
            match_event_counts[ev["e"]] += 1

        human_count = sum(1 for is_bot in players.values() if not is_bot)
        bot_count = sum(1 for is_bot in players.values() if is_bot)

        match_json = {
            "match_id": match_id,
            "raw_match_id": meta["raw_match_id"],
            "map_id": meta["map_id"],
            "date": meta["date"],
            "participant_count": len(players),
            "human_count": human_count,
            "bot_count": bot_count,
            "players": player_list,
            "event_counts": dict(match_event_counts),
            "events": indexed_events,
        }
        (MATCHES_DIR / f"{match_id}.json").write_text(json.dumps(match_json, separators=(",", ":")))

        matches_index.append(
            {
                "match_id": match_id,
                "map_id": meta["map_id"],
                "date": meta["date"],
                "participant_count": len(players),
                "human_count": human_count,
                "bot_count": bot_count,
                "event_count": len(events),
            }
        )

    matches_index.sort(key=lambda m: (-m["participant_count"], m["date"], m["match_id"]))
    (OUTPUT_DIR / "matches-index.json").write_text(json.dumps(matches_index, separators=(",", ":")))

    stats = {
        "files_processed": files_processed,
        "files_failed": len(failures),
        "total_rows": total_rows,
        "unique_players": len(all_user_ids),
        "unique_matches": len(match_meta),
        "event_type_counts": dict(event_type_counts),
        "failures": [{"file": f, "error": e} for f, e in failures],
    }
    (OUTPUT_DIR / "stats.json").write_text(json.dumps(stats, indent=2))

    # --- Console verification report ---
    print("=== Stage 1 pipeline: verification report ===")
    print(f"Files processed: {files_processed}  (failed: {len(failures)})")
    print(f"Total rows:      {total_rows}   (README claims ~89,000)")
    print(f"Unique players:  {len(all_user_ids)}   (README claims 339)")
    print(f"Unique matches:  {len(match_meta)}   (README claims 796)")
    print("\nEvent type distribution:")
    for etype, count in sorted(event_type_counts.items(), key=lambda kv: -kv[1]):
        pct = 100 * count / total_rows if total_rows else 0
        print(f"  {etype:16s} {count:7d}  ({pct:5.2f}%)")
    position_like = event_type_counts.get("Position", 0) + event_type_counts.get("BotPosition", 0)
    print(f"\nPosition + BotPosition share: {100 * position_like / total_rows:.2f}% (README claims ~85%+)")

    participant_counts = [m["participant_count"] for m in matches_index]
    avg_files_per_match = files_processed / len(match_meta) if match_meta else 0
    print(f"\nAvg files/match: {avg_files_per_match:.2f}  (PRD claims ~1.53-1.56)")
    print(f"Max participant count in a single match: {max(participant_counts) if participant_counts else 0}  (PRD claims max 15)")
    single_file_matches = sum(1 for c in participant_counts if c == 1)
    print(f"Matches with exactly 1 participant: {single_file_matches} / {len(match_meta)}")

    if failures:
        print(f"\n⚠ {len(failures)} file(s) failed to parse — see stats.json 'failures' for details.")
        for f, e in failures[:10]:
            print(f"  - {f}: {e}")

    print(f"\nWrote {len(matches_index)} match files to {MATCHES_DIR}")
    print(f"Wrote index to {OUTPUT_DIR / 'matches-index.json'}")
    print(f"Wrote stats to {OUTPUT_DIR / 'stats.json'}")

    if failures:
        sys.exit(1)


if __name__ == "__main__":
    main()
