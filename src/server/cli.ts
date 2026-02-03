#!/usr/bin/env node

import { RUNTIME } from "./runtime/detect";

process.env.NODE_ENV = "production";

const PORT = parseInt(process.env.PORT || "3456");

console.log(`[cloviz] Starting with ${RUNTIME} runtime...`);

// Open browser after a short delay
setTimeout(() => {
  const url = `http://localhost:${PORT}`;
  const { platform } = process;

  let cmd: string;
  let args: string[];
  if (platform === "darwin") {
    cmd = "open";
    args = [url];
  } else if (platform === "win32") {
    cmd = "cmd";
    args = ["/c", "start", url];
  } else {
    cmd = "xdg-open";
    args = [url];
  }

  import("child_process").then(({ spawn }) => {
    const child = spawn(cmd, args, { stdio: "ignore", detached: true });
    child.unref();
  }).catch(() => {
    // Browser open is best-effort
  });
}, 1000);

// Import and run the server
await import("./index");
