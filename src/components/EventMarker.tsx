import type { MarkerShape } from "@/lib/markers";

interface MarkerShapeProps {
  shape: MarkerShape;
  cx: number;
  cy: number;
  /** Half-extent of the shape, in map pixel units. */
  r: number;
  color: string;
  opacity: number;
  /** Stroke width for the `cross` shape, which is drawn rather than filled. */
  strokeWidth: number;
  /** Normalized position in the match (0..1), read by playback to reveal in order. */
  dataP?: number;
}

/**
 * The bare SVG geometry for one marker. Shapes are drawn centred on (cx, cy) so every
 * event type sits exactly on its mapped coordinate regardless of which shape it uses.
 */
export function EventMarkerShape({
  shape,
  cx,
  cy,
  r,
  color,
  opacity,
  strokeWidth,
  dataP,
}: MarkerShapeProps) {
  switch (shape) {
    case "circle":
      return <circle cx={cx} cy={cy} r={r} fill={color} fillOpacity={opacity} />;

    case "diamond":
      return (
        <polygon
          points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`}
          fill={color}
          fillOpacity={opacity}
        />
      );

    case "square":
      return (
        <rect
          x={cx - r}
          y={cy - r}
          width={r * 2}
          height={r * 2}
          fill={color}
          fillOpacity={opacity}
        />
      );

    case "triangle":
      return (
        <polygon
          points={`${cx},${cy - r} ${cx + r},${cy + r * 0.8} ${cx - r},${cy + r * 0.8}`}
          fill={color}
          fillOpacity={opacity}
        />
      );

    // Journey endpoints sit inside a dense field of same-hue position dots, so the ring
    // alone had nothing to separate it from its surroundings. A dark casing underneath
    // (the map background colour, not a new palette entry) cuts a gap around the shape
    // so it reads as a distinct object -- the same trick as a halo/casing on map labels.
    case "ring":
      return (
        <g data-p={dataP} data-endpoint="">
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="var(--color-background)"
            strokeOpacity={0.85}
            strokeWidth={strokeWidth * 2.6}
          />
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={color}
            strokeOpacity={opacity}
            strokeWidth={strokeWidth}
          />
        </g>
      );

    case "bullseye":
      return (
        <g data-p={dataP} data-endpoint="">
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="var(--color-background)"
            strokeOpacity={0.85}
            strokeWidth={strokeWidth * 2.6}
          />
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={color}
            strokeOpacity={opacity}
            strokeWidth={strokeWidth}
          />
          <circle
            cx={cx}
            cy={cy}
            r={r * 0.42}
            fill={color}
            fillOpacity={opacity}
            stroke="var(--color-background)"
            strokeOpacity={0.85}
            strokeWidth={strokeWidth * 0.9}
          />
        </g>
      );

    case "cross":
      return (
        <path
          d={`M ${cx - r},${cy - r} L ${cx + r},${cy + r} M ${cx - r},${cy + r} L ${cx + r},${cy - r}`}
          stroke={color}
          strokeOpacity={opacity}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
        />
      );
  }
}
