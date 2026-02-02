import { Link } from "react-router-dom";
import { useProjects } from "../hooks/useProjects";
import ProjectLogo from "../components/ProjectLogo";
import LoadingSkeleton from "../components/LoadingSkeleton";
import { formatCost } from "../utils/format";
import { extractRepoName } from "../utils/project";
import { formatDistanceToNow } from "date-fns";

export default function ProjectOverview() {
  const { projects, costs, loading } = useProjects();

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-lg font-semibold">Projects</h2>
        <LoadingSkeleton variant="chart" />
        <LoadingSkeleton variant="card" count={6} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">
        Projects ({projects.length})
      </h2>

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
              className="rounded-xl p-5 border border-border hover:border-primary/50 transition-colors"
            >
              <div className="flex items-start gap-3">
                <ProjectLogo project={p} size="w-14 h-14" textSize="text-base" />
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
                  <div className="text-xs text-gray-500 truncate">
                    {p.path}
                  </div>
                  {p.remote_url && (
                    <a
                      href={p.remote_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[10px] text-primary/70 hover:text-primary truncate inline-flex items-center gap-1 mb-3"
                    >
                      {extractRepoName(p.remote_url)}
                      <svg className="w-2.5 h-2.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  )}
                  {!p.remote_url && <div className="mb-3" />}
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
