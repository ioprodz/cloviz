import { Database } from "bun:sqlite";
import { existsSync } from "fs";

interface ParsedCommit {
  hash: string;
  shortHash: string;
  subject: string;
  body: string;
  author: string;
  authorEmail: string;
  timestamp: string;
  filesChanged: number;
  insertions: number;
  deletions: number;
  isClaude: boolean;
}

interface SessionWindow {
  id: string;
  createdAt: string;
  modifiedAt: string;
  hasBashGitCommit: boolean;
}

// Git format escapes (used in --format argument)
const GIT_FIELD_SEP = "%x00";
const GIT_RECORD_SEP = "%x01";

// Actual bytes that git outputs (used for parsing)
const FIELD_SEP = "\x00";
const RECORD_SEP = "\x01";

/**
 * Run a git command in a project directory and return stdout.
 */
async function gitExec(
  cwd: string,
  args: string[]
): Promise<string | null> {
  try {
    const proc = Bun.spawn(["git", ...args], {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
    });
    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;
    if (exitCode !== 0) return null;
    return output;
  } catch {
    return null;
  }
}

/**
 * Check if a directory is a git repository.
 */
async function isGitRepo(path: string): Promise<boolean> {
  if (!existsSync(path)) return false;
  const result = await gitExec(path, ["rev-parse", "--git-dir"]);
  return result !== null;
}

/**
 * Detect Claude co-authorship in commit subject + body.
 */
function isClaude(subject: string, body: string): boolean {
  const text = `${subject}\n${body}`.toLowerCase();
  return (
    text.includes("co-authored-by") &&
    (text.includes("claude") || text.includes("noreply@anthropic.com"))
  );
}

/**
 * Parse git log metadata output into commit objects.
 */
function parseMetadata(output: string): Map<string, Omit<ParsedCommit, "filesChanged" | "insertions" | "deletions">> {
  const commits = new Map<string, Omit<ParsedCommit, "filesChanged" | "insertions" | "deletions">>();
  const records = output.split(RECORD_SEP).filter((r) => r.trim());

  for (const record of records) {
    const fields = record.split(FIELD_SEP);
    if (fields.length < 6) continue;

    const hash = fields[0].trim();
    const shortHash = fields[1];
    const author = fields[2];
    const authorEmail = fields[3];
    const timestamp = fields[4];
    const subject = fields[5];
    const body = fields.slice(6).join(FIELD_SEP).trim();

    if (!hash || hash.length < 7) continue;

    commits.set(hash, {
      hash,
      shortHash,
      subject,
      body,
      author,
      authorEmail,
      timestamp,
      isClaude: isClaude(subject, body),
    });
  }

  return commits;
}

/**
 * Parse git shortstat output to get file change counts per commit.
 */
function parseShortstat(output: string): Map<string, { filesChanged: number; insertions: number; deletions: number }> {
  const stats = new Map<string, { filesChanged: number; insertions: number; deletions: number }>();
  const lines = output.split("\n");

  let currentHash = "";
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // A 40-char hex string is a commit hash
    if (/^[a-f0-9]{40}$/.test(trimmed)) {
      currentHash = trimmed;
      continue;
    }

    // Shortstat line: " 3 files changed, 50 insertions(+), 10 deletions(-)"
    if (currentHash && trimmed.includes("file")) {
      const filesMatch = trimmed.match(/(\d+) files? changed/);
      const insMatch = trimmed.match(/(\d+) insertions?\(\+\)/);
      const delMatch = trimmed.match(/(\d+) deletions?\(-\)/);
      stats.set(currentHash, {
        filesChanged: filesMatch ? parseInt(filesMatch[1]) : 0,
        insertions: insMatch ? parseInt(insMatch[1]) : 0,
        deletions: delMatch ? parseInt(delMatch[1]) : 0,
      });
      currentHash = "";
    }
  }

  return stats;
}

/**
 * Parse git log for a project. Returns list of commits.
 * On progressive runs, uses sinceHash..HEAD.
 * On first run, uses --after=afterDate to only scan as far back as the earliest session.
 */
