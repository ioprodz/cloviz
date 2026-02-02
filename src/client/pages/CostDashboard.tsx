import { useApi } from "../hooks/useApi";
import StatsCard from "../components/StatsCard";
import DonutChart from "../components/DonutChart";
import LoadingSkeleton from "../components/LoadingSkeleton";
import { formatCost } from "../utils/format";
import { getModelColor, shortModelName, COST_COLORS, TOOLTIP_STYLE, AXIS_STYLE, GRID_STYLE } from "../utils/chart-theme";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
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

export default function CostDashboard() {
  const { data, loading } = useApi<CostData>("/api/analytics/costs");

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-lg font-semibold">Cost Analytics</h2>
        <LoadingSkeleton variant="card" count={4} />
        <LoadingSkeleton variant="chart" />
      </div>
    );
  }

  if (!data) return null;

  const { totals, perModelCosts, dailyCosts, rates } = data;

  // Sparkline data from last 30 daily costs
  const sparkData = dailyCosts.slice(-30).map((d) => d.totalCost);

  // Savings percentage
  const savingsPct =
    totals.costWithoutCache > 0
      ? ((totals.cacheSavings / totals.costWithoutCache) * 100).toFixed(0)
      : "0";

  // Model donut data
  const modelDonut = Object.entries(perModelCosts).map(([model, cost]) => ({
    name: shortModelName(model),
    value: cost.totalCost,
    color: getModelColor(model),
  }));

  // Cost breakdown donut
  const breakdownDonut = [
    { name: "Input", value: totals.inputCost, color: COST_COLORS.input },
    { name: "Output", value: totals.outputCost, color: COST_COLORS.output },
    { name: "Cache Write", value: totals.cacheWriteCost, color: COST_COLORS.cacheWrite },
    { name: "Cache Read", value: totals.cacheReadCost, color: COST_COLORS.cacheRead },
  ];

  // Cache savings comparison bar data
  const savingsBar = [
    { name: "Actual Cost", value: totals.totalCost, fill: "#3b82f6" },
    { name: "Without Caching", value: totals.costWithoutCache, fill: "#6b7280" },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Cost Analytics</h2>

      {/* Row 1: Stats Cards */}
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

      {/* Row 2: Daily Cost Trend */}
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

      {/* Row 3: Two DonutCharts */}
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

      {/* Row 4: Cache Savings Bar */}
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
          Saved {formatCost(totals.cacheSavings)} ({savingsPct}%) through caching
        </div>
      </div>

      {/* Row 5: Per-Model Cost Table */}
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
