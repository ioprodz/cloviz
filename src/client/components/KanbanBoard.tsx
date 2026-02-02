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

function KanbanColumn({
  column,
  sessions,
}: {
  column: KanbanColumnDef;
  sessions: EnrichedSession[];
}) {
  return (
    <div className="flex flex-col min-h-0">
      <div
        className={`px-3 py-2 rounded-lg ${column.bgClass} mb-2 flex items-center justify-between`}
      >
        <span className={`text-xs font-medium ${column.textClass}`}>
          {column.label}
        </span>
        <span className="text-[10px] text-gray-500">{sessions.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto space-y-2 max-h-[60vh]">
        {sessions.length === 0 ? (
          <div className="text-[10px] text-gray-600 text-center py-6">
            No sessions
          </div>
        ) : (
          sessions.map((s) => <KanbanCard key={s.id} session={s} />)
        )}
      </div>
    </div>
  );
}

interface KanbanBoardProps {
  sessions: EnrichedSession[];
}

export default function KanbanBoard({ sessions }: KanbanBoardProps) {
  const classified = useMemo(() => classifySessions(sessions), [sessions]);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4">
      {KANBAN_COLUMNS.map((col) => (
        <KanbanColumn
          key={col.key}
          column={col}
          sessions={classified[col.key]}
        />
      ))}
    </div>
  );
}
