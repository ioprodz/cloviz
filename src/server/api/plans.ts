import { Hono } from "hono";
import { getDb } from "../db";

const app = new Hono();

app.get("/", (c) => {
  const db = getDb();

  const plans = db
    .prepare(
      "SELECT id, filename, mtime FROM plans ORDER BY mtime DESC"
    )
    .all();

  return c.json({ plans });
});

app.get("/:name", (c) => {
  const db = getDb();
  const name = c.req.param("name");

  // Allow querying with or without .md extension
  const filename = name.endsWith(".md") ? name : `${name}.md`;

  const plan = db
    .prepare("SELECT * FROM plans WHERE filename = ?")
    .get(filename);

  if (!plan) {
    return c.json({ error: "Plan not found" }, 404);
  }

  return c.json(plan);
});

export default app;
