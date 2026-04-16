// Hot-path instrumentation for autofill content scripts.
// See performance.md for usage and performance.design.md for design rationale.

let enabled = false;
let forceTimeout = false;

const BUFFER_SIZE = 128;
const BUFFER_MASK = BUFFER_SIZE - 1;

// Mark and measure names must remain stable — they are part of the
// extraction API and are visible in browser developer tools.
interface PerfNames {
  measure: string;
  start: string;
  end: string;
  poison: string;
}

const namesCache: Record<string, PerfNames> = {};
let namesCacheSize = 0;
const NAMES_CACHE_WARN_THRESHOLD = 64;

function resolveNames(name: string): PerfNames {
  let names = namesCache[name];
  if (!names) {
    names = {
      measure: name,
      start: name + ":start",
      end: name + ":end",
      poison: name + ":poison",
    };
    namesCache[name] = names;
    namesCacheSize++;
    if (namesCacheSize === NAMES_CACHE_WARN_THRESHOLD) {
      // eslint-disable-next-line no-console -- this is running in a content-script; `LogService` is unavailable
      console.warn(
        `[perf] ${NAMES_CACHE_WARN_THRESHOLD} unique measurement names registered. ` +
          "This cache is not bounded — ensure names are static, not dynamically generated.",
      );
    }
  }
  return names;
}

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

function scheduleFlush(): void {
  // Inlined `requestIdleCallbackPolyfill()` from ../utils to avoid
  // pulling background resources into content scripts
  if (!forceTimeout && "requestIdleCallback" in globalThis) {
    globalThis.requestIdleCallback(flushBuffer);
  } else {
    globalThis.setTimeout(flushBuffer, 0);
  }
}

function recordEntry(name: string, start: number, end: number): void {
  const slot = buffer[writeHead & BUFFER_MASK];
  slot.name = name;
  slot.start = start;
  slot.end = end;
  writeHead++;

  if (!pendingFlush) {
    pendingFlush = true;
    scheduleFlush();
  }
}

function flushBuffer(): void {
  const currentWriteHead = writeHead;

  if (currentWriteHead - readHead > BUFFER_SIZE) {
    readHead = currentWriteHead - BUFFER_SIZE;
  }

  while (readHead < currentWriteHead) {
    const slot = buffer[readHead & BUFFER_MASK];
    const names = resolveNames(slot.name);

    performance.mark(names.start, { startTime: slot.start });
    performance.mark(names.end, { startTime: slot.end });
    performance.measure(names.measure, names.start, names.end);

    readHead++;
  }

  pendingFlush = false;

  if (writeHead > currentWriteHead) {
    pendingFlush = true;
    scheduleFlush();
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
 * Forces the flush scheduler to use `setTimeout` instead of `requestIdleCallback`.
 * This is a one-way latch — once activated, all subsequent flushes use timeouts
 * for the lifetime of the content script.
 *
 * Use this when the page under test never goes idle, which would prevent
 * `requestIdleCallback` from firing and leave entries stranded in the buffer.
 */
export function useTimeoutForFlush(): void {
  forceTimeout = true;
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
 * Marks a measurement as poisoned by writing a `${name}:poison` mark to the
 * Performance Timeline. Use when an unexpected error or external factor has
 * compromised the timing data, making it unreliable. Consumers should check
 * for poison marks before trusting extracted measures.
 *
 * @param name - The measurement name to poison.
 */
export function poison(name: string): void {
  const names = resolveNames(name);
  performance.mark(names.poison);
}
