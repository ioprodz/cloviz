import { useParams, Link } from "react-router-dom";
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

interface ProjectAnalytics {
  project: {
    id: number;
    path: string;
    display_name: string;
  };
  costs: CostWithSavings;
  modelBreakdown: Record<string, CostWithSavings>;
  dailyCosts: {
    date: string;
    totalCost: number;
    inputCost: number;
    outputCost: number;
    cacheWriteCost: number;
    cacheReadCost: number;
  }[];
  topSessionsByCost: {
    id: string;
    summary: string;
    first_prompt: string;
    slug: string;
    message_count: number;
    created_at: string;
    cost: CostWithSavings;
  }[];
  toolDistribution: { tool_name: string; count: number }[];
  sessionCount: number;
  messageCount: number;
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, loading } = useApi<ProjectAnalytics>(
    `/api/projects/${id}/analytics`,
    [id]
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton variant="card" count={4} />
        <LoadingSkeleton variant="chart" />
      </div>
    );
  }

  if (!data) return null;

  const {
    project,
    costs,
    modelBreakdown,
    dailyCosts,
    topSessionsByCost,
    toolDistribution,
    sessionCount,
    messageCount,
  } = data;

  const savingsPct =
    costs.costWithoutCache > 0
      ? ((costs.cacheSavings / costs.costWithoutCache) * 100).toFixed(0)
      : "0";

  const modelDonut = Object.entries(modelBreakdown).map(([model, cost]) => ({
    name: shortModelName(model),
    value: cost.totalCost,
    color: getModelColor(model),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-surface-light rounded-xl p-5 border border-border">
        <Link
          to="/projects"
          className="text-xs text-gray-500 hover:text-gray-400"
        >
          &larr; Back to projects
        </Link>
        <h2 className="text-lg font-semibold mt-1">{project.display_name}</h2>
        <div className="text-xs text-gray-500 mt-1">{project.path}</div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard
          label="Total Cost"
          value={formatCost(costs.totalCost)}
        />
        <StatsCard label="Sessions" value={sessionCount} />
        <StatsCard
          label="Messages"
          value={messageCount.toLocaleString()}
        />
        <StatsCard
          label="Cache Savings"
          value={formatCost(costs.cacheSavings)}
          sub={`${savingsPct}% saved`}
          accent="#10b981"
        />
      </div>

      {/* Daily cost chart */}
      {dailyCosts.length > 0 && (
        <div className="bg-surface-light rounded-xl p-5 border border-border">
          <h3 className="text-sm font-medium text-gray-400 mb-4">
            Daily Cost
          </h3>
          <ResponsiveContainer width="100%" height={250}>
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

      {/* Model usage donut + Tool distribution */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-surface-light rounded-xl p-5 border border-border">
          <h3 className="text-sm font-medium text-gray-400 mb-2">
            Cost by Model
          </h3>
          <DonutChart
            data={modelDonut}
            label={formatCost(costs.totalCost)}
            subLabel="total"
            valueFormatter={formatCost}
          />
        </div>

        {toolDistribution.length > 0 && (
          <div className="bg-surface-light rounded-xl p-5 border border-border">
            <h3 className="text-sm font-medium text-gray-400 mb-4">
              Tool Distribution
            </h3>
            <ResponsiveContainer
              width="100%"
              height={Math.max(200, toolDistribution.length * 25)}
            >
              <BarChart
                data={toolDistribution}
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
          </div>
        )}
      </div>

      {/* Top sessions by cost */}
      {topSessionsByCost.length > 0 && (
        <div className="bg-surface-light rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <h3 className="text-sm font-medium text-gray-400">
              Top Sessions by Cost
            </h3>
          </div>
          <div className="divide-y divide-border/50">
            {topSessionsByCost.map((s) => (
              <Link
                key={s.id}
                to={`/sessions/${s.id}`}
                className="block px-5 py-3 hover:bg-surface-lighter/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-300 truncate flex-1 mr-4">
                    {s.summary || s.first_prompt || s.slug || s.id.slice(0, 8)}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-gray-500">
                      {s.message_count} msgs
                    </span>
                    <span className="text-sm font-mono text-primary">
                      {formatCost(s.cost.totalCost)}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
