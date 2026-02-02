import { useState, useRef, useCallback, useEffect } from "react";

interface SplitPaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
  defaultLeftWidth?: number;
  minLeft?: number;
  minRight?: number;
}

const STORAGE_KEY = "cloviz-split-pane-width";

export default function SplitPane({
  left,
  right,
  defaultLeftWidth = 280,
  minLeft = 200,
  minRight = 400,
}: SplitPaneProps) {
  const [leftWidth, setLeftWidth] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? parseInt(stored) : defaultLeftWidth;
  });
  const [collapsed, setCollapsed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newWidth = Math.max(
        minLeft,
        Math.min(e.clientX - rect.left, rect.width - minRight)
      );
      setLeftWidth(newWidth);
    };

    const handleMouseUp = () => {
      setDragging(false);
      localStorage.setItem(STORAGE_KEY, String(leftWidth));
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging, leftWidth, minLeft, minRight]);

  return (
    <div
      ref={containerRef}
      className="flex h-full"
      style={{ userSelect: dragging ? "none" : undefined }}
    >
      {!collapsed && (
        <div
          className="flex-shrink-0 overflow-y-auto overflow-x-hidden"
          style={{ width: leftWidth }}
        >
          {left}
        </div>
      )}

      {/* Divider */}
      <div
        className={`split-divider flex-shrink-0 w-1.5 cursor-col-resize relative group ${
          dragging ? "bg-primary/40" : "bg-border/50 hover:bg-primary/30"
        }`}
        onMouseDown={handleMouseDown}
      >
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute top-2 -left-2.5 w-6 h-6 bg-surface-light border border-border rounded text-[10px] text-gray-400 hover:text-primary hover:border-primary/50 flex items-center justify-center z-10"
          title={collapsed ? "Show file tree" : "Hide file tree"}
        >
          {collapsed ? "\u25B6" : "\u25C0"}
        </button>
      </div>

      <div className="flex-1 min-w-0 overflow-y-auto">{right}</div>
    </div>
  );
}
