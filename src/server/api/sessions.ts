import { Hono } from "hono";
import { getDb } from "../db";
import { parseSessionJsonl } from "../pipeline/session-parser";
import { calculateCost, aggregateCosts, type CostWithSavings } from "../pricing";

const app = new Hono();

// List sessions with filters
app.get("/", (c) => {
  const db = getDb();
  const project = c.req.query("project");
  const branch = c.req.query("branch");
  const limit = parseInt(c.req.query("limit") || "50");
  const offset = parseInt(c.req.query("offset") || "0");
  const sort = c.req.query("sort") || "modified_at";
  const order = c.req.query("order") === "asc" ? "ASC" : "DESC";

  let where = "1=1";
  const params: unknown[] = [];

  if (project) {
    where += " AND p.path = ?";
    params.push(project);
  }

  if (branch) {
    where += " AND s.git_branch = ?";
    params.push(branch);
  }

  const allowedSorts = [
    "created_at",
    "modified_at",
    "message_count",
    "first_prompt",
  ];
  const sortCol = allowedSorts.includes(sort) ? sort : "modified_at";

  const sessions = db
    .prepare(
      `SELECT s.id, s.summary, s.first_prompt, s.message_count, s.created_at, s.modified_at,
              s.git_branch, s.slug, s.is_sidechain, s.indexed_bytes,
              p.display_name as project_name, p.path as project_path
       FROM sessions s
       LEFT JOIN projects p ON s.project_id = p.id
       WHERE ${where}
       ORDER BY s.${sortCol} ${order}
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);

  const total = db
    .prepare(
      `SELECT COUNT(*) as cnt FROM sessions s LEFT JOIN projects p ON s.project_id = p.id WHERE ${where}`
    )
    .get(...params) as { cnt: number };

  return c.json({ sessions, total: total.cnt, limit, offset });
});

// Get single session metadata + cost
app.get("/:id", (c) => {
  const db = getDb();
  const id = c.req.param("id");

  const session = db
    .prepare(
      `SELECT s.*, p.display_name as project_name, p.path as project_path
       FROM sessions s
       LEFT JOIN projects p ON s.project_id = p.id
       WHERE s.id = ?`
    )
    .get(id) as any;

  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  // Compute session cost
  const costRows = db
    .prepare(
      `SELECT model,
              SUM(input_tokens) as input_tokens,
              SUM(output_tokens) as output_tokens,
              SUM(cache_creation_tokens) as cache_creation_tokens,
              SUM(cache_read_tokens) as cache_read_tokens
       FROM messages
       WHERE session_id = ? AND model IS NOT NULL AND model != ''
       GROUP BY model`
    )
    .all(id) as {
    model: string;
    input_tokens: number;
    output_tokens: number;
    cache_creation_tokens: number;
    cache_read_tokens: number;
  }[];

  let sessionCost: CostWithSavings | null = null;
  if (costRows.length > 0) {
    const costs = costRows.map((row) =>
      calculateCost(
        row.model,
        row.input_tokens ?? 0,
        row.output_tokens ?? 0,
        row.cache_creation_tokens ?? 0,
        row.cache_read_tokens ?? 0
      )
    );
    sessionCost = aggregateCosts(costs);
  }

  return c.json({ ...session, sessionCost });
});

// Get session messages (lazy-indexed)
app.get("/:id/messages", (c) => {
  const db = getDb();
  const id = c.req.param("id");
  const limit = parseInt(c.req.query("limit") || "100");
  const offset = parseInt(c.req.query("offset") || "0");

  // Ensure this session's JSONL is indexed
  const session = db
    .prepare("SELECT jsonl_path, indexed_bytes FROM sessions WHERE id = ?")
    .get(id) as { jsonl_path: string; indexed_bytes: number } | null;

  if (session?.jsonl_path) {
    try {
      parseSessionJsonl(db, id, session.jsonl_path);
    } catch {
      // Continue with what we have
    }
  }

  const messages = db
    .prepare(
      `SELECT id, uuid, parent_uuid, type, role, model, content_text, content_json,
              input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, timestamp
       FROM messages
       WHERE session_id = ?
       ORDER BY id ASC
       LIMIT ? OFFSET ?`
    )
    .all(id, limit, offset);

  const total = db
    .prepare("SELECT COUNT(*) as cnt FROM messages WHERE session_id = ?")
    .get(id) as { cnt: number };

  // Get tool uses for these messages
  const messageIds = messages.map((m: any) => m.id);
  let toolUses: any[] = [];
  if (messageIds.length > 0) {
    toolUses = db
      .prepare(
        `SELECT * FROM tool_uses WHERE session_id = ? ORDER BY id ASC`
      )
      .all(id);
  }

  return c.json({ messages, toolUses, total: total.cnt, limit, offset });
});

// Get files touched in a session (from tool_uses)
app.get("/:id/files", (c) => {
  const db = getDb();
  const id = c.req.param("id");

  // Ensure session exists
  const session = db
    .prepare("SELECT id FROM sessions WHERE id = ?")
    .get(id);
  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  const toolUses = db
    .prepare(
      `SELECT tool_name, input_json, message_id, timestamp
       FROM tool_uses
       WHERE session_id = ? AND tool_name IN ('Read', 'Write', 'Edit', 'MultiEdit')
       ORDER BY timestamp ASC`
    )
    .all(id) as {
    tool_name: string;
    input_json: string;
    message_id: number;
    timestamp: number;
  }[];

  const fileMap = new Map<
    string,
    { tool: string; message_id: number; timestamp: number }[]
  >();

  for (const tu of toolUses) {
    let filePath: string | null = null;
    try {
      const input = JSON.parse(tu.input_json || "{}");
      filePath = input.file_path || input.path || null;
    } catch {
      continue;
    }
    if (!filePath) continue;

    if (!fileMap.has(filePath)) {
      fileMap.set(filePath, []);
    }
    fileMap.get(filePath)!.push({
      tool: tu.tool_name,
      message_id: tu.message_id,
      timestamp: tu.timestamp,
    });
  }

  const files = [...fileMap.entries()]
    .map(([path, operations]) => ({ path, operations }))
    .sort((a, b) => a.path.localeCompare(b.path));

  return c.json({ files });
});

// Tool usage timeline bucketed by message sequence
app.get("/:id/tool-timeline", (c) => {
  const db = getDb();
  const id = c.req.param("id");

  // Get message IDs in order to establish sequence positions
  const messages = db
    .prepare(`SELECT id FROM messages WHERE session_id = ? ORDER BY id ASC`)
    .all(id) as { id: number }[];

  if (messages.length === 0) {
    return c.json({
      buckets: [],
      totals: { read: 0, write: 0, bash: 0, search: 0, other: 0 },
    });
  }

  // Map message_id to sequence index
  const msgSeq = new Map<number, number>();
  messages.forEach((m, i) => msgSeq.set(m.id, i));

  // Get all tool uses
  const toolUses = db
    .prepare(
      `SELECT tool_name, message_id FROM tool_uses WHERE session_id = ? ORDER BY id ASC`
    )
    .all(id) as { tool_name: string; message_id: number }[];

  const totalMessages = messages.length;
  const bucketCount = Math.min(30, totalMessages);
  const bucketSize = totalMessages / bucketCount;

  type Category = "read" | "write" | "bash" | "search" | "other";
  const categorize = (name: string): Category => {
    switch (name) {
      case "Read":
        return "read";
      case "Write":
      case "Edit":
      case "MultiEdit":
        return "write";
      case "Bash":
        return "bash";
      case "Glob":
      case "Grep":
      case "WebSearch":
      case "WebFetch":
        return "search";
      default:
        return "other";
    }
  };

  // Initialize buckets
  const buckets = Array.from({ length: bucketCount }, (_, i) => ({
    index: i,
    read: 0,
    write: 0,
    bash: 0,
    search: 0,
    other: 0,
  }));

  const totals = { read: 0, write: 0, bash: 0, search: 0, other: 0 };

  for (const tu of toolUses) {
    const seq = msgSeq.get(tu.message_id);
    if (seq === undefined) continue;

    const bucketIdx = Math.min(
      Math.floor(seq / bucketSize),
      bucketCount - 1
    );
    const category = categorize(tu.tool_name);

    buckets[bucketIdx][category]++;
    totals[category]++;
  }

  return c.json({ buckets, totals });
});

// Get plans linked to a session (via tool_uses referencing .claude/plans/*.md files)
app.get("/:id/plans", (c) => {
  const db = getDb();
  const id = c.req.param("id");

  const session = db
    .prepare("SELECT id FROM sessions WHERE id = ?")
    .get(id);
  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  // Find distinct plan filenames from tool_uses for this session
  const toolUseRows = db
    .prepare(
      `SELECT DISTINCT input_json FROM tool_uses
       WHERE session_id = ? AND tool_name IN ('Write', 'Edit', 'MultiEdit', 'Read')
       AND input_json LIKE '%/.claude/plans/%.md%'`
    )
    .all(id) as { input_json: string }[];

  // Extract filenames via regex
  const planFilenames = new Set<string>();
  const planPathRegex = /\.claude\/plans\/([^/]+\.md)/;
  for (const row of toolUseRows) {
    try {
      const input = JSON.parse(row.input_json || "{}");
      const pathValue = input.file_path || input.path || "";
      const match = pathValue.match(planPathRegex);
      if (match) {
        planFilenames.add(match[1]);
      }
    } catch {
      continue;
    }
  }

  if (planFilenames.size === 0) {
    return c.json({ plans: [] });
  }

  const placeholders = [...planFilenames].map(() => "?").join(",");
  const plans = db
    .prepare(
      `SELECT id, filename, content, mtime FROM plans
       WHERE filename IN (${placeholders}) ORDER BY mtime DESC`
    )
    .all(...planFilenames);

  return c.json({ plans });
});

export default app;
