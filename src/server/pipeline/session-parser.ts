import type { DatabaseLike } from "../runtime/database";
import { readFileSync, statSync } from "fs";

interface ContentBlock {
  type: string;
  text?: string;
  thinking?: string;
  name?: string;
  id?: string;
  input?: unknown;
  content?: string;
  tool_use_id?: string;
}

interface SessionLine {
  type: string;
  uuid?: string;
  parentUuid?: string;
  sessionId?: string;
  timestamp?: string;
  slug?: string;
  isSidechain?: boolean;
  gitBranch?: string;
  message?: {
    role?: string;
    model?: string;
    content?: string | ContentBlock[];
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
  };
  summary?: string;
  leafUuid?: string;
  snapshot?: unknown;
}

export function parseSessionJsonl(
  db: DatabaseLike,
  sessionId: string,
  jsonlPath: string
) {
  let fileSize: number;
  try {
    fileSize = statSync(jsonlPath).size;
  } catch {
    return;
  }

  // Check indexed state
  const session = db
    .prepare("SELECT indexed_bytes FROM sessions WHERE id = ?")
    .get(sessionId) as { indexed_bytes: number } | null;

  const indexedBytes = session?.indexed_bytes ?? 0;
  if (indexedBytes >= fileSize) return;

  const buffer = readFileSync(jsonlPath);
  const newData = buffer.subarray(indexedBytes).toString("utf-8");
  const lines = newData.split("\n").filter((l) => l.trim());

  const insertMsg = db.prepare(
    `INSERT INTO messages (session_id, uuid, parent_uuid, type, role, model, content_text, content_json, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, timestamp, byte_offset)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const insertTool = db.prepare(
    `INSERT INTO tool_uses (message_id, session_id, tool_name, tool_use_id, input_json, timestamp)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  const tx = db.transaction(() => {
    let offset = indexedBytes;
    let lastSlug = "";
    let lastBranch = "";

    for (const line of lines) {
      try {
        const entry: SessionLine = JSON.parse(line);

        if (entry.slug) lastSlug = entry.slug;
        if (entry.gitBranch) lastBranch = entry.gitBranch;

        if (entry.type === "user" || entry.type === "assistant") {
          const msg = entry.message;
          let contentText = "";
          let contentJson = "";
          let inputTokens = 0;
          let outputTokens = 0;
          let cacheRead = 0;
          let cacheCreation = 0;

          if (msg) {
            if (typeof msg.content === "string") {
              contentText = msg.content;
            } else if (Array.isArray(msg.content)) {
              const textParts: string[] = [];
              for (const block of msg.content) {
                if (block.type === "text" && block.text) {
                  textParts.push(block.text);
                } else if (block.type === "thinking" && block.thinking) {
                  textParts.push(block.thinking);
                } else if (block.type === "tool_result" && block.content) {
                  textParts.push(
                    typeof block.content === "string"
                      ? block.content
                      : JSON.stringify(block.content)
                  );
                }
              }
              contentText = textParts.join("\n");
              contentJson = JSON.stringify(msg.content);
            }

            if (msg.usage) {
              inputTokens = msg.usage.input_tokens ?? 0;
              outputTokens = msg.usage.output_tokens ?? 0;
              cacheRead = msg.usage.cache_read_input_tokens ?? 0;
              cacheCreation = msg.usage.cache_creation_input_tokens ?? 0;
            }
          }

          const result = insertMsg.run(
            sessionId,
            entry.uuid ?? null,
            entry.parentUuid ?? null,
            entry.type,
            msg?.role ?? entry.type,
            msg?.model ?? null,
            contentText,
            contentJson || null,
            inputTokens,
            outputTokens,
            cacheRead,
            cacheCreation,
            entry.timestamp ?? null,
            offset
          );

          // Extract tool_use blocks from assistant messages
          if (
            entry.type === "assistant" &&
            msg &&
            Array.isArray(msg.content)
          ) {
            const msgId = Number(result.lastInsertRowid);
            for (const block of msg.content) {
              if (block.type === "tool_use" && block.name) {
                insertTool.run(
                  msgId,
                  sessionId,
                  block.name,
                  block.id ?? null,
                  block.input ? JSON.stringify(block.input) : null,
                  entry.timestamp ?? null
                );
              }
            }
          }
        } else if (entry.type === "summary" && entry.summary) {
          // Update session summary
          db.prepare("UPDATE sessions SET summary = ? WHERE id = ?").run(
            entry.summary,
            sessionId
          );
        }
      } catch {
        // Skip malformed lines
      }
      offset += Buffer.byteLength(line, "utf-8") + 1;
    }

    // Update session indexed state
    db.prepare(
      "UPDATE sessions SET indexed_bytes = ?, slug = COALESCE(NULLIF(?, ''), slug), git_branch = COALESCE(NULLIF(?, ''), git_branch) WHERE id = ?"
    ).run(fileSize, lastSlug, lastBranch, sessionId);
  });

  tx();
}
