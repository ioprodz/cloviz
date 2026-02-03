import type { DatabaseLike } from "../runtime/database";
import { readFileSync, readdirSync } from "fs";
import { join, basename } from "path";

export function parseTodo(db: DatabaseLike, filePath: string) {
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf-8");
  } catch {
    return;
  }

  const items = JSON.parse(raw);
  if (!Array.isArray(items) || items.length === 0) return;

  const filename = basename(filePath, ".json");
  // Filename format: {sessionId}-agent-{agentId}
  const agentMatch = filename.match(
    /^(.+?)-agent-(.+)$/
  );
  const sessionId = agentMatch ? agentMatch[1] : filename;
  const agentId = agentMatch ? agentMatch[2] : "";

  // Delete old entries for this file and re-insert
  db.prepare("DELETE FROM todos WHERE source_file = ?").run(
    basename(filePath)
  );

  const insert = db.prepare(
    "INSERT INTO todos (source_file, session_id, agent_id, content, status, active_form) VALUES (?, ?, ?, ?, ?, ?)"
  );

  const tx = db.transaction(() => {
    for (const item of items) {
      insert.run(
        basename(filePath),
        sessionId,
        agentId,
        item.content ?? "",
        item.status ?? "pending",
        item.activeForm ?? ""
      );
    }
  });

  tx();
}

export function scanAllTodos(db: DatabaseLike, claudeDir: string) {
  const todosDir = join(claudeDir, "todos");
  let files: string[];
  try {
    files = readdirSync(todosDir).filter((f) => f.endsWith(".json"));
  } catch {
    return;
  }

  const tx = db.transaction(() => {
    for (const file of files) {
      try {
        parseTodo(db, join(todosDir, file));
      } catch {
        // Skip invalid
      }
    }
  });

  tx();
}
