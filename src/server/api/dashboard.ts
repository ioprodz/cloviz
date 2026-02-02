import { Hono } from "hono";
import { getDb } from "../db";
import { calculateCost, aggregateCosts, type CostWithSavings } from "../pricing";

const app = new Hono();

app.get("/", (c) => {
  const db = getDb();
  const projectId = c.req.query("project_id");

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

  const recentSessions = projectId
    ? db
        .prepare(
          `SELECT s.id, s.summary, s.first_prompt, s.message_count, s.created_at, s.modified_at, s.git_branch, s.slug, s.is_sidechain,
                  p.display_name as project_name, p.path as project_path
           FROM sessions s
           LEFT JOIN projects p ON s.project_id = p.id
           WHERE s.project_id = ?
           ORDER BY s.modified_at DESC
           LIMIT 20`
        )
        .all(projectId)
    : db
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

  const sessionCount = projectId
    ? (db
        .prepare("SELECT COUNT(*) as cnt FROM sessions WHERE project_id = ?")
        .get(projectId) as { cnt: number })
    : (db.prepare("SELECT COUNT(*) as cnt FROM sessions").get() as {
        cnt: number;
      });

  const messageCount = projectId
    ? (db
        .prepare(
          "SELECT COUNT(*) as cnt FROM messages m JOIN sessions s ON m.session_id = s.id WHERE s.project_id = ?"
        )
        .get(projectId) as { cnt: number })
    : (db.prepare("SELECT COUNT(*) as cnt FROM messages").get() as {
        cnt: number;
      });

  const toolUseCount = projectId
    ? (db
        .prepare(
          "SELECT COUNT(*) as cnt FROM tool_uses t JOIN sessions s ON t.session_id = s.id WHERE s.project_id = ?"
        )
        .get(projectId) as { cnt: number })
    : (db.prepare("SELECT COUNT(*) as cnt FROM tool_uses").get() as {
        cnt: number;
      });

  let dailyActivity;
  if (projectId) {
    // Compute from messages and tool_uses joined through sessions
    dailyActivity = db
      .prepare(
        `SELECT date,
                SUM(message_count) as message_count,
                COUNT(*) as session_count,
                SUM(tool_count) as tool_call_count
         FROM (
           SELECT DATE(s.created_at) as date,
                  (SELECT COUNT(*) FROM messages m WHERE m.session_id = s.id) as message_count,
                  (SELECT COUNT(*) FROM tool_uses t WHERE t.session_id = s.id) as tool_count
           FROM sessions s
           WHERE s.project_id = ?
         )
         GROUP BY date
         ORDER BY date`
      )
      .all(projectId);
  } else {
    dailyActivity = db
      .prepare(
        "SELECT date, message_count, session_count, tool_call_count FROM daily_stats ORDER BY date"
      )
      .all();
  }

  // Cost summary from modelUsage in stats_cache
  let costSummary: CostWithSavings | null = null;
  if (projectId) {
    // Compute costs from messages for this project
    const projectModelRows = db
      .prepare(
        `SELECT m.model,
                SUM(m.input_tokens) as input_tokens,
                SUM(m.output_tokens) as output_tokens,
                SUM(m.cache_creation_tokens) as cache_creation_tokens,
                SUM(m.cache_read_tokens) as cache_read_tokens
         FROM messages m
         JOIN sessions s ON m.session_id = s.id
         WHERE s.project_id = ? AND m.model IS NOT NULL AND m.model != ''
         GROUP BY m.model`
      )
      .all(projectId) as {
      model: string;
      input_tokens: number;
      output_tokens: number;
      cache_creation_tokens: number;
      cache_read_tokens: number;
    }[];
    const costList: CostWithSavings[] = [];
    for (const row of projectModelRows) {
      costList.push(
        calculateCost(
          row.model,
          row.input_tokens ?? 0,
          row.output_tokens ?? 0,
          row.cache_creation_tokens ?? 0,
          row.cache_read_tokens ?? 0
        )
      );
    }
    if (costList.length > 0) {
      costSummary = aggregateCosts(costList);
    }
  } else {
    const modelUsage = stats.modelUsage ? JSON.parse(stats.modelUsage) : {};
    const costList: CostWithSavings[] = [];
    for (const [model, usage] of Object.entries(modelUsage) as [
      string,
      any,
    ][]) {
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
  }

  // Daily cost sparkline (last 30 days)
  const projectCostJoin = projectId
    ? "JOIN sessions s ON m.session_id = s.id"
    : "";
  const projectCostWhere = projectId ? "AND s.project_id = ?" : "";
  const projectCostParams = projectId ? [projectId] : [];

  const dailyCostRows = db
    .prepare(
      `SELECT DATE(m.timestamp) as date, m.model,
              SUM(m.input_tokens) as input_tokens,
              SUM(m.output_tokens) as output_tokens,
              SUM(m.cache_creation_tokens) as cache_creation_tokens,
              SUM(m.cache_read_tokens) as cache_read_tokens
       FROM messages m
       ${projectCostJoin}
       WHERE m.timestamp IS NOT NULL AND m.model IS NOT NULL AND m.model != ''
         AND DATE(m.timestamp) >= DATE('now', '-30 days')
         ${projectCostWhere}
       GROUP BY date, m.model
       ORDER BY date`
    )
    .all(...projectCostParams) as {
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
