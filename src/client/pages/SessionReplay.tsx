import { useParams, Link } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import { useWebSocket } from "../hooks/useWebSocket";
import ChatMessage from "../components/ChatMessage";
import LoadingSkeleton from "../components/LoadingSkeleton";
import { formatCost } from "../utils/format";
import { useState } from "react";

interface CostWithSavings {
  inputCost: number;
  outputCost: number;
  cacheWriteCost: number;
  cacheReadCost: number;
  totalCost: number;
  costWithoutCache: number;
  cacheSavings: number;
}

interface SessionData {
  id: string;
  summary?: string;
  first_prompt?: string;
  message_count: number;
  created_at?: string;
  modified_at?: string;
  git_branch?: string;
  slug?: string;
  project_name?: string;
  project_path?: string;
  sessionCost?: CostWithSavings | null;
}

interface MessagesResponse {
  messages: any[];
  toolUses: any[];
  total: number;
  limit: number;
  offset: number;
}

export default function SessionReplay() {
  const { id } = useParams<{ id: string }>();
  const [page, setPage] = useState(0);
  const limit = 100;

  const { data: session } = useApi<SessionData>(`/api/sessions/${id}`, [id]);
  const { data: msgData, loading, refetch } = useApi<MessagesResponse>(
    `/api/sessions/${id}/messages?limit=${limit}&offset=${page * limit}`,
    [id, page]
  );

  useWebSocket("session:updated", (data: any) => {
    if (data?.path?.includes(id)) refetch();
  });

  const messages = msgData?.messages ?? [];
  const toolUses = msgData?.toolUses ?? [];
  const total = msgData?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      {/* Session header */}
      <div className="bg-surface-light rounded-xl p-5 border border-border">
        <div className="flex items-start justify-between">
          <div>
            <Link
              to="/sessions"
              className="text-xs text-gray-500 hover:text-gray-400"
            >
              &larr; Back to sessions
            </Link>
            <h2 className="text-lg font-semibold mt-1">
              {session?.summary || session?.first_prompt || session?.slug || id}
            </h2>
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
              {session?.project_name && (
                <span className="text-primary">{session.project_name}</span>
              )}
              {session?.git_branch && (
                <span className="bg-surface-lighter px-1.5 py-0.5 rounded">
                  {session.git_branch}
                </span>
              )}
              {session?.message_count && (
                <span>{session.message_count} total msgs</span>
              )}
              {session?.created_at && (
                <span>
                  {new Date(session.created_at).toLocaleDateString()}
                </span>
              )}
              {session?.sessionCost && session.sessionCost.totalCost > 0 && (
                <span
                  className="text-primary font-medium bg-primary/10 px-1.5 py-0.5 rounded"
                  title={`Input: ${formatCost(session.sessionCost.inputCost)} | Output: ${formatCost(session.sessionCost.outputCost)} | Cache Write: ${formatCost(session.sessionCost.cacheWriteCost)} | Cache Read: ${formatCost(session.sessionCost.cacheReadCost)} | Savings: ${formatCost(session.sessionCost.cacheSavings)}`}
                >
                  Cost: {formatCost(session.sessionCost.totalCost)}
                </span>
              )}
            </div>
          </div>
          <div className="text-xs text-gray-600 font-mono">{id?.slice(0, 8)}</div>
        </div>
      </div>

      {/* Pagination top */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">
            {total} messages (showing {page * limit + 1}-
            {Math.min((page + 1) * limit, total)})
          </span>
          <div className="flex gap-2">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1 rounded bg-surface-light text-gray-400 disabled:opacity-30 hover:bg-surface-lighter"
            >
              Prev
            </button>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 rounded bg-surface-light text-gray-400 disabled:opacity-30 hover:bg-surface-lighter"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="bg-surface-light rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-4">
            <LoadingSkeleton variant="text" count={8} />
          </div>
        ) : messages.length === 0 ? (
          <div className="p-6 text-gray-500 text-center">
            No messages indexed yet. Messages are indexed on first view.
          </div>
        ) : (
          <div className="divide-y divide-border/50 px-4">
            {messages.map((msg: any) => (
              <ChatMessage key={msg.id} message={msg} toolUses={toolUses} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
