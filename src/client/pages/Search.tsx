import { useState, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiFetch } from "../hooks/useApi";

interface SearchResult {
  resultType: "message" | "session" | "plan";
  // Message fields
  id?: number;
  session_id?: string;
  type?: string;
  role?: string;
  timestamp?: string;
  snippet?: string;
  slug?: string;
  first_prompt?: string;
  project_name?: string;
  // Session fields
  summary_snippet?: string;
  prompt_snippet?: string;
  message_count?: number;
  created_at?: string;
  modified_at?: string;
  // Plan fields
  filename?: string;
  filename_snippet?: string;
  content_snippet?: string;
  mtime?: number;
}

interface SearchResponse {
  results: SearchResult[];
  query: string;
}

export default function Search() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("project_id") || "";
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const doSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      let url = `/api/search?q=${encodeURIComponent(query)}`;
      if (projectId) url += `&project_id=${projectId}`;
      const data = await apiFetch<SearchResponse>(url);
      setResults(data.results);
    } catch {
      setResults([]);
    }
    setLoading(false);
  }, [query, projectId]);

  // Group results by type
  const messages = results.filter((r) => r.resultType === "message");
  const sessions = results.filter((r) => r.resultType === "session");
  const plans = results.filter((r) => r.resultType === "plan");

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Search</h2>

      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && doSearch()}
          placeholder="Search conversations, plans, sessions..."
          className="flex-1 bg-surface-light border border-border rounded-lg px-4 py-2 text-sm text-gray-200 focus:outline-none focus:border-primary"
          autoFocus
        />
        <button
          onClick={doSearch}
          disabled={loading}
          className="bg-primary hover:bg-primary-light text-gray-900 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {loading ? "..." : "Search"}
        </button>
      </div>

      {searched && results.length === 0 && !loading && (
        <div className="text-gray-500 text-sm text-center py-8">
          No results found for "{query}"
        </div>
      )}

      {/* Message results */}
      {messages.length > 0 && (
        <div className="bg-surface-light rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <h3 className="text-sm font-medium text-gray-400">
              Messages ({messages.length})
            </h3>
          </div>
          <div className="divide-y divide-border/50">
            {messages.map((r, i) => (
              <Link
                key={i}
                to={`/sessions/${r.session_id}`}
                className="block px-5 py-3 hover:bg-surface-lighter transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded ${
                      r.role === "assistant"
                        ? "bg-primary/20 text-primary"
                        : "bg-blue-900/30 text-blue-400"
                    }`}
                  >
                    {r.role}
                  </span>
                  {r.project_name && (
                    <span className="text-[10px] text-gray-500">
                      {r.project_name}
                    </span>
                  )}
                  {r.timestamp && (
                    <span className="text-[10px] text-gray-600">
                      {new Date(r.timestamp).toLocaleString()}
                    </span>
                  )}
                </div>
                <div
                  className="text-sm text-gray-300"
                  dangerouslySetInnerHTML={{ __html: r.snippet ?? "" }}
                />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Session results */}
      {sessions.length > 0 && (
        <div className="bg-surface-light rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <h3 className="text-sm font-medium text-gray-400">
              Sessions ({sessions.length})
            </h3>
          </div>
          <div className="divide-y divide-border/50">
            {sessions.map((r, i) => (
              <Link
                key={i}
                to={`/sessions/${r.session_id}`}
                className="block px-5 py-3 hover:bg-surface-lighter transition-colors"
              >
                <div
                  className="text-sm text-gray-300"
                  dangerouslySetInnerHTML={{
                    __html:
                      r.summary_snippet || r.prompt_snippet || r.slug || "",
                  }}
                />
                <div className="text-xs text-gray-500 mt-1">
                  {r.message_count} messages
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Plan results */}
      {plans.length > 0 && (
        <div className="bg-surface-light rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <h3 className="text-sm font-medium text-gray-400">
              Plans ({plans.length})
            </h3>
          </div>
          <div className="divide-y divide-border/50">
            {plans.map((r, i) => (
              <Link
                key={i}
                to={`/plans?name=${encodeURIComponent(r.filename ?? "")}`}
                className="block px-5 py-3 hover:bg-surface-lighter transition-colors"
              >
                <div className="text-sm text-gray-300 font-medium">
                  {r.filename}
                </div>
                <div
                  className="text-xs text-gray-400 mt-1"
                  dangerouslySetInnerHTML={{
                    __html: r.content_snippet ?? "",
                  }}
                />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
