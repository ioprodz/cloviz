import { Hono } from "hono";
import { getDb } from "../db";

const app = new Hono();

app.get("/", (c) => {
  const db = getDb();
  const status = c.req.query("status");
  const sessionId = c.req.query("session");

  let where = "1=1";
  const params: string[] = [];

  if (status) {
    where += " AND status = ?";
    params.push(status);
  }

  if (sessionId) {
    where += " AND session_id = ?";
    params.push(sessionId);
  }

  const todos = db
    .prepare(
      `SELECT * FROM todos WHERE ${where} ORDER BY id DESC`
    )
    .all(...params);

  let countWhere = "1=1";
  const countParams: string[] = [];

  if (sessionId) {
    countWhere += " AND session_id = ?";
    countParams.push(sessionId);
  }

  const statusCounts = db
    .prepare(
      `SELECT status, COUNT(*) as count FROM todos WHERE ${countWhere} GROUP BY status`
    )
    .all(...countParams);

  return c.json({ todos, statusCounts });
});

export default app;
