import { useState } from "react";
import { useApi } from "../hooks/useApi";
import LoadingSkeleton from "../components/LoadingSkeleton";
import { TOOLTIP_STYLE, AXIS_STYLE, GRID_STYLE } from "../utils/chart-theme";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Treemap,
  AreaChart,
  Area,
  Legend,
} from "recharts";

interface ToolData {
  topTools: { tool_name: string; count: number }[];
  toolsBySession: {
    session_id: string;
    slug: string;
    first_prompt: string;
    tool_count: number;
  }[];
  dailyTools: { date: string; tool_name: string; count: number }[];
}

const TOOL_COLORS = [
  "#d97706", "#3b82f6", "#10b981", "#8b5cf6", "#ef4444",
  "#06b6d4", "#f59e0b", "#ec4899", "#14b8a6", "#6366f1",
];

function TreemapContent(props: any) {
  const { x, y, width, height, name, value } = props;
  if (width < 40 || height < 20) return null;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={4}
        style={{ fill: props.color || "#d97706", stroke: "#111827", strokeWidth: 2 }}
      />
      {width > 50 && height > 30 && (
        <>
          <text
            x={x + width / 2}
            y={y + height / 2 - 6}
            textAnchor="middle"
            fill="#f3f4f6"
            fontSize={11}
            fontWeight={600}
          >
            {name}
          </text>
          <text
            x={x + width / 2}
            y={y + height / 2 + 10}
            textAnchor="middle"
            fill="#9ca3af"
            fontSize={10}
          >
            {value.toLocaleString()}
          </text>
        </>
      )}
    </g>
  );
}

export default function ToolAnalytics() {
  const { data, loading } = useApi<ToolData>("/api/analytics/tools");
  const [chartView, setChartView] = useState<"bar" | "treemap">("bar");

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-lg font-semibold">Tool Usage Analytics</h2>
        <LoadingSkeleton variant="chart" />
        <LoadingSkeleton variant="table" count={5} />
      </div>
    );
  }

  if (!data) return null;

  const { topTools, toolsBySession, dailyTools } = data;

  // Treemap data
  const treemapData = topTools.map((t, i) => ({
    name: t.tool_name,
    size: t.count,
    color: TOOL_COLORS[i % TOOL_COLORS.length],
  }));

  // Daily tool usage: top 5 tools + "Other", pivoted by date
  const top5Names = topTools.slice(0, 5).map((t) => t.tool_name);
  const dailyMap = new Map<string, Record<string, number>>();
  for (const d of dailyTools) {
    if (!dailyMap.has(d.date)) {
      dailyMap.set(d.date, {});
    }
    const entry = dailyMap.get(d.date)!;
    if (top5Names.includes(d.tool_name)) {
      entry[d.tool_name] = (entry[d.tool_name] || 0) + d.count;
    } else {
      entry["Other"] = (entry["Other"] || 0) + d.count;
    }
  }
  const dailyChartData = [...dailyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({ date, ...counts }));

  const dailySeries = [...top5Names];
  if (dailyChartData.some((d) => (d as any)["Other"] > 0)) {
    dailySeries.push("Other");
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Tool Usage Analytics</h2>

      {/* Top tools chart */}
      {topTools.length > 0 && (
        <div className="bg-surface-light rounded-xl p-5 border border-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-400">
              Most Used Tools
            </h3>
            <div className="flex gap-1">
              <button
                onClick={() => setChartView("bar")}
                className={`px-2 py-1 text-xs rounded ${
                  chartView === "bar"
                    ? "bg-primary/20 text-primary"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                Bar
              </button>
              <button
                onClick={() => setChartView("treemap")}
                className={`px-2 py-1 text-xs rounded ${
                  chartView === "treemap"
                    ? "bg-primary/20 text-primary"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                Treemap
              </button>
            </div>
          </div>

          {chartView === "bar" ? (
            <ResponsiveContainer width="100%" height={Math.max(300, topTools.length * 30)}>
              <BarChart
                data={topTools}
                layout="vertical"
                margin={{ left: 80 }}
              >
                <CartesianGrid {...GRID_STYLE} />
                <XAxis type="number" tick={AXIS_STYLE} />
                <YAxis
                  type="category"
                  dataKey="tool_name"
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  width={80}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value: number) => [
                    value.toLocaleString(),
                    "calls",
                  ]}
                />
                <Bar dataKey="count" fill="#d97706" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              <Treemap
                data={treemapData}
                dataKey="size"
                nameKey="name"
                content={<TreemapContent />}
              >
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value: number) => [value.toLocaleString(), "calls"]}
                />
              </Treemap>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Daily tool usage stacked area */}
      {dailyChartData.length > 0 && (
        <div className="bg-surface-light rounded-xl p-5 border border-border">
          <h3 className="text-sm font-medium text-gray-400 mb-4">
            Daily Tool Usage
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={dailyChartData}>
              <CartesianGrid {...GRID_STYLE} />
              <XAxis
                dataKey="date"
                tick={AXIS_STYLE}
                tickFormatter={(v) => v.slice(5)}
              />
              <YAxis tick={AXIS_STYLE} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={{ color: "#9ca3af" }}
              />
              <Legend />
              {dailySeries.map((name, i) => (
                <Area
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stackId="1"
                  stroke={TOOL_COLORS[i % TOOL_COLORS.length]}
                  fill={TOOL_COLORS[i % TOOL_COLORS.length]}
                  fillOpacity={0.6}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top sessions by tool use */}
      <div className="bg-surface-light rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h3 className="text-sm font-medium text-gray-400">
            Sessions with Most Tool Usage
          </h3>
        </div>
        <div className="divide-y divide-border/50">
          {toolsBySession.map((s) => (
            <div key={s.session_id} className="px-5 py-3">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-300 truncate">
                  {s.first_prompt || s.slug || s.session_id.slice(0, 8)}
                </div>
                <div className="text-sm font-mono text-primary ml-4">
                  {s.tool_count.toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
