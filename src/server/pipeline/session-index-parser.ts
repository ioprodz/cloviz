import { Database } from "bun:sqlite";
import { readFileSync, readdirSync } from "fs";
import { join, basename } from "path";

export function parseSessionIndex(
  db: Database,
  indexPath: string,
  claudeDir: string
) {
  let raw: string;
  try {
    raw = readFileSync(indexPath, "utf-8");
  } catch {
    return;
  }

  const data = JSON.parse(raw);
  const projectPath = data.originalPath ?? "";
  const displayName =
    projectPath.split("/").filter(Boolean).pop() ?? projectPath;

  // Upsert project
  db.prepare(
    `INSERT INTO projects (path, display_name, created_at, updated_at)
     VALUES (?, ?, datetime('now'), datetime('now'))
     ON CONFLICT(path) DO UPDATE SET updated_at = datetime('now')`
  ).run(projectPath, displayName);

  const project = db
    .prepare("SELECT id FROM projects WHERE path = ?")
    .get(projectPath) as { id: number } | null;
  if (!project) return;

  const entries = data.entries ?? [];

  const upsertSession = db.prepare(
    `INSERT INTO sessions (id, project_id, jsonl_path, summary, first_prompt, message_count, created_at, modified_at, git_branch, is_sidechain, slug)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       project_id = excluded.project_id,
       summary = excluded.summary,
       first_prompt = excluded.first_prompt,
       message_count = excluded.message_count,
       created_at = COALESCE(NULLIF(excluded.created_at, ''), sessions.created_at),
       modified_at = excluded.modified_at,
       git_branch = excluded.git_branch,
       is_sidechain = excluded.is_sidechain`
  );

  const tx = db.transaction(() => {
    for (const entry of entries) {
      upsertSession.run(
        entry.sessionId,
        project.id,
        entry.fullPath ?? "",
        entry.summary ?? "",
        entry.firstPrompt ?? "",
        entry.messageCount ?? 0,
        entry.created ?? "",
        entry.modified ?? "",
        entry.gitBranch ?? "",
        entry.isSidechain ? 1 : 0,
        ""
      );
    }

    // Update project counts
    const counts = db
      .prepare(
        "SELECT COUNT(*) as cnt, COALESCE(SUM(message_count), 0) as msgs FROM sessions WHERE project_id = ?"
      )
      .get(project.id) as { cnt: number; msgs: number };

    db.prepare(
      "UPDATE projects SET session_count = ?, message_count = ? WHERE id = ?"
    ).run(counts.cnt, counts.msgs, project.id);
  });

  tx();
}

export function scanAllSessionIndexes(db: Database, claudeDir: string) {
  const projectsDir = join(claudeDir, "projects");
  let dirs: string[];
  try {
    dirs = readdirSync(projectsDir);
  } catch {
    return;
  }

  for (const dir of dirs) {
    const indexPath = join(projectsDir, dir, "sessions-index.json");
    try {
      parseSessionIndex(db, indexPath, claudeDir);
    } catch {
      // Skip invalid
    }
  }
}
