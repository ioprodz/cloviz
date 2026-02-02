import { useState, useEffect } from "react";
import { apiFetch, apiPost } from "../hooks/useApi";
import { useWebSocket } from "../hooks/useWebSocket";

export default function WatcherToggle() {
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch<{ running: boolean }>("/api/watcher/status").then((data) =>
      setRunning(data.running)
    ).catch(() => {});
  }, []);

  useWebSocket("watcher:status", (data: any) => {
    setRunning(data?.running ?? false);
  });

  async function toggle() {
    setLoading(true);
    try {
      const endpoint = running ? "/api/watcher/stop" : "/api/watcher/start";
      const data = await apiPost<{ running: boolean }>(endpoint);
      setRunning(data.running);
    } catch {
      // Ignore
    }
    setLoading(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
        running
          ? "bg-green-900/30 text-green-400 hover:bg-green-900/50"
          : "bg-gray-800 text-gray-500 hover:bg-gray-700"
      }`}
    >
      <span
        className={`w-2 h-2 rounded-full ${
          running ? "bg-green-400 animate-pulse" : "bg-gray-600"
        }`}
      />
      {loading ? "..." : running ? "Watching" : "Paused"}
    </button>
  );
}
