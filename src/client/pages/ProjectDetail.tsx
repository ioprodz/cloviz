import { useParams, Link } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import StatsCard from "../components/StatsCard";
import SessionList from "../components/SessionList";
import LoadingSkeleton from "../components/LoadingSkeleton";
import { formatCost } from "../utils/format";

interface CostWithSavings {
  inputCost: number;
  outputCost: number;
  cacheWriteCost: number;
  cacheReadCost: number;
  totalCost: number;
  costWithoutCache: number;
  cacheSavings: number;
}

interface ProjectAnalytics {
  project: {
    id: number;
    path: string;
    display_name: string;
  };
  costs: CostWithSavings;
  sessionCount: number;
  messageCount: number;
}

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

interface SessionsResponse {
  sessions: Session[];
  total: number;
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, loading } = useApi<ProjectAnalytics>(
    `/api/projects/${id}/analytics`,
    [id]
  );
  const { data: sessionsData, loading: sessionsLoading } =
    useApi<SessionsResponse>(`/api/projects/${id}`, [id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton variant="card" count={4} />
      </div>
    );
  }

  if (!data) return null;

  const { project, costs, sessionCount, messageCount } = data;
  const sessions = sessionsData?.sessions ?? [];

  const savingsPct =
    costs.costWithoutCache > 0
      ? ((costs.cacheSavings / costs.costWithoutCache) * 100).toFixed(0)
      : "0";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-surface-light rounded-xl p-5 border border-border">
        <Link to="/" className="text-xs text-gray-500 hover:text-gray-400">
          &larr; Back to projects
        </Link>
        <h2 className="text-lg font-semibold mt-1">{project.display_name}</h2>
        <div className="text-xs text-gray-500 mt-1">{project.path}</div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard
          label="Total Cost"
          value={formatCost(costs.totalCost)}
        />
        <StatsCard label="Sessions" value={sessionCount} />
        <StatsCard
          label="Messages"
          value={messageCount.toLocaleString()}
        />
        <StatsCard
          label="Cache Savings"
          value={formatCost(costs.cacheSavings)}
          sub={`${savingsPct}% saved`}
          accent="#10b981"
        />
      </div>

      {/* Session list */}
      <div className="bg-surface-light rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h3 className="text-sm font-medium text-gray-400">
            Sessions ({sessions.length})
          </h3>
        </div>
        {sessionsLoading ? (
          <div className="p-4">
            <LoadingSkeleton variant="text" count={5} />
          </div>
        ) : (
          <SessionList sessions={sessions} />
        )}
      </div>
    </div>
  );
}
