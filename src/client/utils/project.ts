export const API_BASE =
  typeof window !== "undefined"
    ? `http://${window.location.hostname}:3456`
    : "http://localhost:3456";

export const INITIALS_COLORS = [
  "from-amber-600 to-orange-700",
  "from-blue-600 to-indigo-700",
  "from-emerald-600 to-teal-700",
  "from-purple-600 to-violet-700",
  "from-rose-600 to-pink-700",
  "from-cyan-600 to-sky-700",
  "from-lime-600 to-green-700",
  "from-fuchsia-600 to-purple-700",
];

export function getInitials(name: string): string {
  const parts = name.replace(/[-_]/g, " ").split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function getColorIndex(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % INITIALS_COLORS.length;
}

export function extractRepoName(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname.replace(/^\//, "");
  } catch {
    return url;
  }
}

export interface Project {
  id: number;
  path: string;
  display_name: string;
  session_count: number;
  message_count: number;
  first_session?: string;
  last_session?: string;
  branches?: string;
  logo_path?: string | null;
  remote_url?: string | null;
}

export interface CostWithSavings {
  inputCost: number;
  outputCost: number;
  cacheWriteCost: number;
  cacheReadCost: number;
  totalCost: number;
  costWithoutCache: number;
  cacheSavings: number;
}

export interface ProjectsResponse {
  projects: Project[];
}
