interface ActivityAreaProps {
  data: { input: number; output: number; cache: number }[];
  width?: number;
  height?: number;
}

export default function ActivityArea({
  data,
  width = 400,
  height = 80,
}: ActivityAreaProps) {
  if (data.length < 2) return null;

  const padding = 0;
  const totals = data.map((d) => d.input + d.output + d.cache);
  const max = Math.max(...totals) || 1;

  // Generate points for each layer (stacked)
  const getY = (value: number) =>
    padding + (1 - value / max) * (height - 2 * padding);

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
    return {
      x,
      input: d.input,
      output: d.output,
      cache: d.cache,
    };
  });

  // Smooth path generator using Catmull-Rom splines
  const smoothPath = (
    pts: { x: number; y: number }[],
    closeBottom: boolean
  ): string => {
    if (pts.length < 2) return "";

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

    if (closeBottom) {
      d += ` L ${pts[pts.length - 1].x},${height} L ${pts[0].x},${height} Z`;
    }

    return d;
  };

  // Build stacked layers (bottom to top: cache, input, output)
  const cacheLayer = points.map((p) => ({
    x: p.x,
    y: getY(p.cache),
  }));

  const inputLayer = points.map((p) => ({
    x: p.x,
    y: getY(p.cache + p.input),
  }));

  const outputLayer = points.map((p) => ({
    x: p.x,
    y: getY(p.cache + p.input + p.output),
  }));

  // Create area paths between layers
  const createAreaPath = (
    topLayer: { x: number; y: number }[],
    bottomLayer: { x: number; y: number }[]
  ): string => {
    const tension = 0.3;

    // Top curve (left to right)
    let d = `M ${topLayer[0].x},${topLayer[0].y}`;
    for (let i = 0; i < topLayer.length - 1; i++) {
      const p0 = topLayer[Math.max(0, i - 1)];
      const p1 = topLayer[i];
      const p2 = topLayer[i + 1];
      const p3 = topLayer[Math.min(topLayer.length - 1, i + 2)];

      const cp1x = p1.x + (p2.x - p0.x) * tension;
      const cp1y = p1.y + (p2.y - p0.y) * tension;
      const cp2x = p2.x - (p3.x - p1.x) * tension;
      const cp2y = p2.y - (p3.y - p1.y) * tension;

      d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }

    // Line down to bottom layer
    d += ` L ${bottomLayer[bottomLayer.length - 1].x},${bottomLayer[bottomLayer.length - 1].y}`;

    // Bottom curve (right to left)
    const reversedBottom = [...bottomLayer].reverse();
    for (let i = 0; i < reversedBottom.length - 1; i++) {
      const p0 = reversedBottom[Math.max(0, i - 1)];
      const p1 = reversedBottom[i];
      const p2 = reversedBottom[i + 1];
      const p3 = reversedBottom[Math.min(reversedBottom.length - 1, i + 2)];

      const cp1x = p1.x + (p2.x - p0.x) * tension;
      const cp1y = p1.y + (p2.y - p0.y) * tension;
      const cp2x = p2.x - (p3.x - p1.x) * tension;
      const cp2y = p2.y - (p3.y - p1.y) * tension;

      d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }

    d += " Z";
    return d;
  };

  // Bottom layer fills to the bottom of the chart
  const cacheBottom = points.map((p) => ({ x: p.x, y: height }));
  const cachePath = createAreaPath(cacheLayer, cacheBottom);
  const inputPath = createAreaPath(inputLayer, cacheLayer);
  const outputPath = createAreaPath(outputLayer, inputLayer);

  // Top line for visual definition
  const topLinePath = smoothPath(outputLayer, false);

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="block"
    >
      <defs>
        <linearGradient id="cacheGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id="inputGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.1" />
        </linearGradient>
        <linearGradient id="outputGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.15" />
        </linearGradient>
      </defs>

      <path d={cachePath} fill="url(#cacheGrad)" />
      <path d={inputPath} fill="url(#inputGrad)" />
      <path d={outputPath} fill="url(#outputGrad)" />

      <path
        d={topLinePath}
        fill="none"
        stroke="#6366f1"
        strokeWidth={1.5}
        strokeOpacity={0.7}
      />
    </svg>
  );
}
