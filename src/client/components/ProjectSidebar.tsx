import { Link } from "react-router-dom";
import { useProjects } from "../hooks/useProjects";
import ProjectSidebarIcon from "./ProjectSidebarIcon";

export default function ProjectSidebar() {
  const { projects, costs } = useProjects();

  return (
    <div className="hidden md:flex fixed left-0 top-0 bottom-0 w-[68px] bg-[#0d1117] flex-col items-center" style={{ zIndex: 60 }}>
      {/* Home / brand mark */}
      <Link
        to="/"
        className="flex items-center justify-center w-12 h-12 mt-3 mb-1 rounded-2xl bg-surface-light hover:bg-primary/20 transition-colors group"
      >
        <img src="/logo.png" alt="Cloviz" className="w-8 h-8" />
      </Link>

      {/* Divider */}
      <div className="w-8 h-px bg-border my-2" />

      {/* Scrollable project list */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden sidebar-scroll w-full">
        <div className="flex flex-col items-center">
          {projects.map((p) => (
            <ProjectSidebarIcon
              key={p.id}
              project={p}
              cost={costs[p.id]}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
