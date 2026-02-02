#!/usr/bin/env node

/**
 * Captures screenshots of the running Cloviz dashboard for docs/README.
 *
 * Prerequisites:
 *   npx playwright install chromium
 *
 * Usage:
 *   1. Start the dev servers:  bun run dev
 *   2. Run this script:        node scripts/screenshots.mjs [--port 3457] [--project-id 8]
 *
 * Options:
 *   --port <number>       Dev server port (default: 3457)
 *   --project-id <number> Project ID to use for board/gantt views (default: first project by session count)
 *   --session-id <uuid>   Session ID for replay screenshot (default: latest with 10+ messages)
 *   --out <dir>           Output directory (default: docs/screenshots)
 */

import { chromium } from "playwright";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// Parse CLI args
const args = process.argv.slice(2);
function getArg(name, fallback) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
}

const PORT = getArg("port", "3457");
const BASE = `http://localhost:${PORT}`;
const OUT = resolve(ROOT, getArg("out", "docs/screenshots"));
let PROJECT_ID = getArg("project-id", null);
let SESSION_ID = getArg("session-id", null);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function go(page, path) {
  await page.goto(BASE + path, { waitUntil: "load", timeout: 15000 });
  await sleep(3000);
}

async function tryClick(page, selector, hasText) {
  const btn = page.locator(selector, { hasText }).first();
  if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await btn.click();
    await sleep(2000);
    return true;
  }
  return false;
}

// Auto-detect a good project and session if not specified
async function resolveDefaults() {
  try {
    const res = await fetch(`${BASE}/api/projects`);
    const { projects } = await res.json();
    if (!PROJECT_ID && projects.length > 0) {
      // Pick the first project (ordered by API, typically most recent/active)
      const first = projects[0];
      PROJECT_ID = first.id;
      console.log(`Auto-selected project: ${first.display_name} (id=${first.id}, ${first.session_count} sessions)`);
    }

    if (!SESSION_ID && PROJECT_ID) {
      const sessRes = await fetch(`${BASE}/api/sessions?limit=50`);
      const { sessions } = await sessRes.json();
      // Pick the first session from this project with a decent number of messages
      const good = sessions.find(
        (s) => s.message_count >= 10 && String(s.project_path).includes(projects.find((p) => p.id === PROJECT_ID)?.display_name || "")
      ) || sessions.find((s) => s.message_count >= 10);
      if (good) {
        SESSION_ID = good.id;
        console.log(`Auto-selected session: "${good.summary}" (${good.message_count} messages)`);
      }
    }
  } catch (e) {
    console.error("Could not auto-detect project/session. Is the dev server running?");
    console.error(`Tried: ${BASE}/api/projects`);
    process.exit(1);
  }
}

const TOTAL = 7;

(async () => {
  console.log(`Taking screenshots from ${BASE}`);
  console.log(`Output: ${OUT}\n`);

  await resolveDefaults();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: "dark",
  });

  const page = await context.newPage();

  // 1. Projects Overview
  console.log(`1/${TOTAL} Projects Overview`);
  await go(page, "/");
  await page.screenshot({ path: `${OUT}/projects-overview.png` });

  // 2. Project Detail - Board (Kanban) view
  if (PROJECT_ID) {
    console.log(`2/${TOTAL} Kanban Board`);
    await go(page, `/projects/${PROJECT_ID}`);
    await tryClick(page, "button", /board/i);
    await page.screenshot({ path: `${OUT}/kanban-board.png` });

    // 3. Gantt view
    console.log(`3/${TOTAL} Gantt Chart`);
    await tryClick(page, "button", /gantt/i);
    await page.screenshot({ path: `${OUT}/gantt-chart.png` });
  } else {
    console.log(`2/${TOTAL} Skipped (no project found)`);
    console.log(`3/${TOTAL} Skipped (no project found)`);
  }

  // 4. Session Replay
  if (SESSION_ID) {
    console.log(`4/${TOTAL} Session Replay`);
    await go(page, `/sessions/${SESSION_ID}`);
    await sleep(1000);
    await page.screenshot({ path: `${OUT}/session-replay.png` });
  } else {
    console.log(`4/${TOTAL} Skipped (no session found)`);
  }

  // 5. Analytics - Costs
  console.log(`5/${TOTAL} Analytics - Costs`);
  await go(page, "/analytics");
  await tryClick(page, "button", /costs/i);
  await page.screenshot({ path: `${OUT}/analytics-costs.png` });

  // 6. Analytics - Tools
  console.log(`6/${TOTAL} Analytics - Tools`);
  await tryClick(page, "button", /tools/i);
  await page.screenshot({ path: `${OUT}/analytics-tools.png` });

  // 7. Analytics - Patterns
  console.log(`7/${TOTAL} Analytics - Patterns`);
  await tryClick(page, "button", /patterns/i);
  await page.screenshot({ path: `${OUT}/analytics-patterns.png` });

  await browser.close();
  console.log(`\nDone! ${TOTAL} screenshots saved to ${OUT}`);
})();
