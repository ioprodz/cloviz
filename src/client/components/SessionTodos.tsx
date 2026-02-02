import { useState } from "react";
import { useApi } from "../hooks/useApi";
import { useWebSocket } from "../hooks/useWebSocket";

interface Todo {
  id: number;
  source_file: string;
  session_id: string;
  agent_id: string;
  content: string;
  status: string;
  active_form: string;
}

interface TodosResponse {
  todos: Todo[];
  statusCounts: { status: string; count: number }[];
}

const STATUS_COLORS: Record<string, string> = {
  completed: "text-green-400 bg-green-900/20",
  in_progress: "text-yellow-400 bg-yellow-900/20",
  pending: "text-gray-400 bg-gray-800",
};

export default function SessionTodos({ sessionId }: { sessionId: string }) {
  const [statusFilter, setStatusFilter] = useState("");
  const queryStr = statusFilter
    ? `?session=${sessionId}&status=${statusFilter}`
    : `?session=${sessionId}`;

  const { data, loading, refetch } = useApi<TodosResponse>(
    `/api/todos${queryStr}`,
    [sessionId, statusFilter]
  );

  useWebSocket("todo:changed", refetch);

  const todos = data?.todos ?? [];
  const counts = data?.statusCounts ?? [];

  if (loading) {
    return (
      <div className="p-3 space-y-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-3 bg-surface-lighter rounded animate-pulse skeleton-shimmer"
            style={{ width: `${40 + i * 15}%` }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="py-1">
      <div className="px-3 py-2 text-[10px] font-medium text-gray-500 uppercase tracking-wider">
        Todos ({todos.length})
      </div>

      {/* Status filter chips */}
      <div className="flex gap-1.5 px-3 pb-2 flex-wrap">
        <button
          onClick={() => setStatusFilter("")}
          className={`px-2 py-0.5 rounded-full text-[10px] ${
            !statusFilter
              ? "bg-primary text-gray-900 font-medium"
              : "bg-surface-lighter text-gray-400 hover:bg-surface-light"
          }`}
        >
          All
        </button>
        {counts.map((c) => (
          <button
            key={c.status}
            onClick={() =>
              setStatusFilter(statusFilter === c.status ? "" : c.status)
            }
            className={`px-2 py-0.5 rounded-full text-[10px] ${
              statusFilter === c.status
                ? "bg-primary text-gray-900 font-medium"
                : "bg-surface-lighter text-gray-400 hover:bg-surface-light"
            }`}
          >
            {c.status} ({c.count})
          </button>
        ))}
      </div>

      {/* Todo list */}
      {todos.length === 0 ? (
        <div className="p-4 text-xs text-gray-600">
          No todos in this session
        </div>
      ) : (
        <div className="divide-y divide-border/50">
          {todos.map((todo) => (
            <div key={todo.id} className="px-3 py-2">
              <div className="flex items-start gap-2">
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0 ${
                    STATUS_COLORS[todo.status] ?? STATUS_COLORS.pending
                  }`}
                >
                  {todo.status}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-200 break-words">
                    {todo.content}
                  </div>
                  {todo.active_form && (
                    <div className="text-[10px] text-gray-500 mt-0.5">
                      {todo.active_form}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
