import { Hono } from "hono";
import { getDb } from "../db";
import { calculateCost, aggregateCosts, type CostWithSavings } from "../pricing";

const app = new Hono();

app.get("/", (c) => {
  const db = getDb();

  const stats: Record<string, string> = {};
  const rows = db.prepare("SELECT key, value FROM stats_cache").all() as {
    key: string;
    value: string;
  }[];
  for (const row of rows) {
    if (row.key !== "raw") {
      stats[row.key] = row.value;
    }
  }

  const recentSessions = db
    .prepare(
      `SELECT s.id, s.summary, s.first_prompt, s.message_count, s.created_at, s.modified_at, s.git_branch, s.slug, s.is_sidechain,
              p.display_name as project_name, p.path as project_path
       FROM sessions s
       LEFT JOIN projects p ON s.project_id = p.id
       ORDER BY s.modified_at DESC
       LIMIT 20`
    )
    .all();

  const projectCount = db
    .prepare("SELECT COUNT(*) as cnt FROM projects")
    .get() as { cnt: number };

  const sessionCount = db
    .prepare("SELECT COUNT(*) as cnt FROM sessions")
    .get() as { cnt: number };

  const messageCount = db
    .prepare("SELECT COUNT(*) as cnt FROM messages")
    .get() as { cnt: number };

  const toolUseCount = db
    .prepare("SELECT COUNT(*) as cnt FROM tool_uses")
    .get() as { cnt: number };

  const dailyActivity = db
    .prepare(
      "SELECT date, message_count, session_count, tool_call_count FROM daily_stats ORDER BY date"
    )
    .all();

  // Cost summary from modelUsage in stats_cache
  let costSummary: CostWithSavings | null = null;
  const modelUsage = stats.modelUsage ? JSON.parse(stats.modelUsage) : {};
  const costList: CostWithSavings[] = [];
  for (const [model, usage] of Object.entries(modelUsage) as [string, any][]) {
    costList.push(
      calculateCost(
        model,
        usage.inputTokens || 0,
        usage.outputTokens || 0,
        usage.cacheCreationInputTokens || 0,
        usage.cacheReadInputTokens || 0
      )
    );
  }
  if (costList.length > 0) {
    costSummary = aggregateCosts(costList);
  }

  // Daily cost sparkline (last 30 days)
  const dailyCostRows = db
    .prepare(
      `SELECT DATE(timestamp) as date, model,
              SUM(input_tokens) as input_tokens,
              SUM(output_tokens) as output_tokens,
              SUM(cache_creation_tokens) as cache_creation_tokens,
              SUM(cache_read_tokens) as cache_read_tokens
       FROM messages
       WHERE timestamp IS NOT NULL AND model IS NOT NULL AND model != ''
         AND DATE(timestamp) >= DATE('now', '-30 days')
       GROUP BY date, model
       ORDER BY date`
    )
    .all() as {
    date: string;
    model: string;
    input_tokens: number;
    output_tokens: number;
    cache_creation_tokens: number;
    cache_read_tokens: number;
  }[];

  const dailyCostMap = new Map<string, number>();
  for (const row of dailyCostRows) {
    const cost = calculateCost(
      row.model,
      row.input_tokens ?? 0,
      row.output_tokens ?? 0,
      row.cache_creation_tokens ?? 0,
      row.cache_read_tokens ?? 0
    );
    dailyCostMap.set(
      row.date,
      (dailyCostMap.get(row.date) || 0) + cost.totalCost
    );
  }

  const dailyCostSparkline = [...dailyCostMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, cost]) => cost);

  return c.json({
    stats: {
      totalSessions: parseInt(stats.totalSessions || "0"),
      totalMessages: parseInt(stats.totalMessages || "0"),
      firstSessionDate: stats.firstSessionDate || null,
      lastComputedDate: stats.lastComputedDate || null,
      longestSession: stats.longestSession
        ? JSON.parse(stats.longestSession)
        : null,
      hourCounts: stats.hourCounts ? JSON.parse(stats.hourCounts) : {},
      modelUsage: stats.modelUsage ? JSON.parse(stats.modelUsage) : {},
    },
    counts: {
      projects: projectCount.cnt,
      sessions: sessionCount.cnt,
      indexedMessages: messageCount.cnt,
      toolUses: toolUseCount.cnt,
    },
    recentSessions,
    dailyActivity,
    costSummary,
    dailyCostSparkline,
  });
});

export default app;
