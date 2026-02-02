import { useState } from "react";

interface ToolUseCardProps {
  name: string;
  input?: unknown;
  toolUseId?: string;
}

const TOOL_COLORS: Record<string, string> = {
  Read: "text-green-400 bg-green-900/20",
  Write: "text-blue-400 bg-blue-900/20",
  Edit: "text-yellow-400 bg-yellow-900/20",
  Bash: "text-red-400 bg-red-900/20",
  Glob: "text-purple-400 bg-purple-900/20",
  Grep: "text-purple-400 bg-purple-900/20",
  WebFetch: "text-cyan-400 bg-cyan-900/20",
  WebSearch: "text-cyan-400 bg-cyan-900/20",
  Task: "text-orange-400 bg-orange-900/20",
};

export default function ToolUseCard({
  name,
  input,
  toolUseId,
}: ToolUseCardProps) {
  const [expanded, setExpanded] = useState(false);
  const colorClass = TOOL_COLORS[name] || "text-gray-400 bg-gray-900/20";

  const inputStr =
    input !== undefined ? JSON.stringify(input, null, 2) : null;
  const preview = inputStr
    ? inputStr.slice(0, 100).replace(/\n/g, " ")
    : "";

  return (
    <div className="border border-gray-700/50 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-surface-light transition-colors"
      >
        <svg
          className={`w-3 h-3 text-gray-500 transition-transform ${expanded ? "rotate-90" : ""}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M6 4l8 6-8 6V4z" />
        </svg>
        <span className={`font-mono font-medium px-1.5 py-0.5 rounded ${colorClass}`}>
          {name}
        </span>
        {!expanded && preview && (
          <span className="text-gray-600 truncate font-mono">{preview}</span>
        )}
      </button>
      {expanded && inputStr && (
        <div className="px-3 py-2 text-xs text-gray-400 border-t border-gray-700/50 max-h-64 overflow-y-auto">
          <pre className="font-mono whitespace-pre-wrap break-all">
            {inputStr.slice(0, 5000)}
          </pre>
        </div>
      )}
    </div>
  );
}
