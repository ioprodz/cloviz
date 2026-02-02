import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import { useWebSocket } from "../hooks/useWebSocket";
import SessionList from "../components/SessionList";

interface SessionsResponse {
  sessions: any[];
  total: number;
  limit: number;
  offset: number;
}

interface ProjectsResponse {
  projects: { id: number; path: string; display_name: string }[];
}

export default function SessionBrowser() {
  const [searchParams, setSearchParams] = useSearchParams();
  const project = searchParams.get("project") || "";
  const branch = searchParams.get("branch") || "";
  const page = parseInt(searchParams.get("page") || "0");
  const limit = 30;

  const queryStr = [
    project && `project=${encodeURIComponent(project)}`,
    branch && `branch=${encodeURIComponent(branch)}`,
    `limit=${limit}`,
    `offset=${page * limit}`,
  ]
    .filter(Boolean)
    .join("&");

  const { data, loading, refetch } = useApi<SessionsResponse>(
    `/api/sessions?${queryStr}`,
    [project, branch, page]
  );

  const { data: projectsData } = useApi<ProjectsResponse>("/api/projects");

  useWebSocket("session:updated", refetch);

  const sessions = data?.sessions ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  // Collect unique branches
  const branches = [
    ...new Set(sessions.map((s: any) => s.git_branch).filter(Boolean)),
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Sessions ({total})</h2>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={project}
          onChange={(e) => {
            setSearchParams((p) => {
              if (e.target.value) p.set("project", e.target.value);
              else p.delete("project");
              p.delete("page");
              return p;
            });
          }}
          className="bg-surface-light border border-border rounded-lg px-3 py-1.5 text-sm text-gray-300"
        >
          <option value="">All Projects</option>
          {projectsData?.projects?.map((p) => (
            <option key={p.id} value={p.path}>
              {p.display_name}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Filter by branch..."
          value={branch}
          onChange={(e) => {
            setSearchParams((p) => {
              if (e.target.value) p.set("branch", e.target.value);
              else p.delete("branch");
              p.delete("page");
              return p;
            });
          }}
          className="bg-surface-light border border-border rounded-lg px-3 py-1.5 text-sm text-gray-300 w-48"
        />
      </div>

      {/* Session List */}
      <div className="bg-surface-light rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="h-4 bg-surface-lighter rounded animate-pulse skeleton-shimmer" style={{width: `${50 + i * 8}%`}} />)}</div>
        ) : (
          <SessionList sessions={sessions} />
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            disabled={page === 0}
            onClick={() =>
              setSearchParams((p) => {
                p.set("page", String(page - 1));
                return p;
              })
            }
            className="px-3 py-1 rounded bg-surface-light text-gray-400 text-sm disabled:opacity-30 hover:bg-surface-lighter"
          >
            Prev
          </button>
          <span className="text-sm text-gray-500">
            Page {page + 1} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages - 1}
            onClick={() =>
              setSearchParams((p) => {
                p.set("page", String(page + 1));
                return p;
              })
            }
            className="px-3 py-1 rounded bg-surface-light text-gray-400 text-sm disabled:opacity-30 hover:bg-surface-lighter"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
