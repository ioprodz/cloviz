import { Hono } from "hono";
import { getDb } from "../db";
import { readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const app = new Hono();

const CLAUDE_DIR = join(homedir(), ".claude");

app.get("/:session", (c) => {
  const db = getDb();
  const sessionId = c.req.param("session");

  const files = db
    .prepare(
      `SELECT * FROM file_history WHERE session_id = ? ORDER BY file_path, version`
    )
    .all(sessionId);

  return c.json({ files, sessionId });
});

app.get("/:session/:filename", (c) => {
  const sessionId = c.req.param("session");
  const filename = c.req.param("filename");

  // Sanitize to prevent path traversal
  if (filename.includes("..") || filename.includes("/")) {
    return c.json({ error: "Invalid filename" }, 400);
  }

  const filePath = join(
    CLAUDE_DIR,
    "file-history",
    sessionId,
    filename
  );

  try {
    const content = readFileSync(filePath, "utf-8");
    return c.json({ content, filename, sessionId });
  } catch {
    return c.json({ error: "File not found" }, 404);
  }
});

export default app;
