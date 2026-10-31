import { CdpSession, Target } from "./cdp";

/** One call of a vault decrypt entry point in the service worker. */
export type DecryptCall = { method: string; items: number; start: number; end?: number };

export type DecryptCallSummary = {
  calls: number;
  /** Ciphers passed in, summed over calls; a whole-vault decrypt adds the vault size. */
  items: number;
  /** Most calls running at the same time; above 1 means decrypts overlapped. */
  maxConcurrent: number;
  /** Time spent in calls, summed; overlapping calls count twice. */
  totalMs: number;
  byMethod: Record<string, { calls: number; items: number }>;
};

/**
 * Decrypt entry points on the service worker's `self.bitwardenMain`, as
 * `[path to the owning service, method]`. Missing ones are skipped, so one probe fits
 * builds from before and after a method was renamed.
 */
const ENTRY_POINTS: [string, string][] = [
  ["cipherService.cipherEncryptionService", "decryptManyWithFailures"],
  ["cipherService.cipherEncryptionService", "decrypt"],
  ["cipherService.cipherSdkService", "getAllDecrypted"],
  ["cipherService.cipherSdkService", "decryptAll"],
];

/**
 * Wraps each entry point to record start, end and item count into `self.__decryptCalls`.
 * Runs in the service worker; serialized by CDP, so it must not close over anything.
 */
function instrument(entryPoints: [string, string][]) {
  // Wrapped already: start over, so each phase counts its own calls.
  if ((self as any).__decryptCalls != null) {
    (self as any).__decryptCalls.length = 0;
    return;
  }

  const calls: DecryptCall[] = [];
  (self as any).__decryptCalls = calls;

  for (const [path, method] of entryPoints) {
    const owner = path.split(".").reduce((o: any, key) => o?.[key], (self as any).bitwardenMain);
    const original = owner?.[method];
    if (typeof original !== "function") {
      continue;
    }

    owner[method] = function (...args: unknown[]) {
      const call: DecryptCall = {
        method,
        items: Array.isArray(args[0]) ? args[0].length : 0,
        start: performance.now(),
      };
      calls.push(call);

      const result = original.apply(this, args);
      void Promise.resolve(result)
        .then((value: any) => {
          // No list passed in, e.g. a whole-vault decrypt by user id: count what came out.
          if (call.items === 0) {
            const results = (value?.successes?.length ?? 0) + (value?.failures?.length ?? 0);
            call.items = results || 1;
          }
        })
        .finally(() => (call.end = performance.now()));
      return result;
    };
  }
}

/** Starts recording decrypt calls in the service worker `target`, or starts over. */
export async function recordDecryptCalls(target: Target) {
  const session = await CdpSession.connect(target);
  try {
    await session.send("Runtime.evaluate", {
      expression: `(${instrument.toString()})(${JSON.stringify(ENTRY_POINTS)})`,
    });
  } finally {
    session.close();
  }
}

/** The calls recorded since {@link recordDecryptCalls}, summarized. */
export async function decryptCallSummary(target: Target): Promise<DecryptCallSummary> {
  const session = await CdpSession.connect(target);
  let calls: DecryptCall[];
  try {
    const { result } = await session.send("Runtime.evaluate", {
      expression: "self.__decryptCalls ?? []",
      returnByValue: true,
    });
    calls = result.value;
  } finally {
    session.close();
  }

  const byMethod: DecryptCallSummary["byMethod"] = {};
  for (const call of calls) {
    const entry = (byMethod[call.method] ??= { calls: 0, items: 0 });
    entry.calls++;
    entry.items += call.items;
  }

  // Sweep over start (+1) and end (-1) events; an unfinished call runs to the end.
  const events = calls.flatMap((c) => [
    [c.start, 1],
    [c.end ?? Infinity, -1],
  ]);
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let running = 0;
  let maxConcurrent = 0;
  for (const [, delta] of events) {
    running += delta;
    maxConcurrent = Math.max(maxConcurrent, running);
  }

  return {
    calls: calls.length,
    items: calls.reduce((sum, c) => sum + c.items, 0),
    maxConcurrent,
    totalMs: Math.round(calls.reduce((sum, c) => sum + ((c.end ?? c.start) - c.start), 0)),
    byMethod,
  };
}
