"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { MapConfig } from "@/lib/types";

interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Point {
  x: number;
  y: number;
}

const MAX_ZOOM = 10;

/** `aspect` (viewBox h/w) is threaded through explicitly rather than derived from
 * mapHeight/mapWidth, because the default/reset view is a "cover" fit whose aspect
 * matches the CONTAINER, not the map -- ties zoom/pan to whatever aspect is already
 * on screen so they never silently snap it back to the map's native (often square)
 * shape mid-interaction. */
function clampViewBox(x: number, y: number, w: number, aspect: number, mapWidth: number, mapHeight: number): ViewBox {
  // Largest w such that both w <= mapWidth and w*aspect <= mapHeight hold -- i.e. the
  // most "zoomed out" this aspect can go without exceeding the map's own bounds.
  const maxW = Math.min(mapWidth, mapHeight / aspect);
  const minW = maxW / MAX_ZOOM;
  const clampedW = Math.min(Math.max(w, minW), maxW);
  const clampedH = clampedW * aspect;
  const maxX = Math.max(0, mapWidth - clampedW);
  const maxY = Math.max(0, mapHeight - clampedH);
  return {
    x: Math.min(Math.max(x, 0), maxX),
    y: Math.min(Math.max(y, 0), maxY),
    w: clampedW,
    h: clampedH,
  };
}

// The exact edge-to-edge "cover" fit has zero pan room on whichever axis is fully
// shown (e.g. a wide viewport on a square map shows the full width already -- there's
// nothing left of x=0 or right of x=mapWidth to pan to, mathematically, so drag/zoom-out
// are both inert on that axis). Defaulting slightly tighter than the exact cover fit
// trades a little visible area for real pan room on both axes from the first load.
const DEFAULT_ZOOM_MARGIN = 0.82;

/** The "cover" fit for the given container size -- zoomed in enough that the map fills
 * the viewport edge-to-edge on both axes (cropping whichever axis overflows), centered,
 * then tightened by DEFAULT_ZOOM_MARGIN so both axes have pan room. This is the
 * default/reset view, and also becomes the effective max-zoom-out bound (see
 * clampViewBox) since zoom/pan preserve whatever aspect is current. */
function coverViewBox(containerW: number, containerH: number, mapWidth: number, mapHeight: number): ViewBox {
  const containerAspect = containerW / containerH;
  const mapAspect = mapWidth / mapHeight;
  const fitW = containerAspect > mapAspect ? mapWidth : mapHeight * containerAspect;
  const fitH = containerAspect > mapAspect ? mapWidth / containerAspect : mapHeight;
  const w = fitW * DEFAULT_ZOOM_MARGIN;
  const h = fitH * DEFAULT_ZOOM_MARGIN;
  // w <= mapWidth and h <= mapHeight always hold by construction, so a centered box is
  // always in-bounds -- no need for clampViewBox's clamp here.
  return { x: (mapWidth - w) / 2, y: (mapHeight - h) / 2, w, h };
}

/** Zoom `prev` by `factor` (< 1 zooms in, > 1 zooms out), keeping the world point under
 * (clientX, clientY) fixed on screen -- the standard "zoom to cursor" behavior. Preserves
 * `prev`'s own aspect ratio rather than the map's native one (see clampViewBox). */
function zoomAt(
  prev: ViewBox,
  mapWidth: number,
  mapHeight: number,
  factor: number,
  clientX: number,
  clientY: number,
  rect: DOMRect
): ViewBox {
  const aspect = prev.h / prev.w;
  const fx = (clientX - rect.left) / rect.width;
  const fy = (clientY - rect.top) / rect.height;
  const worldX = prev.x + fx * prev.w;
  const worldY = prev.y + fy * prev.h;
  const newW = prev.w * factor;
  const newH = newW * aspect;
  return clampViewBox(worldX - fx * newW, worldY - fy * newH, newW, aspect, mapWidth, mapHeight);
}

interface MapViewportProps {
  map: MapConfig;
  ariaLabel: string;
  children: React.ReactNode;
}

