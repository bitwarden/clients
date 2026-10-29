import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { Page } from "@playwright/test";

import { LockScreen } from "../../lock-screen";

import { reportDir } from "./report";

/** Lock/unlock cycles, or popup opens, measured per method. */
export const UNLOCK_RUNS = 10;

// `VAULT_RENDERED_MARK` (libs/vault/src/utils/vault-performance.ts): first paint of the vault list.
const VAULT_RENDERED_MARK = "Vault rendered";
const UNLOCK_STARTED_MARK = "[e2e] Unlock started";
// Every unlock button sits in the shared lock screen (libs/key-management-ui).
const UNLOCK_TRIGGER = "bit-lock button";
const RENDER_TIMEOUT_MS = 5 * 60_000;
const REPORT_FILE = "unlock.json";

type Marks = { started: string; rendered: string; trigger: string };
const MARKS: Marks = {
  started: UNLOCK_STARTED_MARK,
  rendered: VAULT_RENDERED_MARK,
  trigger: UNLOCK_TRIGGER,
};

export type TimingSummary = {
  runs: number;
  medianMs: number;
  minMs: number;
  maxMs: number;
  durationsMs: number[];
};

/**
 * Runs in the page. Marks the unlock start when a lock screen button is clicked. The capture
 * listener runs before the app's own handler, so no unlock work precedes the mark. Clearing
 * both marks keeps one run from reading the previous run's render.
 */
function markUnlockClicks({ started, rendered, trigger }: Marks) {
  const scope = window as any;
  if (scope.__e2eUnlockMarks) {
    return;
  }
  scope.__e2eUnlockMarks = true;

  window.addEventListener(
    "click",
    (event) => {
      if (!(event.target instanceof Element) || event.target.closest(trigger) == null) {
        return;
      }

      performance.clearMarks(started);
      performance.clearMarks(rendered);
      performance.mark(started);
    },
    { capture: true },
  );
}

/** Marks unlock starts in every document the context opens from now on. */
export async function trackUnlocks(page: Page) {
  await page.context().addInitScript(markUnlockClicks, MARKS);
  await page.evaluate(markUnlockClicks, MARKS);
}

/**
 * Time to the vault's first paint, in ms: from the unlock click, or from navigation start
 * when `fromNavigation` (a popup opened while unlocked).
 */
async function renderTime(page: Page, fromNavigation: boolean): Promise<number> {
  const duration = await page
    .waitForFunction(
      ({ marks, fromNavigation }) => {
        const end = performance.getEntriesByName(marks.rendered, "mark").at(-1);
        if (end == null) {
          return false;
        }
        if (fromNavigation) {
          return end.startTime;
        }

        const start = performance.getEntriesByName(marks.started, "mark").at(-1);
        return start == null ? false : end.startTime - start.startTime;
      },
      { marks: MARKS, fromNavigation },
      { timeout: RENDER_TIMEOUT_MS },
    )
    .catch(async (error) => {
      // Name what is missing, e.g. a client build without the vault rendered mark.
      const marks = await page.evaluate(() =>
        performance.getEntriesByType("mark").map((mark) => mark.name),
      );
      throw new Error(`${error.message}\nMarks in page: ${marks.join(", ")}`);
    });

  return (await duration.jsonValue()) as number;
}

/**
 * Locks and unlocks {@link UNLOCK_RUNS} times. `lock` resolves the page showing the lock
 * screen, a new one since locking restarts the extension.
 */
export async function measureUnlocks(
  lock: () => Promise<Page>,
  unlock: (page: Page) => Promise<void>,
): Promise<number[]> {
  const durations: number[] = [];

  for (let run = 0; run < UNLOCK_RUNS; run++) {
    const page = await lock();
    await new LockScreen(page).waitUntilShown();

    await unlock(page);
    durations.push(await renderTime(page, false));
  }

  return durations;
}

/** Opens the popup {@link UNLOCK_RUNS} times while unlocked, as a toolbar click would. */
export async function measurePopupOpens(open: () => Promise<Page>): Promise<number[]> {
  const durations: number[] = [];

  for (let run = 0; run < UNLOCK_RUNS; run++) {
    const page = await open();
    durations.push(await renderTime(page, true));
    await page.close();
  }

  return durations;
}

const round = (ms: number) => Math.round(ms * 10) / 10;

/** Summarizes `durations` under `method` in `memory/<label>/unlock.json`, and logs it. */
export function reportTimings(method: string, durations: number[]): TimingSummary {
  const sorted = [...durations].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];

  const summary: TimingSummary = {
    runs: sorted.length,
    medianMs: round(median),
    minMs: round(sorted[0]),
    maxMs: round(sorted[sorted.length - 1]),
    durationsMs: durations.map(round),
  };

  const file = join(reportDir(), REPORT_FILE);
  let all: Record<string, TimingSummary> = {};
  try {
    all = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    // First method of this run.
  }
  all[method] = summary;
  writeFileSync(file, JSON.stringify(all, null, 2));

  // eslint-disable-next-line no-console
  console.log(
    `[unlock] ${method}: median ${summary.medianMs} ms, min ${summary.minMs} ms, ` +
      `max ${summary.maxMs} ms (${summary.durationsMs.join(", ")})`,
  );
  return summary;
}
