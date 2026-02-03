import { Hono } from "hono";
import { cors } from "hono/cors";
import { join, dirname } from "path";
import { homedir } from "os";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { getDb, closeDb } from "./db";
import { runQuickIndex, runBackgroundIndex } from "./pipeline/index";
import { startWatcher } from "./watcher";
import { addClient, removeClient, broadcast } from "./ws";
import { IS_BUN } from "./runtime/detect";
import { fileResponse, fileExistsAsync } from "./runtime/file";
import dashboardApi from "./api/dashboard";
import sessionsApi from "./api/sessions";
import projectsApi from "./api/projects";
import analyticsApi from "./api/analytics";
import searchApi from "./api/search";
import plansApi from "./api/plans";
import todosApi from "./api/todos";
import fileHistoryApi from "./api/file-history";
import debugApi from "./api/debug";
import costsApi from "./api/costs";
import commitsApi from "./api/commits";
import { createWatcherApi } from "./api/watcher-api";
import { createHooksApi } from "./api/hooks-api";

const __dirname = dirname(fileURLToPath(import.meta.url));

const CLAUDE_DIR = join(homedir(), ".claude");
const PORT = parseInt(process.env.PORT || "3456");
const IS_PROD = process.env.NODE_ENV === "production";

// Initialize database
const db = getDb();

// Pipeline context
const ctx = { db, claudeDir: CLAUDE_DIR };

// Run quick index (metadata, stats, session index — no JSONL parsing)
runQuickIndex(ctx);

// Create Hono app
const app = new Hono();

// CORS for dev mode
app.use("/api/*", cors());

// API routes
app.route("/api/dashboard", dashboardApi);
app.route("/api/sessions", sessionsApi);
app.route("/api/projects", projectsApi);
app.route("/api/analytics/costs", costsApi);
app.route("/api/analytics", analyticsApi);
app.route("/api/search", searchApi);
app.route("/api/plans", plansApi);
app.route("/api/todos", todosApi);
app.route("/api/file-history", fileHistoryApi);
app.route("/api/debug", debugApi);
app.route("/api/commits", commitsApi);
app.route("/api/watcher", createWatcherApi(ctx));
app.route("/api/hooks", createHooksApi(ctx));

// Serve static files in production
if (IS_PROD) {
  const clientDir = join(__dirname, "../../dist/client");
  if (existsSync(clientDir)) {
    app.get("/*", async (c, next) => {
      // Skip API and WS routes
      if (c.req.path.startsWith("/api/") || c.req.path === "/ws") {
        return next();
      }
      // Try to serve static file
      const filePath = join(clientDir, c.req.path === "/" ? "index.html" : c.req.path);
      if (existsSync(filePath)) {
        return fileResponse(filePath);
      }
      // SPA fallback
      return fileResponse(join(clientDir, "index.html"));
    });
  }
}

// Start file watcher
startWatcher(ctx);

function getDashboardSummary() {
  try {
    const stats: Record<string, string> = {};
    const rows = db.prepare("SELECT key, value FROM stats_cache").all() as {
      key: string;
      value: string;
    }[];
    for (const row of rows) {
      if (row.key !== "raw") stats[row.key] = row.value;
    }

    return {
      totalSessions: parseInt(stats.totalSessions || "0"),
      totalMessages: parseInt(stats.totalMessages || "0"),
    };
  } catch {
    return {};
  }
}

// Start server with WebSocket support
if (IS_BUN) {
  // Bun runtime: native Bun.serve with WebSocket
  const server = Bun.serve({
    port: PORT,
    fetch(req: Request, server: any) {
      const url = new URL(req.url);

      // WebSocket upgrade
      if (url.pathname === "/ws") {
        const upgraded = server.upgrade(req);
        if (upgraded) return undefined;
        return new Response("WebSocket upgrade failed", { status: 400 });
      }

      return app.fetch(req, server);
    },
    websocket: {
      open(ws: any) {
        addClient(ws);
        const dashboardData = getDashboardSummary();
        ws.send(
          JSON.stringify({
            event: "initial:sync",
            data: dashboardData,
            timestamp: Date.now(),
          })
        );
      },
      close(ws: any) {
        removeClient(ws);
      },
      message(_ws: any, _msg: any) {
        // Handle client messages if needed
      },
    },
  });
} else {
  // Node.js runtime: @hono/node-server + @hono/node-ws
  const { serve } = await import("@hono/node-server");
  const { createNodeWebSocket } = await import("@hono/node-ws");

  const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

  const wsClientMap = new WeakMap<object, { send(data: string): void }>();

  app.get("/ws", upgradeWebSocket(() => ({
    onOpen(_event: any, ws: any) {
      const client = { send: (data: string) => ws.send(data) };
      wsClientMap.set(ws, client);
      addClient(client);
      const dashboardData = getDashboardSummary();
      ws.send(
        JSON.stringify({
          event: "initial:sync",
          data: dashboardData,
          timestamp: Date.now(),
        })
      );
    },
    onClose(_event: any, ws: any) {
      const client = wsClientMap.get(ws);
      if (client) {
        removeClient(client);
        wsClientMap.delete(ws);
      }
    },
    onMessage(_event: any, _ws: any) {
      // Handle client messages if needed
    },
  })));

  const server = serve({ fetch: app.fetch, port: PORT }, () => {});
  injectWebSocket(server);
}

console.log(`
  ╔═══════════════════════════════════════╗
  ║         Cloviz Dashboard              ║
  ║   http://localhost:${PORT}               ║
  ╚═══════════════════════════════════════╝
`);

// Run background index for session JSONL content (deferred, non-blocking)
setTimeout(() => runBackgroundIndex(ctx), 100);

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down...");
  closeDb();
  process.exit(0);
});

export default app;
