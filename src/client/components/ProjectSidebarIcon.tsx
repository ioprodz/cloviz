import { useState, useRef, useCallback, useEffect } from "react";
import { NavLink } from "react-router-dom";
import ProjectLogo from "./ProjectLogo";
import { formatCost } from "../utils/format";
import { extractRepoName, type Project, type CostWithSavings } from "../utils/project";
import { formatDistanceToNow } from "date-fns";

interface ProjectSidebarIconProps {
  project: Project;
  cost?: CostWithSavings;
}

export default function ProjectSidebarIcon({ project, cost }: ProjectSidebarIconProps) {
  const [hovered, setHovered] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const [cardTop, setCardTop] = useState(0);
  const [arrowOffset, setArrowOffset] = useState(0);
  const iconRef = useRef<HTMLDivElement>(null);
  const enterTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const leaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const cardRef = useRef<HTMLDivElement>(null);

  const positionCard = useCallback(() => {
    if (!iconRef.current) return;
    const rect = iconRef.current.getBoundingClientRect();
    const iconCenterY = rect.top + rect.height / 2;
    // Estimate card height ~200px, clamp to viewport
    const cardHeight = 200;
    const minTop = 8;
    const maxTop = window.innerHeight - cardHeight - 8;
    const clampedTop = Math.min(maxTop, Math.max(minTop, iconCenterY - cardHeight / 2));
    setCardTop(clampedTop);
    setArrowOffset(iconCenterY - clampedTop);
  }, []);

  const handleEnter = useCallback(() => {
    clearTimeout(leaveTimer.current);
    enterTimer.current = setTimeout(() => {
      positionCard();
      setShowCard(true);
    }, 200);
    setHovered(true);
  }, [positionCard]);

  const handleLeave = useCallback(() => {
    clearTimeout(enterTimer.current);
    leaveTimer.current = setTimeout(() => {
      setShowCard(false);
    }, 100);
    setHovered(false);
  }, []);

  useEffect(() => {
    return () => {
      clearTimeout(enterTimer.current);
      clearTimeout(leaveTimer.current);
    };
  }, []);

  const branchList = project.branches ? project.branches.split(",").filter(Boolean) : [];

  return (
    <div
      className="relative flex justify-center py-1"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <NavLink
        to={`/projects/${project.id}`}
        className="group relative flex items-center"
      >
        {({ isActive }) => (
          <>
            {/* Left pill indicator */}
            <div
              className={`absolute -left-[14px] w-1 rounded-r-full bg-white transition-all duration-200 ${
                isActive
                  ? "h-10"
                  : hovered
                    ? "h-5"
                    : "h-0 opacity-0"
              }`}
            />

            {/* Icon */}
            <div
              ref={iconRef}
              className={`rounded-xl transition-all duration-200 ${
                isActive
                  ? "ring-2 ring-primary"
                  : hovered
                    ? "ring-1 ring-gray-500"
                    : ""
              }`}
            >
              <ProjectLogo
                project={project}
                size="w-12 h-12"
                rounded="rounded-xl"
                textSize="text-sm"
              />
            </div>
          </>
        )}
      </NavLink>

      {/* Hover card */}
      {showCard && (
        <div
          className="fixed animate-sidebar-card-in"
          style={{ top: cardTop, left: 68, zIndex: 200 }}
          onMouseEnter={() => {
            clearTimeout(leaveTimer.current);
            setHovered(true);
          }}
          onMouseLeave={handleLeave}
        >
          {/* Arrow */}
          <div className="absolute left-0 -translate-y-1/2 -translate-x-[6px]" style={{ top: arrowOffset }}>
            <div className="w-3 h-3 bg-surface-light rotate-45 border-l border-b border-border" />
          </div>

          <div className="bg-surface-light border border-border rounded-xl p-4 shadow-xl shadow-black/50 w-72">
            {/* Header */}
            <div className="flex items-start gap-3 mb-3">
              <ProjectLogo project={project} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-200 truncate">
                  {project.display_name}
                </div>
                {cost && cost.totalCost > 0 && (
                  <span className="text-xs font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded inline-block mt-0.5">
                    ~{formatCost(cost.totalCost)}
                  </span>
                )}
              </div>
            </div>

            {/* Path */}
            <div className="text-[10px] text-gray-500 truncate mb-2">
              {project.path}
            </div>

            {/* Remote URL */}
            {project.remote_url && (
              <div className="text-[10px] text-primary/70 truncate mb-2">
                {extractRepoName(project.remote_url)}
              </div>
            )}

            {/* Stats */}
            <div className="flex items-center gap-4 text-xs text-gray-400 mb-2">
              <span>{project.session_count} sessions</span>
              <span>{project.message_count.toLocaleString()} msgs</span>
            </div>

            {/* Branches */}
            {branchList.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {branchList.slice(0, 4).map((b) => (
                  <span
                    key={b}
                    className="bg-surface-lighter px-1.5 py-0.5 rounded text-[10px] text-gray-500"
                  >
                    {b}
                  </span>
                ))}
                {branchList.length > 4 && (
                  <span className="text-[10px] text-gray-600">
                    +{branchList.length - 4}
                  </span>
                )}
              </div>
            )}

            {/* Last active */}
            {project.last_session && (
              <div className="text-[10px] text-gray-600">
                Last active:{" "}
                {formatDistanceToNow(new Date(project.last_session), { addSuffix: true })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