async function parseGitLog(
  projectPath: string,
  sinceHash?: string | null,
  afterDate?: string | null
): Promise<ParsedCommit[]> {
  // Build args for metadata
  const formatStr = `%H${GIT_FIELD_SEP}%h${GIT_FIELD_SEP}%an${GIT_FIELD_SEP}%ae${GIT_FIELD_SEP}%aI${GIT_FIELD_SEP}%s${GIT_FIELD_SEP}%b${GIT_RECORD_SEP}`;
  const metaArgs = ["log", `--format=${formatStr}`, "--no-merges"];
  const statArgs = ["log", "--format=%H", "--shortstat", "--no-merges"];

  if (sinceHash) {
    metaArgs.push(`${sinceHash}..HEAD`);
    statArgs.push(`${sinceHash}..HEAD`);
  } else if (afterDate) {
    metaArgs.push(`--after=${afterDate}`);
    statArgs.push(`--after=${afterDate}`);
  }

  const [metaOutput, statOutput] = await Promise.all([
    gitExec(projectPath, metaArgs),
    gitExec(projectPath, statArgs),
  ]);

  if (!metaOutput) return [];

  const metaMap = parseMetadata(metaOutput);
  const statMap = statOutput ? parseShortstat(statOutput) : new Map();

  const commits: ParsedCommit[] = [];
  for (const [hash, meta] of metaMap) {
    const stat = statMap.get(hash);
    commits.push({
      ...meta,
      filesChanged: stat?.filesChanged ?? 0,
      insertions: stat?.insertions ?? 0,
      deletions: stat?.deletions ?? 0,
    });
  }

  return commits;
}

/**
 * Load session time windows and whether they contain Bash git commit tool_uses.
 */
function loadSessionWindows(db: Database, projectId: number): SessionWindow[] {
  const sessions = db
    .prepare(
      `SELECT s.id, s.created_at, s.modified_at
       FROM sessions s
       WHERE s.project_id = ? AND s.created_at IS NOT NULL AND s.modified_at IS NOT NULL`
    )
    .all(projectId) as { id: string; created_at: string; modified_at: string }[];

  // Find sessions that have Bash tool_uses containing 'git commit'
  const bashSessions = new Set<string>();
  const bashRows = db
    .prepare(
      `SELECT DISTINCT t.session_id
       FROM tool_uses t
       JOIN sessions s ON t.session_id = s.id
       WHERE s.project_id = ? AND t.tool_name = 'Bash'
       AND t.input_json LIKE '%git commit%'`
    )
    .all(projectId) as { session_id: string }[];

  for (const row of bashRows) {
    bashSessions.add(row.session_id);
  }

  return sessions.map((s) => ({
    id: s.id,
    createdAt: s.created_at,
    modifiedAt: s.modified_at,
    hasBashGitCommit: bashSessions.has(s.id),
  }));
}

/**
 * Match commits to sessions by time window overlap.
 */
function matchCommitsToSessions(
  db: Database,
  projectId: number,
  commits: ParsedCommit[]
) {
  const windows = loadSessionWindows(db, projectId);
  if (windows.length === 0 || commits.length === 0) return;

  const insertLink = db.prepare(
    `INSERT OR IGNORE INTO session_commits (session_id, commit_id, match_type)
     VALUES (?, ?, ?)`
  );

  const getCommitId = db.prepare(
    "SELECT id FROM commits WHERE project_id = ? AND hash = ?"
  );

  const tx = db.transaction(() => {
    for (const commit of commits) {
      const commitRow = getCommitId.get(projectId, commit.hash) as { id: number } | null;
      if (!commitRow) continue;

      const commitTime = commit.timestamp;

      for (const session of windows) {
        // Check if commit timestamp falls within the session window
        if (commitTime >= session.createdAt && commitTime <= session.modifiedAt) {
          const matchType = session.hasBashGitCommit ? "direct" : "inferred";
          insertLink.run(session.id, commitRow.id, matchType);
        }
      }
    }
  });

  tx();
}

/**
 * Scan and index git commits for a single project.
 */
