import { Hono } from "hono";
import { join } from "path";
import { homedir } from "os";
import { existsSync } from "fs";
import { fileStreamResponse } from "../runtime/file";

const app = new Hono();

const CLAUDE_DIR = join(homedir(), ".claude");

// Stream debug log (never cache, can be very large)
app.get("/:session", (c) => {
  const sessionId = c.req.param("session");

  if (sessionId.includes("..") || sessionId.includes("/")) {
    return c.json({ error: "Invalid session ID" }, 400);
  }

  const filePath = join(CLAUDE_DIR, "debug", `${sessionId}.txt`);

  if (!existsSync(filePath)) {
    return c.json({ error: "Debug log not found" }, 404);
  }

  const response = fileStreamResponse(filePath, "text/plain");
  return new Response(response.body, {
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "no-store",
    },
  });
});

export default app;
