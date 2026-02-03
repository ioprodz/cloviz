import { useParams, Link } from "react-router-dom";
import { useState, useMemo } from "react";
import { useApi } from "../hooks/useApi";
import { useWebSocket } from "../hooks/useWebSocket";
import SessionCardGrid, {
  type EnrichedSession,
} from "../components/SessionCard";
import KanbanBoard, { type KanbanCommit } from "../components/KanbanBoard";
import GanttChart from "../components/GanttChart";
import LoadingSkeleton from "../components/LoadingSkeleton";
import ProjectLogo from "../components/ProjectLogo";
import ActivityArea from "../components/ActivityArea";
import { formatCost } from "../utils/format";
import { type CostWithSavings } from "../utils/project";

const SESSION_VIEWS = [
  { key: "board", label: "Board" },
  { key: "cards", label: "Cards" },
  { key: "gantt", label: "Gantt" },
] as const;
type SessionView = (typeof SESSION_VIEWS)[number]["key"];

interface DailyCost {
  date: string;
  totalCost: number;
  inputCost: number;
  outputCost: number;
  cacheWriteCost: number;
  cacheReadCost: number;
}

interface ProjectAnalytics {
  project: {
    id: number;
    path: string;
    display_name: string;
    logo_path?: string | null;
    remote_url?: string | null;
  };
  costs: CostWithSavings;
  dailyCosts: DailyCost[];
  sessionCount: number;
  messageCount: number;
}

interface EnrichedSessionsResponse {
  sessions: EnrichedSession[];
  planSessionMap: Record<string, string[]>;
  total: number;
}

interface CommitsResponse {
  commits: KanbanCommit[];
  total: number;
}

const PAGE_SIZE = 50;

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [page, setPage] = useState(0);
  const { data, loading, refetch } = useApi<ProjectAnalytics>(
    `/api/projects/${id}/analytics`,
    [id]
  );
  const { data: enrichedData, loading: enrichedLoading, refetch: refetchSessions } =
    useApi<EnrichedSessionsResponse>(
      `/api/projects/${id}/sessions-enriched?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`,
      [id, page]
    );
  const { data: commitsData, refetch: refetchCommits } = useApi<CommitsResponse>(
    `/api/commits/project/${id}?limit=50`,
    [id]
  );
  useWebSocket("session:updated", () => { refetch(); refetchSessions(); refetchCommits(); });
  const [sessionView, setSessionView] = useState<SessionView>("board");

  // Prepare activity data for the header chart (last 30 days, fill missing)
  // Must be before early returns to follow React hooks rules
  const activityData = useMemo(() => {
    const dailyCosts = data?.dailyCosts;
    if (!dailyCosts || dailyCosts.length === 0) return [];

    const today = new Date();
    const days: string[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }

    const costMap = new Map(dailyCosts.map((d) => [d.date, d]));
    return days.map((day) => {
      const dc = costMap.get(day);
      return {
        input: dc?.inputCost ?? 0,
        output: dc?.outputCost ?? 0,
        cache: (dc?.cacheWriteCost ?? 0) + (dc?.cacheReadCost ?? 0),
      };
    });
  }, [data?.dailyCosts]);

  if (loading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton variant="card" count={4} />
      </div>
    );
  }

  if (!data) return null;

  const { project, costs, sessionCount, messageCount } = data;
  const enrichedSessions = enrichedData?.sessions ?? [];

  const savingsPct =
    costs.costWithoutCache > 0
      ? ((costs.cacheSavings / costs.costWithoutCache) * 100).toFixed(0)
      : "0";

  return (
    <div className="space-y-6">
      {/* Header + Stats (compact) */}
      <div className="bg-surface-light rounded-xl p-4 border border-border relative overflow-hidden">
        {activityData.length > 0 && activityData.some((d) => d.input + d.output + d.cache > 0) && (
          <div className="absolute bottom-0 left-0 right-0 pointer-events-none opacity-60">
            <ActivityArea data={activityData} width={800} height={100} />
          </div>
        )}
        <div className="flex items-center gap-4 flex-wrap relative z-10">
          {/* Logo + project info */}
          <div className="flex items-center gap-3 min-w-0">
            <ProjectLogo project={project} size="w-11 h-11" textSize="text-sm" />
            <div className="min-w-0">
              <Link to="/" className="text-[10px] text-gray-500 hover:text-gray-400">
                &larr; Projects
              </Link>
              <h2 className="text-base font-semibold leading-tight truncate">{project.display_name}</h2>
              <div className="text-[10px] text-gray-500 truncate">{project.path}</div>
              {project.remote_url && (
                <a
                  href={project.remote_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-primary/70 hover:text-primary truncate inline-flex items-center gap-1"
                >
                  {(() => {
                    try {
                      const u = new URL(project.remote_url);
                      return u.host + u.pathname;
                    } catch {
                      return project.remote_url;
                    }
                  })()}
                  <svg className="w-2.5 h-2.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
            </div>
          </div>

          {/* Stats inline */}
          <div className="flex items-center gap-4 ml-auto flex-shrink-0">
            <div className="text-center px-3">
              <div className="text-lg font-bold text-gray-100">{formatCost(costs.totalCost)}</div>
              <div className="text-[10px] text-gray-500">Cost</div>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center px-3">
              <div className="text-lg font-bold text-gray-100">{sessionCount}</div>
              <div className="text-[10px] text-gray-500">Sessions</div>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center px-3">
              <div className="text-lg font-bold text-gray-100">{messageCount.toLocaleString()}</div>
              <div className="text-[10px] text-gray-500">Messages</div>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center px-3">
              <div className="text-lg font-bold text-emerald-400">{formatCost(costs.cacheSavings)}</div>
              <div className="text-[10px] text-gray-500">{savingsPct}% saved</div>
            </div>
          </div>
        </div>
      </div>

      {/* Sessions */}
      <div className="bg-surface-light rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-400">
            Sessions ({enrichedData?.total ?? enrichedSessions.length})
          </h3>
          <div className="flex gap-1 bg-surface rounded-lg p-0.5 border border-border">
            {SESSION_VIEWS.map((v) => (
              <button
                key={v.key}
                onClick={() => {
                  setSessionView(v.key);
                  if (v.key !== "gantt") setPage(0);
                }}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  sessionView === v.key
                    ? "bg-primary/15 text-primary font-medium"
                    : "text-gray-500 hover:text-gray-300 hover:bg-surface-lighter"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
        {enrichedLoading && sessionView !== "gantt" ? (
          <div className="p-4">
            <LoadingSkeleton variant="card" count={6} />
          </div>
        ) : sessionView === "cards" ? (
          <SessionCardGrid sessions={enrichedSessions} />
        ) : sessionView === "board" ? (
          <KanbanBoard sessions={enrichedSessions} commits={commitsData?.commits} />
        ) : (
          <GanttChart projectId={id!} />
        )}
        {/* Pagination controls (hidden for Gantt which manages its own data) */}
        {sessionView !== "gantt" && (enrichedData?.total ?? 0) > PAGE_SIZE && (
          <div className="px-5 py-3 border-t border-border flex items-center justify-between text-sm">
            <span className="text-gray-500">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, enrichedData?.total ?? 0)} of {enrichedData?.total ?? 0}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 rounded bg-surface text-gray-400 disabled:opacity-30 hover:bg-surface-lighter"
              >
                Prev
              </button>
              <button
                disabled={(page + 1) * PAGE_SIZE >= (enrichedData?.total ?? 0)}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 rounded bg-surface text-gray-400 disabled:opacity-30 hover:bg-surface-lighter"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
