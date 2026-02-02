import { useApi } from "../hooks/useApi";
import StatsCard from "../components/StatsCard";
import DonutChart from "../components/DonutChart";
import LoadingSkeleton from "../components/LoadingSkeleton";
import { formatCost, formatTokens } from "../utils/format";
import { getModelColor, shortModelName, TOOLTIP_STYLE, AXIS_STYLE, GRID_STYLE } from "../utils/chart-theme";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface CostWithSavings {
  inputCost: number;
  outputCost: number;
  cacheWriteCost: number;
  cacheReadCost: number;
  totalCost: number;
  costWithoutCache: number;
  cacheSavings: number;
}

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

export default function UsageAnalytics() {
  const { data, loading } = useApi<UsageData>("/api/analytics/usage");

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-lg font-semibold">Usage Analytics</h2>
        <LoadingSkeleton variant="card" count={4} />
        <LoadingSkeleton variant="chart" />
        <LoadingSkeleton variant="table" count={5} />
      </div>
    );
  }

  if (!data) return null;

  const { modelUsage, dailyTokens, totals, costTotals, perModelCosts } = data;

  // Get all model names from daily data
  const allModels = new Set<string>();
  for (const day of dailyTokens) {
    for (const model of Object.keys(day.tokensByModel)) {
      allModels.add(model);
    }
  }
  const modelList = [...allModels];

  // Build chart data
  const chartData = dailyTokens.map((day) => {
    const entry: Record<string, any> = { date: day.date };
    for (const model of modelList) {
      entry[shortModelName(model)] = day.tokensByModel[model] ?? 0;
    }
    return entry;
  });

  // Cost by model donut data
  const costDonut = Object.entries(perModelCosts || {}).map(([model, cost]) => ({
    name: shortModelName(model),
    value: cost.totalCost,
    color: getModelColor(model),
  }));

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Usage Analytics</h2>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard
          label="Input Tokens"
          value={formatTokens(totals.inputTokens)}
          sub={costTotals ? `${formatCost(costTotals.inputCost)} cost` : undefined}
        />
        <StatsCard
          label="Output Tokens"
          value={formatTokens(totals.outputTokens)}
          sub={costTotals ? `${formatCost(costTotals.outputCost)} cost` : undefined}
        />
        <StatsCard
          label="Cache Read"
          value={formatTokens(totals.cacheReadTokens)}
          sub={costTotals ? `${formatCost(costTotals.cacheReadCost)} cost` : undefined}
        />
        <StatsCard
          label="Cache Hit Rate"
          value={`${(totals.cacheHitRate * 100).toFixed(1)}%`}
          accent="#10b981"
          sub={costTotals ? `${formatCost(costTotals.cacheSavings)} saved` : undefined}
        />
      </div>

      {/* Cost by model donut */}
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

      {/* Daily tokens chart */}
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

      {/* Model breakdown table */}
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
