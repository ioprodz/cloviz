import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { formatCost } from "../utils/format";

export interface EnrichedSession {
  id: string;
  summary?: string;
  first_prompt?: string;
  message_count: number;
  created_at?: string;
  modified_at?: string;
  git_branch?: string;
  slug?: string;
  is_sidechain?: number;
  files_read_count: number;
  files_written_count: number;
  has_plan: boolean;
  todo_count: number;
  total_cost: number;
}

interface SessionCardGridProps {
  sessions: EnrichedSession[];
}

export default function SessionCardGrid({ sessions }: SessionCardGridProps) {
  if (!sessions?.length) {
    return (
      <div className="text-gray-500 text-sm p-4">No sessions found</div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 p-4">
      {sessions.map((s) => (
        <Link
          key={s.id}
          to={`/sessions/${s.id}`}
          className="bg-surface-light rounded-xl p-5 border border-border hover:border-primary/50 transition-colors"
        >
          {/* Title + Cost */}
          <div className="flex items-start justify-between gap-2">
            <div className="text-sm font-medium text-gray-200 truncate flex-1">
              {s.summary || s.first_prompt || s.slug || s.id.slice(0, 8)}
            </div>
            {s.total_cost > 0 && (
              <span className="text-xs font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded flex-shrink-0">
                {formatCost(s.total_cost)}
              </span>
            )}
          </div>

          {/* First prompt subtitle */}
          {s.first_prompt && s.summary && (
            <div className="text-xs text-gray-500 truncate mt-1">
              {s.first_prompt}
            </div>
          )}

          {/* Metadata */}
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
            {s.git_branch && (
              <span className="bg-surface-lighter px-1.5 py-0.5 rounded text-gray-400">
                {s.git_branch}
              </span>
            )}
            <span>{s.message_count} msgs</span>
            {s.modified_at && (
              <span>
                {formatDistanceToNow(new Date(s.modified_at), {
                  addSuffix: true,
                })}
              </span>
            )}
            {s.is_sidechain ? (
              <span className="text-blue-400">sidechain</span>
            ) : null}
          </div>

          {/* Stats indicators */}
          <div className="flex items-center gap-3 mt-3 text-xs">
            <span className="text-gray-400 flex items-center gap-1" title="Files read">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              {s.files_read_count}
            </span>
            <span className="text-gray-400 flex items-center gap-1" title="Files written">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              {s.files_written_count}
            </span>
            {s.has_plan && (
              <span className="text-blue-400 bg-blue-900/20 px-1.5 py-0.5 rounded">
                plan
              </span>
            )}
            {s.todo_count > 0 && (
              <span className="text-yellow-400 bg-yellow-900/20 px-1.5 py-0.5 rounded">
                {s.todo_count} todo{s.todo_count !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
