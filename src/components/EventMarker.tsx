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
