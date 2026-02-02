import { useState, useMemo } from "react";
import { diffLines, type Change } from "diff";

interface DiffViewerProps {
  oldContent: string;
  newContent: string;
  fileName: string;
  onClose: () => void;
}

export default function DiffViewer({
  oldContent,
  newContent,
  fileName,
  onClose,
}: DiffViewerProps) {
  const [unified, setUnified] = useState(true);

  const changes = useMemo(
    () => diffLines(oldContent, newContent),
    [oldContent, newContent]
  );

  const hasChanges = changes.some((c) => c.added || c.removed);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-surface rounded-xl border border-border shadow-2xl w-[90vw] max-w-[1200px] max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-medium text-gray-200">{fileName}</h3>
            <div className="flex gap-1">
              <button
                onClick={() => setUnified(true)}
                className={`px-2 py-0.5 text-xs rounded ${
                  unified
                    ? "bg-primary/20 text-primary"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                Unified
              </button>
              <button
                onClick={() => setUnified(false)}
                className={`px-2 py-0.5 text-xs rounded ${
                  !unified
                    ? "bg-primary/20 text-primary"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                Side by Side
              </button>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 text-lg leading-none"
          >
            &times;
          </button>
        </div>

        {/* Diff content */}
        <div className="flex-1 overflow-auto">
          {!hasChanges ? (
            <div className="p-6 text-center text-gray-500 text-sm">
              No changes detected
            </div>
          ) : unified ? (
            <UnifiedView changes={changes} />
          ) : (
            <SideBySideView changes={changes} />
          )}
        </div>
      </div>
    </div>
  );
}

function UnifiedView({ changes }: { changes: Change[] }) {
  let lineNum = 0;

  return (
    <pre className="text-xs font-mono p-0 m-0">
      {changes.map((change, i) => {
        const lines = change.value.replace(/\n$/, "").split("\n");
        return lines.map((line, j) => {
          if (!change.added && !change.removed) lineNum++;
          const cls = change.added
            ? "diff-add"
            : change.removed
              ? "diff-remove"
              : "diff-context";
          const prefix = change.added ? "+" : change.removed ? "-" : " ";
          return (
            <div key={`${i}-${j}`} className={cls}>
              <span className="inline-block w-12 text-right text-gray-600 mr-3 select-none">
                {!change.added && !change.removed ? lineNum : ""}
              </span>
              <span className="text-gray-600 mr-1">{prefix}</span>
              {line}
            </div>
          );
        });
      })}
    </pre>
  );
}

function SideBySideView({ changes }: { changes: Change[] }) {
  const leftLines: { text: string; type: string }[] = [];
  const rightLines: { text: string; type: string }[] = [];

  for (const change of changes) {
    const lines = change.value.replace(/\n$/, "").split("\n");
    if (change.removed) {
      for (const line of lines) {
        leftLines.push({ text: line, type: "removed" });
        rightLines.push({ text: "", type: "empty" });
      }
    } else if (change.added) {
      for (const line of lines) {
        leftLines.push({ text: "", type: "empty" });
        rightLines.push({ text: line, type: "added" });
      }
    } else {
      for (const line of lines) {
        leftLines.push({ text: line, type: "context" });
        rightLines.push({ text: line, type: "context" });
      }
    }
  }

  return (
    <div className="grid grid-cols-2 divide-x divide-border">
      <pre className="text-xs font-mono p-0 m-0">
        {leftLines.map((line, i) => (
          <div
            key={i}
            className={
              line.type === "removed"
                ? "diff-remove"
                : line.type === "empty"
                  ? "diff-empty"
                  : "diff-context"
            }
          >
            <span className="inline-block w-10 text-right text-gray-600 mr-2 select-none">
              {line.type !== "empty" ? i + 1 : ""}
            </span>
            {line.text}
          </div>
        ))}
      </pre>
      <pre className="text-xs font-mono p-0 m-0">
        {rightLines.map((line, i) => (
          <div
            key={i}
            className={
              line.type === "added"
                ? "diff-add"
                : line.type === "empty"
                  ? "diff-empty"
                  : "diff-context"
            }
          >
            <span className="inline-block w-10 text-right text-gray-600 mr-2 select-none">
              {line.type !== "empty" ? i + 1 : ""}
            </span>
            {line.text}
          </div>
        ))}
      </pre>
    </div>
  );
}
