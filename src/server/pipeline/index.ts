import { Database } from "bun:sqlite";
import { join } from "path";
import { readdirSync, existsSync, statSync } from "fs";
import { parseStatsCache } from "./stats-parser";
import { parseHistory } from "./history-parser";
import {
  parseSessionIndex,
  scanAllSessionIndexes,
} from "./session-index-parser";
import { parseSessionJsonl } from "./session-parser";
import { parsePlan, scanAllPlans } from "./plan-parser";
import { parseTodo, scanAllTodos } from "./todo-parser";
import { scanFileHistory } from "./file-history-parser";
import { scanAllProjectCommits, scanProjectCommits } from "./git-parser";

// Only index session JSONLs up to 2MB at startup; larger ones are lazy-loaded on demand
const STARTUP_MAX_JSONL_SIZE = 2 * 1024 * 1024;

export interface PipelineContext {
  db: Database;
  claudeDir: string;
}

/**
 * Quick index: metadata only. Returns in <1s.
 * Called synchronously before server starts.
 */
export function runQuickIndex(ctx: PipelineContext) {
  const { db, claudeDir } = ctx;

  console.log("[pipeline] Starting quick index...");
  const start = Date.now();

  // 1. Stats cache (instant)
  const statsPath = join(claudeDir, "stats-cache.json");
  if (existsSync(statsPath)) {
    parseStatsCache(db, statsPath);
  }

  // 2. Session indexes (instant)
  scanAllSessionIndexes(db, claudeDir);

  // 3. History (incremental)
  const historyPath = join(claudeDir, "history.jsonl");
  if (existsSync(historyPath)) {
    parseHistory(db, historyPath);
  }

  // 4. Plans (instant)
  scanAllPlans(db, claudeDir);

  // 5. Todos (instant — skip scan if lots of empty files)
  scanAllTodos(db, claudeDir);

  // 6. File history (scan metadata only)
  scanFileHistory(db, claudeDir);

  // 7. Register all session JSONL paths (without parsing content)
  registerSessionJsonlPaths(ctx);

  // 8. Scan project directories for logos
  scanProjectLogos(db);

  const elapsed = Date.now() - start;
  console.log(`[pipeline] Quick index completed in ${elapsed}ms`);
}

/**
 * Background index: parse session JSONL content for small files.
 * Called asynchronously after server starts.
 */
export function runBackgroundIndex(ctx: PipelineContext) {
  const { db, claudeDir } = ctx;
  const projectsDir = join(claudeDir, "projects");

  let projectDirs: string[];
  try {
    projectDirs = readdirSync(projectsDir);
  } catch {
    return;
  }

  let count = 0;
  for (const dir of projectDirs) {
    const dirPath = join(projectsDir, dir);
    let files: string[];
    try {
      files = readdirSync(dirPath).filter((f) => f.endsWith(".jsonl"));
    } catch {
      continue;
    }

    for (const file of files) {
      const sessionId = file.replace(".jsonl", "");
      const jsonlPath = join(dirPath, file);

      let fileSize: number;
      try {
        fileSize = statSync(jsonlPath).size;
      } catch {
        continue;
      }

      if (fileSize > STARTUP_MAX_JSONL_SIZE) {
        continue;
      }

      // Check if already indexed
      const session = db
        .prepare("SELECT indexed_bytes FROM sessions WHERE id = ?")
        .get(sessionId) as { indexed_bytes: number } | null;

      if (session && session.indexed_bytes >= fileSize) {
        continue;
      }

      try {
        parseSessionJsonl(db, sessionId, jsonlPath);
        count++;
      } catch {
        // Skip problematic files
      }
    }
  }

  if (count > 0) {
    console.log(`[pipeline] Background: ${count} session JSONL files indexed`);
  }

  // 8. Scan git commits for all projects
  scanAllProjectCommits(db).catch((e) => {
    console.error("[pipeline] Error scanning git commits:", e);
  });
}

/**
 * Register all session JSONL paths in the DB so the sessions API can
 * lazy-load them on demand, without parsing content upfront.
 */
