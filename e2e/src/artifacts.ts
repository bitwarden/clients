import { rmSync } from "node:fs";
import { join } from "node:path";

import { BrowserContext, TestInfo } from "@playwright/test";

/** Records every test instead of only failing ones, e.g. `E2E_VIDEO=1`. */
const RECORD_ALL = process.env.E2E_VIDEO != null;

const VIDEO_SUBDIR = "video";
const TRACE_FILE = "trace.zip";

/** Playwright's `video` option for the contexts it creates itself. */
export const VIDEO_MODE = RECORD_ALL ? "on" : "retain-on-failure";

function failed(testInfo: TestInfo): boolean {
  return testInfo.status !== testInfo.expectedStatus;
}

/**
 * Where a self-launched context records. Playwright's `video`, `trace` and `screenshot`
 * options only reach the contexts it creates itself, so the browser and desktop
 * fixtures record and trace on their own.
 */
export function videoDir(testInfo: TestInfo): string {
  return join(testInfo.outputDir, VIDEO_SUBDIR);
}

/** Drops a passing test's video, once its context closed and the file is complete. */
export function pruneVideo(testInfo: TestInfo) {
  if (RECORD_ALL || failed(testInfo)) {
    return;
  }

  rmSync(videoDir(testInfo), { recursive: true, force: true });
}

/** Screenshots and DOM snapshots per action, like Playwright's `trace` option. */
export async function startTrace(context: BrowserContext) {
  await context.tracing.start({ screenshots: true, snapshots: true });
}

/** Keeps the trace of a failing test only, like `retain-on-failure`. */
export async function stopTrace(context: BrowserContext, testInfo: TestInfo) {
  if (!failed(testInfo)) {
    await context.tracing.stop();
    return;
  }

  await context.tracing.stop({ path: join(testInfo.outputDir, TRACE_FILE) });
}
