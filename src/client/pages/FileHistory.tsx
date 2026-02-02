import { useState } from "react";
import { useApi, apiFetch } from "../hooks/useApi";
import { useParams } from "react-router-dom";

interface FileEntry {
  id: number;
  session_id: string;
  file_path: string;
  backup_filename: string;
  version: number;
}

interface FileHistoryResponse {
  files: FileEntry[];
  sessionId: string;
}

interface FileContentResponse {
  content: string;
  filename: string;
  sessionId: string;
}

export default function FileHistory() {
  const { session } = useParams<{ session: string }>();
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [sessionInput, setSessionInput] = useState(session ?? "");

  const { data, loading } = useApi<FileHistoryResponse>(
    sessionInput
      ? `/api/file-history/${sessionInput}`
      : "/api/file-history/none",
    [sessionInput]
  );

  const files = data?.files ?? [];

  // Group by file_path
  const fileGroups = new Map<string, FileEntry[]>();
  for (const f of files) {
    const group = fileGroups.get(f.file_path) || [];
    group.push(f);
    fileGroups.set(f.file_path, group);
  }

  async function loadFileContent(sessionId: string, filename: string) {
    try {
      const data = await apiFetch<FileContentResponse>(
        `/api/file-history/${sessionId}/${filename}`
      );
      setFileContent(data.content);
      setSelectedFile(filename);
    } catch {
      setFileContent("Error loading file");
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">File History</h2>

      {/* Session input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={sessionInput}
          onChange={(e) => setSessionInput(e.target.value)}
          placeholder="Enter session ID..."
          className="flex-1 bg-surface-light border border-border rounded-lg px-3 py-2 text-sm text-gray-300 font-mono"
        />
      </div>

      <div className="flex gap-4 h-[calc(100vh-14rem)]">
        {/* File list */}
        <div className="w-80 flex-shrink-0 bg-surface-light rounded-xl border border-border overflow-y-auto">
          {loading ? (
            <div className="p-4 space-y-2">{[1,2,3].map(i => <div key={i} className="h-3 bg-surface-lighter rounded animate-pulse skeleton-shimmer" style={{width: `${60 + i * 10}%`}} />)}</div>
          ) : files.length === 0 ? (
            <div className="p-4 text-gray-500 text-sm">
              {sessionInput ? "No files found for this session" : "Enter a session ID to view file history"}
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {[...fileGroups.entries()].map(([hash, versions]) => (
                <div key={hash} className="p-3">
                  <div className="text-xs font-mono text-gray-400 mb-1">
                    {hash}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {versions
                      .sort((a, b) => a.version - b.version)
                      .map((v) => (
                        <button
                          key={v.backup_filename}
                          onClick={() =>
                            loadFileContent(v.session_id, v.backup_filename)
                          }
                          className={`text-[10px] px-1.5 py-0.5 rounded ${
                            selectedFile === v.backup_filename
                              ? "bg-primary text-gray-900"
                              : "bg-surface-lighter text-gray-400 hover:text-gray-300"
                          }`}
                        >
                          v{v.version}
                        </button>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* File content */}
        <div className="flex-1 bg-surface-light rounded-xl border border-border overflow-auto">
          {fileContent !== null ? (
            <pre className="p-4 text-xs text-gray-300 font-mono whitespace-pre-wrap">
              {fileContent}
            </pre>
          ) : (
            <div className="p-6 text-gray-500 text-sm text-center">
              Select a file version to view its contents
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
