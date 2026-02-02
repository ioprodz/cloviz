import { Hono } from "hono";
import { getDb } from "../db";

const app = new Hono();

app.get("/", (c) => {
  const db = getDb();
  const q = c.req.query("q");
  const limit = parseInt(c.req.query("limit") || "30");
  const projectId = c.req.query("project_id");

  if (!q || q.trim().length === 0) {
    return c.json({ results: [], query: "" });
  }

  // Escape FTS5 special characters
  const ftsQuery = q.replace(/['"*()]/g, " ").trim();
  if (!ftsQuery) {
    return c.json({ results: [], query: q });
  }

  const projectFilter = projectId ? " AND s.project_id = ?" : "";
  const results: any[] = [];

  // Search messages
  try {
    const params: any[] = [ftsQuery];
    if (projectId) params.push(projectId);
    params.push(limit);

    const messageResults = db
      .prepare(
        `SELECT m.id, m.session_id, m.type, m.role, m.timestamp,
                snippet(messages_fts, 0, '<mark>', '</mark>', '...', 40) as snippet,
                s.slug, s.first_prompt, p.display_name as project_name
         FROM messages_fts
         JOIN messages m ON messages_fts.rowid = m.id
         LEFT JOIN sessions s ON m.session_id = s.id
         LEFT JOIN projects p ON s.project_id = p.id
         WHERE messages_fts MATCH ?${projectFilter}
         ORDER BY rank
         LIMIT ?`
      )
      .all(...params);

    for (const r of messageResults as any[]) {
      results.push({ ...r, resultType: "message" });
    }
  } catch {
    // FTS query might fail on certain inputs
  }

  // Search sessions
  try {
    const params: any[] = [ftsQuery];
    if (projectId) params.push(projectId);
    params.push(limit);

    const sessionResults = db
      .prepare(
        `SELECT s.id as session_id, s.slug, s.created_at, s.modified_at, s.message_count,
                snippet(sessions_fts, 0, '<mark>', '</mark>', '...', 40) as summary_snippet,
                snippet(sessions_fts, 1, '<mark>', '</mark>', '...', 40) as prompt_snippet,
                p.display_name as project_name
         FROM sessions_fts
         JOIN sessions s ON sessions_fts.rowid = s.rowid
         LEFT JOIN projects p ON s.project_id = p.id
         WHERE sessions_fts MATCH ?${projectFilter}
         ORDER BY rank
         LIMIT ?`
      )
      .all(...params);

    for (const r of sessionResults as any[]) {
      results.push({ ...r, resultType: "session" });
    }
  } catch {
    // FTS query might fail
  }

  // Search plans (no project filter for plans since they aren't project-scoped)
  try {
    const planResults = db
      .prepare(
        `SELECT p.filename, p.mtime,
                snippet(plans_fts, 0, '<mark>', '</mark>', '...', 40) as filename_snippet,
                snippet(plans_fts, 1, '<mark>', '</mark>', '...', 40) as content_snippet
         FROM plans_fts
         JOIN plans p ON plans_fts.rowid = p.id
         WHERE plans_fts MATCH ?
         ORDER BY rank
         LIMIT ?`
      )
      .all(ftsQuery, limit);

    for (const r of planResults as any[]) {
      results.push({ ...r, resultType: "plan" });
    }
  } catch {
    // FTS query might fail
  }

  return c.json({ results, query: q });
});

export default app;
