import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import { useWebSocket } from "../hooks/useWebSocket";
import StatsCard from "../components/StatsCard";
import DonutChart from "../components/DonutChart";
import LoadingSkeleton from "../components/LoadingSkeleton";
import { formatCost, formatTokens } from "../utils/format";
import {
  getModelColor,
  shortModelName,
  COST_COLORS,
  TOOLTIP_STYLE,
  AXIS_STYLE,
  GRID_STYLE,
} from "../utils/chart-theme";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Treemap,
} from "recharts";

const TABS = [
  { key: "costs", label: "Costs" },
  { key: "usage", label: "Usage" },
  { key: "tools", label: "Tools" },
  { key: "patterns", label: "Patterns" },
  { key: "activity", label: "Activity" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function Analytics() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab") as TabKey | null;
  const [activeTab, setActiveTab] = useState<TabKey>(
    tabParam && TABS.some((t) => t.key === tabParam) ? tabParam : "costs"
  );

  useEffect(() => {
    setSearchParams({ tab: activeTab }, { replace: true });
  }, [activeTab, setSearchParams]);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Analytics</h2>

      {/* Tab bar */}
      <div className="flex gap-1 bg-surface-light rounded-lg p-1 border border-border">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm rounded-md transition-colors flex-1 ${
              activeTab === tab.key
                ? "bg-primary/15 text-primary font-medium"
                : "text-gray-400 hover:text-gray-200 hover:bg-surface-lighter"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "costs" && <CostsTab />}
      {activeTab === "usage" && <UsageTab />}
      {activeTab === "tools" && <ToolsTab />}
      {activeTab === "patterns" && <PatternsTab />}
      {activeTab === "activity" && <ActivityTab />}
    </div>
  );
}

// =============================================================================
// Costs Tab
// =============================================================================

interface CostWithSavings {
  inputCost: number;
  outputCost: number;
  cacheWriteCost: number;
  cacheReadCost: number;
  totalCost: number;
  costWithoutCache: number;
  cacheSavings: number;
}

interface CostData {
  totals: CostWithSavings;
  perModelCosts: Record<string, CostWithSavings & { model: string }>;
  dailyCosts: {
    date: string;
    inputCost: number;
    outputCost: number;
    cacheWriteCost: number;
    cacheReadCost: number;
    totalCost: number;
    cacheSavings: number;
  }[];
  rates: {
    perDay7: number;
    perWeek7: number;
    perDay30: number;
    perWeek30: number;
  };
}

