import { useParams, Link } from "react-router-dom";
import { useState } from "react";
import { useApi } from "../hooks/useApi";
import SessionCardGrid, {
  type EnrichedSession,
} from "../components/SessionCard";
import LoadingSkeleton from "../components/LoadingSkeleton";
import MarkdownView from "../components/MarkdownView";
import { formatCost } from "../utils/format";

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
  };
  costs: CostWithSavings;
  sessionCount: number;
  messageCount: number;
}

interface EnrichedSessionsResponse {
  sessions: EnrichedSession[];
  planSessionMap: Record<string, string[]>;
}

interface ProjectPlan {
  id: number;
  filename: string;
  content: string;
  mtime: number;
  session_ids: string[];
}

interface ProjectPlansResponse {
  plans: ProjectPlan[];
}

interface ProjectTodo {
  id: number;
  source_file: string;
  session_id: string;
  agent_id: string;
  content: string;
  status: string;
  active_form: string;
  session_summary?: string;
  session_slug?: string;
}

interface ProjectTodosResponse {
  todos: ProjectTodo[];
  statusCounts: { status: string; count: number }[];
}

const STATUS_COLORS: Record<string, string> = {
  completed: "text-green-400 bg-green-900/20",
  in_progress: "text-yellow-400 bg-yellow-900/20",
  pending: "text-gray-400 bg-gray-800",
};

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, loading } = useApi<ProjectAnalytics>(
    `/api/projects/${id}/analytics`,
    [id]
  );
  const { data: enrichedData, loading: enrichedLoading } =
    useApi<EnrichedSessionsResponse>(
      `/api/projects/${id}/sessions-enriched`,
      [id]
    );
  const { data: plansData } = useApi<ProjectPlansResponse>(
    `/api/projects/${id}/plans`,
    [id]
  );
  const { data: todosData } = useApi<ProjectTodosResponse>(
    `/api/projects/${id}/todos`,
    [id]
  );
  const [expandedPlan, setExpandedPlan] = useState<number | null>(null);
  const [logoImgFailed, setLogoImgFailed] = useState(false);

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
  const planSessionMap = enrichedData?.planSessionMap ?? {};
  const plans = plansData?.plans ?? [];

  const savingsPct =
    costs.costWithoutCache > 0
      ? ((costs.cacheSavings / costs.costWithoutCache) * 100).toFixed(0)
      : "0";

  // Build a lookup for enriched sessions by id
  const sessionById = new Map(enrichedSessions.map((s) => [s.id, s]));

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

      {/* Sessions as cards */}
      <div className="bg-surface-light rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h3 className="text-sm font-medium text-gray-400">
            Sessions ({enrichedSessions.length})
          </h3>
        </div>
        {enrichedLoading ? (
          <div className="p-4">
            <LoadingSkeleton variant="card" count={6} />
          </div>
        ) : (
          <SessionCardGrid sessions={enrichedSessions} />
        )}
      </div>

      {/* Plans section with grouped session cards */}
      {plans.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-400 px-1">
            Plans ({plans.length})
          </h3>
          {plans.map((plan) => {
            const planSessions = (
              planSessionMap[plan.filename] ?? plan.session_ids ?? []
            )
              .map((sid) => sessionById.get(sid))
              .filter(Boolean) as EnrichedSession[];

            return (
              <div
                key={plan.id}
                className="bg-surface-light rounded-xl border border-border overflow-hidden"
              >
                <button
                  onClick={() =>
                    setExpandedPlan(
                      expandedPlan === plan.id ? null : plan.id
                    )
                  }
                  className="w-full text-left px-5 py-3 hover:bg-surface-lighter transition-colors flex items-center gap-3"
                >
                  <span className="text-[10px] w-3 text-center text-gray-500">
                    {expandedPlan === plan.id ? "\u25BC" : "\u25B6"}
                  </span>
                  <span className="text-sm text-gray-200 flex-1 truncate">
                    {plan.filename.replace(".md", "")}
                  </span>
                  <span className="text-[10px] text-gray-600">
                    {new Date(plan.mtime).toLocaleDateString()}
                  </span>
                  {planSessions.length > 0 && (
                    <span className="text-[10px] bg-surface-lighter text-gray-500 px-1.5 py-0.5 rounded">
                      {planSessions.length} session
                      {planSessions.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </button>
                {expandedPlan === plan.id && (
                  <>
                    <div className="px-5 py-3 max-h-96 overflow-y-auto border-t border-border/50 bg-surface/50">
                      <MarkdownView content={plan.content} />
                    </div>
                    {planSessions.length > 0 && (
                      <div className="border-t border-border/50">
                        <SessionCardGrid sessions={planSessions} />
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Todos section */}
      {(todosData?.todos ?? []).length > 0 && (
        <div className="bg-surface-light rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center gap-3">
            <h3 className="text-sm font-medium text-gray-400">
              Todos ({todosData!.todos.length})
            </h3>
            <div className="flex gap-1.5">
              {todosData!.statusCounts.map((sc) => (
                <span
                  key={sc.status}
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    STATUS_COLORS[sc.status] ?? STATUS_COLORS.pending
                  }`}
                >
                  {sc.status}: {sc.count}
                </span>
              ))}
            </div>
          </div>
          <div className="divide-y divide-border/50">
            {todosData!.todos.map((todo) => (
              <div key={todo.id} className="px-5 py-3">
                <div className="flex items-start gap-3">
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0 ${
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
                    <div className="text-[10px] text-gray-600 mt-1">
                      <Link
                        to={`/sessions/${todo.session_id}`}
                        className="hover:text-gray-400"
                      >
                        {todo.session_summary || todo.session_slug || todo.session_id.slice(0, 8)}
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
