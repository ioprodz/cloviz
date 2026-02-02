import { Hono } from "hono";
import { getDb } from "../db";
import { calculateCost, aggregateCosts, type CostWithSavings } from "../pricing";

const app = new Hono();

app.get("/", (c) => {
  const db = getDb();

  const projects = db
    .prepare(
      `SELECT p.*,
              MIN(s.created_at) as first_session,
              MAX(s.modified_at) as last_session,
              GROUP_CONCAT(DISTINCT s.git_branch) as branches
       FROM projects p
       LEFT JOIN sessions s ON s.project_id = p.id
       GROUP BY p.id
       ORDER BY last_session DESC`
    )
    .all();

  return c.json({ projects });
});

// Bulk per-project cost summary — must be before /:id
app.get("/costs", (c) => {
  const db = getDb();

  const rows = db
    .prepare(
      `SELECT p.id as project_id, m.model,
              SUM(m.input_tokens) as input_tokens,
              SUM(m.output_tokens) as output_tokens,
              SUM(m.cache_creation_tokens) as cache_creation_tokens,
              SUM(m.cache_read_tokens) as cache_read_tokens
       FROM messages m
       JOIN sessions s ON m.session_id = s.id
       JOIN projects p ON s.project_id = p.id
       WHERE m.model IS NOT NULL AND m.model != ''
       GROUP BY p.id, m.model`
    )
    .all() as {
    project_id: number;
    model: string;
    input_tokens: number;
    output_tokens: number;
    cache_creation_tokens: number;
    cache_read_tokens: number;
  }[];

  const projectCosts: Record<number, CostWithSavings> = {};
  const projectCostLists: Record<number, CostWithSavings[]> = {};

  for (const row of rows) {
    const cost = calculateCost(
      row.model,
      row.input_tokens ?? 0,
      row.output_tokens ?? 0,
      row.cache_creation_tokens ?? 0,
      row.cache_read_tokens ?? 0
    );
    if (!projectCostLists[row.project_id]) {
      projectCostLists[row.project_id] = [];
    }
    projectCostLists[row.project_id].push(cost);
  }

  for (const [pid, costs] of Object.entries(projectCostLists)) {
    projectCosts[Number(pid)] = aggregateCosts(costs);
  }

  return c.json(projectCosts);
});

app.get("/:id", (c) => {
  const db = getDb();
  const id = c.req.param("id");

  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  const sessions = db
    .prepare(
      `SELECT id, summary, first_prompt, message_count, created_at, modified_at, git_branch, slug, is_sidechain
       FROM sessions WHERE project_id = ?
       ORDER BY modified_at DESC`
    )
    .all(id);

  return c.json({ project, sessions });
});

// Per-project deep analytics
app.get("/:id/analytics", (c) => {
  const db = getDb();
  const id = c.req.param("id");

  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  // Per-model costs for this project
  const modelRows = db
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
    .all(id) as {
    model: string;
    input_tokens: number;
    output_tokens: number;
    cache_creation_tokens: number;
    cache_read_tokens: number;
  }[];

  const modelBreakdown: Record<string, CostWithSavings> = {};
  const allCosts: CostWithSavings[] = [];

  for (const row of modelRows) {
    const cost = calculateCost(
      row.model,
      row.input_tokens ?? 0,
      row.output_tokens ?? 0,
      row.cache_creation_tokens ?? 0,
      row.cache_read_tokens ?? 0
    );
    modelBreakdown[row.model] = cost;
    allCosts.push(cost);
  }

  const costs = aggregateCosts(allCosts);

  // Daily costs for this project
  const dailyRows = db
    .prepare(
      `SELECT DATE(m.timestamp) as date,
              SUM(m.input_tokens) as input_tokens,
              SUM(m.output_tokens) as output_tokens,
              SUM(m.cache_creation_tokens) as cache_creation_tokens,
              SUM(m.cache_read_tokens) as cache_read_tokens,
              m.model
       FROM messages m
       JOIN sessions s ON m.session_id = s.id
       WHERE s.project_id = ? AND m.timestamp IS NOT NULL AND m.model IS NOT NULL AND m.model != ''
       GROUP BY date, m.model
       ORDER BY date`
    )
    .all(id) as {
    date: string;
    model: string;
    input_tokens: number;
    output_tokens: number;
    cache_creation_tokens: number;
    cache_read_tokens: number;
  }[];

  const dailyMap = new Map<string, { date: string; totalCost: number; inputCost: number; outputCost: number; cacheWriteCost: number; cacheReadCost: number }>();
  for (const row of dailyRows) {
    const cost = calculateCost(
      row.model,
      row.input_tokens ?? 0,
      row.output_tokens ?? 0,
      row.cache_creation_tokens ?? 0,
      row.cache_read_tokens ?? 0
    );
    const existing = dailyMap.get(row.date);
    if (existing) {
      existing.totalCost += cost.totalCost;
      existing.inputCost += cost.inputCost;
      existing.outputCost += cost.outputCost;
      existing.cacheWriteCost += cost.cacheWriteCost;
      existing.cacheReadCost += cost.cacheReadCost;
    } else {
      dailyMap.set(row.date, {
        date: row.date,
        totalCost: cost.totalCost,
        inputCost: cost.inputCost,
        outputCost: cost.outputCost,
        cacheWriteCost: cost.cacheWriteCost,
        cacheReadCost: cost.cacheReadCost,
      });
    }
  }
  const dailyCosts = [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date));

  // Top 10 sessions by cost
  const sessionRows = db
    .prepare(
      `SELECT s.id, s.summary, s.first_prompt, s.slug, s.message_count, s.created_at,
              m.model,
              SUM(m.input_tokens) as input_tokens,
              SUM(m.output_tokens) as output_tokens,
              SUM(m.cache_creation_tokens) as cache_creation_tokens,
              SUM(m.cache_read_tokens) as cache_read_tokens
       FROM sessions s
       JOIN messages m ON m.session_id = s.id
       WHERE s.project_id = ? AND m.model IS NOT NULL AND m.model != ''
       GROUP BY s.id, m.model`
    )
    .all(id) as {
    id: string;
    summary: string;
    first_prompt: string;
    slug: string;
    message_count: number;
    created_at: string;
    model: string;
    input_tokens: number;
    output_tokens: number;
    cache_creation_tokens: number;
    cache_read_tokens: number;
  }[];

  // Aggregate per session
  const sessionCostMap = new Map<
    string,
    { id: string; summary: string; first_prompt: string; slug: string; message_count: number; created_at: string; costs: CostWithSavings[] }
  >();
  for (const row of sessionRows) {
    const cost = calculateCost(
      row.model,
      row.input_tokens ?? 0,
      row.output_tokens ?? 0,
      row.cache_creation_tokens ?? 0,
      row.cache_read_tokens ?? 0
    );
    const existing = sessionCostMap.get(row.id);
    if (existing) {
      existing.costs.push(cost);
    } else {
      sessionCostMap.set(row.id, {
        id: row.id,
        summary: row.summary,
        first_prompt: row.first_prompt,
        slug: row.slug,
        message_count: row.message_count,
        created_at: row.created_at,
        costs: [cost],
      });
    }
  }

  const topSessionsByCost = [...sessionCostMap.values()]
    .map((s) => ({
      id: s.id,
      summary: s.summary,
      first_prompt: s.first_prompt,
      slug: s.slug,
      message_count: s.message_count,
      created_at: s.created_at,
      cost: aggregateCosts(s.costs),
    }))
    .sort((a, b) => b.cost.totalCost - a.cost.totalCost)
    .slice(0, 10);

  // Tool distribution for this project
  const toolDistribution = db
    .prepare(
      `SELECT t.tool_name, COUNT(*) as count
       FROM tool_uses t
       JOIN sessions s ON t.session_id = s.id
       WHERE s.project_id = ?
       GROUP BY t.tool_name
       ORDER BY count DESC
       LIMIT 15`
    )
    .all(id);

  // Session/message counts
  const sessionCount = db
    .prepare("SELECT COUNT(*) as cnt FROM sessions WHERE project_id = ?")
    .get(id) as { cnt: number };

  const messageCount = db
    .prepare(
      "SELECT COUNT(*) as cnt FROM messages m JOIN sessions s ON m.session_id = s.id WHERE s.project_id = ?"
    )
    .get(id) as { cnt: number };

  return c.json({
    project,
    costs,
    modelBreakdown,
    dailyCosts,
    topSessionsByCost,
    toolDistribution,
    sessionCount: sessionCount.cnt,
    messageCount: messageCount.cnt,
  });
});

