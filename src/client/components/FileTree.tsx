import { useState, useMemo } from "react";

interface FileOperation {
  tool: string;
  message_id: number;
  timestamp: number;
}

interface FileEntry {
  path: string;
  operations: FileOperation[];
}

interface FileTreeProps {
  files: FileEntry[];
  onFileSelect: (path: string, messageId: number) => void;
  onViewDiff: (path: string) => void;
  selectedFile?: string;
}

interface TreeNode {
  name: string;
  path: string;
  children: Map<string, TreeNode>;
  file?: FileEntry;
}

function buildTree(files: FileEntry[]): TreeNode {
  const root: TreeNode = { name: "", path: "", children: new Map() };

  for (const file of files) {
    const parts = file.path.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;

      if (!current.children.has(part)) {
        current.children.set(part, {
          name: part,
          path: parts.slice(0, i + 1).join("/"),
          children: new Map(),
        });
      }

      current = current.children.get(part)!;

      if (isFile) {
        current.file = file;
      }
    }
  }

  return root;
}

// Collapse single-child folder chains: a/b/c → "a/b/c"
function collapseNode(node: TreeNode): TreeNode {
  if (node.children.size === 1 && !node.file) {
    const [child] = node.children.values();
    if (!child.file) {
      const collapsed = collapseNode(child);
      return {
        ...collapsed,
        name: node.name ? `${node.name}/${collapsed.name}` : collapsed.name,
      };
    }
  }
  const newChildren = new Map<string, TreeNode>();
  for (const [key, child] of node.children) {
    const collapsed = collapseNode(child);
    newChildren.set(collapsed.name, collapsed);
  }
  return { ...node, children: newChildren };
}

type OpType = "Write" | "Edit" | "Read";

const OP_STYLES: Record<OpType, { label: string; bg: string; text: string; border: string }> = {
  Write: { label: "W", bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/30" },
  Edit:  { label: "E", bg: "bg-blue-500/15",    text: "text-blue-400",    border: "border-blue-500/30" },
  Read:  { label: "R", bg: "bg-gray-500/15",     text: "text-gray-500",    border: "border-gray-500/30" },
};

function getPrimaryOp(operations: FileOperation[]): OpType {
  if (operations.some((o) => o.tool === "Write")) return "Write";
  if (operations.some((o) => o.tool === "Edit" || o.tool === "MultiEdit"))
    return "Edit";
  return "Read";
}

function getDistinctOps(operations: FileOperation[]): OpType[] {
  const ops = new Set<OpType>();
  for (const o of operations) {
    if (o.tool === "Write") ops.add("Write");
    else if (o.tool === "Edit" || o.tool === "MultiEdit") ops.add("Edit");
    else ops.add("Read");
  }
  // Order: Write, Edit, Read
  const ordered: OpType[] = [];
  if (ops.has("Write")) ordered.push("Write");
  if (ops.has("Edit")) ordered.push("Edit");
  if (ops.has("Read")) ordered.push("Read");
  return ordered;
}

function FolderIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg className="w-4 h-4 text-yellow-500/80 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
        <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v1H2V6z" />
        <path fillRule="evenodd" d="M2 9h16v5a2 2 0 01-2 2H4a2 2 0 01-2-2V9z" clipRule="evenodd" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4 text-yellow-600/70 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
      <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
    </svg>
  );
}

function FileIcon({ name }: { name: string }) {
  const ext = name.includes(".") ? name.split(".").pop()?.toLowerCase() : "";
  let color = "text-gray-500";
  if (ext === "ts" || ext === "tsx") color = "text-blue-400";
  else if (ext === "js" || ext === "jsx") color = "text-yellow-400";
  else if (ext === "json") color = "text-yellow-600";
  else if (ext === "css" || ext === "scss") color = "text-pink-400";
  else if (ext === "html") color = "text-orange-400";
  else if (ext === "md") color = "text-gray-400";
  else if (ext === "py") color = "text-green-400";
  else if (ext === "rs") color = "text-orange-500";
  else if (ext === "go") color = "text-cyan-400";
  else if (ext === "svg" || ext === "png" || ext === "jpg" || ext === "ico") color = "text-purple-400";

  return (
    <svg className={`w-4 h-4 ${color} flex-shrink-0`} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
    </svg>
  );
}

function OpBadge({ op }: { op: OpType }) {
  const style = OP_STYLES[op];
  return (
    <span className={`inline-flex items-center justify-center w-[18px] h-[18px] rounded text-[10px] font-bold ${style.bg} ${style.text} border ${style.border}`}>
      {style.label}
    </span>
  );
}

