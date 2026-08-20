"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Watchable default, per PRD.md §6 (~15-20s). Speed divides this. */
const BASE_DURATION_MS = 18_000;
const SPEEDS = [0.5, 1, 2, 4] as const;

interface PlaybackControlsProps {
  /**
   * The parent keys this component on the match id, so a different match remounts it
   * with fresh state. That is React's idiom for resetting on a prop change, and avoids
   * a reset effect that would setState during an effect body.
   */
  eventCount: number;
}

interface Revealable {
  el: HTMLElement | SVGElement;
  p: number;
}

/**
 * Running count of real events among the first n revealables. Journey start/end markers
 * are revealed alongside events but are not events themselves -- they re-mark a position
 * sample that is already counted -- so tallying every revealable reported more events
 * than the match contains ("1039/1015 events shown").
 */
function eventPrefixCounts(items: Revealable[]): number[] {
  const prefix = new Array<number>(items.length + 1).fill(0);
  for (let i = 0; i < items.length; i++) {
    prefix[i + 1] = prefix[i] + (items[i].el.hasAttribute("data-endpoint") ? 0 : 1);
  }
  return prefix;
}

export function PlaybackControls({ eventCount }: PlaybackControlsProps) {
  const [progress, setProgress] = useState(1); // 1 = whole match shown (the static view)
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
  const [shownCount, setShownCount] = useState(eventCount);

  const itemsRef = useRef<Revealable[]>([]);
  const eventPrefixRef = useRef<number[]>([]);
  /** How many items are currently revealed, so each frame only touches what changed. */
  const shownRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef(0);
  const progressRef = useRef(progress);
  const speedRef = useRef(speed);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  /**
   * Collect the revealable elements once per match, sorted by their normalized time.
   * Playback then walks a pointer along this array, toggling only the elements it
   * crosses -- so a frame costs O(changed), not O(~1000 nodes). Re-rendering the whole
   * SVG through React each frame would be far more expensive for no benefit.
   */
  const collect = useCallback(() => {
    const layer = document.querySelector(".match-layer");
    if (!layer) return false;
    const items: Revealable[] = [...layer.querySelectorAll<SVGElement>("[data-p]")]
      .map((el) => ({ el, p: Number(el.getAttribute("data-p")) }))
      .filter((it) => Number.isFinite(it.p))
      .sort((a, b) => a.p - b.p);
    itemsRef.current = items;
    eventPrefixRef.current = eventPrefixCounts(items);
    shownRef.current = items.length; // everything visible initially
    return items.length > 0;
  }, []);

  const applyProgress = useCallback((p: number) => {
    const items = itemsRef.current;
    if (items.length === 0) return;
    // Number of items whose time is <= p. Items are sorted, so this is a boundary walk.
    let target = shownRef.current;
    while (target < items.length && items[target].p <= p) target++;
    while (target > 0 && items[target - 1].p > p) target--;

    if (target > shownRef.current) {
      for (let i = shownRef.current; i < target; i++) items[i].el.style.visibility = "";
    } else if (target < shownRef.current) {
      for (let i = target; i < shownRef.current; i++) items[i].el.style.visibility = "hidden";
    }
    shownRef.current = target;
    setShownCount(eventPrefixRef.current[target] ?? target);
  }, []);

  // Collect the match's markers once they're in the DOM. Purely a read of an external
  // system (the rendered SVG), which is what effects are for.
  useEffect(() => {
    let tries = 0;
    let raf = 0;
    const tryCollect = () => {
      if (collect() || tries++ > 20) return;
      raf = requestAnimationFrame(tryCollect);
    };
    tryCollect();
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [collect]);

  // Playback loop.
  useEffect(() => {
    if (!playing) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    lastTickRef.current = performance.now();
    const tick = (now: number) => {
      const dt = now - lastTickRef.current;
      lastTickRef.current = now;
      const next = progressRef.current + dt / (BASE_DURATION_MS / speedRef.current);
      if (next >= 1) {
        progressRef.current = 1;
        setProgress(1);
        applyProgress(1);
        setPlaying(false);
        return;
      }
      progressRef.current = next;
      setProgress(next);
      applyProgress(next);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [playing, applyProgress]);

  // Dim the route polylines while playing, so the revealed events read as "what has
  // happened so far" against a faint preview of the whole route.
  useEffect(() => {
    const layer = document.querySelector(".match-layer");
    layer?.classList.toggle("is-playing", playing || progress < 1);
  }, [playing, progress]);

  const togglePlay = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    // Restarting from the end replays from the beginning.
    if (progressRef.current >= 1) {
      progressRef.current = 0;
      setProgress(0);
      applyProgress(0);
    }
    setPlaying(true);
  };

  const scrub = (value: number) => {
    setPlaying(false);
    progressRef.current = value;
    setProgress(value);
    applyProgress(value);
  };

  const percent = Math.round(progress * 100);

  return (
    <div className="pointer-events-auto flex flex-col gap-2 rounded-md border border-border bg-surface/90 p-3 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? "Pause playback" : "Play match timeline"}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border border-border bg-surfaceRaised text-ui-emphasis text-textPrimary"
        >
          {/* Drawn as SVG rather than the ❚❚ / ▶ glyphs: those render at whatever weight
              and baseline the font happens to give them, which read as heavy and sat
              off-centre in the button. */}
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" fill="currentColor">
            {playing ? (
              <>
                <rect x="2.5" y="1.5" width="3.5" height="11" rx="1" />
                <rect x="8" y="1.5" width="3.5" height="11" rx="1" />
              </>
            ) : (
              <path d="M3.5 1.9a1 1 0 0 1 1.52-.85l7.1 4.6a1 1 0 0 1 0 1.7l-7.1 4.6a1 1 0 0 1-1.52-.85z" />
            )}
          </svg>
        </button>

        <input
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={progress}
          onChange={(e) => scrub(Number(e.target.value))}
          className="playback-scrubber min-h-11 flex-1"
          // Drives the filled portion of the track (WebKit has no ::-moz-range-progress
          // equivalent, so the fill is painted as a gradient stop).
          style={{ "--playback-fill": progress } as React.CSSProperties}
          aria-label="Match timeline position"
          aria-valuetext={`${percent}% through the match`}
        />

        <div className="flex shrink-0 gap-1" role="group" aria-label="Playback speed">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSpeed(s)}
              aria-pressed={speed === s}
              className={`h-11 min-w-11 rounded-sm border border-border px-2 text-ui ${
                speed === s
                  ? "bg-surfaceRaised text-textPrimary"
                  : "bg-transparent text-textSecondary"
              }`}
            >
              {s}&times;
            </button>
          ))}
        </div>
      </div>

      {/* Numeric readout doubles as the non-colour-dependent progress indicator
          (PRD.md §9.5), and names the axis as normalized rather than elapsed time --
          per-match ts spans are ~65-880ms, so a mm:ss clock would be a fiction. */}
      <p className="text-ui text-textSecondary">
        <span className="text-data text-textPrimary">{percent}%</span> through match ·{" "}
        <span className="text-data">{shownCount}</span>/{eventCount} events shown ·
        normalized progress, not elapsed time
      </p>
    </div>
  );
}
