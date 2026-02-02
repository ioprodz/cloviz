import { useState, useEffect } from "react";
import { apiFetch, apiPost } from "../hooks/useApi";
import { useWebSocket } from "../hooks/useWebSocket";

export default function HooksToggle() {
  const [installed, setInstalled] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch<{ installed: boolean }>("/api/hooks/status")
      .then((data) => setInstalled(data.installed))
      .catch(() => {});
  }, []);

  useWebSocket("hooks:status", (data: any) => {
    setInstalled(data?.installed ?? false);
  });

  async function toggle() {
    setLoading(true);
    try {
      const endpoint = installed ? "/api/hooks/uninstall" : "/api/hooks/install";
      const data = await apiPost<{ installed: boolean }>(endpoint);
      setInstalled(data.installed);
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
        installed
          ? "bg-blue-900/30 text-blue-400 hover:bg-blue-900/50"
          : "bg-gray-800 text-gray-500 hover:bg-gray-700"
      }`}
    >
      <span
        className={`w-2 h-2 rounded-full ${
          installed ? "bg-blue-400 animate-pulse" : "bg-gray-600"
        }`}
      />
      {loading ? "..." : installed ? "Hooks" : "No Hooks"}
    </button>
  );
}