export async function scanProjectCommits(
  db: Database,
  projectId: number,
  projectPath: string
) {
  if (!(await isGitRepo(projectPath))) return;

  // Get last indexed commit
  const project = db
    .prepare("SELECT last_indexed_commit FROM projects WHERE id = ?")
    .get(projectId) as { last_indexed_commit: string | null } | null;

  const sinceHash = project?.last_indexed_commit ?? null;

  // On first run, find the earliest session date to bound the scan
  let afterDate: string | null = null;
  if (!sinceHash) {
    const earliest = db
      .prepare(
        "SELECT MIN(created_at) as earliest FROM sessions WHERE project_id = ? AND created_at IS NOT NULL AND created_at != ''"
      )
      .get(projectId) as { earliest: string | null } | null;
    afterDate = earliest?.earliest ?? null;
    if (!afterDate) return; // No sessions yet, nothing to match against
  }

  const commits = await parseGitLog(projectPath, sinceHash, afterDate);
  if (commits.length === 0) return;

  // Insert commits into DB
  const insertCommit = db.prepare(
    `INSERT OR IGNORE INTO commits (project_id, hash, short_hash, subject, body, author, author_email, timestamp, files_changed, insertions, deletions, is_claude_authored)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const tx = db.transaction(() => {
    for (const c of commits) {
      insertCommit.run(
        projectId,
        c.hash,
        c.shortHash,
        c.subject,
        c.body,
        c.author,
        c.authorEmail,
        c.timestamp,
        c.filesChanged,
        c.insertions,
        c.deletions,
        c.isClaude ? 1 : 0
      );
    }
  });
  tx();

  // Match commits to sessions
  matchCommitsToSessions(db, projectId, commits);

  // Update last indexed commit (first commit in the list is newest)
  const newestHash = commits[0].hash;
  db.prepare("UPDATE projects SET last_indexed_commit = ? WHERE id = ?").run(
    newestHash,
    projectId
  );

  console.log(
    `[git-parser] ${projectPath}: indexed ${commits.length} commits`
  );
}

/**
 * Get the remote URL for the 'origin' remote of a git repository.
 */
export async function getRemoteUrl(projectPath: string): Promise<string | null> {
  const output = await gitExec(projectPath, ["remote", "get-url", "origin"]);
  return output ? output.trim() : null;
}

/**
 * Convert a git remote URL (SSH or HTTPS) to a web URL.
 * Handles:
 *   git@host:user/repo.git       → https://host/user/repo
 *   ssh://git@host/user/repo.git → https://host/user/repo
 *   https://host/user/repo.git   → https://host/user/repo
 */
export function parseRemoteToWebUrl(remoteUrl: string): string | null {
  let url = remoteUrl.trim();

  // SSH format: git@host:user/repo.git
  const sshMatch = url.match(/^[\w-]+@([^:]+):(.+?)(?:\.git)?$/);
  if (sshMatch) {
    return `https://${sshMatch[1]}/${sshMatch[2]}`;
  }

  // ssh:// prefix: ssh://git@host/user/repo.git
  const sshProtoMatch = url.match(/^ssh:\/\/[\w-]+@([^/]+)\/(.+?)(?:\.git)?$/);
  if (sshProtoMatch) {
    return `https://${sshProtoMatch[1]}/${sshProtoMatch[2]}`;
  }

  // HTTPS/HTTP format: https://host/user/repo.git
  const httpsMatch = url.match(/^https?:\/\/([^/]+)\/(.+?)(?:\.git)?$/);
  if (httpsMatch) {
    return `https://${httpsMatch[1]}/${httpsMatch[2]}`;
  }

  return null;
}

/**
 * Scan all projects for git commits.
 */
export async function scanAllProjectCommits(db: Database) {
  const projects = db
    .prepare("SELECT id, path FROM projects WHERE path IS NOT NULL AND path != ''")
    .all() as { id: number; path: string }[];

  let count = 0;
  for (const project of projects) {
    try {
      await scanProjectCommits(db, project.id, project.path);
      count++;
    } catch (e) {
      console.error(`[git-parser] Error scanning ${project.path}:`, e);
    }
  }

  if (count > 0) {
    console.log(`[git-parser] Scanned ${count} projects for commits`);
  }
}
