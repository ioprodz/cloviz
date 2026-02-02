import { Database } from "bun:sqlite";
import { readFileSync } from "fs";

export function parseStatsCache(db: Database, filePath: string) {
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf-8");
  } catch {
    return;
  }

  const data = JSON.parse(raw);

  const upsert = db.prepare(
    "INSERT OR REPLACE INTO stats_cache (key, value) VALUES (?, ?)"
  );

  const tx = db.transaction(() => {
    upsert.run("raw", raw);
    upsert.run("totalSessions", String(data.totalSessions ?? 0));
    upsert.run("totalMessages", String(data.totalMessages ?? 0));
    upsert.run("firstSessionDate", data.firstSessionDate ?? "");
    upsert.run("lastComputedDate", data.lastComputedDate ?? "");
    upsert.run("longestSession", JSON.stringify(data.longestSession ?? {}));
    upsert.run("hourCounts", JSON.stringify(data.hourCounts ?? {}));
    upsert.run("modelUsage", JSON.stringify(data.modelUsage ?? {}));
    upsert.run(
      "totalSpeculationTimeSavedMs",
      String(data.totalSpeculationTimeSavedMs ?? 0)
    );

    // Daily activity
    db.exec("DELETE FROM daily_stats");
    const dailyInsert = db.prepare(
      "INSERT INTO daily_stats (date, message_count, session_count, tool_call_count, tokens_by_model) VALUES (?, ?, ?, ?, ?)"
    );

    const tokensByDate: Record<string, Record<string, number>> = {};
    if (data.dailyModelTokens) {
      for (const entry of data.dailyModelTokens) {
        tokensByDate[entry.date] = entry.tokensByModel;
      }
    }

    if (data.dailyActivity) {
      for (const day of data.dailyActivity) {
        dailyInsert.run(
          day.date,
          day.messageCount ?? 0,
          day.sessionCount ?? 0,
          day.toolCallCount ?? 0,
          JSON.stringify(tokensByDate[day.date] ?? {})
        );
      }
    }
  });

  tx();
}
