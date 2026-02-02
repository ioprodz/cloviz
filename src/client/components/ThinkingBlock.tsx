import { useState } from "react";

interface ThinkingBlockProps {
  content: string;
}

export default function ThinkingBlock({ content }: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(false);

  const preview = content.slice(0, 150).replace(/\n/g, " ");

  return (
    <div className="border border-gray-700/50 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-500 hover:text-gray-400 hover:bg-surface-light transition-colors"
      >
        <svg
          className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M6 4l8 6-8 6V4z" />
        </svg>
        <span className="font-medium">Thinking</span>
        {!expanded && (
          <span className="text-gray-600 truncate">{preview}...</span>
        )}
        <span className="ml-auto text-gray-600">
          {content.length.toLocaleString()} chars
        </span>
      </button>
      {expanded && (
        <div className="px-3 py-2 text-xs text-gray-400 whitespace-pre-wrap border-t border-gray-700/50 max-h-96 overflow-y-auto font-mono">
          {content}
        </div>
      )}
    </div>
  );
}
