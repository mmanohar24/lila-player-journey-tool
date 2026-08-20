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
  /** Mobile only: the speed buttons are collapsed behind a toggle to save a row. */
  const [speedsOpen, setSpeedsOpen] = useState(false);
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
    /* On a phone this panel was 175px tall -- 26% of the viewport, and 51% in landscape
       -- because the speed buttons and a two-line caption each took a row. Everything
       now fits one row on small screens: the caption is hidden visually (it still
       reaches assistive tech through the paragraph's aria-label) and the speeds sit
       behind a disclosure. From `sm` up the full layout returns. */
    <div className="pointer-events-auto flex flex-col gap-2 rounded-md border border-border bg-surface/90 p-2 backdrop-blur-sm sm:gap-2 sm:p-3">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
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
          // A minimum width so that, when space runs short, the speed group wraps to the
          // next line rather than squeezing the scrubber (it collapsed to 58px at
          // tablet width, which is not draggable).
          className="playback-scrubber min-h-11 min-w-32 flex-1"
          // Drives the filled portion of the track (WebKit has no ::-moz-range-progress
          // equivalent, so the fill is painted as a gradient stop).
          style={{ "--playback-fill": progress } as React.CSSProperties}
          aria-label="Match timeline position"
          aria-valuetext={`${percent}% through the match`}
        />

        {/* Compact progress figure, so the row still reports position once the full
            caption below is hidden on small screens. */}
        <span aria-hidden="true" className="text-data shrink-0 text-textPrimary sm:hidden">
          {`${percent}%`}
        </span>

        {/* Speeds stay inline from `sm` up; on a phone they collapse behind this
            toggle rather than claiming a whole row of a 660px-tall screen. */}
        <button
          type="button"
          onClick={() => setSpeedsOpen((v) => !v)}
          aria-expanded={speedsOpen}
          aria-controls="playback-speeds"
          aria-label={`Playback speed: ${speed === 0.5 ? "half" : speed} times. Change speed.`}
          className="flex h-11 min-w-11 shrink-0 items-center justify-center rounded-sm border border-border bg-surfaceRaised px-3 text-ui text-textPrimary sm:hidden"
        >
          <span aria-hidden="true">{`${speed}×`}</span>
        </button>

        {/* `basis-full` so that, when opened on a phone, the speeds wrap onto their own
            line instead of competing with the scrubber and squeezing it to nothing.
            From `sm` they sit inline again. */}
        <div
          id="playback-speeds"
          className={`shrink-0 basis-full gap-1 sm:basis-auto ${
            speedsOpen ? "flex" : "hidden"
          } sm:flex`}
          role="group"
          aria-label="Playback speed"
        >
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setSpeed(s);
                setSpeedsOpen(false);
              }}
              aria-pressed={speed === s}
              // Spoken as "half speed" / "2 times speed" rather than the visual glyph,
              // which a screen reader otherwise splits into "0.5" and "times".
              aria-label={s === 0.5 ? "Half speed" : `${s} times speed`}
              className={`h-11 min-w-11 rounded-sm border border-border px-2 text-ui ${
                speed === s
                  ? "bg-surfaceRaised text-textPrimary"
                  : "bg-transparent text-textSecondary"
              }`}
            >
              <span aria-hidden="true">{`${s}×`}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Numeric readout doubles as the non-colour-dependent progress indicator
          (PRD.md §9.5), and names the axis as normalized rather than elapsed time --
          per-match ts spans are ~65-880ms, so a mm:ss clock would be a fiction.

          The emphasised figures are separate elements for styling, which a screen
          reader would otherwise chunk mid-sentence, so the paragraph carries the whole
          sentence as its accessible name and the visual parts are hidden from it. */}
      {/* Hidden visually below `sm` only -- `sr-only` keeps it in the accessibility tree,
          so the "normalized progress, not elapsed time" caveat (PRD.md §6) is never
          dropped for a screen reader, just for a 393px-wide screen where it cost two
          lines. The compact % in the row above carries it visually. */}
      <p
        className="sr-only text-ui text-textSecondary sm:not-sr-only [@media(max-height:430px)]:sr-only"
        aria-label={`${percent}% through match. ${shownCount} of ${eventCount} events shown. Normalized progress, not elapsed time.`}
      >
        <span aria-hidden="true">
          <span className="text-data text-textPrimary">{`${percent}%`}</span>
          {` through match · `}
          <span className="text-data">{`${shownCount}/${eventCount}`}</span>
          {` events shown · normalized progress, not elapsed time`}
        </span>
      </p>
    </div>
  );
}
