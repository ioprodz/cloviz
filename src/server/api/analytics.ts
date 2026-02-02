import { Hono } from "hono";
import { getDb } from "../db";
import { calculateCost, aggregateCosts, type CostWithSavings } from "../pricing";

const app = new Hono();

// Token usage and cost analytics
app.get("/usage", (c) => {
  const db = getDb();

  const modelUsageRaw = db
    .prepare("SELECT value FROM stats_cache WHERE key = 'modelUsage'")
    .get() as { value: string } | null;

  const modelUsage = modelUsageRaw ? JSON.parse(modelUsageRaw.value) : {};

  const dailyTokens = db
    .prepare(
      "SELECT date, tokens_by_model FROM daily_stats WHERE tokens_by_model != '{}' ORDER BY date"
    )
    .all()
    .map((row: any) => ({
      date: row.date,
      tokensByModel: JSON.parse(row.tokens_by_model),
    }));

  // Compute totals from model usage
  let totalInput = 0;
  let totalOutput = 0;
  let totalCacheRead = 0;
  let totalCacheCreation = 0;

  for (const [model, usage] of Object.entries(modelUsage) as [
    string,
    any,
  ][]) {
    totalInput += usage.inputTokens || 0;
    totalOutput += usage.outputTokens || 0;
    totalCacheRead += usage.cacheReadInputTokens || 0;
    totalCacheCreation += usage.cacheCreationInputTokens || 0;
  }

  const cacheHitRate =
    totalCacheRead + totalCacheCreation > 0
      ? totalCacheRead / (totalCacheRead + totalCacheCreation + totalInput)
      : 0;

  // Cost data per model
  const costList: CostWithSavings[] = [];
  const perModelCosts: Record<string, CostWithSavings> = {};
  for (const [model, usage] of Object.entries(modelUsage) as [string, any][]) {
    const cost = calculateCost(
      model,
      usage.inputTokens || 0,
      usage.outputTokens || 0,
      usage.cacheCreationInputTokens || 0,
      usage.cacheReadInputTokens || 0
    );
    perModelCosts[model] = cost;
    costList.push(cost);
  }

  const costTotals = costList.length > 0 ? aggregateCosts(costList) : null;

  return c.json({
    modelUsage,
    dailyTokens,
    totals: {
      inputTokens: totalInput,
      outputTokens: totalOutput,
      cacheReadTokens: totalCacheRead,
      cacheCreationTokens: totalCacheCreation,
      cacheHitRate,
    },
    costTotals,
    perModelCosts,
  });
});

// Tool usage analytics
app.get("/tools", (c) => {
  const db = getDb();

  const topTools = db
    .prepare(
      `SELECT tool_name, COUNT(*) as count
       FROM tool_uses
       GROUP BY tool_name
       ORDER BY count DESC
       LIMIT 20`
    )
    .all();

  // Tool usage by session (top 10 sessions by tool use)
  const toolsBySession = db
    .prepare(
      `SELECT t.session_id, s.slug, s.first_prompt, COUNT(*) as tool_count
       FROM tool_uses t
       LEFT JOIN sessions s ON t.session_id = s.id
       GROUP BY t.session_id
       ORDER BY tool_count DESC
       LIMIT 10`
    )
    .all();

  // Daily tool usage
  const dailyTools = db
    .prepare(
      `SELECT DATE(timestamp) as date, tool_name, COUNT(*) as count
       FROM tool_uses
       WHERE timestamp IS NOT NULL
       GROUP BY date, tool_name
       ORDER BY date`
    )
    .all();

  return c.json({ topTools, toolsBySession, dailyTools });
});

// Hourly activity patterns
app.get("/hourly", (c) => {
  const db = getDb();

  const hourCountsRaw = db
    .prepare("SELECT value FROM stats_cache WHERE key = 'hourCounts'")
    .get() as { value: string } | null;

  const hourCounts = hourCountsRaw ? JSON.parse(hourCountsRaw.value) : {};

  // Day of week distribution from history
  const dayOfWeek = db
    .prepare(
      `SELECT
        CAST(strftime('%w', datetime(timestamp/1000, 'unixepoch')) AS INTEGER) as dow,
        COUNT(*) as count
       FROM history_entries
       WHERE timestamp > 0
       GROUP BY dow
       ORDER BY dow`
    )
    .all();

  // Hour × day heatmap from history
  const heatmap = db
    .prepare(
      `SELECT
        CAST(strftime('%w', datetime(timestamp/1000, 'unixepoch')) AS INTEGER) as dow,
        CAST(strftime('%H', datetime(timestamp/1000, 'unixepoch')) AS INTEGER) as hour,
        COUNT(*) as count
       FROM history_entries
       WHERE timestamp > 0
       GROUP BY dow, hour`
    )
    .all();

  return c.json({ hourCounts, dayOfWeek, heatmap });
});

export default app;
