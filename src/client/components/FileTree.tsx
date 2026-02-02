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

function getOpColor(tool: string): string {
  switch (tool) {
    case "Write":
      return "#10b981";
    case "Edit":
    case "MultiEdit":
      return "#3b82f6";
    case "Read":
      return "#6b7280";
    default:
      return "#6b7280";
  }
}

function getPrimaryOp(operations: FileOperation[]): string {
  // Prioritize Write > Edit > Read
  if (operations.some((o) => o.tool === "Write")) return "Write";
  if (operations.some((o) => o.tool === "Edit" || o.tool === "MultiEdit"))
    return "Edit";
  return "Read";
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
    // Folders first, then files, alphabetical within each group
    return entries.sort(([, a], [, b]) => {
      const aIsDir = !a.file;
      const bIsDir = !b.file;
      if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [node.children]);

  if (node.file) {
    const primaryOp = getPrimaryOp(node.file.operations);
    const opColor = getOpColor(primaryOp);
    const isSelected = selectedFile === node.file.path;
    const hasWriteOrEdit = node.file.operations.some(
      (o) => o.tool === "Write" || o.tool === "Edit" || o.tool === "MultiEdit"
    );

    return (
      <div
        className={`file-tree-node flex items-center gap-1.5 px-2 py-1 cursor-pointer text-xs group ${
          isSelected
            ? "bg-primary/15 text-primary"
            : "text-gray-400 hover:bg-surface-lighter hover:text-gray-200"
        }`}
        style={{ paddingLeft: depth * 12 + 8 }}
        onClick={() =>
          onFileSelect(node.file!.path, node.file!.operations[0].message_id)
        }
      >
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: opColor }}
        />
        <span className="truncate flex-1">{node.name}</span>
        <span className="text-[10px] text-gray-600">
          {node.file.operations.length}
        </span>
        {hasWriteOrEdit && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewDiff(node.file!.path);
            }}
            className="hidden group-hover:block text-[10px] text-gray-500 hover:text-primary px-1 rounded bg-surface-lighter"
            title="View diff"
          >
            diff
          </button>
        )}
      </div>
    );
  }

  // Folder node
  return (
    <div>
      <div
        className="file-tree-node flex items-center gap-1.5 px-2 py-1 cursor-pointer text-xs text-gray-500 hover:text-gray-300"
        style={{ paddingLeft: depth * 12 + 8 }}
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-[10px] w-3 text-center">
          {expanded ? "\u25BC" : "\u25B6"}
        </span>
        <span className="truncate">{node.name}</span>
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
      <div className="p-4 text-xs text-gray-600">No files in this session</div>
    );
  }

  const sortedChildren = [...tree.children.entries()].sort(([, a], [, b]) => {
    const aIsDir = !a.file;
    const bIsDir = !b.file;
    if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="py-1">
      <div className="px-3 py-2 text-[10px] font-medium text-gray-500 uppercase tracking-wider">
        Files ({files.length})
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
