import { useParams, Link } from "react-router-dom";
import { useApi, apiFetch } from "../hooks/useApi";
import { useWebSocket } from "../hooks/useWebSocket";
import ChatMessage from "../components/ChatMessage";
import LoadingSkeleton from "../components/LoadingSkeleton";
import SplitPane from "../components/SplitPane";
import FileTree from "../components/FileTree";
import DiffViewer from "../components/DiffViewer";
import MarkdownView from "../components/MarkdownView";
import SessionTodos from "../components/SessionTodos";
import SessionCommits from "../components/SessionCommits";
import SessionTimeline from "../components/SessionTimeline";
import { formatCost } from "../utils/format";
import { useState, useRef, useCallback } from "react";

interface CostWithSavings {
  inputCost: number;
  outputCost: number;
  cacheWriteCost: number;
  cacheReadCost: number;
  totalCost: number;
  costWithoutCache: number;
  cacheSavings: number;
}

interface SessionData {
  id: string;
  summary?: string;
  first_prompt?: string;
  message_count: number;
  created_at?: string;
  modified_at?: string;
  git_branch?: string;
  slug?: string;
  project_id?: number;
  project_name?: string;
  project_path?: string;
  sessionCost?: CostWithSavings | null;
}

interface MessagesResponse {
  messages: any[];
  toolUses: any[];
  total: number;
  limit: number;
  offset: number;
}

interface FileOperation {
  tool: string;
  message_id: number;
  timestamp: number;
}

interface FileEntry {
  path: string;
  operations: FileOperation[];
}

interface FilesResponse {
  files: FileEntry[];
}

interface DiffState {
  fileName: string;
  oldContent: string;
  newContent: string;
}

