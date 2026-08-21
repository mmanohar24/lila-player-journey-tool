"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DrawerCloseProvider } from "./DrawerContext";
import type { PickerEntry } from "@/lib/types";

const ALL = "all";

type SortMode = "richest" | "combat";

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
  const toggleRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const closeRail = useCallback(() => setOpen(false), []);

  // Escape dismisses the drawer, opening it moves focus onto Close, and closing it hands
  // focus back to the opener. All three exist because the drawer covers the map almost
  // entirely on a phone: reaching the dismiss control meant scrolling the panel back to
  // the top, which made comparing heatmap layers against the map underneath far more
  // work than it should be.
  //
  // The focus moves live here rather than in the click handler because the opener and
  // the Close button are each hidden in the state the other belongs to. Focusing the
  // opener straight after setOpen(false) targeted an element still rendered
  // `display: none`, which silently dropped focus to <body>; an effect runs after the
  // commit, when the element it wants is actually on screen.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      closeRef.current?.focus();
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") closeRail();
      };
      document.addEventListener("keydown", onKeyDown);
      return () => document.removeEventListener("keydown", onKeyDown);
    }
    // Only on a real close -- never on mount, which would steal focus from the document.
    if (wasOpen.current) {
      wasOpen.current = false;
      toggleRef.current?.focus();
    }
  }, [open, closeRail]);

  /** Default view: mostly solo bot-filled lobbies (INSIGHTS.md, "This dataset barely has
   *  any humans playing together"), so "richest" alone doesn't surface a match with real
   *  fighting in it. This is the other axis, not a replacement -- richest-first stays the
   *  default. */
  const [sortMode, setSortMode] = useState<SortMode>("richest");

  // Filtering runs in-memory over the compact index, so changing map/date updates the
  // list instantly instead of waiting on a server round trip. Entries arrive
  // richest-first, and filtering preserves that order -- sorting by combat needs an
  // explicit re-sort, since the server-side order (data.ts `getPickerEntries`) is only
  // ever by participant count.
  const filtered = useMemo(() => {
    const matches = entries.filter(
      (e) => (map === ALL || e.map === map) && (date === ALL || e.date === date)
    );
    if (sortMode === "combat") {
      return [...matches].sort(
        (a, b) =>
          b.combat - a.combat || b.n - a.n || a.date.localeCompare(b.date) || a.id.localeCompare(b.id)
      );
    }
    return matches;
  }, [entries, map, date, sortMode]);

  const mapNames = useMemo(
    () => Object.fromEntries(maps.map((m) => [m.id, m.displayName])),
    [maps]
  );

  // Roving tabindex: the row that carries the tab stop. Starts on the selected match so
  // tabbing into the list lands where the user already is, rather than at row 0.
  const selectedIndex = Math.max(
    0,
    filtered.findIndex((e) => e.id === selectedMatchId)
  );
  const [focusIndex, setFocusIndex] = useState(selectedIndex);

  // Keep the tab stop on the selection as filters (and so the list) change. Adjusted
  // during render rather than in an effect -- React's documented pattern for deriving
  // state from a changed prop, and it avoids a second render pass.
  const [prevSelectedIndex, setPrevSelectedIndex] = useState(selectedIndex);
  if (prevSelectedIndex !== selectedIndex) {
    setPrevSelectedIndex(selectedIndex);
    setFocusIndex(selectedIndex);
  }

  const listRef = useRef<HTMLUListElement>(null);

  const moveFocus = useCallback(
    (next: number) => {
      const clamped = Math.min(Math.max(next, 0), filtered.length - 1);
      setFocusIndex(clamped);
      listRef.current
        ?.querySelector<HTMLElement>(`[data-row="${clamped}"]`)
        ?.focus({ preventScroll: false });
    },
    [filtered.length]
  );

  const handleListKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLUListElement>) => {
      const keys = ["ArrowDown", "ArrowUp", "Home", "End", "PageDown", "PageUp"];
      if (!keys.includes(e.key)) return;
      e.preventDefault();
      const step = 10;
      switch (e.key) {
        case "ArrowDown":
          moveFocus(focusIndex + 1);
          break;
        case "ArrowUp":
          moveFocus(focusIndex - 1);
          break;
        case "PageDown":
          moveFocus(focusIndex + step);
          break;
        case "PageUp":
          moveFocus(focusIndex - step);
          break;
        case "Home":
          moveFocus(0);
          break;
        case "End":
          moveFocus(filtered.length - 1);
          break;
      }
    },
    [focusIndex, filtered.length, moveFocus]
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
      {/* Unless the viewport is both wide and tall enough for a fixed side rail, it
          would leave the map unusably small (design.md, Layout), so the rail becomes a
          drawer behind this toggle. This button only ever opens: once the drawer is up
          it is hidden, and dismissal lives in the drawer's own header, which stays put
          however far the panel below it has been scrolled. */}
      <button
        ref={toggleRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="filter-rail"
        className={`pointer-events-auto absolute left-3 top-3 z-40 min-h-11 rounded-sm border border-border bg-surfaceRaised px-3 text-ui-emphasis text-textPrimary rail:hidden ${
          open ? "hidden" : ""
        }`}
      >
        Filters &amp; legend
      </button>

      <div
        id="filter-rail"
        className={`pointer-events-auto absolute z-30 flex-col rounded-md border border-border bg-surface/90 backdrop-blur-sm ${
          // Phone and short landscape: a drawer, only when opened. It can claim the full
          // inset now that the opener is hidden behind it, rather than starting below it.
          open ? "inset-3 flex" : "hidden"
        } rail:bottom-3 rail:left-3 rail:right-auto rail:top-3 rail:flex rail:w-[320px]`}
      >
        {/* A header outside the scroll container, not a sticky child of it: the panel
            has `p-5`, and a sticky element's offsets resolve against the scrollport's
            padding box, so `top-0` would have parked it 20px down over its own content. */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-3 py-2 rail:hidden">
          <p className="text-ui-emphasis text-textPrimary">Filters &amp; legend</p>
          <button
            ref={closeRef}
            type="button"
            onClick={closeRail}
            className="min-h-11 shrink-0 rounded-sm border border-border bg-surfaceRaised px-3 text-ui-emphasis text-textPrimary"
          >
            Close
          </button>
        </div>

        {/* Everything below the header scrolls. `pb-8` so the last line -- the heatmap
            summary -- doesn't end flush against the panel edge, which read as though
            there were more content hidden below it. */}
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5 pb-8 rail:pb-5">
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

          {/* The min-height belongs on this section, not on the <ul> inside it: with the
              section free to shrink below the list's own minimum, the list simply
              overflowed its parent and painted over the panels below. Constraining the
              section makes the rail scroll instead.

              Keyed on height alone, not on `rail:`, which also asks about width: a phone
              in landscape leaves the drawer ~236px of scrollable body, and a flat 252px
              minimum spent all of it on the match list, pushing the legend and the
              heatmap controls entirely below the fold. Three rows is enough to show that
              the list is a list and that it scrolls. */}
          <div className="flex min-h-[132px] flex-1 flex-col [@media(min-height:600px)]:min-h-[252px]">
            {/* "Richest" alone can't surface a fight -- most richer-looking matches are
                one human plus a bot-filled lobby (INSIGHTS.md), not organic combat. This
                sits above the count/list so the ordering it controls is legible right
                below it, matching the heatmap layer toggle's group/aria-pressed pattern. */}
            <div className="flex items-center justify-between gap-2">
              <span id="sort-mode-label" className="text-ui text-textSecondary">
                Sort by
              </span>
              <div className="flex gap-1" role="group" aria-labelledby="sort-mode-label">
                <button
                  type="button"
                  onClick={() => setSortMode("richest")}
                  aria-pressed={sortMode === "richest"}
                  aria-label="Sort matches by participant count, most first"
                  className={`h-11 rounded-sm border border-border px-3 text-ui ${
                    sortMode === "richest" ? "bg-surfaceRaised text-textPrimary" : "text-textSecondary"
                  }`}
                >
                  Participants
                </button>
                <button
                  type="button"
                  onClick={() => setSortMode("combat")}
                  aria-pressed={sortMode === "combat"}
                  aria-label="Sort matches by combat event count, most first"
                  className={`h-11 rounded-sm border border-border px-3 text-ui ${
                    sortMode === "combat" ? "bg-surfaceRaised text-textPrimary" : "text-textSecondary"
                  }`}
                >
                  Combat
                </button>
              </div>
            </div>

            {/* One string, not interleaved expressions: React separates adjacent
                expressions with `<!-- -->`, which a screen reader treats as a break and
                reads as fragments ("796", "match", "es"). */}
            <p id="match-count" className="mt-2 text-ui text-textSecondary">
              {`${filtered.length} ${filtered.length === 1 ? "match" : "matches"}${
                filtered.length > 0
                  ? ` · most ${sortMode === "combat" ? "combat events" : "participants"} first`
                  : ""
              }`}
            </p>

            {/* The sparsity is real and worth seeing rather than engineering away
                (PRD.md §8): the full filtered list stays browsable, just ordered so the
                informative matches surface first.

                Roving tabindex: only one row is ever in the tab order, and arrow keys move
                between rows. Making all 796 rows focusable put 839 tab stops on the page --
                the same trap avoided for the map's position markers, reintroduced here. */}
            {/* The section's min-height is load-bearing, not cosmetic: as a flex-1 child
                in a column whose other sections are fixed height, this list is the only
                thing that can shrink -- and below roughly 700px of viewport height it was
                shrinking to exactly 0, so the rail showed "50 matches" above an empty gap. */}
            <ul
              className="mt-1 min-h-0 flex-1 overflow-y-auto"
              ref={listRef}
              role="listbox"
              aria-label="Matches"
              aria-describedby="match-count"
              onKeyDown={handleListKeyDown}
            >
              {filtered.map((e, i) => {
                const active = e.id === selectedMatchId;
                const isTabStop = i === focusIndex;
                return (
                  <li key={e.id} role="option" aria-selected={active}>
                    {/* next/link, not a bare <a>: a plain anchor triggers a full document
                        reload on every match selection, which throws away the client
                        runtime (and any in-flight view transition) each time. */}
                    <Link
                      href={buildHref(e.id, map, date)}
                      tabIndex={isTabStop ? 0 : -1}
                      data-row={i}
                      onFocus={() => setFocusIndex(i)}
                      aria-current={active ? "true" : undefined}
                      title={`Match ${e.id} · ${e.date} · ${e.n} participant${
                        e.n === 1 ? "" : "s"
                      } · ${e.combat} combat event${e.combat === 1 ? "" : "s"}`}
                      className={`flex min-h-11 items-center gap-2 rounded-sm px-2 text-ui ${
                        active
                          ? "bg-surfaceRaised text-textPrimary"
                          : "text-textSecondary hover:bg-surfaceRaised"
                      }`}
                    >
                      <span
                        aria-label={`${e.n} participant${e.n === 1 ? "" : "s"}`}
                        className="shrink-0 rounded-pill bg-surfaceRaised px-2 py-0.5 text-data text-textPrimary"
                      >
                        {e.n}
                      </span>
                      {/* Only shown while sorted by it -- otherwise the visible order
                          ("richest" mode) and the badges on screen would disagree about
                          what's being ranked. */}
                      {sortMode === "combat" && (
                        <span
                          aria-label={`${e.combat} combat event${e.combat === 1 ? "" : "s"}`}
                          className="shrink-0 rounded-pill bg-surfaceRaised px-2 py-0.5 text-data text-textPrimary"
                        >
                          {e.combat}
                        </span>
                      )}
                      {/* The map name, not the id fragment: under "All maps" a hex prefix
                          gave no clue which map a row would open. The id stays available
                          via the row's title. */}
                      <span className="truncate">{mapNames[e.map] ?? e.map}</span>
                      <span className="ml-auto shrink-0 text-data text-textSecondary">
                        {e.date.slice(5)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Match rows and the map/date selects close the drawer for free -- picking
              either navigates, which remounts this component with `open` reset. The
              heatmap toggles inside `children` have no such navigation to ride on, so
              they reach back out through this context to close explicitly. */}
          <DrawerCloseProvider value={closeRail}>{children}</DrawerCloseProvider>
        </div>
      </div>
    </>
  );
}