// Get plans linked to a project (via tool_uses across all project sessions)
app.get("/:id/plans", (c) => {
  const db = getDb();
  const id = c.req.param("id");

  const project = db.prepare("SELECT id FROM projects WHERE id = ?").get(id);
  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  const toolUseRows = db
    .prepare(
      `SELECT DISTINCT tu.input_json, tu.session_id
       FROM tool_uses tu JOIN sessions s ON tu.session_id = s.id
       WHERE s.project_id = ? AND tu.tool_name IN ('Write','Edit','MultiEdit','Read')
       AND tu.input_json LIKE '%/.claude/plans/%.md%'`
    )
    .all(id) as { input_json: string; session_id: string }[];

  // Extract filenames and track which sessions reference each plan
  const planSessionMap = new Map<string, Set<string>>();
  const planPathRegex = /\.claude\/plans\/([^/]+\.md)/;
  for (const row of toolUseRows) {
    try {
      const input = JSON.parse(row.input_json || "{}");
      const pathValue = input.file_path || input.path || "";
      const match = pathValue.match(planPathRegex);
      if (match) {
        const filename = match[1];
        if (!planSessionMap.has(filename)) {
          planSessionMap.set(filename, new Set());
        }
        planSessionMap.get(filename)!.add(row.session_id);
      }
    } catch {
      continue;
    }
  }

  if (planSessionMap.size === 0) {
    return c.json({ plans: [] });
  }

  const filenames = [...planSessionMap.keys()];
  const placeholders = filenames.map(() => "?").join(",");
  const planRows = db
    .prepare(
      `SELECT id, filename, content, mtime FROM plans
       WHERE filename IN (${placeholders}) ORDER BY mtime DESC`
    )
    .all(...filenames) as { id: number; filename: string; content: string; mtime: number }[];

  const plans = planRows.map((p) => ({
    ...p,
    session_ids: [...(planSessionMap.get(p.filename) ?? [])],
  }));

  return c.json({ plans });
});

// Get todos for a project (aggregated across all project sessions)
app.get("/:id/todos", (c) => {
  const db = getDb();
  const id = c.req.param("id");

  const project = db.prepare("SELECT id FROM projects WHERE id = ?").get(id);
  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  const todos = db
    .prepare(
      `SELECT t.*, s.summary as session_summary, s.slug as session_slug
       FROM todos t JOIN sessions s ON t.session_id = s.id
       WHERE s.project_id = ? ORDER BY t.id DESC`
    )
    .all(id);

  const statusCounts = db
    .prepare(
      `SELECT t.status, COUNT(*) as count FROM todos t
       JOIN sessions s ON t.session_id = s.id WHERE s.project_id = ?
       GROUP BY t.status`
    )
    .all(id);

  return c.json({ todos, statusCounts });
});

export default app;