function CostsTab() {
  const { data, loading } = useApi<CostData>("/api/analytics/costs");

  if (loading)
    return (
      <>
        <LoadingSkeleton variant="card" count={4} />
        <LoadingSkeleton variant="chart" />
      </>
    );
  if (!data) return null;

  const { totals, perModelCosts, dailyCosts, rates } = data;
  const sparkData = dailyCosts.slice(-30).map((d) => d.totalCost);
  const savingsPct =
    totals.costWithoutCache > 0
      ? ((totals.cacheSavings / totals.costWithoutCache) * 100).toFixed(0)
      : "0";

  const modelDonut = Object.entries(perModelCosts).map(([model, cost]) => ({
    name: shortModelName(model),
    value: cost.totalCost,
    color: getModelColor(model),
  }));

  const breakdownDonut = [
    { name: "Input", value: totals.inputCost, color: COST_COLORS.input },
    { name: "Output", value: totals.outputCost, color: COST_COLORS.output },
    {
      name: "Cache Write",
      value: totals.cacheWriteCost,
      color: COST_COLORS.cacheWrite,
    },
    {
      name: "Cache Read",
      value: totals.cacheReadCost,
      color: COST_COLORS.cacheRead,
    },
  ];

  const savingsBar = [
    { name: "Actual Cost", value: totals.totalCost, fill: "#3b82f6" },
    {
      name: "Without Caching",
      value: totals.costWithoutCache,
      fill: "#6b7280",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard
          label="Total Spend"
          value={formatCost(totals.totalCost)}
          sparkData={sparkData}
        />
        <StatsCard
          label="Cache Savings"
          value={formatCost(totals.cacheSavings)}
          sub={`${savingsPct}% saved`}
          accent="#10b981"
        />
        <StatsCard
          label="Daily Rate (7d)"
          value={formatCost(rates.perDay7)}
          sub={`~${formatCost(rates.perWeek7)}/week`}
        />
        <StatsCard
          label="Daily Rate (30d)"
          value={formatCost(rates.perDay30)}
          sub={`~${formatCost(rates.perWeek30)}/week`}
        />
      </div>

      {dailyCosts.length > 0 && (
        <div className="bg-surface-light rounded-xl p-5 border border-border">
          <h3 className="text-sm font-medium text-gray-400 mb-4">
            Daily Cost Trend
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={dailyCosts}>
              <CartesianGrid {...GRID_STYLE} />
              <XAxis
                dataKey="date"
                tick={AXIS_STYLE}
                tickFormatter={(v) => v.slice(5)}
              />
              <YAxis
                tick={AXIS_STYLE}
                tickFormatter={(v) => `$${v.toFixed(2)}`}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={{ color: "#9ca3af" }}
                formatter={(value: number, name: string) => [
                  formatCost(value),
                  name,
                ]}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="inputCost"
                name="Input"
                stackId="1"
                stroke={COST_COLORS.input}
                fill={COST_COLORS.input}
                fillOpacity={0.6}
              />
              <Area
                type="monotone"
                dataKey="outputCost"
                name="Output"
                stackId="1"
                stroke={COST_COLORS.output}
                fill={COST_COLORS.output}
                fillOpacity={0.6}
              />
              <Area
                type="monotone"
                dataKey="cacheWriteCost"
                name="Cache Write"
                stackId="1"
                stroke={COST_COLORS.cacheWrite}
                fill={COST_COLORS.cacheWrite}
                fillOpacity={0.6}
              />
              <Area
                type="monotone"
                dataKey="cacheReadCost"
                name="Cache Read"
                stackId="1"
                stroke={COST_COLORS.cacheRead}
                fill={COST_COLORS.cacheRead}
                fillOpacity={0.6}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-surface-light rounded-xl p-5 border border-border">
          <h3 className="text-sm font-medium text-gray-400 mb-2">
            Cost by Model
          </h3>
          <DonutChart
            data={modelDonut}
            label={formatCost(totals.totalCost)}
            subLabel="total"
            valueFormatter={formatCost}
          />
        </div>
        <div className="bg-surface-light rounded-xl p-5 border border-border">
          <h3 className="text-sm font-medium text-gray-400 mb-2">
            Cost Breakdown
          </h3>
          <DonutChart
            data={breakdownDonut}
            label={formatCost(totals.totalCost)}
            subLabel="total"
            valueFormatter={formatCost}
          />
        </div>
      </div>

      <div className="bg-surface-light rounded-xl p-5 border border-border">
        <h3 className="text-sm font-medium text-gray-400 mb-4">
          Cache Savings Comparison
        </h3>
        <ResponsiveContainer width="100%" height={100}>
          <BarChart data={savingsBar} layout="vertical" margin={{ left: 100 }}>
            <XAxis
              type="number"
              tick={AXIS_STYLE}
              tickFormatter={(v) => formatCost(v)}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              width={100}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value: number) => [formatCost(value)]}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {savingsBar.map((entry, i) => (
                <rect key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="text-center mt-2 text-sm text-green-400">
          Saved {formatCost(totals.cacheSavings)} ({savingsPct}%) through
          caching
        </div>
      </div>

      <div className="bg-surface-light rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h3 className="text-sm font-medium text-gray-400">
            Per-Model Costs
          </h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 border-b border-border">
              <th className="text-left px-5 py-2">Model</th>
              <th className="text-right px-5 py-2">Input</th>
              <th className="text-right px-5 py-2">Output</th>
              <th className="text-right px-5 py-2">Cache Write</th>
              <th className="text-right px-5 py-2">Cache Read</th>
              <th className="text-right px-5 py-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(perModelCosts)
              .sort(([, a], [, b]) => b.totalCost - a.totalCost)
              .map(([model, cost]) => (
                <tr key={model} className="border-b border-border/50">
                  <td className="px-5 py-2 font-mono text-xs text-gray-300">
                    <span
                      className="inline-block w-2 h-2 rounded-full mr-2"
                      style={{ backgroundColor: getModelColor(model) }}
                    />
                    {shortModelName(model)}
                  </td>
                  <td className="text-right px-5 py-2 text-gray-400">
                    {formatCost(cost.inputCost)}
                  </td>
                  <td className="text-right px-5 py-2 text-gray-400">
                    {formatCost(cost.outputCost)}
                  </td>
                  <td className="text-right px-5 py-2 text-gray-400">
                    {formatCost(cost.cacheWriteCost)}
                  </td>
                  <td className="text-right px-5 py-2 text-gray-400">
                    {formatCost(cost.cacheReadCost)}
                  </td>
                  <td className="text-right px-5 py-2 text-gray-200 font-medium">
                    {formatCost(cost.totalCost)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =============================================================================
// Usage Tab
// =============================================================================

interface UsageData {
  modelUsage: Record<
    string,
    {
      inputTokens: number;
      outputTokens: number;
      cacheReadInputTokens: number;
      cacheCreationInputTokens: number;
    }
  >;
  dailyTokens: { date: string; tokensByModel: Record<string, number> }[];
  totals: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
    cacheHitRate: number;
  };
  costTotals: CostWithSavings | null;
  perModelCosts: Record<string, CostWithSavings>;
}

function UsageTab() {
  const { data, loading } = useApi<UsageData>("/api/analytics/usage");

  if (loading)
    return (
      <>
        <LoadingSkeleton variant="card" count={4} />
        <LoadingSkeleton variant="chart" />
      </>
    );
  if (!data) return null;

  const { modelUsage, dailyTokens, totals, costTotals, perModelCosts } = data;

  const allModels = new Set<string>();
  for (const day of dailyTokens) {
    for (const model of Object.keys(day.tokensByModel)) {
      allModels.add(model);
    }
  }
  const modelList = [...allModels];

  const chartData = dailyTokens.map((day) => {
    const entry: Record<string, any> = { date: day.date };
    for (const model of modelList) {
      entry[shortModelName(model)] = day.tokensByModel[model] ?? 0;
    }
    return entry;
  });

  const costDonut = Object.entries(perModelCosts || {}).map(
    ([model, cost]) => ({
      name: shortModelName(model),
      value: cost.totalCost,
      color: getModelColor(model),
    })
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard
          label="Input Tokens"
          value={formatTokens(totals.inputTokens)}
          sub={
            costTotals
              ? `${formatCost(costTotals.inputCost)} cost`
              : undefined
          }
        />
        <StatsCard
          label="Output Tokens"
          value={formatTokens(totals.outputTokens)}
          sub={
            costTotals
              ? `${formatCost(costTotals.outputCost)} cost`
              : undefined
          }
        />
        <StatsCard
          label="Cache Read"
          value={formatTokens(totals.cacheReadTokens)}
          sub={
            costTotals
              ? `${formatCost(costTotals.cacheReadCost)} cost`
              : undefined
          }
        />
        <StatsCard
          label="Cache Hit Rate"
          value={`${(totals.cacheHitRate * 100).toFixed(1)}%`}
          accent="#10b981"
          sub={
            costTotals
              ? `${formatCost(costTotals.cacheSavings)} saved`
              : undefined
          }
        />
      </div>

      {costDonut.length > 0 && costTotals && (
        <div className="bg-surface-light rounded-xl p-5 border border-border">
          <h3 className="text-sm font-medium text-gray-400 mb-2">
            Cost by Model
          </h3>
          <DonutChart
            data={costDonut}
            label={formatCost(costTotals.totalCost)}
            subLabel="total cost"
            valueFormatter={formatCost}
            height={220}
          />
        </div>
      )}

      {chartData.length > 0 && (
        <div className="bg-surface-light rounded-xl p-5 border border-border">
          <h3 className="text-sm font-medium text-gray-400 mb-4">
            Daily Tokens by Model
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <CartesianGrid {...GRID_STYLE} />
              <XAxis
                dataKey="date"
                tick={AXIS_STYLE}
                tickFormatter={(v) => v.slice(5)}
              />
              <YAxis
                tick={AXIS_STYLE}
                tickFormatter={(v) =>
                  v >= 1e6
                    ? `${(v / 1e6).toFixed(0)}M`
                    : v >= 1e3
                      ? `${(v / 1e3).toFixed(0)}K`
                      : v
                }
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={{ color: "#9ca3af" }}
                formatter={(value: number) => [
                  value.toLocaleString(),
                  "tokens",
                ]}
              />
              <Legend />
              {modelList.map((model) => (
                <Area
                  key={model}
                  type="monotone"
                  dataKey={shortModelName(model)}
                  stackId="1"
                  stroke={getModelColor(model)}
                  fill={getModelColor(model)}
                  fillOpacity={0.6}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-surface-light rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h3 className="text-sm font-medium text-gray-400">
            Model Breakdown
          </h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 border-b border-border">
              <th className="text-left px-5 py-2">Model</th>
              <th className="text-right px-5 py-2">Input</th>
              <th className="text-right px-5 py-2">Output</th>
              <th className="text-right px-5 py-2">Cache Read</th>
              <th className="text-right px-5 py-2">Cache Creation</th>
              <th className="text-right px-5 py-2">Cost</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(modelUsage).map(([model, usage]) => {
              const modelCost = perModelCosts?.[model];
              return (
                <tr key={model} className="border-b border-border/50">
                  <td className="px-5 py-2 font-mono text-xs text-gray-300">
                    <span
                      className="inline-block w-2 h-2 rounded-full mr-2"
                      style={{ backgroundColor: getModelColor(model) }}
                    />
                    {shortModelName(model)}
                  </td>
                  <td className="text-right px-5 py-2 text-gray-400">
                    {formatTokens(usage.inputTokens)}
                  </td>
                  <td className="text-right px-5 py-2 text-gray-400">
                    {formatTokens(usage.outputTokens)}
                  </td>
                  <td className="text-right px-5 py-2 text-gray-400">
                    {formatTokens(usage.cacheReadInputTokens)}
                  </td>
                  <td className="text-right px-5 py-2 text-gray-400">
                    {formatTokens(usage.cacheCreationInputTokens)}
                  </td>
                  <td className="text-right px-5 py-2 text-primary font-medium">
                    {modelCost ? formatCost(modelCost.totalCost) : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =============================================================================
// Tools Tab
// =============================================================================

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
  "#d97706",
  "#3b82f6",
  "#10b981",
  "#8b5cf6",
  "#ef4444",
  "#06b6d4",
  "#f59e0b",
  "#ec4899",
  "#14b8a6",
  "#6366f1",
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
        style={{
          fill: props.color || "#d97706",
          stroke: "#111827",
          strokeWidth: 2,
        }}
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

function ToolsTab() {
  const { data, loading } = useApi<ToolData>("/api/analytics/tools");
  const [chartView, setChartView] = useState<"bar" | "treemap">("bar");

  if (loading)
    return (
      <>
        <LoadingSkeleton variant="chart" />
        <LoadingSkeleton variant="table" count={5} />
      </>
    );
  if (!data) return null;

  const { topTools, toolsBySession, dailyTools } = data;

  const treemapData = topTools.map((t, i) => ({
    name: t.tool_name,
    size: t.count,
    color: TOOL_COLORS[i % TOOL_COLORS.length],
  }));

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
            <ResponsiveContainer
              width="100%"
              height={Math.max(300, topTools.length * 30)}
            >
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
                  formatter={(value: number) => [
                    value.toLocaleString(),
                    "calls",
                  ]}
                />
              </Treemap>
            </ResponsiveContainer>
          )}
        </div>
      )}

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

// =============================================================================
// Patterns Tab
// =============================================================================

interface HourlyData {
  hourCounts: Record<string, number>;
  dayOfWeek: { dow: number; count: number }[];
  heatmap: { dow: number; hour: number; count: number }[];
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function PatternsTab() {
  const { data, loading } = useApi<HourlyData>("/api/analytics/hourly");

  if (loading)
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-4 bg-surface-lighter rounded animate-pulse skeleton-shimmer"
            style={{ width: `${50 + i * 8}%` }}
          />
        ))}
      </div>
    );
  if (!data) return null;

  const { hourCounts, heatmap } = data;

  const heatmapGrid: number[][] = Array.from({ length: 7 }, () =>
    Array(24).fill(0)
  );
  let maxHeat = 1;
  for (const entry of heatmap) {
    heatmapGrid[entry.dow][entry.hour] = entry.count;
    if (entry.count > maxHeat) maxHeat = entry.count;
  }

  function getHeatColor(count: number): string {
    if (count === 0) return "rgb(17 24 39)";
    const intensity = count / maxHeat;
    if (intensity < 0.2) return "rgb(120 53 15 / 0.4)";
    if (intensity < 0.4) return "rgb(120 53 15)";
    if (intensity < 0.6) return "rgb(146 64 14)";
    if (intensity < 0.8) return "rgb(217 119 6)";
    return "rgb(245 158 11)";
  }

  const hourValues = HOURS.map((h) => ({
    hour: h,
    count: Number(hourCounts[String(h)] ?? 0),
  }));
  const maxHourCount = Math.max(...hourValues.map((h) => h.count), 1);

  const peakHour = hourValues.reduce((a, b) =>
    a.count > b.count ? a : b
  );
  const totalFromHours = hourValues.reduce((acc, h) => acc + h.count, 0);
  const morningCount = hourValues
    .filter((h) => h.hour >= 6 && h.hour < 12)
    .reduce((a, h) => a + h.count, 0);
  const eveningCount = hourValues
    .filter((h) => h.hour >= 18 && h.hour < 24)
    .reduce((a, h) => a + h.count, 0);

  return (
    <div className="space-y-6">
      <div className="bg-surface-light rounded-xl p-5 border border-border">
        <h3 className="text-sm font-medium text-gray-400 mb-4">
          Hour x Day Heatmap
        </h3>
        <div className="overflow-x-auto">
          <table className="border-collapse">
            <thead>
              <tr>
                <th className="w-10"></th>
                {HOURS.map((h) => (
                  <th
                    key={h}
                    className="text-[10px] text-gray-600 font-normal px-0.5 w-6 text-center"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((day, dow) => (
                <tr key={dow}>
                  <td className="text-[10px] text-gray-500 pr-2 text-right">
                    {day}
                  </td>
                  {HOURS.map((h) => (
                    <td key={h} className="p-0.5">
                      <div
                        className="w-5 h-5 rounded-sm"
                        style={{
                          backgroundColor: getHeatColor(heatmapGrid[dow][h]),
                        }}
                        title={`${day} ${h}:00 — ${heatmapGrid[dow][h]} activities`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-surface-light rounded-xl p-5 border border-border">
        <h3 className="text-sm font-medium text-gray-400 mb-4">
          Hourly Distribution (Sessions Started)
        </h3>
        <div className="flex items-end gap-1 h-32">
          {hourValues.map((h) => (
            <div
              key={h.hour}
              className="flex-1 flex flex-col items-center gap-1"
            >
              <div
                className="w-full bg-primary/70 rounded-t transition-all"
                style={{
                  height: `${(h.count / maxHourCount) * 100}%`,
                  minHeight: h.count > 0 ? "2px" : "0",
                }}
              />
              <span className="text-[9px] text-gray-600">{h.hour}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface-light rounded-xl p-4 border border-border">
          <div className="text-xs text-gray-500">Peak Hour</div>
          <div className="text-xl font-bold">{peakHour.hour}:00</div>
          <div className="text-xs text-gray-600">
            {peakHour.count} sessions
          </div>
        </div>
        <div className="bg-surface-light rounded-xl p-4 border border-border">
          <div className="text-xs text-gray-500">Total Tracked</div>
          <div className="text-xl font-bold">{totalFromHours}</div>
        </div>
        <div className="bg-surface-light rounded-xl p-4 border border-border">
          <div className="text-xs text-gray-500">Morning (6-12)</div>
          <div className="text-xl font-bold">{morningCount}</div>
        </div>
        <div className="bg-surface-light rounded-xl p-4 border border-border">
          <div className="text-xs text-gray-500">Evening (18-24)</div>
          <div className="text-xl font-bold">{eveningCount}</div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Activity Tab
// =============================================================================

interface DashboardData {
  dailyActivity: {
    date: string;
    message_count: number;
    session_count: number;
    tool_call_count: number;
  }[];
  recentSessions: {
    id: string;
    summary?: string;
    first_prompt?: string;
    slug?: string;
    message_count: number;
    modified_at?: string;
    project_name?: string;
  }[];
}

function ActivityTab() {
  const { data, loading, refetch } = useApi<DashboardData>("/api/dashboard");

  useWebSocket("history:appended", refetch);

  if (loading)
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-4 bg-surface-lighter rounded animate-pulse skeleton-shimmer"
            style={{ width: `${50 + i * 8}%` }}
          />
        ))}
      </div>
    );
  if (!data) return null;

  const { dailyActivity, recentSessions } = data;
  const reversed = [...dailyActivity].reverse();

  return (
    <div className="space-y-6">
      <div className="bg-surface-light rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h3 className="text-sm font-medium text-gray-400">
            Recent Sessions
          </h3>
        </div>
        <div className="divide-y divide-border/50">
          {recentSessions.map((s) => (
            <Link
              key={s.id}
              to={`/sessions/${s.id}`}
              className="flex items-center gap-4 px-5 py-3 hover:bg-surface-lighter transition-colors"
            >
              <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-200 truncate">
                  {s.summary || s.first_prompt || s.slug || s.id.slice(0, 8)}
                </div>
                <div className="text-xs text-gray-500 flex gap-2">
                  {s.project_name && <span>{s.project_name}</span>}
                  <span>{s.message_count} msgs</span>
                </div>
              </div>
              {s.modified_at && (
                <div className="text-xs text-gray-600 flex-shrink-0">
                  {new Date(s.modified_at).toLocaleDateString()}
                </div>
              )}
            </Link>
          ))}
        </div>
      </div>

      <div className="bg-surface-light rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h3 className="text-sm font-medium text-gray-400">Daily Summary</h3>
        </div>
        <div className="divide-y divide-border/50 max-h-[60vh] overflow-y-auto">
          {reversed.map((day) => (
            <div
              key={day.date}
              className="px-5 py-3 flex items-center gap-4"
            >
              <div className="text-sm text-gray-300 w-24 flex-shrink-0 font-mono">
                {day.date}
              </div>
              <div className="flex gap-4 text-xs text-gray-500">
                <span>
                  <span className="text-gray-300 font-medium">
                    {day.session_count}
                  </span>{" "}
                  sessions
                </span>
                <span>
                  <span className="text-gray-300 font-medium">
                    {day.message_count}
                  </span>{" "}
                  messages
                </span>
                <span>
                  <span className="text-gray-300 font-medium">
                    {day.tool_call_count}
                  </span>{" "}
                  tools
                </span>
              </div>
              <div className="flex-1">
                <div
                  className="h-1.5 bg-primary/60 rounded-full"
                  style={{
                    width: `${Math.min(
                      (day.message_count /
                        Math.max(
                          ...reversed.map((d) => d.message_count),
                          1
                        )) *
                        100,
                      100
                    )}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
