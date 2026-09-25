import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { E2E_STATE_DIR } from "./paths";

const PERF_DIR = resolve(E2E_STATE_DIR, "perf");

/** One lock → unlock round trip, in wall-clock milliseconds. */
export type LockCycle = { lockMs: number; unlockMs: number };

/** Number of lock → unlock round trips, e.g. `PERF_ITERATIONS=5`. */
export const PERF_ITERATIONS = Number(process.env.PERF_ITERATIONS ?? 3);

/** Times `action` from call to resolve. */
export async function timed(action: () => Promise<void>): Promise<number> {
  const start = Date.now();
  await action();
  return Date.now() - start;
}

/** Runs `PERF_ITERATIONS` lock → unlock cycles and collects their timings. */
export async function measureLockCycles(
  lock: () => Promise<void>,
  unlock: () => Promise<void>,
): Promise<LockCycle[]> {
  const cycles: LockCycle[] = [];

  for (let i = 0; i < PERF_ITERATIONS; i++) {
    const lockMs = await timed(lock);
    const unlockMs = await timed(unlock);
    cycles.push({ lockMs, unlockMs });
  }

  return cycles;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

/**
 * Prints the cycles and their medians, and saves them to .debug/e2e/perf/<client>.json.
 *
 *   [perf] browser lock/unlock (3 cycles)
 *   ┌─────────┬────────┬──────────┐
 *   │ (index) │ lockMs │ unlockMs │
 */
export function reportLockCycles(client: string, cycles: LockCycle[]) {
  const summary = {
    lockMedianMs: median(cycles.map((c) => c.lockMs)),
    unlockMedianMs: median(cycles.map((c) => c.unlockMs)),
  };

  mkdirSync(PERF_DIR, { recursive: true });
  writeFileSync(
    resolve(PERF_DIR, `${client}.json`),
    JSON.stringify({ client, cycles, summary }, null, 2),
  );

  /* eslint-disable no-console */
  console.log(`[perf] ${client} lock/unlock (${cycles.length} cycles)`);
  console.table(cycles);
  console.table(summary);
  /* eslint-enable no-console */
}
