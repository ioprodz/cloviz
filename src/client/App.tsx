import { BrowserRouter, Routes, Route, NavLink, Link } from "react-router-dom";
import { useState } from "react";
import WatcherToggle from "./components/WatcherToggle";
import { useWebSocketStatus } from "./hooks/useWebSocket";
import ProjectOverview from "./pages/ProjectOverview";
import ProjectDetail from "./pages/ProjectDetail";
import SessionReplay from "./pages/SessionReplay";
import Analytics from "./pages/Analytics";
import Search from "./pages/Search";

const NAV_ITEMS = [
  { path: "/", label: "Projects", icon: "P" },
  { path: "/analytics", label: "Analytics", icon: "A" },
  { path: "/search", label: "Search", icon: "Q" },
];

function NavBar() {
  const wsConnected = useWebSocketStatus();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="bg-surface border-b border-border sticky top-0 z-50">
      <div className="max-w-[1600px] mx-auto px-4">
        <div className="flex items-center h-12 gap-4">
          {/* Logo */}
          <Link to="/" className="text-primary font-bold text-lg mr-2 flex-shrink-0">
            cloviz
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-0.5 flex-1 overflow-x-auto">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/"}
                className={({ isActive }) =>
                  `px-2.5 py-1.5 text-xs rounded-md whitespace-nowrap transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-gray-400 hover:text-gray-200 hover:bg-surface-light"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
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
            <WatcherToggle />
          </div>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <div className="md:hidden pb-3 grid grid-cols-3 gap-1">
            {NAV_ITEMS.map((item) => (
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
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-950">
        <NavBar />
        <main className="max-w-[1600px] mx-auto p-4">
          <Routes>
            <Route path="/" element={<ProjectOverview />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
            <Route path="/sessions/:id" element={<SessionReplay />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/search" element={<Search />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