function TreeNodeComponent({
  node,
  depth,
  onFileSelect,
  onViewDiff,
  selectedFile,
}: {
  node: TreeNode;
  depth: number;
  onFileSelect: (path: string, messageId: number) => void;
  onViewDiff: (path: string) => void;
  selectedFile?: string;
}) {
  const [expanded, setExpanded] = useState(depth < 2);

  const sortedChildren = useMemo(() => {
    const entries = [...node.children.entries()];
    return entries.sort(([, a], [, b]) => {
      const aIsDir = !a.file;
      const bIsDir = !b.file;
      if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [node.children]);

  if (node.file) {
    const ops = getDistinctOps(node.file.operations);
    const isSelected = selectedFile === node.file.path;
    const hasWriteOrEdit = node.file.operations.some(
      (o) => o.tool === "Write" || o.tool === "Edit" || o.tool === "MultiEdit"
    );

    return (
      <div
        className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer rounded-md mx-1 my-px ${
          isSelected
            ? "bg-primary/15 text-primary"
            : "text-gray-300 hover:bg-surface-lighter"
        }`}
        style={{ paddingLeft: depth * 16 + 8 }}
        onClick={() =>
          onFileSelect(node.file!.path, node.file!.operations[0].message_id)
        }
      >
        <FileIcon name={node.name} />
        <span className="text-[13px] truncate flex-1 font-mono">{node.name}</span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {ops.map((op) => (
            <OpBadge key={op} op={op} />
          ))}
          {node.file.operations.length > 1 && (
            <span className="text-[10px] text-gray-600 ml-0.5 tabular-nums">
              x{node.file.operations.length}
            </span>
          )}
          {hasWriteOrEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewDiff(node.file!.path);
              }}
              className="text-[10px] text-gray-500 hover:text-primary px-1.5 py-0.5 rounded bg-surface-lighter border border-border ml-1"
              title="View diff"
            >
              diff
            </button>
          )}
        </div>
      </div>
    );
  }

  // Folder node
  return (
    <div>
      <div
        className="flex items-center gap-2 px-3 py-1.5 cursor-pointer rounded-md mx-1 my-px text-gray-400 hover:text-gray-200 hover:bg-surface-lighter"
        style={{ paddingLeft: depth * 16 + 8 }}
        onClick={() => setExpanded(!expanded)}
      >
        <FolderIcon open={expanded} />
        <span className="text-[13px] truncate font-medium">{node.name}</span>
        <svg
          className={`w-3 h-3 text-gray-600 flex-shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
        </svg>
      </div>
      {expanded &&
        sortedChildren.map(([key, child]) => (
          <TreeNodeComponent
            key={key}
            node={child}
            depth={depth + 1}
            onFileSelect={onFileSelect}
            onViewDiff={onViewDiff}
            selectedFile={selectedFile}
          />
        ))}
    </div>
  );
}

export default function FileTree({
  files,
  onFileSelect,
  onViewDiff,
  selectedFile,
}: FileTreeProps) {
  const tree = useMemo(() => {
    const raw = buildTree(files);
    return collapseNode(raw);
  }, [files]);

  if (files.length === 0) {
    return (
      <div className="p-4 text-sm text-gray-600">No files in this session</div>
    );
  }

  const sortedChildren = [...tree.children.entries()].sort(([, a], [, b]) => {
    const aIsDir = !a.file;
    const bIsDir = !b.file;
    if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  // Count files by primary op type
  const writeCount = files.filter((f) => getPrimaryOp(f.operations) === "Write").length;
  const editCount = files.filter((f) => getPrimaryOp(f.operations) === "Edit").length;
  const readCount = files.filter((f) => getPrimaryOp(f.operations) === "Read").length;

  return (
    <div className="py-2">
      <div className="px-3 pb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
          Files ({files.length})
        </span>
        <div className="flex items-center gap-2 text-[10px]">
          {writeCount > 0 && (
            <span className="flex items-center gap-1 text-emerald-500">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {writeCount}
            </span>
          )}
          {editCount > 0 && (
            <span className="flex items-center gap-1 text-blue-400">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              {editCount}
            </span>
          )}
          {readCount > 0 && (
            <span className="flex items-center gap-1 text-gray-500">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
              {readCount}
            </span>
          )}
        </div>
      </div>
      {sortedChildren.map(([key, child]) => (
        <TreeNodeComponent
          key={key}
          node={child}
          depth={0}
          onFileSelect={onFileSelect}
          onViewDiff={onViewDiff}
          selectedFile={selectedFile}
        />
      ))}
    </div>
  );
}
