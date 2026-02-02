import { BrowserRouter, Routes, Route, NavLink, Link, useMatch } from "react-router-dom";
import { useState } from "react";
import WatcherToggle from "./components/WatcherToggle";
import HooksToggle from "./components/HooksToggle";
import HooksBanner from "./components/HooksBanner";
import ProjectSidebar from "./components/ProjectSidebar";
import ProjectLogo from "./components/ProjectLogo";
import { useWebSocketStatus } from "./hooks/useWebSocket";
import { ProjectsProvider, useProjects } from "./hooks/useProjects";
import { useApi } from "./hooks/useApi";
import ProjectOverview from "./pages/ProjectOverview";
import ProjectDetail from "./pages/ProjectDetail";
import SessionReplay from "./pages/SessionReplay";
import Analytics from "./pages/Analytics";
import Search from "./pages/Search";

const GLOBAL_NAV_ITEMS = [
  { path: "/", label: "Projects" },
  { path: "/analytics", label: "Analytics" },
  { path: "/search", label: "Search" },
];

function useCurrentProject(): { id: number; display_name: string; logo_path?: string | null } | null {
  const { projects } = useProjects();
  const projectMatch = useMatch("/projects/:id");

  if (projectMatch) {
    const pid = Number(projectMatch.params.id);
    return projects.find((p) => p.id === pid) ?? null;
  }

  return null;
}

function useSessionProject(): { id: number; display_name: string; logo_path?: string | null } | null {
  const sessionMatch = useMatch("/sessions/:id");
  const sessionId = sessionMatch?.params.id;
  const { data } = useApi<{ project_id?: number }>(
    sessionId ? `/api/sessions/${sessionId}` : null,
    [sessionId]
  );
  const { projects } = useProjects();

  if (!data?.project_id) return null;
  return projects.find((p) => p.id === data.project_id) ?? null;
}

function navLinkClass(isActive: boolean) {
  return `px-2.5 py-1.5 text-xs rounded-md whitespace-nowrap transition-colors ${
    isActive
      ? "bg-primary/10 text-primary font-medium"
      : "text-gray-400 hover:text-gray-200 hover:bg-surface-light"
  }`;
}

function ProjectNav({ project }: { project: { id: number; display_name: string; logo_path?: string | null } }) {
  const projectMatch = useMatch("/projects/:id");
  const sessionMatch = useMatch("/sessions/:id");
  const analyticsMatch = useMatch("/analytics");
  const searchMatch = useMatch("/search");

  const isWork = !!(projectMatch || sessionMatch) && !analyticsMatch && !searchMatch;

  const items = [
    { to: `/projects/${project.id}`, label: "Work", active: isWork },
    { to: `/analytics?project_id=${project.id}`, label: "Analytics", active: !!analyticsMatch },
    { to: `/search?project_id=${project.id}`, label: "Search", active: !!searchMatch },
  ];

  return (
    <>
      <Link
        to={`/projects/${project.id}`}
        className="flex items-center gap-1.5 mr-1 shrink-0"
      >
        <ProjectLogo project={project} size="w-5 h-5" rounded="rounded" textSize="text-[9px]" />
        <span className="text-sm font-semibold text-gray-100 truncate max-w-[140px]">{project.display_name}</span>
      </Link>
      {items.map((item) => (
        <Link
          key={item.label}
          to={item.to}
          className={navLinkClass(item.active)}
        >
          {item.label}
        </Link>
      ))}
    </>
  );
}

function NavBar() {
  const wsConnected = useWebSocketStatus();
  const [mobileOpen, setMobileOpen] = useState(false);
  const currentProject = useCurrentProject();
  const sessionProject = useSessionProject();
  const activeProject = currentProject || sessionProject;

  return (
    <nav className="bg-surface border-b border-border sticky top-0 z-50">
      <div className="max-w-[1600px] mx-auto px-4">
        <div className="flex items-center h-12 gap-4">
          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-0.5 flex-1 overflow-x-auto">
            {activeProject ? (
              <ProjectNav project={activeProject} />
            ) : (
              <>
                <Link to="/" className="flex items-center gap-1.5 mr-2 shrink-0">
                  <img src="/logo.png" alt="Cloviz" className="w-6 h-6" />
                  <span className="text-sm font-semibold text-gray-100">Cloviz</span>
                </Link>
                {GLOBAL_NAV_ITEMS.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === "/"}
                    className={({ isActive }) => navLinkClass(isActive)}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden text-gray-400 hover:text-gray-200"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex items-center gap-2 ml-auto flex-shrink-0">
            {/* WS status */}
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                wsConnected ? "bg-green-400" : "bg-red-400"
              }`}
              title={wsConnected ? "WebSocket connected" : "WebSocket disconnected"}
            />
            <HooksToggle />
            <WatcherToggle />
          </div>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <div className="md:hidden pb-3 grid grid-cols-3 gap-1">
            {activeProject ? (
              <>
                <Link
                  to={`/projects/${activeProject.id}`}
                  onClick={() => setMobileOpen(false)}
                  className="px-3 py-2 text-xs rounded-md text-center text-gray-400 hover:bg-surface-light"
                >
                  Work
                </Link>
                <Link
                  to={`/analytics?project_id=${activeProject.id}`}
                  onClick={() => setMobileOpen(false)}
                  className="px-3 py-2 text-xs rounded-md text-center text-gray-400 hover:bg-surface-light"
                >
                  Analytics
                </Link>
                <Link
                  to={`/search?project_id=${activeProject.id}`}
                  onClick={() => setMobileOpen(false)}
                  className="px-3 py-2 text-xs rounded-md text-center text-gray-400 hover:bg-surface-light"
                >
                  Search
                </Link>
              </>
            ) : (
              GLOBAL_NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === "/"}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `px-3 py-2 text-xs rounded-md text-center ${
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-gray-400 hover:bg-surface-light"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))
            )}
          </div>
        )}
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ProjectsProvider>
        <ProjectSidebar />
        <div className="min-h-screen bg-gray-950 md:ml-[68px]">
          <NavBar />
          <HooksBanner />
          <Routes>
            <Route path="/sessions/:id" element={<SessionReplay />} />
            <Route path="*" element={
              <main className="max-w-[1600px] mx-auto p-4">
                <Routes>
                  <Route path="/" element={<ProjectOverview />} />
                  <Route path="/projects/:id" element={<ProjectDetail />} />
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="/search" element={<Search />} />
                </Routes>
              </main>
            } />
          </Routes>
        </div>
      </ProjectsProvider>
    </BrowserRouter>
  );
}
