import chokidar from "chokidar";
import type { FSWatcher } from "chokidar";
import { broadcast } from "./ws";
import { handleFileChange, type PipelineContext } from "./pipeline/index";

// Sensitive paths that must never be read or served
const BLACKLIST = [
  ".credentials.json",
  "statsig",
  "session-env",
  "cache",
  "telemetry",
  "paste-cache",
  "shell-snapshots",
  "skills",
];

function isBlacklisted(path: string): boolean {
  return BLACKLIST.some(
    (bl) => path.includes(`/${bl}/`) || path.endsWith(`/${bl}`) || path.includes(`/${bl}`)
  );
}

let watcher: FSWatcher | null = null;
let watcherRunning = false;

export function startWatcher(ctx: PipelineContext) {
  if (watcher) return;

  const { claudeDir } = ctx;

  watcher = chokidar.watch(claudeDir, {
    ignored: (path) => isBlacklisted(path),
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 200,
      pollInterval: 50,
    },
  });

  const handleChange = (filePath: string) => {
    if (isBlacklisted(filePath)) return;

    try {
      const event = handleFileChange(ctx, filePath);
      if (event) {
        broadcast(event, { path: filePath });
      }
    } catch (e) {
      console.error(`[watcher] Error processing ${filePath}:`, e);
    }
  };

  watcher.on("add", handleChange);
  watcher.on("change", handleChange);
  watcher.on("ready", () => {
    console.log("[watcher] Ready and watching for changes");
  });

  watcherRunning = true;
  broadcast("watcher:status", { running: true });
  console.log(`[watcher] Started watching ${claudeDir}`);
}

export function stopWatcher() {
  if (watcher) {
    watcher.close();
    watcher = null;
    watcherRunning = false;
    broadcast("watcher:status", { running: false });
    console.log("[watcher] Stopped");
  }
}

export function isWatcherRunning(): boolean {
  return watcherRunning;
}
