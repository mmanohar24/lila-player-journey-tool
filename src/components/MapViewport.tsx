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

/** Pixel-space bounding box of the content the view should frame. */
export interface FocusBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * A view framing `bounds` (with breathing room), at the container's aspect ratio.
 *
 * Without this, selecting a match just re-rendered the map at the same default framing:
 * a sparse match's events often sit outside it entirely -- measured across single-
 * participant matches, one had only 9% of its markers inside the default view -- so
 * picking a match looked like nothing had happened.
 */
function boundsViewBox(
  containerW: number,
  containerH: number,
  bounds: FocusBounds,
  mapWidth: number,
  mapHeight: number
): ViewBox {
  const aspect = containerH / containerW;
  const bw = Math.max(bounds.maxX - bounds.minX, 1);
  const bh = Math.max(bounds.maxY - bounds.minY, 1);
  const pad = 1.25;
  // Whichever axis needs more room decides the zoom, so nothing is cropped.
  const w = Math.max(bw, bh / aspect) * pad;
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  return clampViewBox(cx - w / 2, cy - (w * aspect) / 2, w, aspect, mapWidth, mapHeight);
}

interface Tooltip {
  title: string;
  sub?: string;
  meta?: string;
  color?: string;
  /** Position relative to the viewport container. */
  x: number;
  y: number;
}

/** Reads the data-tt-* payload off the nearest marker/journey ancestor, if any. */
function readTooltipTarget(target: EventTarget | null): Omit<Tooltip, "x" | "y"> | null {
  if (!(target instanceof Element)) return null;
  const el = target.closest("[data-tt-title]");
  if (!(el instanceof Element)) return null;
  return {
    title: el.getAttribute("data-tt-title") ?? "",
    sub: el.getAttribute("data-tt-sub") ?? undefined,
    meta: el.getAttribute("data-tt-meta") ?? undefined,
    color: el.getAttribute("data-tt-color") ?? undefined,
  };
}

/**
 * Last framing rendered, kept at module scope so it survives the remount that a route
 * change causes. Selecting a match navigates to a new page, which tears this component
 * down and builds a new one -- without this, every match change looked like a first
 * paint and jumped straight to the new framing instead of gliding to it.
 */
let lastFraming: { mapId: string; viewBox: ViewBox } | null = null;

interface MapViewportProps {
  map: MapConfig;
  ariaLabel: string;
  /** Frame this region on load and on reset -- normally the selected match's events. */
  focusBounds?: FocusBounds;
  /** Changing this re-frames the view (i.e. when a different match is selected). */
  focusKey?: string;
  children: React.ReactNode;
}

