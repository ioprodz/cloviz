import { Link } from "react-router-dom";
import { useState } from "react";
import { useApi } from "../hooks/useApi";
import LoadingSkeleton from "../components/LoadingSkeleton";
import { formatCost } from "../utils/format";
import { formatDistanceToNow } from "date-fns";
import { TOOLTIP_STYLE, AXIS_STYLE, GRID_STYLE } from "../utils/chart-theme";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

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

function ProjectLogo({ project }: { project: Project }) {
  const [imgFailed, setImgFailed] = useState(false);

  if (project.logo_path && !imgFailed) {
    return (
      <img
        src={`${API_BASE}/api/projects/logo/${project.id}`}
        alt=""
        className="w-9 h-9 rounded-lg object-contain bg-surface-lighter flex-shrink-0"
        onError={() => setImgFailed(true)}
      />
    );
  }

  const initials = getInitials(project.display_name);
  const color = INITIALS_COLORS[getColorIndex(project.display_name)];

  return (
    <div
      className={`w-9 h-9 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center flex-shrink-0`}
    >
      <span className="text-xs font-bold text-white/90">{initials}</span>
    </div>
  );
}

interface Project {
  id: number;
  path: string;
  display_name: string;
  session_count: number;
  message_count: number;
  first_session?: string;
  last_session?: string;
  branches?: string;
  logo_path?: string | null;
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

interface ProjectsResponse {
  projects: Project[];
}

export default function ProjectOverview() {
  const { data, loading } = useApi<ProjectsResponse>("/api/projects");
  const { data: costData } = useApi<Record<number, CostWithSavings>>(
    "/api/projects/costs"
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-lg font-semibold">Projects</h2>
        <LoadingSkeleton variant="chart" />
        <LoadingSkeleton variant="card" count={6} />
      </div>
    );
  }

  const projects = data?.projects ?? [];
  const costs = costData || {};

  // Top 10 projects by cost for bar chart
  const costChartData = projects
    .map((p) => ({
      name: p.display_name,
      cost: costs[p.id]?.totalCost || 0,
    }))
    .filter((d) => d.cost > 0)
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">
        Projects ({projects.length})
      </h2>

      {/* Cost by Project bar chart */}
      {costChartData.length > 0 && (
        <div className="bg-surface-light rounded-xl p-5 border border-border">
          <h3 className="text-sm font-medium text-gray-400 mb-4">
            Cost by Project
          </h3>
          <ResponsiveContainer
            width="100%"
            height={Math.max(200, costChartData.length * 32)}
          >
            <BarChart
              data={costChartData}
              layout="vertical"
              margin={{ left: 120 }}
            >
              <CartesianGrid {...GRID_STYLE} />
              <XAxis
                type="number"
                tick={AXIS_STYLE}
                tickFormatter={(v) => formatCost(v)}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                width={120}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(value: number) => [formatCost(value), "Cost"]}
              />
              <Bar dataKey="cost" fill="#d97706" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => {
          const branchList = p.branches
            ? p.branches.split(",").filter(Boolean)
            : [];
          const projectCost = costs[p.id];
          return (
            <Link
              key={p.id}
              to={`/projects/${p.id}`}
              className="bg-surface-light rounded-xl p-5 border border-border hover:border-primary/50 transition-colors"
            >
              <div className="flex items-start gap-3">
                <ProjectLogo project={p} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div className="text-sm font-medium text-gray-200 mb-1 truncate">
                      {p.display_name}
                    </div>
                    {projectCost && projectCost.totalCost > 0 && (
                      <span className="text-xs font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded flex-shrink-0 ml-2">
                        ~{formatCost(projectCost.totalCost)}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 truncate mb-3">
                    {p.path}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span>{p.session_count} sessions</span>
                    <span>{p.message_count.toLocaleString()} msgs</span>
                  </div>
                  {branchList.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {branchList.slice(0, 5).map((b) => (
                        <span
                          key={b}
                          className="bg-surface-lighter px-1.5 py-0.5 rounded text-[10px] text-gray-500"
                        >
                          {b}
                        </span>
                      ))}
                      {branchList.length > 5 && (
                        <span className="text-[10px] text-gray-600">
                          +{branchList.length - 5}
                        </span>
                      )}
                    </div>
                  )}
                  {p.last_session && (
                    <div className="text-[10px] text-gray-600 mt-2">
                      Last active:{" "}
                      {formatDistanceToNow(new Date(p.last_session), { addSuffix: true })}
                    </div>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
