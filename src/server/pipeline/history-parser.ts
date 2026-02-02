import { Database } from "bun:sqlite";
import { readFileSync, statSync } from "fs";

export function parseHistory(db: Database, filePath: string) {
  let fileSize: number;
  try {
    fileSize = statSync(filePath).size;
  } catch {
    return;
  }

  // Check how far we've already indexed
  const state = db
    .prepare("SELECT indexed_bytes FROM index_state WHERE file_path = ?")
    .get(filePath) as { indexed_bytes: number } | null;

  const indexedBytes = state?.indexed_bytes ?? 0;

  if (indexedBytes >= fileSize) return; // Already up to date

  // Read only new bytes
  const fd = Bun.file(filePath);
  const buffer = readFileSync(filePath);
  const newData = buffer.subarray(indexedBytes).toString("utf-8");
  const lines = newData.split("\n").filter((l) => l.trim());

  const insert = db.prepare(
    "INSERT INTO history_entries (display, timestamp, project, session_id, byte_offset) VALUES (?, ?, ?, ?, ?)"
  );

  const tx = db.transaction(() => {
    let offset = indexedBytes;
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        insert.run(
          entry.display ?? "",
          entry.timestamp ?? 0,
          entry.project ?? "",
          entry.sessionId ?? "",
          offset
        );
      } catch {
        // Skip malformed lines
      }
      offset += Buffer.byteLength(line, "utf-8") + 1; // +1 for newline
    }

    db.prepare(
      "INSERT OR REPLACE INTO index_state (file_path, indexed_bytes, mtime) VALUES (?, ?, ?)"
    ).run(filePath, fileSize, Date.now());
  });

  tx();
}
