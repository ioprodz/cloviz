import { Database } from "bun:sqlite";
import { readdirSync } from "fs";
import { join } from "path";

export function scanFileHistory(db: Database, claudeDir: string) {
  const histDir = join(claudeDir, "file-history");
  let sessionDirs: string[];
  try {
    sessionDirs = readdirSync(histDir);
  } catch {
    return;
  }

  const insert = db.prepare(
    `INSERT OR IGNORE INTO file_history (session_id, file_path, backup_filename, version)
     VALUES (?, ?, ?, ?)`
  );

  // Check existing count to avoid re-scanning
  const existing = db
    .prepare("SELECT COUNT(*) as cnt FROM file_history")
    .get() as { cnt: number };

  const tx = db.transaction(() => {
    for (const sessionId of sessionDirs) {
      const sessionDir = join(histDir, sessionId);
      let files: string[];
      try {
        files = readdirSync(sessionDir);
      } catch {
        continue;
      }

      for (const file of files) {
        // Format: {hash}@v{version}
        const match = file.match(/^(.+)@v(\d+)$/);
        if (!match) continue;

        const hash = match[1];
        const version = parseInt(match[2], 10);

        insert.run(sessionId, hash, file, version);
      }
    }
  });

  tx();
}
