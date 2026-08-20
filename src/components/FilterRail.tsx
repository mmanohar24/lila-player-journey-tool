"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PickerEntry } from "@/lib/types";

const ALL = "all";

interface FilterRailProps {
  entries: PickerEntry[];
  maps: { id: string; displayName: string }[];
  dates: string[];
  selectedMatchId: string;
  map: string;
  date: string;
  children?: React.ReactNode;
}

function buildHref(matchId: string, map: string, date: string) {
  const params = new URLSearchParams();
  if (map !== ALL) params.set("map", map);
  if (date !== ALL) params.set("date", date);
  const qs = params.toString();
  return `/match/${matchId}${qs ? `?${qs}` : ""}`;
}

export function FilterRail({
  entries,
  maps,
  dates,
  selectedMatchId,
  map,
  date,
  children,
}: FilterRailProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Filtering runs in-memory over the compact index, so changing map/date updates the
  // list instantly instead of waiting on a server round trip. Entries arrive
  // richest-first, and filtering preserves that order.
  const filtered = useMemo(
    () => entries.filter((e) => (map === ALL || e.map === map) && (date === ALL || e.date === date)),
    [entries, map, date]
  );

  /** Changing a filter keeps the current match if it still qualifies, otherwise jumps to
   *  the richest match that does -- so the map is never left showing something outside
   *  the active filters, and never lands on an empty view. */
  const applyFilter = (nextMap: string, nextDate: string) => {
    const next = entries.filter(
      (e) => (nextMap === ALL || e.map === nextMap) && (nextDate === ALL || e.date === nextDate)
    );
    if (next.length === 0) return;
    const keep = next.some((e) => e.id === selectedMatchId);
    router.push(buildHref(keep ? selectedMatchId : next[0].id, nextMap, nextDate));
  };

  // px-3 (not px-2) so the value isn't crowded against the control's own border, and
  // mt-1 to separate it from its label -- design.md's `spacing` steps, not arbitrary.
  const selectClass =
    "mt-1 min-h-11 w-full rounded-sm border border-border bg-surfaceRaised px-3 text-ui text-textPrimary";

  return (
    <>
      {/* Below tablet width a fixed side rail would leave the map unusably small
          (design.md, Layout), so the rail becomes a bottom sheet behind this toggle. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="filter-rail"
        className="pointer-events-auto absolute left-3 top-3 z-20 min-h-11 rounded-sm border border-border bg-surfaceRaised px-3 text-ui-emphasis text-textPrimary md:hidden"
      >
        {open ? "Close" : "Filters & legend"}
      </button>

      <div
        id="filter-rail"
        className={`pointer-events-auto absolute z-10 flex flex-col gap-5 overflow-y-auto rounded-md border border-border bg-surface/90 p-5 backdrop-blur-sm ${
          // Mobile: bottom sheet, only when opened. Tablet+: persistent left rail.
          open ? "inset-x-3 bottom-3 top-16 flex" : "hidden"
        } md:left-3 md:top-3 md:bottom-3 md:right-auto md:flex md:w-[320px]`}
      >
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="map-filter" className="text-ui text-textSecondary">
              Map
            </label>
            <select
              id="map-filter"
              value={map}
              onChange={(e) => applyFilter(e.target.value, date)}
              className={selectClass}
            >
              <option value={ALL}>All maps</option>
              {maps.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="date-filter" className="text-ui text-textSecondary">
              Date
            </label>
            <select
              id="date-filter"
              value={date}
              onChange={(e) => applyFilter(map, e.target.value)}
              className={selectClass}
            >
              <option value={ALL}>All dates</option>
              {dates.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <p className="text-ui text-textSecondary">
            {filtered.length} match{filtered.length === 1 ? "" : "es"}
            {filtered.length > 0 && " · most participants first"}
          </p>

          {/* The sparsity is real and worth seeing rather than engineering away
              (PRD.md §8): the full filtered list stays browsable, just ordered so the
              informative matches surface first. */}
          <ul className="mt-1 min-h-0 flex-1 overflow-y-auto" aria-label="Matches">
            {filtered.map((e) => {
              const active = e.id === selectedMatchId;
              return (
                <li key={e.id}>
                  {/* next/link, not a bare <a>: a plain anchor triggers a full document
                      reload on every match selection, which throws away the client
                      runtime (and any in-flight view transition) each time. */}
                  <Link
                    href={buildHref(e.id, map, date)}
                    aria-current={active ? "true" : undefined}
                    className={`flex min-h-11 items-center gap-2 rounded-sm px-2 text-ui ${
                      active
                        ? "bg-surfaceRaised text-textPrimary"
                        : "text-textSecondary hover:bg-surfaceRaised"
                    }`}
                  >
                    <span
                      className="shrink-0 rounded-pill bg-surfaceRaised px-2 py-0.5 text-data text-textPrimary"
                      title={`${e.n} participant${e.n === 1 ? "" : "s"}`}
                    >
                      {e.n}
                    </span>
                    <span className="truncate text-data">{e.id.slice(0, 8)}</span>
                    <span className="ml-auto shrink-0 text-ui text-textSecondary">
                      {e.date.slice(5)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {children}
      </div>
    </>
  );
}
