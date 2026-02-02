interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fill?: boolean;
}

export default function Sparkline({
  data,
  width = 80,
  height = 24,
  color = "#d97706",
  fill = true,
}: SparklineProps) {
  if (data.length < 2) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const padding = 1;

  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
    const y = padding + (1 - (v - min) / range) * (height - 2 * padding);
    return `${x},${y}`;
  });

  const polyline = points.join(" ");

  const fillPoints = fill
    ? `${padding},${height - padding} ${polyline} ${width - padding},${height - padding}`
    : "";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="inline-block"
    >
      {fill && (
        <polygon points={fillPoints} fill={color} fillOpacity={0.15} />
      )}
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
