import { Database } from "bun:sqlite";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, basename } from "path";

export function parsePlan(db: Database, filePath: string) {
  let content: string;
  let mtime: number;
  try {
    content = readFileSync(filePath, "utf-8");
    mtime = statSync(filePath).mtimeMs;
  } catch {
    return;
  }

  const filename = basename(filePath);

  db.prepare(
    `INSERT INTO plans (filename, content, mtime)
     VALUES (?, ?, ?)
     ON CONFLICT(filename) DO UPDATE SET content = excluded.content, mtime = excluded.mtime`
  ).run(filename, content, Math.floor(mtime));
}

export function scanAllPlans(db: Database, claudeDir: string) {
  const plansDir = join(claudeDir, "plans");
  let files: string[];
  try {
    files = readdirSync(plansDir).filter((f) => f.endsWith(".md"));
  } catch {
    return;
  }

  const tx = db.transaction(() => {
    for (const file of files) {
      parsePlan(db, join(plansDir, file));
    }
  });

  tx();
}
