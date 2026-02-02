import { Hono } from "hono";
import { startWatcher, stopWatcher, isWatcherRunning } from "../watcher";
import type { PipelineContext } from "../pipeline/index";

export function createWatcherApi(ctx: PipelineContext) {
  const app = new Hono();

  app.post("/start", (c) => {
    startWatcher(ctx);
    return c.json({ running: true });
  });

  app.post("/stop", (c) => {
    stopWatcher();
    return c.json({ running: false });
  });

  app.get("/status", (c) => {
    return c.json({ running: isWatcherRunning() });
  });

  return app;
}
