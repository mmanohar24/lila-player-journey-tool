"use client";

import { createContext, useContext } from "react";

/**
 * Lets a control rendered *inside* the filter rail's `children` (e.g. the heatmap
 * toggles) dismiss the mobile drawer the way selecting a match or a filter already does.
 * Those close as a side effect of navigating to a new route, which remounts FilterRail
 * with `open` reset to false -- the heatmap layer is client state precisely so switching
 * it stays instant (HeatmapContext), so there is no navigation here to piggyback on.
 *
 * A context, not a prop, because `children` is built by MatchView and passed in as
 * already-constructed elements -- FilterRail can't add a prop to something it didn't
 * create. Wrapping `{children}` in the provider still puts every descendant inside the
 * tree position that has this value, regardless of where the JSX was authored.
 *
 * The default is a no-op rather than throwing: on the persistent desktop rail this still
 * gets called (calling it costs nothing there -- see FilterRail, `open` has no effect
 * once the `rail:` breakpoint matches), and a no-op default keeps any future consumer
 * safe if it's ever rendered outside a FilterRail entirely.
 */
const DrawerContext = createContext<() => void>(() => {});

export const DrawerCloseProvider = DrawerContext.Provider;

export function useCloseDrawer() {
  return useContext(DrawerContext);
}
