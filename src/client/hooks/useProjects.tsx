import { createContext, useContext, type ReactNode } from "react";
import { useApi } from "./useApi";
import { useWebSocket } from "./useWebSocket";
import type { Project, CostWithSavings, ProjectsResponse } from "../utils/project";

interface ProjectsContextValue {
  projects: Project[];
  costs: Record<number, CostWithSavings>;
  activity: Record<number, number[]>;
  loading: boolean;
}

const ProjectsContext = createContext<ProjectsContextValue>({
  projects: [],
  costs: {},
  activity: {},
  loading: true,
});

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const { data, loading, refetch } = useApi<ProjectsResponse>("/api/projects");
  const { data: costData, refetch: refetchCosts } = useApi<Record<number, CostWithSavings>>(
    "/api/projects/costs"
  );
  const { data: activityData, refetch: refetchActivity } = useApi<Record<number, number[]>>(
    "/api/projects/activity"
  );

  useWebSocket("session:updated", () => {
    refetch();
    refetchCosts();
    refetchActivity();
  });

  const value: ProjectsContextValue = {
    projects: data?.projects ?? [],
    costs: costData ?? {},
    activity: activityData ?? {},
    loading,
  };

  return (
    <ProjectsContext.Provider value={value}>
      {children}
    </ProjectsContext.Provider>
  );
}

export function useProjects() {
  return useContext(ProjectsContext);
}
