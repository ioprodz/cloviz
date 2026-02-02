export const MODEL_COLORS: Record<string, string> = {
  "opus-4-5": "#d97706",
  "sonnet-4-5": "#3b82f6",
  "sonnet-4": "#6366f1",
  "haiku-4-5": "#10b981",
  "haiku-3-5": "#14b8a6",
  "sonnet-3-5": "#8b5cf6",
};

export const COST_COLORS = {
  input: "#3b82f6",
  output: "#f59e0b",
  cacheWrite: "#a855f7",
  cacheRead: "#10b981",
};

export const TOOLTIP_STYLE = {
  backgroundColor: "#1f2937",
  border: "1px solid #374151",
  borderRadius: "8px",
  fontSize: "12px",
};

export const AXIS_STYLE = {
  fontSize: 10,
  fill: "#6b7280",
};

export const GRID_STYLE = {
  strokeDasharray: "3 3",
  stroke: "#374151",
};

export function getModelColor(name: string): string {
  const short = shortModelName(name);
  for (const [key, color] of Object.entries(MODEL_COLORS)) {
    if (short.includes(key)) return color;
  }
  return "#6b7280";
}

export function shortModelName(name: string): string {
  return name
    .replace("claude-", "")
    .replace(/-\d{8}$/, "");
}