export function MapViewport({
  map,
  ariaLabel,
  focusBounds,
  focusKey,
  children,
}: MapViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const fitViewBox: ViewBox = useMemo(
    () => ({ x: 0, y: 0, w: map.width, h: map.height }),
    [map.width, map.height]
  );

  const [viewBox, setViewBox] = useState<ViewBox>(fitViewBox);
  const [isDragging, setIsDragging] = useState(false);

  const viewBoxRef = useRef(viewBox);
  useEffect(() => {
    viewBoxRef.current = viewBox;
    lastFraming = { mapId: map.id, viewBox };
  }, [viewBox, map.id]);

  /** The view this match should open at: framed on its events when we know where they
   *  are, otherwise the whole-map cover fit. */
  const defaultViewBox = useCallback(
    (w: number, h: number) =>
      focusBounds
        ? boundsViewBox(w, h, focusBounds, map.width, map.height)
        : coverViewBox(w, h, map.width, map.height),
    [focusBounds, map.width, map.height]
  );

  /** Eases the view to `target`. Selecting a match used to snap the framing instantly,
   *  which gave no sense that the map had moved somewhere; gliding there lets the eye
   *  follow. Honours prefers-reduced-motion by jumping straight to the target. */
  const animationRef = useRef<number | null>(null);

  /** Any direct manipulation cancels an in-flight glide, so the animation never fights
   *  the user's own drag or zoom. */
  const stopAnimation = useCallback(() => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  const animateTo = useCallback((target: ViewBox) => {
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setViewBox(target);
      return;
    }

    const from = viewBoxRef.current;
    const start = performance.now();
    const DURATION = 420;
    const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

    const step = (now: number) => {
      const p = Math.min((now - start) / DURATION, 1);
      const e = easeInOut(p);
      setViewBox({
        x: from.x + (target.x - from.x) * e,
        y: from.y + (target.y - from.y) * e,
        w: from.w + (target.w - from.w) * e,
        h: from.h + (target.h - from.h) * e,
      });
      if (p < 1) animationRef.current = requestAnimationFrame(step);
      else animationRef.current = null;
    };
    animationRef.current = requestAnimationFrame(step);
  }, []);

  useEffect(
    () => () => {
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    },
    []
  );

  const resetView = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    animateTo(
      rect && rect.width > 0 && rect.height > 0 ? defaultViewBox(rect.width, rect.height) : fitViewBox
    );
  }, [animateTo, defaultViewBox, fitViewBox]);

  // Re-frame whenever the focused match changes -- not just once on mount, since
  // navigating between matches reuses this component rather than remounting it.
  const appliedFocus = useRef<string | null>(null);
  useLayoutEffect(() => {
    const key = focusKey ?? "";
    if (appliedFocus.current === key) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    const target = defaultViewBox(rect.width, rect.height);

    if (appliedFocus.current !== null) {
      // Same component instance, different match.
      animateTo(target);
    } else if (lastFraming && lastFraming.mapId === map.id) {
      // Fresh mount after a route change, still on the same map: resume from where the
      // previous match left off so the move reads as one continuous glide.
      viewBoxRef.current = lastFraming.viewBox;
      setViewBox(lastFraming.viewBox);
      animateTo(target);
    } else {
      // Genuine first paint, or a switch to a different map -- nothing to glide from.
      setViewBox(target);
    }
    appliedFocus.current = key;
  }, [focusKey, defaultViewBox, animateTo, map.id]);

  const pointers = useRef<Map<number, Point>>(new Map());
  const dragState = useRef<{ startClientX: number; startClientY: number; startVB: ViewBox } | null>(null);
  const pinchState = useRef<{ startDist: number; startMid: Point; startVB: ViewBox } | null>(null);

  const zoomBy = useCallback(
    (factor: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      stopAnimation();
      setViewBox((prev) =>
        zoomAt(prev, map.width, map.height, factor, rect.left + rect.width / 2, rect.top + rect.height / 2, rect)
      );
    },
    [map.width, map.height, stopAnimation]
  );

  // Native (non-passive) wheel listener: React's onWheel is passive by default, which
  // silently ignores preventDefault() and lets the page scroll instead of zooming the map.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      stopAnimation();
      const rect = el.getBoundingClientRect();
      const factor = Math.pow(1.0015, e.deltaY);
      setViewBox((prev) => zoomAt(prev, map.width, map.height, factor, e.clientX, e.clientY, rect));
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [map.width, map.height, stopAnimation]);

  /** Places the tooltip near a point, flipping it away from the container's edges so it
   *  never spills outside the viewport. Measures the real rendered box rather than
   *  guessing at its size. */
  const positionTooltip = useCallback(
    (payload: Omit<Tooltip, "x" | "y">, clientX: number, clientY: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const tip = tooltipRef.current?.getBoundingClientRect();
      const tw = tip?.width ?? 200;
      const th = tip?.height ?? 72;
      const gap = 14;

      let x = clientX - rect.left + gap;
      let y = clientY - rect.top + gap;
      if (x + tw > rect.width) x = clientX - rect.left - tw - gap;
      if (y + th > rect.height) y = clientY - rect.top - th - gap;

      setTooltip({ ...payload, x: Math.max(4, x), y: Math.max(4, y) });
    },
    []
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isDragging) return;
      const payload = readTooltipTarget(e.target);
      if (!payload) {
        setTooltip((prev) => (prev ? null : prev));
        return;
      }
      positionTooltip(payload, e.clientX, e.clientY);
    },
    [isDragging, positionTooltip]
  );

  /** Keyboard focus gets the same tooltip, anchored to the focused marker's centre. */
  const handleFocusIn = useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      const payload = readTooltipTarget(e.target);
      if (!payload) return;
      const box = (e.target as Element).getBoundingClientRect();
      positionTooltip(payload, box.left + box.width / 2, box.top + box.height / 2);
    },
    [positionTooltip]
  );

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    setTooltip(null);
    stopAnimation();
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
  }, [stopAnimation]);

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
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setTooltip(null)}
      onFocus={handleFocusIn}
      onBlur={() => setTooltip(null)}
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

      {/* Marker tooltip. Rendered as a styled element rather than an SVG <title> so it
          shares the panel treatment used by the match info card and legend, and appears
          immediately instead of waiting on the browser's ~1s native-tooltip delay.
          aria-hidden: the same content is already on each marker's aria-label, so
          announcing it twice would just be noise. */}
      <div
        ref={tooltipRef}
        aria-hidden="true"
        className={`pointer-events-none absolute z-10 max-w-xs rounded-md border border-border bg-surface/90 px-3 py-2 shadow-[0_2px_8px_rgba(0,0,0,0.45)] backdrop-blur-sm transition-opacity duration-75 ${
          tooltip ? "opacity-100" : "opacity-0"
        }`}
        style={{
          left: tooltip?.x ?? 0,
          top: tooltip?.y ?? 0,
          visibility: tooltip ? "visible" : "hidden",
        }}
      >
        {tooltip && (
          <>
            <p className="text-ui-emphasis flex items-center gap-2 text-textPrimary">
              {tooltip.color && (
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-pill"
                  style={{ background: tooltip.color }}
                />
              )}
              {tooltip.title}
            </p>
            {tooltip.sub && <p className="text-data text-textSecondary">{tooltip.sub}</p>}
            {tooltip.meta && <p className="text-ui text-textSecondary">{tooltip.meta}</p>}
          </>
        )}
      </div>

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
