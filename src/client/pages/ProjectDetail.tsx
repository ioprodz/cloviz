import { useParams, Link } from "react-router-dom";
import { useState } from "react";
import { useApi } from "../hooks/useApi";
import { useWebSocket } from "../hooks/useWebSocket";
import SessionCardGrid, {
  type EnrichedSession,
} from "../components/SessionCard";
import KanbanBoard from "../components/KanbanBoard";
import GanttChart from "../components/GanttChart";
import LoadingSkeleton from "../components/LoadingSkeleton";
import { formatCost } from "../utils/format";

const SESSION_VIEWS = [
  { key: "cards", label: "Cards" },
  { key: "board", label: "Board" },
  { key: "gantt", label: "Gantt" },
] as const;
type SessionView = (typeof SESSION_VIEWS)[number]["key"];

const API_BASE =
  typeof window !== "undefined"
    ? `http://${window.location.hostname}:3456`
    : "http://localhost:3456";

const INITIALS_COLORS = [
  "from-amber-600 to-orange-700",
  "from-blue-600 to-indigo-700",
  "from-emerald-600 to-teal-700",
  "from-purple-600 to-violet-700",
  "from-rose-600 to-pink-700",
  "from-cyan-600 to-sky-700",
  "from-lime-600 to-green-700",
  "from-fuchsia-600 to-purple-700",
];

function getInitials(name: string): string {
  const parts = name.replace(/[-_]/g, " ").split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function getColorIndex(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % INITIALS_COLORS.length;
}

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
    logo_path?: string | null;
    remote_url?: string | null;
  };
  costs: CostWithSavings;
  sessionCount: number;
  messageCount: number;
}

interface EnrichedSessionsResponse {
  sessions: EnrichedSession[];
  planSessionMap: Record<string, string[]>;
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
  useWebSocket("session:updated", () => { refetch(); refetchSessions(); });
  const [logoImgFailed, setLogoImgFailed] = useState(false);
  const [sessionView, setSessionView] = useState<SessionView>("cards");

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

  const logoEl = (() => {
    if (project.logo_path && !logoImgFailed) {
      return (
        <img
          src={`${API_BASE}/api/projects/logo/${project.id}`}
          alt=""
          className="w-11 h-11 rounded-lg object-contain bg-surface-lighter flex-shrink-0"
          onError={() => setLogoImgFailed(true)}
        />
      );
    }
    const initials = getInitials(project.display_name);
    const color = INITIALS_COLORS[getColorIndex(project.display_name)];
    return (
      <div className={`w-11 h-11 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center flex-shrink-0`}>
        <span className="text-sm font-bold text-white/90">{initials}</span>
      </div>
    );
  })();

  return (
    <div className="space-y-6">
      {/* Header + Stats (compact) */}
      <div className="bg-surface-light rounded-xl p-4 border border-border">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Logo + project info */}
          <div className="flex items-center gap-3 min-w-0">
            {logoEl}
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
          <KanbanBoard sessions={enrichedSessions} />
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
