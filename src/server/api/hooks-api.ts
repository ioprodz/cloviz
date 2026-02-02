import { Hono } from "hono";
import { join } from "path";
import { homedir } from "os";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { broadcast } from "../ws";
import { handleFileChange, type PipelineContext } from "../pipeline/index";

const SETTINGS_PATH = join(homedir(), ".claude", "settings.json");
const HOOK_MARKER = "#cloviz-hook";

const PORT = parseInt(process.env.PORT || "3456");

function makeHookCommand(): string {
  return `curl -s -X POST http://localhost:${PORT}/api/hooks/notify -H 'Content-Type: application/json' -d @- > /dev/null 2>&1 || true ${HOOK_MARKER}`;
}

function makeHookEntry() {
  return {
    matcher: "",
    hooks: [
      {
        type: "command",
        command: makeHookCommand(),
        timeout: 600,
        async: true,
      },
    ],
  };
}

function readSettings(): Record<string, unknown> {
  try {
    if (!existsSync(SETTINGS_PATH)) return {};
    const raw = readFileSync(SETTINGS_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeSettings(settings: Record<string, unknown>) {
  const dir = join(homedir(), ".claude");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + "\n", "utf-8");
}

function hasClovizHook(eventHooks: unknown[]): boolean {
  if (!Array.isArray(eventHooks)) return false;
  return eventHooks.some((group: any) => {
    if (!Array.isArray(group?.hooks)) return false;
    return group.hooks.some(
      (h: any) => typeof h?.command === "string" && h.command.includes(HOOK_MARKER)
    );
  });
}

function isInstalled(): boolean {
  const settings = readSettings();
  const hooks = settings.hooks as Record<string, unknown[]> | undefined;
  if (!hooks) return false;
  return hasClovizHook(hooks.PostToolUse) && hasClovizHook(hooks.Stop);
}

export function createHooksApi(ctx: PipelineContext) {
  const app = new Hono();

  app.get("/status", (c) => {
    return c.json({ installed: isInstalled() });
  });

  app.post("/install", (c) => {
    const settings = readSettings();
    if (!settings.hooks) settings.hooks = {};
    const hooks = settings.hooks as Record<string, unknown[]>;

    for (const event of ["PostToolUse", "Stop"]) {
      if (!Array.isArray(hooks[event])) {
        hooks[event] = [];
      }
      if (!hasClovizHook(hooks[event])) {
        hooks[event].push(makeHookEntry());
      }
    }

    writeSettings(settings);
    const installed = isInstalled();
    broadcast("hooks:status", { installed });
    return c.json({ installed });
  });

  app.post("/uninstall", (c) => {
    const settings = readSettings();
    const hooks = settings.hooks as Record<string, unknown[]> | undefined;
    if (hooks) {
      for (const event of ["PostToolUse", "Stop"]) {
        if (!Array.isArray(hooks[event])) continue;
        hooks[event] = hooks[event].filter((group: any) => {
          if (!Array.isArray(group?.hooks)) return true;
          const filtered = group.hooks.filter(
            (h: any) => !(typeof h?.command === "string" && h.command.includes(HOOK_MARKER))
          );
          if (filtered.length === 0) return false;
          group.hooks = filtered;
          return true;
        });
        if (hooks[event].length === 0) delete hooks[event];
      }
      if (Object.keys(hooks).length === 0) delete settings.hooks;
      writeSettings(settings);
    }

    const installed = isInstalled();
    broadcast("hooks:status", { installed });
    return c.json({ installed });
  });

  app.post("/notify", async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const { transcript_path, session_id, hook_event_name } = body as {
        transcript_path?: string;
        session_id?: string;
        hook_event_name?: string;
      };

      if (transcript_path) {
        const event = handleFileChange(ctx, transcript_path);
        if (event) {
          broadcast(event, { path: transcript_path, source: "hook" });
        }
      }

      // On Stop events, also re-parse history and stats
      if (hook_event_name === "Stop") {
        const historyPath = join(ctx.claudeDir, "history.jsonl");
        if (existsSync(historyPath)) {
          const histEvent = handleFileChange(ctx, historyPath);
          if (histEvent) broadcast(histEvent, { source: "hook" });
        }

        const statsPath = join(ctx.claudeDir, "stats-cache.json");
        if (existsSync(statsPath)) {
          const statsEvent = handleFileChange(ctx, statsPath);
          if (statsEvent) broadcast(statsEvent, { source: "hook" });
        }
      }
    } catch (e) {
      console.error("[hooks] Error processing notify:", e);
    }

    return c.json({ ok: true });
  });

  return app;
}
