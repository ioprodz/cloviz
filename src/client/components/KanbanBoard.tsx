import { useMemo } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { formatCost } from "../utils/format";
import {
  classifySessions,
  KANBAN_COLUMNS,
  type KanbanColumnDef,
} from "../utils/session-classify";
import type { EnrichedSession } from "./SessionCard";

export interface KanbanCommit {
  id: number;
  short_hash: string;
  subject: string;
  author: string;
  timestamp: string;
  files_changed: number;
  insertions: number;
  deletions: number;
  is_claude_authored: number;
  session_ids: string[];
}

function KanbanCard({ session: s }: { session: EnrichedSession }) {
  return (
    <Link
      to={`/sessions/${s.id}`}
      className="block bg-surface-light rounded-lg p-3 border border-border hover:border-primary/50 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-medium text-gray-200 truncate flex-1">
          {s.summary || s.first_prompt || s.slug || s.id.slice(0, 8)}
        </div>
        {s.total_cost > 0 && (
          <span className="text-[10px] font-mono text-primary bg-primary/10 px-1 py-0.5 rounded flex-shrink-0">
            {formatCost(s.total_cost)}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-gray-500">
        <span>{s.message_count} msgs</span>
        {s.modified_at && (
          <span>
            {formatDistanceToNow(new Date(s.modified_at), { addSuffix: true })}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 mt-1.5 text-[10px]">
        {s.files_written_count > 0 && (
          <span className="text-gray-400">
            {s.files_written_count} file{s.files_written_count !== 1 ? "s" : ""} edited
          </span>
        )}
        {s.commit_count > 0 && (
          <span className="text-orange-400">
            {s.commit_count} commit{s.commit_count !== 1 ? "s" : ""}
          </span>
        )}
        {s.has_plan && (
          <span className="text-blue-400 bg-blue-900/20 px-1 py-0.5 rounded">
            plan
          </span>
        )}
      </div>
    </Link>
  );
}

function CommitCard({ commit }: { commit: KanbanCommit }) {
  return (
    <div className="block bg-surface-light rounded-lg p-3 border border-emerald-500/30">
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-medium text-gray-200 truncate flex-1">
          {commit.subject}
        </div>
        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1 py-0.5 rounded flex-shrink-0">
          {commit.short_hash}
        </span>
      </div>
      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-gray-500">
        <span>{commit.author}</span>
        <span>
          {formatDistanceToNow(new Date(commit.timestamp), { addSuffix: true })}
        </span>
      </div>
      <div className="flex items-center gap-2 mt-1.5 text-[10px]">
        {commit.files_changed > 0 && (
          <span className="text-gray-400">
            {commit.files_changed} file{commit.files_changed !== 1 ? "s" : ""}
          </span>
        )}
        {commit.insertions > 0 && (
          <span className="text-green-400">+{commit.insertions}</span>
        )}
        {commit.deletions > 0 && (
          <span className="text-red-400">-{commit.deletions}</span>
        )}
        {commit.is_claude_authored ? (
          <span className="text-violet-400 bg-violet-900/20 px-1 py-0.5 rounded">
            claude
          </span>
        ) : null}
      </div>
    </div>
  );
}

type TimelineItem =
  | { kind: "session"; time: number; session: EnrichedSession }
  | { kind: "commit"; time: number; commit: KanbanCommit };

function mergeByTime(
  sessions: EnrichedSession[],
  commits?: KanbanCommit[]
): TimelineItem[] {
  const items: TimelineItem[] = sessions.map((s) => ({
    kind: "session" as const,
    time: s.modified_at ? new Date(s.modified_at).getTime() : 0,
    session: s,
  }));
  if (commits) {
    for (const c of commits) {
      items.push({
        kind: "commit" as const,
        time: new Date(c.timestamp).getTime(),
        commit: c,
      });
    }
  }
  items.sort((a, b) => b.time - a.time);
  return items;
}

function KanbanColumn({
  column,
  sessions,
  commits,
}: {
  column: KanbanColumnDef;
  sessions: EnrichedSession[];
  commits?: KanbanCommit[];
}) {
  const items = useMemo(() => mergeByTime(sessions, commits), [sessions, commits]);
  return (
    <div className="flex flex-col min-h-0">
      <div
        className={`px-3 py-2 rounded-lg ${column.bgClass} mb-2 flex items-center justify-between`}
      >
        <span className={`text-xs font-medium ${column.textClass}`}>
          {column.label}
        </span>
        <span className="text-[10px] text-gray-500">{items.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto space-y-2 max-h-[60vh] pr-0.5">
        {items.length === 0 ? (
          <div className="text-[10px] text-gray-600 text-center py-6">
            No sessions
          </div>
        ) : (
          items.map((item) =>
            item.kind === "commit" ? (
              <CommitCard key={`commit-${item.commit.id}`} commit={item.commit} />
            ) : (
              <KanbanCard key={item.session.id} session={item.session} />
            )
          )
        )}
      </div>
    </div>
  );
}

interface KanbanBoardProps {
  sessions: EnrichedSession[];
  commits?: KanbanCommit[];
}

export default function KanbanBoard({ sessions, commits }: KanbanBoardProps) {
  const classified = useMemo(() => classifySessions(sessions), [sessions]);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4">
      {KANBAN_COLUMNS.map((col) => (
        <KanbanColumn
          key={col.key}
          column={col}
          sessions={classified[col.key]}
          commits={col.key === "done" ? commits : undefined}
        />
      ))}
    </div>
  );
}
