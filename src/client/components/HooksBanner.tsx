import { useState, useEffect } from "react";
import { apiFetch, apiPost } from "../hooks/useApi";
import { useWebSocket } from "../hooks/useWebSocket";

export default function HooksBanner() {
  const [installed, setInstalled] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    apiFetch<{ installed: boolean }>("/api/hooks/status")
      .then((data) => setInstalled(data.installed))
      .catch(() => {});
  }, []);

  useWebSocket("hooks:status", (data: any) => {
    setInstalled(data?.installed ?? false);
  });

  if (installed === null || installed || dismissed) return null;

  async function handleEnable() {
    setInstalling(true);
    try {
      const data = await apiPost<{ installed: boolean }>("/api/hooks/install");
      setInstalled(data.installed);
    } catch {
      // Ignore
    }
    setInstalling(false);
  }

  return (
    <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-300">Enable real-time updates</p>
        <p className="text-xs text-amber-300/70 mt-0.5">
          Install Claude Code hooks for instant UI updates on every tool use (instead of ~30s delay).
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => setDismissed(true)}
          className="px-2.5 py-1 text-xs text-gray-400 hover:text-gray-200 transition-colors"
        >
          Dismiss
        </button>
        <button
          onClick={handleEnable}
          disabled={installing}
          className="px-3 py-1 text-xs font-medium rounded-md bg-amber-600 text-white hover:bg-amber-500 disabled:opacity-50 transition-colors"
        >
          {installing ? "Installing..." : "Enable"}
        </button>
      </div>
    </div>
  );
}
