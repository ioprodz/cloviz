import { Hono } from "hono";
import { getDb } from "../db";
import { calculateCost, aggregateCosts, type CostWithSavings } from "../pricing";

const app = new Hono();

// Token usage and cost analytics
app.get("/usage", (c) => {
  const db = getDb();
  const projectId = c.req.query("project_id");

  let modelUsage: Record<string, { inputTokens: number; outputTokens: number; cacheReadInputTokens: number; cacheCreationInputTokens: number }>;
  let dailyTokens: { date: string; tokensByModel: Record<string, number> }[];

  if (projectId) {
    // Compute from messages table with session join
    const modelRows = db
      .prepare(
        `SELECT m.model,
                SUM(m.input_tokens) as input_tokens,
                SUM(m.output_tokens) as output_tokens,
                SUM(m.cache_read_tokens) as cache_read_tokens,
                SUM(m.cache_creation_tokens) as cache_creation_tokens
         FROM messages m
         JOIN sessions s ON m.session_id = s.id
         WHERE s.project_id = ? AND m.model IS NOT NULL AND m.model != ''
         GROUP BY m.model`
      )
      .all(projectId) as { model: string; input_tokens: number; output_tokens: number; cache_read_tokens: number; cache_creation_tokens: number }[];

    modelUsage = {};
    for (const row of modelRows) {
      modelUsage[row.model] = {
        inputTokens: row.input_tokens ?? 0,
        outputTokens: row.output_tokens ?? 0,
        cacheReadInputTokens: row.cache_read_tokens ?? 0,
        cacheCreationInputTokens: row.cache_creation_tokens ?? 0,
      };
    }

    // Daily tokens by model
    const dailyRows = db
      .prepare(
        `SELECT DATE(m.timestamp) as date, m.model,
                SUM(m.input_tokens + m.output_tokens + m.cache_read_tokens + m.cache_creation_tokens) as total_tokens
         FROM messages m
         JOIN sessions s ON m.session_id = s.id
         WHERE s.project_id = ? AND m.timestamp IS NOT NULL AND m.model IS NOT NULL AND m.model != ''
         GROUP BY date, m.model
         ORDER BY date`
      )
      .all(projectId) as { date: string; model: string; total_tokens: number }[];

    const dailyMap = new Map<string, Record<string, number>>();
    for (const row of dailyRows) {
      if (!dailyMap.has(row.date)) dailyMap.set(row.date, {});
      dailyMap.get(row.date)![row.model] = row.total_tokens ?? 0;
    }
    dailyTokens = [...dailyMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, tokensByModel]) => ({ date, tokensByModel }));
  } else {
    // Fast path: use stats_cache
    const modelUsageRaw = db
      .prepare("SELECT value FROM stats_cache WHERE key = 'modelUsage'")
      .get() as { value: string } | null;

    modelUsage = modelUsageRaw ? JSON.parse(modelUsageRaw.value) : {};

    dailyTokens = db
      .prepare(
        "SELECT date, tokens_by_model FROM daily_stats WHERE tokens_by_model != '{}' ORDER BY date"
      )
      .all()
      .map((row: any) => ({
        date: row.date,
        tokensByModel: JSON.parse(row.tokens_by_model),
      }));
  }

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
  const projectId = c.req.query("project_id");

  const projectJoin = projectId ? "JOIN sessions s ON t.session_id = s.id" : "";
  const projectWhere = projectId ? "AND s.project_id = ?" : "";
  const projectParams = projectId ? [projectId] : [];

  const topTools = db
    .prepare(
      `SELECT t.tool_name, COUNT(*) as count
       FROM tool_uses t
       ${projectJoin}
       WHERE 1=1 ${projectWhere}
       GROUP BY t.tool_name
       ORDER BY count DESC
       LIMIT 20`
    )
    .all(...projectParams);

  // Tool usage by session (top 10 sessions by tool use)
  // This query always joins sessions, just conditionally filter by project
  const sessionProjectWhere = projectId ? "WHERE s.project_id = ?" : "";
  const toolsBySession = db
    .prepare(
      `SELECT t.session_id, s.slug, s.first_prompt, COUNT(*) as tool_count
       FROM tool_uses t
       LEFT JOIN sessions s ON t.session_id = s.id
       ${sessionProjectWhere}
       GROUP BY t.session_id
       ORDER BY tool_count DESC
       LIMIT 10`
    )
    .all(...projectParams);

  // Daily tool usage
  const dailyTools = db
    .prepare(
      `SELECT DATE(t.timestamp) as date, t.tool_name, COUNT(*) as count
       FROM tool_uses t
       ${projectJoin}
       WHERE t.timestamp IS NOT NULL ${projectWhere}
       GROUP BY date, t.tool_name
       ORDER BY date`
    )
    .all(...projectParams);

  return c.json({ topTools, toolsBySession, dailyTools });
});

