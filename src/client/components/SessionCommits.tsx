import { useApi } from "../hooks/useApi";
import { formatDistanceToNow } from "date-fns";

interface Commit {
  id: number;
  hash: string;
  short_hash: string;
  subject: string;
  body: string;
  author: string;
  author_email: string;
  timestamp: string;
  files_changed: number;
  insertions: number;
  deletions: number;
  is_claude_authored: number;
  match_type: string;
}

interface CommitsResponse {
  commits: Commit[];
}

export default function SessionCommits({ sessionId }: { sessionId: string }) {
  const { data, loading } = useApi<CommitsResponse>(
    `/api/commits/session/${sessionId}`,
    [sessionId]
  );

  if (loading) {
    return (
      <div className="p-3 text-xs text-gray-500">Loading commits...</div>
    );
  }

  const commits = data?.commits ?? [];

  if (commits.length === 0) {
    return (
      <div className="p-3 text-xs text-gray-500">
        No commits linked to this session
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/50">
      {commits.map((c) => (
        <div key={c.id} className="px-3 py-2.5 hover:bg-surface-lighter transition-colors">
          {/* Subject + badges */}
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-200 leading-snug truncate">
                {c.subject}
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {c.is_claude_authored ? (
                <span className="text-[9px] px-1 py-0.5 rounded bg-purple-900/30 text-purple-400">
                  claude
                </span>
              ) : null}
              <span
                className={`text-[9px] px-1 py-0.5 rounded ${
                  c.match_type === "direct"
                    ? "bg-green-900/30 text-green-400"
                    : "bg-gray-800 text-gray-500"
                }`}
              >
                {c.match_type}
              </span>
            </div>
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-2 mt-1.5 text-[10px] text-gray-500">
            <span className="font-mono text-gray-400">{c.short_hash}</span>
            <span>{c.author}</span>
            {c.timestamp && (
              <span>
                {formatDistanceToNow(new Date(c.timestamp), {
                  addSuffix: true,
                })}
              </span>
            )}
          </div>

          {/* Stats */}
          {c.files_changed > 0 && (
            <div className="flex items-center gap-2 mt-1 text-[10px]">
              <span className="text-gray-500">
                {c.files_changed} file{c.files_changed !== 1 ? "s" : ""}
              </span>
              {c.insertions > 0 && (
                <span className="text-green-500">+{c.insertions}</span>
              )}
              {c.deletions > 0 && (
                <span className="text-red-500">-{c.deletions}</span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
