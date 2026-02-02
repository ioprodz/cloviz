import { createContext, useContext, type ReactNode } from "react";
import { useApi } from "./useApi";
import { useWebSocket } from "./useWebSocket";
import type { Project, CostWithSavings, ProjectsResponse } from "../utils/project";

interface ProjectsContextValue {
  projects: Project[];
  costs: Record<number, CostWithSavings>;
  loading: boolean;
}

const ProjectsContext = createContext<ProjectsContextValue>({
  projects: [],
  costs: {},
  loading: true,
});

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const { data, loading, refetch } = useApi<ProjectsResponse>("/api/projects");
  const { data: costData, refetch: refetchCosts } = useApi<Record<number, CostWithSavings>>(
    "/api/projects/costs"
  );

  useWebSocket("session:updated", () => {
    refetch();
    refetchCosts();
  });

  const value: ProjectsContextValue = {
    projects: data?.projects ?? [],
    costs: costData ?? {},
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
