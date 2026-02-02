import { Database } from "bun:sqlite";
import { mkdirSync } from "fs";
import { dirname, join } from "path";
import { homedir } from "os";

const DB_DIR = join(homedir(), ".cache", "cloviz");
const DB_PATH = join(DB_DIR, "cloviz.db");

let db: Database;

export function getDb(): Database {
  if (!db) {
    mkdirSync(DB_DIR, { recursive: true });
    db = new Database(DB_PATH);
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA synchronous = NORMAL");
    db.exec("PRAGMA cache_size = -64000"); // 64MB cache
    db.exec("PRAGMA busy_timeout = 5000");
    migrate(db);
  }
  return db;
}

function migrate(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      session_count INTEGER DEFAULT 0,
      message_count INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      project_id INTEGER REFERENCES projects(id),
      jsonl_path TEXT,
      summary TEXT,
      first_prompt TEXT,
      message_count INTEGER DEFAULT 0,
      created_at TEXT,
      modified_at TEXT,
      git_branch TEXT,
      is_sidechain INTEGER DEFAULT 0,
      slug TEXT,
      indexed_bytes INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT REFERENCES sessions(id),
      uuid TEXT,
      parent_uuid TEXT,
      type TEXT NOT NULL,
      role TEXT,
      model TEXT,
      content_text TEXT,
      content_json TEXT,
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      cache_read_tokens INTEGER DEFAULT 0,
      cache_creation_tokens INTEGER DEFAULT 0,
      timestamp TEXT,
      byte_offset INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS tool_uses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id INTEGER REFERENCES messages(id),
      session_id TEXT REFERENCES sessions(id),
      tool_name TEXT NOT NULL,
      tool_use_id TEXT,
      input_json TEXT,
      timestamp TEXT
    );

    CREATE TABLE IF NOT EXISTS plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT UNIQUE NOT NULL,
      content TEXT,
      mtime INTEGER
    );

    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_file TEXT NOT NULL,
      session_id TEXT,
      agent_id TEXT,
      content TEXT,
      status TEXT,
      active_form TEXT
    );

    CREATE TABLE IF NOT EXISTS daily_stats (
      date TEXT PRIMARY KEY,
      message_count INTEGER DEFAULT 0,
      session_count INTEGER DEFAULT 0,
      tool_call_count INTEGER DEFAULT 0,
      tokens_by_model TEXT
    );

    CREATE TABLE IF NOT EXISTS file_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT,
      file_path TEXT,
      backup_filename TEXT,
      version INTEGER
    );

    CREATE TABLE IF NOT EXISTS history_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      display TEXT,
      timestamp INTEGER,
      project TEXT,
      session_id TEXT,
      byte_offset INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS stats_cache (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS index_state (
      file_path TEXT PRIMARY KEY,
      indexed_bytes INTEGER DEFAULT 0,
      mtime INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS commits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER REFERENCES projects(id),
      hash TEXT NOT NULL,
      short_hash TEXT NOT NULL,
      subject TEXT,
      body TEXT,
      author TEXT,
      author_email TEXT,
      timestamp TEXT NOT NULL,
      files_changed INTEGER DEFAULT 0,
      insertions INTEGER DEFAULT 0,
      deletions INTEGER DEFAULT 0,
      is_claude_authored INTEGER DEFAULT 0,
      UNIQUE(project_id, hash)
    );

    CREATE TABLE IF NOT EXISTS session_commits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT REFERENCES sessions(id),
      commit_id INTEGER REFERENCES commits(id),
      match_type TEXT NOT NULL,
      UNIQUE(session_id, commit_id)
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id);
    CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(type);
    CREATE INDEX IF NOT EXISTS idx_tool_uses_session ON tool_uses(session_id);
    CREATE INDEX IF NOT EXISTS idx_tool_uses_name ON tool_uses(tool_name);
    CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(status);
    CREATE INDEX IF NOT EXISTS idx_history_timestamp ON history_entries(timestamp);
    CREATE INDEX IF NOT EXISTS idx_messages_uuid ON messages(uuid);
    CREATE INDEX IF NOT EXISTS idx_commits_project ON commits(project_id);
    CREATE INDEX IF NOT EXISTS idx_commits_timestamp ON commits(timestamp);
    CREATE INDEX IF NOT EXISTS idx_session_commits_session ON session_commits(session_id);
    CREATE INDEX IF NOT EXISTS idx_session_commits_commit ON session_commits(commit_id);
  `);

  // Add last_indexed_commit and logo_path to projects (safe to call repeatedly)
  try {
    db.exec("ALTER TABLE projects ADD COLUMN last_indexed_commit TEXT");
  } catch {
    // Column already exists
  }
  try {
    db.exec("ALTER TABLE projects ADD COLUMN logo_path TEXT");
  } catch {
    // Column already exists
  }
  try {
    db.exec("ALTER TABLE projects ADD COLUMN remote_url TEXT");
  } catch {
    // Column already exists
  }

  // FTS5 virtual tables
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
      content_text,
      content='messages',
      content_rowid='id'
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS sessions_fts USING fts5(
      summary,
      first_prompt,
      content='sessions',
      content_rowid='rowid'
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS plans_fts USING fts5(
      filename,
      content,
      content='plans',
      content_rowid='id'
    );
  `);

  // Triggers to keep FTS in sync
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
      INSERT INTO messages_fts(rowid, content_text) VALUES (new.id, new.content_text);
    END;

    CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
      INSERT INTO messages_fts(messages_fts, rowid, content_text) VALUES('delete', old.id, old.content_text);
    END;

    CREATE TRIGGER IF NOT EXISTS sessions_ai AFTER INSERT ON sessions BEGIN
      INSERT INTO sessions_fts(rowid, summary, first_prompt) VALUES (new.rowid, new.summary, new.first_prompt);
    END;

    CREATE TRIGGER IF NOT EXISTS sessions_au AFTER UPDATE ON sessions BEGIN
      INSERT INTO sessions_fts(sessions_fts, rowid, summary, first_prompt) VALUES('delete', old.rowid, old.summary, old.first_prompt);
      INSERT INTO sessions_fts(rowid, summary, first_prompt) VALUES (new.rowid, new.summary, new.first_prompt);
    END;

    CREATE TRIGGER IF NOT EXISTS plans_ai AFTER INSERT ON plans BEGIN
      INSERT INTO plans_fts(rowid, filename, content) VALUES (new.id, new.filename, new.content);
    END;

    CREATE TRIGGER IF NOT EXISTS plans_au AFTER UPDATE ON plans BEGIN
      INSERT INTO plans_fts(plans_fts, rowid, filename, content) VALUES('delete', old.id, old.filename, old.content);
      INSERT INTO plans_fts(rowid, filename, content) VALUES (new.id, new.filename, new.content);
    END;
  `);
}

export function closeDb() {
  if (db) {
    db.close();
  }
}