export default function SessionReplay() {
  const { id } = useParams<{ id: string }>();
  const [page, setPage] = useState(0);
  const [selectedFile, setSelectedFile] = useState<string>();
  const [diffState, setDiffState] = useState<DiffState | null>(null);
  const [leftTab, setLeftTab] = useState<"files" | "todos" | "commits">("files");
  const [planView, setPlanView] = useState<{ filename: string; content: string } | null>(null);
  const messageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const limit = 100;

  const { data: session } = useApi<SessionData>(`/api/sessions/${id}`, [id]);
  const { data: msgData, loading, refetch } = useApi<MessagesResponse>(
    `/api/sessions/${id}/messages?limit=${limit}&offset=${page * limit}`,
    [id, page]
  );
  const { data: filesData } = useApi<FilesResponse>(
    `/api/sessions/${id}/files`,
    [id]
  );

  useWebSocket("session:updated", (data: any) => {
    if (data?.path?.includes(id)) refetch();
  });

  const messages = msgData?.messages ?? [];
  const toolUses = msgData?.toolUses ?? [];
  const total = msgData?.total ?? 0;
  const totalPages = Math.ceil(total / limit);
  const files = filesData?.files ?? [];

  const handleFileSelect = useCallback(
    (path: string, messageId: number) => {
      setSelectedFile(path);

      // If it's a plan file, fetch and show content in the right pane
      const planMatch = path.match(/\.claude\/plans\/([^/]+\.md)$/);
      if (planMatch) {
        apiFetch<{ filename: string; content: string }>(
          `/api/plans/${encodeURIComponent(planMatch[1])}`
        )
          .then((plan) => setPlanView({ filename: plan.filename, content: plan.content }))
          .catch(() => setPlanView(null));
        return;
      }

      setPlanView(null);
      // Find the message element and scroll to it
      const el = messageRefs.current.get(messageId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        el.classList.add("ring-1", "ring-primary/50");
        setTimeout(() => {
          el.classList.remove("ring-1", "ring-primary/50");
        }, 2000);
      }
    },
    []
  );

  const handleViewDiff = useCallback(
    async (path: string) => {
      // Try to find Write/Edit operations to build a diff
      const file = files.find((f) => f.path === path);
      if (!file) return;

      // Find tool_uses for this file in the current message data
      const fileToolUses = toolUses.filter((tu: any) => {
        if (
          tu.tool_name !== "Write" &&
          tu.tool_name !== "Edit" &&
          tu.tool_name !== "MultiEdit"
        )
          return false;
        try {
          const input = JSON.parse(tu.input_json || "{}");
          return input.file_path === path || input.path === path;
        } catch {
          return false;
        }
      });

      if (fileToolUses.length === 0) return;

      // Build a simple diff from Edit operations
      let oldContent = "";
      let newContent = "";

      for (const tu of fileToolUses) {
        try {
          const input = JSON.parse(tu.input_json || "{}");
          if (tu.tool_name === "Write") {
            newContent = input.content || "";
          } else if (tu.tool_name === "Edit" || tu.tool_name === "MultiEdit") {
            if (input.old_string && input.new_string) {
              oldContent += input.old_string + "\n";
              newContent += input.new_string + "\n";
            }
          }
        } catch {
          // skip
        }
      }

      setDiffState({
        fileName: path.split("/").pop() || path,
        oldContent,
        newContent,
      });
    },
    [files, toolUses]
  );

  const conversationContent = (
    <div className="space-y-4 p-4">
      {/* Session header */}
      <div className="bg-surface-light rounded-xl p-5 border border-border">
        <div className="flex items-start justify-between">
          <div>
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
              {session?.project_name ? (
                <>
                  <Link
                    to={`/projects/${session.project_id}`}
                    className="hover:text-gray-400"
                  >
                    {session.project_name}
                  </Link>
                  <span>&rsaquo;</span>
                </>
              ) : (
                <>
                  <Link to="/" className="hover:text-gray-400">
                    Projects
                  </Link>
                  <span>&rsaquo;</span>
                </>
              )}
              <span className="text-gray-400">Session</span>
            </div>
            <h2 className="text-lg font-semibold">
              {session?.summary || session?.first_prompt || session?.slug || id}
            </h2>
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
              {session?.project_name && (
                <span className="text-primary">{session.project_name}</span>
              )}
              {session?.git_branch && (
                <span className="bg-surface-lighter px-1.5 py-0.5 rounded">
                  {session.git_branch}
                </span>
              )}
              {session?.message_count && (
                <span>{session.message_count} total msgs</span>
              )}
              {session?.created_at && (
                <span>
                  {new Date(session.created_at).toLocaleDateString()}
                </span>
              )}
              {session?.sessionCost && session.sessionCost.totalCost > 0 && (
                <span
                  className="text-primary font-medium bg-primary/10 px-1.5 py-0.5 rounded"
                  title={`Input: ${formatCost(session.sessionCost.inputCost)} | Output: ${formatCost(session.sessionCost.outputCost)} | Cache Write: ${formatCost(session.sessionCost.cacheWriteCost)} | Cache Read: ${formatCost(session.sessionCost.cacheReadCost)} | Savings: ${formatCost(session.sessionCost.cacheSavings)}`}
                >
                  Cost: {formatCost(session.sessionCost.totalCost)}
                </span>
              )}
            </div>
          </div>
          <div className="text-xs text-gray-600 font-mono">
            {id?.slice(0, 8)}
          </div>
        </div>
        {id && <SessionTimeline sessionId={id} />}
      </div>

      {/* Pagination top */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">
            {total} messages (showing {page * limit + 1}-
            {Math.min((page + 1) * limit, total)})
          </span>
          <div className="flex gap-2">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1 rounded bg-surface-light text-gray-400 disabled:opacity-30 hover:bg-surface-lighter"
            >
              Prev
            </button>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 rounded bg-surface-light text-gray-400 disabled:opacity-30 hover:bg-surface-lighter"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="bg-surface-light rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-4">
            <LoadingSkeleton variant="text" count={8} />
          </div>
        ) : messages.length === 0 ? (
          <div className="p-6 text-gray-500 text-center">
            No messages indexed yet. Messages are indexed on first view.
          </div>
        ) : (
          <div className="divide-y divide-border/50 px-4">
            {messages.map((msg: any) => (
              <div
                key={msg.id}
                ref={(el) => {
                  if (el) messageRefs.current.set(msg.id, el);
                }}
                className="transition-all duration-300"
              >
                <ChatMessage message={msg} toolUses={toolUses} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const planViewContent = planView && (
    <div className="p-4 space-y-4">
      <div className="bg-surface-light rounded-xl border border-border overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h3 className="text-sm font-medium text-gray-200">
            {planView.filename.replace(".md", "")}
          </h3>
          <button
            onClick={() => { setPlanView(null); setSelectedFile(undefined); }}
            className="text-gray-500 hover:text-gray-300 text-lg leading-none"
          >
            &times;
          </button>
        </div>
        <div className="p-5 overflow-y-auto" style={{ maxHeight: "calc(100vh - 180px)" }}>
          <MarkdownView content={planView.content} />
        </div>
      </div>
    </div>
  );

  const LEFT_TABS = [
    { key: "files" as const, label: "Files" },
    { key: "todos" as const, label: "Todos" },
    { key: "commits" as const, label: "Commits" },
  ];

  const leftPanelContent = (
    <div className="bg-surface-light border-r border-border h-full flex flex-col">
      {/* Tab bar */}
      <div className="flex border-b border-border">
        {LEFT_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setLeftTab(tab.key)}
            className={`flex-1 px-2 py-2 text-xs text-center transition-colors ${
              leftTab === tab.key
                ? "text-primary border-b-2 border-primary font-medium"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {leftTab === "files" && (
          <FileTree
            files={files}
            onFileSelect={handleFileSelect}
            onViewDiff={handleViewDiff}
            selectedFile={selectedFile}
          />
        )}
        {leftTab === "todos" && <SessionTodos sessionId={id!} />}
        {leftTab === "commits" && <SessionCommits sessionId={id!} />}
      </div>
    </div>
  );

  return (
    <>
      <div style={{ height: "calc(100vh - 48px)" }}>
        <SplitPane left={leftPanelContent} right={planViewContent || conversationContent} />
      </div>
      {diffState && (
        <DiffViewer
          oldContent={diffState.oldContent}
          newContent={diffState.newContent}
          fileName={diffState.fileName}
          onClose={() => setDiffState(null)}
        />
      )}
    </>
  );
}
