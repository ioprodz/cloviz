import { useApi } from "../hooks/useApi";
import { useWebSocket } from "../hooks/useWebSocket";
import { Link } from "react-router-dom";
import { useState } from "react";

interface HistoryEntry {
  id: number;
  display: string;
  timestamp: number;
  project: string;
  session_id: string;
}

// Use dashboard data which has daily activity
interface DashboardData {
  dailyActivity: {
    date: string;
    message_count: number;
    session_count: number;
    tool_call_count: number;
  }[];
  recentSessions: {
    id: string;
    summary?: string;
    first_prompt?: string;
    slug?: string;
    message_count: number;
    modified_at?: string;
    project_name?: string;
  }[];
}

export default function ActivityTimeline() {
  const { data, loading, refetch } = useApi<DashboardData>("/api/dashboard");

  useWebSocket("history:appended", refetch);

  if (loading) {
    return <div className="p-6 space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="h-4 bg-surface-lighter rounded animate-pulse skeleton-shimmer" style={{width: `${50 + i * 8}%`}} />)}</div>;
  }

  if (!data) return null;

  const { dailyActivity, recentSessions } = data;

  // Reverse daily activity for most recent first
  const reversed = [...dailyActivity].reverse();

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Activity Timeline</h2>

      {/* Recent sessions as timeline */}
      <div className="bg-surface-light rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h3 className="text-sm font-medium text-gray-400">
            Recent Sessions
          </h3>
        </div>
        <div className="divide-y divide-border/50">
          {recentSessions.map((s) => (
            <Link
              key={s.id}
              to={`/sessions/${s.id}`}
              className="flex items-center gap-4 px-5 py-3 hover:bg-surface-lighter transition-colors"
            >
              <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-200 truncate">
                  {s.summary || s.first_prompt || s.slug || s.id.slice(0, 8)}
                </div>
                <div className="text-xs text-gray-500 flex gap-2">
                  {s.project_name && <span>{s.project_name}</span>}
                  <span>{s.message_count} msgs</span>
                </div>
              </div>
              {s.modified_at && (
                <div className="text-xs text-gray-600 flex-shrink-0">
                  {new Date(s.modified_at).toLocaleDateString()}
                </div>
              )}
            </Link>
          ))}
        </div>
      </div>

      {/* Daily summary */}
      <div className="bg-surface-light rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h3 className="text-sm font-medium text-gray-400">
            Daily Summary
          </h3>
        </div>
        <div className="divide-y divide-border/50 max-h-[60vh] overflow-y-auto">
          {reversed.map((day) => (
            <div key={day.date} className="px-5 py-3 flex items-center gap-4">
              <div className="text-sm text-gray-300 w-24 flex-shrink-0 font-mono">
                {day.date}
              </div>
              <div className="flex gap-4 text-xs text-gray-500">
                <span>
                  <span className="text-gray-300 font-medium">
                    {day.session_count}
                  </span>{" "}
                  sessions
                </span>
                <span>
                  <span className="text-gray-300 font-medium">
                    {day.message_count}
                  </span>{" "}
                  messages
                </span>
                <span>
                  <span className="text-gray-300 font-medium">
                    {day.tool_call_count}
                  </span>{" "}
                  tools
                </span>
              </div>
              <div className="flex-1">
                <div
                  className="h-1.5 bg-primary/60 rounded-full"
                  style={{
                    width: `${Math.min(
                      (day.message_count / Math.max(...reversed.map((d) => d.message_count), 1)) * 100,
                      100
                    )}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
