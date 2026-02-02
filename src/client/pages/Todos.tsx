import { useApi } from "../hooks/useApi";
import { useWebSocket } from "../hooks/useWebSocket";
import { useState } from "react";

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

export default function Todos() {
  const [statusFilter, setStatusFilter] = useState("");
  const queryStr = statusFilter ? `?status=${statusFilter}` : "";

  const { data, loading, refetch } = useApi<TodosResponse>(
    `/api/todos${queryStr}`,
    [statusFilter]
  );

  useWebSocket("todo:changed", refetch);

  const todos = data?.todos ?? [];
  const counts = data?.statusCounts ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Todos ({todos.length})
        </h2>
      </div>

      {/* Status filter chips */}
      <div className="flex gap-2">
        <button
          onClick={() => setStatusFilter("")}
          className={`px-3 py-1 rounded-full text-xs ${
            !statusFilter
              ? "bg-primary text-gray-900 font-medium"
              : "bg-surface-light text-gray-400 hover:bg-surface-lighter"
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
            className={`px-3 py-1 rounded-full text-xs ${
              statusFilter === c.status
                ? "bg-primary text-gray-900 font-medium"
                : "bg-surface-light text-gray-400 hover:bg-surface-lighter"
            }`}
          >
            {c.status} ({c.count})
          </button>
        ))}
      </div>

      {/* Todo list */}
      <div className="bg-surface-light rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-4 bg-surface-lighter rounded animate-pulse skeleton-shimmer" style={{width: `${50 + i * 10}%`}} />)}</div>
        ) : todos.length === 0 ? (
          <div className="p-6 text-gray-500 text-center">
            No todos found
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {todos.map((todo) => (
              <div key={todo.id} className="px-5 py-3">
                <div className="flex items-start gap-3">
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded mt-0.5 ${
                      STATUS_COLORS[todo.status] ?? STATUS_COLORS.pending
                    }`}
                  >
                    {todo.status}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-200">
                      {todo.content}
                    </div>
                    {todo.active_form && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        {todo.active_form}
                      </div>
                    )}
                    <div className="text-[10px] text-gray-600 mt-1 font-mono">
                      {todo.session_id?.slice(0, 8)}
                      {todo.agent_id &&
                        todo.agent_id !== todo.session_id &&
                        ` / agent:${todo.agent_id.slice(0, 8)}`}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
