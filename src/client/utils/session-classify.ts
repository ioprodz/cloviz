import type { EnrichedSession } from "../components/SessionCard";

export type KanbanCategory = "plan" | "implementation" | "validate" | "done";

export interface KanbanColumnDef {
  key: KanbanCategory;
  label: string;
  color: string;
  bgClass: string;
  textClass: string;
}

export const KANBAN_COLUMNS: KanbanColumnDef[] = [
  {
    key: "plan",
    label: "Plan",
    color: "#3b82f6",
    bgClass: "bg-blue-500/15",
    textClass: "text-blue-400",
  },
  {
    key: "implementation",
    label: "Implementation",
    color: "#d97706",
    bgClass: "bg-primary/15",
    textClass: "text-primary",
  },
  {
    key: "validate",
    label: "Validate",
    color: "#8b5cf6",
    bgClass: "bg-violet-500/15",
    textClass: "text-violet-400",
  },
  {
    key: "done",
    label: "Done",
    color: "#10b981",
    bgClass: "bg-emerald-500/15",
    textClass: "text-emerald-400",
  },
];

const DONE_THRESHOLD_MS = 30 * 60 * 1000;
const VALIDATE_THRESHOLD_MS = 5 * 60 * 1000;

export function classifySession(session: EnrichedSession): KanbanCategory {
  const now = Date.now();
  const modifiedMs = session.modified_at
    ? new Date(session.modified_at).getTime()
    : 0;
  const idleMs = now - modifiedMs;
  const hasWrites = session.files_written_count > 0;

  if (idleMs > DONE_THRESHOLD_MS) return "done";
  if (hasWrites && idleMs > VALIDATE_THRESHOLD_MS) return "validate";
  if (hasWrites) return "implementation";
  return "plan";
}

export function classifySessions(
  sessions: EnrichedSession[]
): Record<KanbanCategory, EnrichedSession[]> {
  const result: Record<KanbanCategory, EnrichedSession[]> = {
    plan: [],
    implementation: [],
    validate: [],
    done: [],
  };
  for (const session of sessions) {
    result[classifySession(session)].push(session);
  }
  return result;
}