function registerSessionJsonlPaths(ctx: PipelineContext) {
  const { db, claudeDir } = ctx;
  const projectsDir = join(claudeDir, "projects");

  let projectDirs: string[];
  try {
    projectDirs = readdirSync(projectsDir);
  } catch {
    return;
  }

  const insertStmt = db.prepare(
    `INSERT OR IGNORE INTO sessions (id, jsonl_path, message_count, indexed_bytes)
     VALUES (?, ?, 0, 0)`
  );
  const updateStmt = db.prepare(
    "UPDATE sessions SET jsonl_path = ? WHERE id = ? AND (jsonl_path IS NULL OR jsonl_path = '')"
  );

  const tx = db.transaction(() => {
    for (const dir of projectDirs) {
      const dirPath = join(projectsDir, dir);
      let files: string[];
      try {
        files = readdirSync(dirPath).filter((f) => f.endsWith(".jsonl"));
      } catch {
        continue;
      }

      for (const file of files) {
        const sessionId = file.replace(".jsonl", "");
        const jsonlPath = join(dirPath, file);
        insertStmt.run(sessionId, jsonlPath);
        updateStmt.run(jsonlPath, sessionId);
      }
    }
  });

  tx();
}

// Logo candidates in priority order (relative to project root)
const LOGO_CANDIDATES = [
  "logo.svg", "logo.png", "logo.jpg", "logo.webp",
  "icon.svg", "icon.png",
  "favicon.svg", "favicon.png", "favicon.ico",
  "public/logo.svg", "public/logo.png",
  "public/favicon.svg", "public/favicon.png", "public/favicon.ico",
  "public/favicon-32x32.png",
  "static/logo.svg", "static/logo.png",
  "static/favicon.svg", "static/favicon.png", "static/favicon.ico",
  "static/favicon-32x32.png",
  "app/static/logo.svg", "app/static/logo.png",
  "app/static/favicon.svg", "app/static/favicon.png", "app/static/favicon.ico",
  "app/static/favicon-32x32.png",
  "src/logo.svg", "src/logo.png",
  "src/assets/logo.svg", "src/assets/logo.png",
  "assets/logo.svg", "assets/logo.png",
  ".github/logo.svg", ".github/logo.png",
];

function scanProjectLogos(db: Database) {
  const projects = db
    .prepare("SELECT id, path FROM projects WHERE path IS NOT NULL AND path != ''")
    .all() as { id: number; path: string }[];

  const updateStmt = db.prepare(
    "UPDATE projects SET logo_path = ? WHERE id = ?"
  );

  for (const project of projects) {
    if (!existsSync(project.path)) continue;

    let found: string | null = null;
    for (const candidate of LOGO_CANDIDATES) {
      const fullPath = join(project.path, candidate);
      if (existsSync(fullPath)) {
        found = fullPath;
        break;
      }
    }

    updateStmt.run(found, project.id);
  }
}

// Handle individual file change events from the watcher
export function handleFileChange(ctx: PipelineContext, filePath: string): string | null {
  const { db, claudeDir } = ctx;
  const relative = filePath.startsWith(claudeDir)
    ? filePath.slice(claudeDir.length + 1)
    : filePath;

  if (relative === "stats-cache.json") {
    parseStatsCache(db, filePath);
    return "stats:updated";
  }

  if (relative === "history.jsonl") {
    parseHistory(db, filePath);
    return "history:appended";
  }

  if (relative.startsWith("plans/") && relative.endsWith(".md")) {
    parsePlan(db, filePath);
    return "plan:changed";
  }

  if (relative.startsWith("todos/") && relative.endsWith(".json")) {
    parseTodo(db, filePath);
    return "todo:changed";
  }

  if (
    relative.startsWith("projects/") &&
    relative.endsWith("sessions-index.json")
  ) {
    parseSessionIndex(db, filePath, claudeDir);
    return "session:updated";
  }

  if (relative.startsWith("projects/") && relative.endsWith(".jsonl")) {
    const parts = relative.split("/");
    const sessionId = parts[parts.length - 1].replace(".jsonl", "");

    // Ensure session row exists
    db.prepare(
      `INSERT OR IGNORE INTO sessions (id, jsonl_path, message_count, indexed_bytes)
       VALUES (?, ?, 0, 0)`
    ).run(sessionId, filePath);

    parseSessionJsonl(db, sessionId, filePath);

    // Re-scan git commits for the project this session belongs to
    const session = db
      .prepare("SELECT project_id FROM sessions WHERE id = ?")
      .get(sessionId) as { project_id: number } | null;
    if (session?.project_id) {
      const project = db
        .prepare("SELECT id, path FROM projects WHERE id = ?")
        .get(session.project_id) as { id: number; path: string } | null;
      if (project?.path) {
        scanProjectCommits(db, project.id, project.path).catch(() => {});
      }
    }

    return "session:updated";
  }

  return null;
}
