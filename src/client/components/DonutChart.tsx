import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { TOOLTIP_STYLE } from "../utils/chart-theme";

interface DonutDatum {
  name: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DonutDatum[];
  label?: string;
  subLabel?: string;
  height?: number;
  showLegend?: boolean;
  valueFormatter?: (value: number) => string;
}

export default function DonutChart({
  data,
  label,
  subLabel,
  height = 250,
  showLegend = true,
  valueFormatter = (v) => v.toLocaleString(),
}: DonutChartProps) {
  const nonZero = data.filter((d) => d.value > 0);
  if (nonZero.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-gray-600 text-sm"
        style={{ height }}
      >
        No data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={nonZero}
          cx="50%"
          cy="50%"
          innerRadius="55%"
          outerRadius="80%"
          paddingAngle={2}
          dataKey="value"
        >
          {nonZero.map((entry, i) => (
            <Cell key={i} fill={entry.color} stroke="transparent" />
          ))}
        </Pie>
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(value: number) => [valueFormatter(value)]}
        />
        {showLegend && (
          <Legend
            formatter={(value: string) => (
              <span className="text-xs text-gray-400">{value}</span>
            )}
          />
        )}
        {/* Center label */}
        {label && (
          <text
            x="50%"
            y={subLabel ? "47%" : "50%"}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-gray-100 text-lg font-bold"
            style={{ fontSize: "18px", fontWeight: 700, fill: "#f3f4f6" }}
          >
            {label}
          </text>
        )}
        {subLabel && (
          <text
            x="50%"
            y="57%"
            textAnchor="middle"
            dominantBaseline="central"
            style={{ fontSize: "11px", fill: "#6b7280" }}
          >
            {subLabel}
          </text>
        )}
      </PieChart>
    </ResponsiveContainer>
  );
}
