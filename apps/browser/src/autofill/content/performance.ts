// Hot-path instrumentation for autofill content scripts.
// See performance.md for usage and performance.design.md for design rationale.

let enabled = false;

const BUFFER_SIZE = 128;
const BUFFER_MASK = BUFFER_SIZE - 1;

interface PerfSlot {
  name: string;
  start: number;
  end: number;
}

const buffer: PerfSlot[] = new Array(BUFFER_SIZE);
for (let i = 0; i < BUFFER_SIZE; i++) {
  buffer[i] = { name: "", start: 0, end: 0 };
}

let writeHead = 0;
let readHead = 0;
let pendingFlush = false;

function recordEntry(name: string, start: number, end: number): void {
  const slot = buffer[writeHead & BUFFER_MASK];
  slot.name = name;
  slot.start = start;
  slot.end = end;
  writeHead++;

  if (!pendingFlush) {
    pendingFlush = true;
    // Inlined rather than importing requestIdleCallbackPolyfill from ../utils,
    // which would pull in the entire barrel export and bloat the content script bundle.
    if ("requestIdleCallback" in globalThis) {
      globalThis.requestIdleCallback(flushBuffer);
    } else {
      globalThis.setTimeout(flushBuffer, 0);
    }
  }
}

function flushBuffer(): void {
  const currentWriteHead = writeHead;

  if (currentWriteHead - readHead > BUFFER_SIZE) {
    readHead = currentWriteHead - BUFFER_SIZE;
  }

  while (readHead < currentWriteHead) {
    const slot = buffer[readHead & BUFFER_MASK];
    const startMarkName = slot.name + "-start";
    const endMarkName = slot.name + "-end";

    performance.mark(startMarkName, { startTime: slot.start });
    performance.mark(endMarkName, { startTime: slot.end });
    performance.measure(slot.name, startMarkName, endMarkName);

    readHead++;
  }

  pendingFlush = false;

  if (writeHead > currentWriteHead) {
    pendingFlush = true;
    if ("requestIdleCallback" in globalThis) {
      globalThis.requestIdleCallback(flushBuffer);
    } else {
      globalThis.setTimeout(flushBuffer, 0);
    }
  }
}

/**
 * Activates instrumentation for all stopwatches and measures. This is a one-way
 * latch — once enabled, instrumentation remains active for the lifetime of the
 * content script. Creates a `perf:enabled` mark to anchor the instrumentation
 * start in the performance timeline.
 */
export function enableInstrumentation(): void {
  enabled = true;
  performance.mark("perf:enabled");
}

/** Returns whether instrumentation is currently enabled. */
export function isInstrumentationEnabled(): boolean {
  return enabled;
}

/**
 * Wraps a function with timing instrumentation. Always returns a wrapper that
 * checks the `enabled` flag at call time — {@link enableInstrumentation} can be
 * called at any point and all existing stopwatches will begin recording.
 *
 * When disabled, the wrapper delegates directly to `fn` with no timestamps
 * or buffer writes. The per-call branch is negligible — the CPU's branch
 * predictor learns the pattern immediately.
 *
 * **Warning:** Only measures synchronous execution. If `fn` returns a Promise,
 * the recorded duration is the time to create the promise, not to resolve it.
 *
 * @param name - Label for the resulting performance measure entries.
 * @param fn - The function to instrument.
 * @returns A wrapper that instruments `fn` when enabled, or delegates directly when disabled.
 */
export function stopwatch<T extends (...args: any[]) => any>(name: string, fn: T): T {
  return function (this: ThisParameterType<T>, ...args: Parameters<T>): ReturnType<T> {
    if (!enabled) {
      return fn.apply(this, args);
    }

    const start = performance.now();
    const result = fn.apply(this, args);
    recordEntry(name, start, performance.now());
    return result;
    // Best-effort type preservation: the wrapper's call signature matches T,
    // but any non-callable properties on T (e.g. a .cancel() method) are lost.
  } as T;
}

/**
 * Executes `fn` and records its duration. Use for inline code blocks that don't
 * sit at a function boundary. When disabled, calls `fn()` directly with no overhead.
 *
 * **Warning:** Only measures synchronous execution. If `fn` returns a Promise,
 * the recorded duration is the time to create the promise, not to resolve it.
 *
 * @param name - Label for the resulting performance measure entry.
 * @param fn - The block to time.
 * @returns The return value of `fn`.
 */
export function measure<T>(name: string, fn: () => T): T {
  if (!enabled) {
    return fn();
  }

  const start = performance.now();
  const result = fn();
  recordEntry(name, start, performance.now());
  return result;
}

/**
 * Returns all performance measure entries recorded by the instrumentation.
 * Delegates to the standard `performance.getEntriesByType("measure")` API.
 */
export function exportPerformanceEntries(): PerformanceEntryList {
  return performance.getEntriesByType("measure");
}
