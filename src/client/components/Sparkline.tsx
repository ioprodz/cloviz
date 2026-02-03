interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fill?: boolean;
  smooth?: boolean;
  skipZeros?: boolean;
}

export default function Sparkline({
  data,
  width = 80,
  height = 24,
  color = "#d97706",
  fill = true,
  smooth = false,
  skipZeros = false,
}: SparklineProps) {
  if (data.length < 2) return null;

  const nonZeroValues = data.filter((v) => v > 0);
  const max = Math.max(...nonZeroValues, 0);
  const min = 0; // Always use 0 as min for consistent baseline
  const range = max - min || 1;
  const paddingX = 1;
  const paddingTop = smooth ? 8 : 1; // Extra top margin for smooth curves
  const paddingBottom = 0; // Fill should touch the bottom

  const points = data.map((v, i) => ({
    x: paddingX + (i / (data.length - 1)) * (width - 2 * paddingX),
    y: paddingTop + (1 - (v - min) / range) * (height - paddingTop - paddingBottom),
    value: v,
  }));

  // Build path segments (split by zeros if skipZeros is true)
  const buildSegments = () => {
    if (!skipZeros) {
      return [points];
    }

    const segments: typeof points[] = [];
    let currentSegment: typeof points = [];

    for (const point of points) {
      if (point.value > 0) {
        currentSegment.push(point);
      } else if (currentSegment.length > 0) {
        segments.push(currentSegment);
        currentSegment = [];
      }
    }
    if (currentSegment.length > 0) {
      segments.push(currentSegment);
    }

    return segments;
  };

  const segments = buildSegments();

  const buildPath = (pts: typeof points): string => {
    if (pts.length < 2) {
      // Single point - draw a small dot
      if (pts.length === 1) {
        return `M ${pts[0].x},${pts[0].y} L ${pts[0].x + 0.5},${pts[0].y}`;
      }
      return "";
    }

    if (smooth && pts.length > 2) {
      const tension = 0.3;
      let d = `M ${pts[0].x},${pts[0].y}`;

      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[Math.min(pts.length - 1, i + 2)];

        const cp1x = p1.x + (p2.x - p0.x) * tension;
        const cp1y = p1.y + (p2.y - p0.y) * tension;
        const cp2x = p2.x - (p3.x - p1.x) * tension;
        const cp2y = p2.y - (p3.y - p1.y) * tension;

        d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
      }
      return d;
    } else {
      return `M ${pts.map((p) => `${p.x},${p.y}`).join(" L ")}`;
    }
  };

  const buildFillPath = (pts: typeof points, linePath: string): string => {
    if (pts.length < 2) return "";
    return `${linePath} L ${pts[pts.length - 1].x},${height} L ${pts[0].x},${height} Z`;
  };

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="block"
    >
      {segments.map((segment, idx) => {
        const linePath = buildPath(segment);
        const fillPath = fill ? buildFillPath(segment, linePath) : "";

        return (
          <g key={idx}>
            {fill && fillPath && (
              <path d={fillPath} fill={color} fillOpacity={0.15} />
            )}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke={color}
                strokeWidth={1.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}
