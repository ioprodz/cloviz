import { Hono } from "hono";
import { getDb } from "../db";

const app = new Hono();

// Get commits linked to a session
app.get("/session/:id", (c) => {
  const db = getDb();
  const sessionId = c.req.param("id");

  const commits = db
    .prepare(
      `SELECT c.*, sc.match_type
       FROM commits c
       JOIN session_commits sc ON sc.commit_id = c.id
       WHERE sc.session_id = ?
       ORDER BY c.timestamp DESC`
    )
    .all(sessionId);

  return c.json({ commits });
});

// Get all commits for a project
app.get("/project/:id", (c) => {
  const db = getDb();
  const projectId = c.req.param("id");
  const limit = parseInt(c.req.query("limit") || "100");
  const offset = parseInt(c.req.query("offset") || "0");

  const commits = db
    .prepare(
      `SELECT c.*,
              GROUP_CONCAT(DISTINCT sc.session_id) as session_ids,
              GROUP_CONCAT(DISTINCT sc.match_type) as match_types
       FROM commits c
       LEFT JOIN session_commits sc ON sc.commit_id = c.id
       WHERE c.project_id = ?
       GROUP BY c.id
       ORDER BY c.timestamp DESC
       LIMIT ? OFFSET ?`
    )
    .all(projectId, limit, offset) as any[];

  const total = db
    .prepare("SELECT COUNT(*) as cnt FROM commits WHERE project_id = ?")
    .get(projectId) as { cnt: number };

  // Parse session_ids from comma-separated string to array
  const enriched = commits.map((c) => ({
    ...c,
    session_ids: c.session_ids ? c.session_ids.split(",") : [],
    match_types: c.match_types ? c.match_types.split(",") : [],
  }));

  return c.json({ commits: enriched, total: total.cnt, limit, offset });
});

export default app;