export function MapViewport({ map, ariaLabel, children }: MapViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fitViewBox: ViewBox = useMemo(
    () => ({ x: 0, y: 0, w: map.width, h: map.height }),
    [map.width, map.height]
  );

  const [viewBox, setViewBox] = useState<ViewBox>(fitViewBox);
  const [isDragging, setIsDragging] = useState(false);

  const viewBoxRef = useRef(viewBox);
  useEffect(() => {
    viewBoxRef.current = viewBox;
  }, [viewBox]);

  const resetView = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    setViewBox(
      rect && rect.width > 0 && rect.height > 0
        ? coverViewBox(rect.width, rect.height, map.width, map.height)
        : fitViewBox
    );
  }, [map.width, map.height, fitViewBox]);

  // Default to "cover" (fills the viewport, no letterbox bars) rather than the whole
  // map, computed from the container's real aspect ratio. useLayoutEffect (not
  // useEffect) so this resolves before the first paint -- no flash of the wrong fit.
  const hasSetInitialView = useRef(false);
  useLayoutEffect(() => {
    if (hasSetInitialView.current) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    setViewBox(coverViewBox(rect.width, rect.height, map.width, map.height));
    hasSetInitialView.current = true;
  }, [map.width, map.height]);

  const pointers = useRef<Map<number, Point>>(new Map());
  const dragState = useRef<{ startClientX: number; startClientY: number; startVB: ViewBox } | null>(null);
  const pinchState = useRef<{ startDist: number; startMid: Point; startVB: ViewBox } | null>(null);

  const zoomBy = useCallback(
    (factor: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setViewBox((prev) =>
        zoomAt(prev, map.width, map.height, factor, rect.left + rect.width / 2, rect.top + rect.height / 2, rect)
      );
    },
    [map.width, map.height]
  );

  // Native (non-passive) wheel listener: React's onWheel is passive by default, which
  // silently ignores preventDefault() and lets the page scroll instead of zooming the map.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const factor = Math.pow(1.0015, e.deltaY);
      setViewBox((prev) => zoomAt(prev, map.width, map.height, factor, e.clientX, e.clientY, rect));
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [map.width, map.height]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    try {
      (e.target as Element).setPointerCapture(e.pointerId);
    } catch {
      // Pointer capture can fail for synthetic/untrusted events; tracking below doesn't depend on it.
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 1) {
      setIsDragging(true);
      dragState.current = { startClientX: e.clientX, startClientY: e.clientY, startVB: viewBoxRef.current };
    } else if (pointers.current.size === 2) {
      dragState.current = null;
      const [a, b] = Array.from(pointers.current.values());
      pinchState.current = {
        startDist: Math.hypot(a.x - b.x, a.y - b.y),
        startMid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        startVB: viewBoxRef.current,
      };
    }
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!pointers.current.has(e.pointerId)) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      if (pointers.current.size === 2 && pinchState.current) {
        const { startDist, startMid, startVB } = pinchState.current;
        const [a, b] = Array.from(pointers.current.values());
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const scaleFactor = startDist / Math.max(dist, 1);

        let vb = zoomAt(startVB, map.width, map.height, scaleFactor, startMid.x, startMid.y, rect);
        const scale = vb.w / rect.width;
        vb = clampViewBox(
          vb.x - (mid.x - startMid.x) * scale,
          vb.y - (mid.y - startMid.y) * scale,
          vb.w,
          vb.h / vb.w,
          map.width,
          map.height
        );
        setViewBox(vb);
      } else if (pointers.current.size === 1 && dragState.current) {
        const { startClientX, startClientY, startVB } = dragState.current;
        const scale = startVB.w / rect.width;
        setViewBox(
          clampViewBox(
            startVB.x - (e.clientX - startClientX) * scale,
            startVB.y - (e.clientY - startClientY) * scale,
            startVB.w,
            startVB.h / startVB.w,
            map.width,
            map.height
          )
        );
      }
    },
    [map.width, map.height]
  );

  const endPointer = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    pinchState.current = null;
    if (pointers.current.size === 0) {
      setIsDragging(false);
      dragState.current = null;
    } else if (pointers.current.size === 1) {
      const [[, p]] = Array.from(pointers.current.entries());
      dragState.current = { startClientX: p.x, startClientY: p.y, startVB: viewBoxRef.current };
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const vb = viewBoxRef.current;
      const aspect = vb.h / vb.w;
      const panStep = vb.w * 0.1;
      switch (e.key) {
        case "+":
        case "=":
          e.preventDefault();
          zoomBy(0.8);
          break;
        case "-":
        case "_":
          e.preventDefault();
          zoomBy(1.25);
          break;
        case "0":
          e.preventDefault();
          resetView();
          break;
        case "ArrowLeft":
          e.preventDefault();
          setViewBox(clampViewBox(vb.x - panStep, vb.y, vb.w, aspect, map.width, map.height));
          break;
        case "ArrowRight":
          e.preventDefault();
          setViewBox(clampViewBox(vb.x + panStep, vb.y, vb.w, aspect, map.width, map.height));
          break;
        case "ArrowUp":
          e.preventDefault();
          setViewBox(clampViewBox(vb.x, vb.y - panStep, vb.w, aspect, map.width, map.height));
          break;
        case "ArrowDown":
          e.preventDefault();
          setViewBox(clampViewBox(vb.x, vb.y + panStep, vb.w, aspect, map.width, map.height));
          break;
      }
    },
    [map.width, map.height, zoomBy, resetView]
  );

  const zoomLevel = fitViewBox.w / viewBox.w;

  return (
    <div
      ref={containerRef}
      className={`relative h-full w-full touch-none overflow-hidden bg-background outline-none ${
        isDragging ? "cursor-grabbing" : "cursor-grab"
      }`}
      tabIndex={0}
      role="group"
      aria-label={`${ariaLabel} Use scroll or pinch to zoom, drag to pan, arrow keys to pan when focused, +/- to zoom, 0 to reset.`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onKeyDown={handleKeyDown}
    >
      {/* Ambient backdrop: the minimaps are square-ish and most viewports aren't, so the
          crisp map (below, letterboxed via the SVG's default "contain" fit -- the whole
          map always stays visible, nothing gets cropped) leaves empty bars on one axis.
          Filling those with a blurred, darkened extension of the same art keeps the
          screen feeling full/immersive without hiding any map content by default.
          Uses "contain" (whole map shape, not a cropped slice) scaled up via transform --
          these landmasses don't fill their square canvas edge-to-edge (e.g. AmbroseValley's
          right third is void), so `background-size: cover` + "center" often cropped into
          that void instead of showing terrain. Scaling up the full contained shape instead
          guarantees recognizable (if blurred) map art, not a coin-flip into black. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 scale-[2.2] bg-contain bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${map.image})`,
          filter: "blur(50px) brightness(0.6) saturate(1.3)",
        }}
      />
      <div aria-hidden="true" className="absolute inset-0 bg-background/35" />

      <svg
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        className="relative block h-full w-full select-none"
      >
        <image href={map.image} x={0} y={0} width={map.width} height={map.height} />
        {children}
      </svg>

      <div className="pointer-events-none absolute bottom-3 right-3 flex flex-col gap-1">
        <button
          type="button"
          onClick={() => zoomBy(0.7)}
          aria-label="Zoom in"
          className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-sm border border-border bg-surfaceRaised text-ui-emphasis text-textPrimary"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => zoomBy(1 / 0.7)}
          aria-label="Zoom out"
          className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-sm border border-border bg-surfaceRaised text-ui-emphasis text-textPrimary"
        >
          &minus;
        </button>
        <button
          type="button"
          onClick={resetView}
          aria-label="Reset zoom"
          className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-sm border border-border bg-surfaceRaised text-ui text-textPrimary"
          title={`${zoomLevel.toFixed(1)}x`}
        >
          &#8635;
        </button>
      </div>
    </div>
  );
}
