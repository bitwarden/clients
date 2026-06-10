// Hot-path instrumentation for autofill content scripts.
// See performance.md for usage and performance.design.md for design rationale.

const enabled = process.env.BW_INCLUDE_CONTENT_SCRIPT_MEASUREMENTS;

const WATCH_BITS = enabled ? 10 : 0;
const WATCH_SIZE = 1 << WATCH_BITS;
const WATCH_MASK = WATCH_SIZE - 1;

const DEFAULT_METER_BITS = 8;

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

const NAMES_SUFFIX = "autofill:bw";

function formatMark(name: string, mark: string) {
  return `${name}:${mark}:${NAMES_SUFFIX}`;
}

function resolveNames(name: string): PerfNames {
  let names = namesCache[name];
  if (!names) {
    names = {
      measure: `${name}:${NAMES_SUFFIX}`,
      start: formatMark(name, "start"),
      end: formatMark(name, "end"),
      poison: formatMark(name, "poison"),
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

interface WatchSlot {
  name: string;
  start: number;
  end: number;
}

const watchBuffer: WatchSlot[] = new Array(WATCH_SIZE);
for (let i = 0; i < WATCH_SIZE; i++) {
  watchBuffer[i] = { name: "", start: 0, end: 0 };
}

let watchWriteHead = 0;
let watchReadHead = 0;

type MeterValue = string | number | boolean;

interface MeterConfig {
  name: string;
  bits?: number;
}

interface RegisteredMeter {
  name: string;
  keys: readonly string[];
  buffer: MeterValue[][];
  mask: number;
  getWriteHead: () => number;
  getReadHead: () => number;
  setReadHead: (v: number) => void;
}

const meters: RegisteredMeter[] = [];

let pendingFlush = false;

function scheduleFlush(): void {
  globalThis.setTimeout(flushBuffer, 0);
}

function recordWatch(name: string, start: number, end: number): void {
  const slot = watchBuffer[watchWriteHead & WATCH_MASK];
  slot.name = name;
  slot.start = start;
  slot.end = end;
  watchWriteHead++;

  if (!pendingFlush) {
    pendingFlush = true;
    scheduleFlush();
  }
}

function flushBuffer(): void {
  let rescheduleNeeded = false;

  const watchWriteHeadAtStart = watchWriteHead;
  if (watchWriteHeadAtStart - watchReadHead > WATCH_SIZE) {
    watchReadHead = watchWriteHeadAtStart - WATCH_SIZE;
  }
  while (watchReadHead < watchWriteHeadAtStart) {
    const slot = watchBuffer[watchReadHead & WATCH_MASK];
    const names = resolveNames(slot.name);
    performance.mark(names.start, { startTime: slot.start });
    performance.mark(names.end, { startTime: slot.end });
    performance.measure(names.measure, names.start, names.end);
    watchReadHead++;
  }

  for (let i = 0; i < meters.length; i++) {
    const m = meters[i];
    const meterWriteHeadAtStart = m.getWriteHead();
    let meterReadHead = m.getReadHead();
    const meterSize = m.mask + 1;

    if (meterWriteHeadAtStart - meterReadHead > meterSize) {
      meterReadHead = meterWriteHeadAtStart - meterSize;
    }

    const markName = `${m.name}:meter:${NAMES_SUFFIX}`;
    const arity = m.keys.length;

    while (meterReadHead < meterWriteHeadAtStart) {
      const row = m.buffer[meterReadHead & m.mask];
      const at = row[0] as number;

      if (arity === 0) {
        performance.mark(markName, { startTime: at });
      } else {
        const detail: Record<string, MeterValue> = {};
        for (let k = 0; k < arity; k++) {
          detail[m.keys[k]] = row[k + 1];
        }
        performance.mark(markName, { startTime: at, detail });
      }

      meterReadHead++;
    }

    m.setReadHead(meterReadHead);

    if (m.getWriteHead() > meterWriteHeadAtStart) {
      rescheduleNeeded = true;
    }
  }

  pendingFlush = false;

  if (watchWriteHead > watchWriteHeadAtStart || rescheduleNeeded) {
    pendingFlush = true;
    scheduleFlush();
  }
}

/**
 * Wraps a function with timing instrumentation. The wrapper preserves the
 * function's return value, arguments, and `this` context. When disabled at
 * build time, the wrapper delegates directly to `fn` with no timestamps or
 * buffer writes.
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
    recordWatch(name, start, performance.now());
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
  recordWatch(name, start, performance.now());
  return result;
}

const NOOP: (...args: any[]) => void = () => {};

/**
 * Registers a meter and returns a function that records one point-in-time event
 * per call. Each call records `performance.now()` and zero or more positional
 * values typed `string | number | boolean`. The declared field names become the
 * keys of the `detail` object on the resulting `${name}:meter:autofill:bw` mark.
 *
 * When disabled at build time, returns a shared no-op and allocates no buffer.
 *
 * @param config - The meter name as a string, or `{ name, bits }` to override
 *   the per-meter buffer size. Buffer size is `1 << bits`. Defaults to 8.
 * @param keys - Field names; their order determines the positional argument order.
 * @returns A function that records one meter entry per call.
 */
export function createMeter<K extends readonly string[]>(
  config: string | MeterConfig,
  ...keys: K
): (...values: { [I in keyof K]: MeterValue }) => void {
  if (!enabled) {
    return NOOP;
  }

  const name = typeof config === "string" ? config : config.name;
  const bits =
    typeof config === "string" ? DEFAULT_METER_BITS : (config.bits ?? DEFAULT_METER_BITS);
  const size = 1 << bits;
  const mask = size - 1;
  const rowLength = 1 + keys.length;
  const buffer: MeterValue[][] = new Array(size);
  for (let i = 0; i < size; i++) {
    buffer[i] = new Array(rowLength);
  }

  let writeHead = 0;
  let readHead = 0;

  meters.push({
    name,
    keys,
    buffer,
    mask,
    getWriteHead: () => writeHead,
    getReadHead: () => readHead,
    setReadHead: (v: number) => {
      readHead = v;
    },
  });

  return ((...values: MeterValue[]) => {
    const slot = buffer[writeHead & mask];
    slot[0] = performance.now();
    for (let i = 0; i < values.length; i++) {
      slot[i + 1] = values[i];
    }
    writeHead++;
    if (!pendingFlush) {
      pendingFlush = true;
      scheduleFlush();
    }
  }) as (...values: { [I in keyof K]: MeterValue }) => void;
}

/**
 * Marks a span measurement as poisoned by writing a `${name}:poison:autofill:bw`
 * mark to the Performance Timeline. Use when an unexpected error or external
 * factor has compromised the timing data. Consumers should check for poison
 * marks before trusting extracted measures.
 *
 * Applies only to spans (`stopwatch`/`measure`). Meter entries cannot be poisoned.
 *
 * When disabled at build time, this is a no-op.
 *
 * @param name - The span measurement name to poison.
 */
export function poison(name: string): void {
  if (!enabled) {
    return;
  }

  const names = resolveNames(name);
  performance.mark(names.poison);
}
