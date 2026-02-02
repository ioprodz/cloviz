import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

interface Session {
  id: string;
  summary?: string;
  first_prompt?: string;
  message_count: number;
  created_at?: string;
  modified_at?: string;
  git_branch?: string;
  slug?: string;
  is_sidechain?: number;
  project_name?: string;
  project_path?: string;
}

interface SessionListProps {
  sessions: Session[];
  compact?: boolean;
}

export default function SessionList({
  sessions,
  compact,
}: SessionListProps) {
  if (!sessions?.length) {
    return <div className="text-gray-500 text-sm p-4">No sessions found</div>;
  }

  return (
    <div className="divide-y divide-border">
      {sessions.map((s) => (
        <Link
          key={s.id}
          to={`/sessions/${s.id}`}
          className="block p-3 hover:bg-surface-lighter transition-colors"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-200 truncate">
                {s.summary || s.first_prompt || s.slug || s.id.slice(0, 8)}
              </div>
              {!compact && s.first_prompt && s.summary && (
                <div className="text-xs text-gray-500 truncate mt-0.5">
                  {s.first_prompt}
                </div>
              )}
              <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                {s.project_name && (
                  <span className="text-primary">{s.project_name}</span>
                )}
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
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