// Hourly activity patterns
app.get("/hourly", (c) => {
  const db = getDb();
  const projectId = c.req.query("project_id");

  let hourCounts: Record<string, number>;
  let dayOfWeek: any[];
  let heatmap: any[];
  let calendarHeatmap: { date: string; count: number }[];

  if (projectId) {
    // Compute hourCounts from history_entries joined with sessions
    const hourRows = db
      .prepare(
        `SELECT
          CAST(strftime('%H', datetime(h.timestamp/1000, 'unixepoch', 'localtime')) AS INTEGER) as hour,
          COUNT(*) as count
         FROM history_entries h
         JOIN sessions s ON h.session_id = s.id
         WHERE h.timestamp > 0 AND s.project_id = ?
         GROUP BY hour`
      )
      .all(projectId) as { hour: number; count: number }[];

    hourCounts = {};
    for (const row of hourRows) {
      hourCounts[String(row.hour)] = row.count;
    }

    // Day of week distribution
    dayOfWeek = db
      .prepare(
        `SELECT
          CAST(strftime('%w', datetime(h.timestamp/1000, 'unixepoch', 'localtime')) AS INTEGER) as dow,
          COUNT(*) as count
         FROM history_entries h
         JOIN sessions s ON h.session_id = s.id
         WHERE h.timestamp > 0 AND s.project_id = ?
         GROUP BY dow
         ORDER BY dow`
      )
      .all(projectId);

    // Hour × day heatmap
    heatmap = db
      .prepare(
        `SELECT
          CAST(strftime('%w', datetime(h.timestamp/1000, 'unixepoch', 'localtime')) AS INTEGER) as dow,
          CAST(strftime('%H', datetime(h.timestamp/1000, 'unixepoch', 'localtime')) AS INTEGER) as hour,
          COUNT(*) as count
         FROM history_entries h
         JOIN sessions s ON h.session_id = s.id
         WHERE h.timestamp > 0 AND s.project_id = ?
         GROUP BY dow, hour`
      )
      .all(projectId);

    // Calendar heatmap (daily activity for last 52 weeks / 364 days)
    calendarHeatmap = db
      .prepare(
        `SELECT
          DATE(datetime(h.timestamp/1000, 'unixepoch', 'localtime')) as date,
          COUNT(*) as count
         FROM history_entries h
         JOIN sessions s ON h.session_id = s.id
         WHERE h.timestamp > 0 AND s.project_id = ?
           AND DATE(datetime(h.timestamp/1000, 'unixepoch', 'localtime')) >= DATE('now', '-364 days')
         GROUP BY date
         ORDER BY date`
      )
      .all(projectId) as { date: string; count: number }[];
  } else {
    // Fast path: use stats_cache for hourCounts
    const hourCountsRaw = db
      .prepare("SELECT value FROM stats_cache WHERE key = 'hourCounts'")
      .get() as { value: string } | null;

    hourCounts = hourCountsRaw ? JSON.parse(hourCountsRaw.value) : {};

    // Day of week distribution from history
    dayOfWeek = db
      .prepare(
        `SELECT
          CAST(strftime('%w', datetime(timestamp/1000, 'unixepoch', 'localtime')) AS INTEGER) as dow,
          COUNT(*) as count
         FROM history_entries
         WHERE timestamp > 0
         GROUP BY dow
         ORDER BY dow`
      )
      .all();

    // Hour × day heatmap from history
    heatmap = db
      .prepare(
        `SELECT
          CAST(strftime('%w', datetime(timestamp/1000, 'unixepoch', 'localtime')) AS INTEGER) as dow,
          CAST(strftime('%H', datetime(timestamp/1000, 'unixepoch', 'localtime')) AS INTEGER) as hour,
          COUNT(*) as count
         FROM history_entries
         WHERE timestamp > 0
         GROUP BY dow, hour`
      )
      .all();

    // Calendar heatmap (daily activity for last 52 weeks / 364 days)
    calendarHeatmap = db
      .prepare(
        `SELECT
          DATE(datetime(timestamp/1000, 'unixepoch', 'localtime')) as date,
          COUNT(*) as count
         FROM history_entries
         WHERE timestamp > 0
           AND DATE(datetime(timestamp/1000, 'unixepoch', 'localtime')) >= DATE('now', '-364 days')
         GROUP BY date
         ORDER BY date`
      )
      .all() as { date: string; count: number }[];
  }

  return c.json({ hourCounts, dayOfWeek, heatmap, calendarHeatmap });
});

export default app;
