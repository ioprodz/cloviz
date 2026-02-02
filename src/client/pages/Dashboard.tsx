import { useApi } from "../hooks/useApi";
import { useWebSocket } from "../hooks/useWebSocket";
import StatsCard from "../components/StatsCard";
import ActivityHeatmap from "../components/ActivityHeatmap";
import SessionList from "../components/SessionList";
import LoadingSkeleton from "../components/LoadingSkeleton";
import { formatCost, formatTrend } from "../utils/format";
import { getModelColor, shortModelName } from "../utils/chart-theme";

interface CostWithSavings {
  inputCost: number;
  outputCost: number;
  cacheWriteCost: number;
  cacheReadCost: number;
  totalCost: number;
  costWithoutCache: number;
  cacheSavings: number;
}

interface DashboardData {
  stats: {
    totalSessions: number;
    totalMessages: number;
    firstSessionDate: string | null;
    lastComputedDate: string | null;
    longestSession: { sessionId: string; duration: number; messageCount: number } | null;
    hourCounts: Record<string, number>;
    modelUsage: Record<string, {
      inputTokens: number;
      outputTokens: number;
      cacheReadInputTokens: number;
      cacheCreationInputTokens: number;
    }>;
  };
  counts: {
    projects: number;
    sessions: number;
    indexedMessages: number;
    toolUses: number;
  };
  recentSessions: any[];
  dailyActivity: any[];
  costSummary: CostWithSavings | null;
  dailyCostSparkline: number[];
}

export default function Dashboard() {
  const { data, loading, refetch } = useApi<DashboardData>("/api/dashboard");

  useWebSocket("stats:updated", refetch);
  useWebSocket("session:updated", refetch);

  if (loading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton variant="card" count={4} />
        <LoadingSkeleton variant="chart" />
        <LoadingSkeleton variant="table" count={5} />
      </div>
    );
  }

  if (!data) return null;

  const { stats, counts, recentSessions, dailyActivity, costSummary, dailyCostSparkline } = data;

  // Compute trend from dailyActivity: last 7d vs prior 7d message counts
  const activityDays = dailyActivity || [];
  const last7 = activityDays.slice(-7);
  const prior7 = activityDays.slice(-14, -7);
  const last7msgs = last7.reduce((s: number, d: any) => s + (d.message_count || 0), 0);
  const prior7msgs = prior7.reduce((s: number, d: any) => s + (d.message_count || 0), 0);
  const msgTrend = formatTrend(last7msgs, prior7msgs);

  // Model breakdown
  const models = Object.entries(stats.modelUsage || {}).map(
    ([name, usage]) => ({
      name: shortModelName(name),
      fullName: name,
      input: usage.inputTokens,
      output: usage.outputTokens,
      cacheRead: usage.cacheReadInputTokens,
      cacheCreation: usage.cacheCreationInputTokens,
      total: usage.inputTokens + usage.outputTokens,
    })
  );

  const totalTokens = models.reduce(
    (acc, m) => acc + m.cacheRead + m.cacheCreation + m.input + m.output,
    0
  );

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard
          label="Total Spend"
          value={costSummary ? formatCost(costSummary.totalCost) : "$0.00"}
          sparkData={dailyCostSparkline}
          sub={costSummary ? `${formatCost(costSummary.cacheSavings)} saved` : undefined}
        />
        <StatsCard
          label="Total Sessions"
          value={stats.totalSessions}
          sub={`${counts.projects} projects`}
        />
        <StatsCard
          label="Total Messages"
          value={stats.totalMessages}
          sub={`${counts.indexedMessages.toLocaleString()} indexed`}
          trend={msgTrend}
        />
        <StatsCard
          label="Tool Calls"
          value={counts.toolUses}
          sub="indexed in DB"
        />
      </div>

      {/* Model Usage */}
      <div className="bg-surface-light rounded-xl p-5 border border-border">
        <h3 className="text-sm font-medium text-gray-400 mb-3">
          Model Usage
        </h3>
        <div className="space-y-2">
          {models.map((m) => {
            const allTok = m.cacheRead + m.cacheCreation + m.input + m.output;
            const pct = totalTokens > 0 ? (allTok / totalTokens) * 100 : 0;
            return (
              <div key={m.fullName} className="flex items-center gap-3">
                <div className="text-xs text-gray-300 w-40 truncate font-mono">
                  {m.name}
                </div>
                <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: getModelColor(m.fullName),
                    }}
                  />
                </div>
                <div className="text-xs text-gray-500 w-24 text-right">
                  {(allTok / 1e6).toFixed(1)}M tok
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Activity Heatmap */}
      <div className="bg-surface-light rounded-xl p-5 border border-border">
        <h3 className="text-sm font-medium text-gray-400 mb-3">
          Activity (Last 365 Days)
        </h3>
        <ActivityHeatmap data={dailyActivity} />
      </div>

      {/* Recent Sessions */}
      <div className="bg-surface-light rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h3 className="text-sm font-medium text-gray-400">
            Recent Sessions
          </h3>
        </div>
        <SessionList sessions={recentSessions} compact />
      </div>
    </div>
  );
}
