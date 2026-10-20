import { AutomationCapability } from "../automation-capability";

const MAX_EVENTS = 10_000;

/** When the global `performance` object gets replaced by the capturing proxy. */
export const PerformanceHookMode = Object.freeze({
  /** Hook on construction. */
  Auto: "auto",
  /** Hook only when `hookPerformance()` is called. */
  Manual: "manual",
} as const);
export type PerformanceHookMode = (typeof PerformanceHookMode)[keyof typeof PerformanceHookMode];

export interface PerformanceEvent {
  type: "mark" | "measure";
  name: string;
  startTime: number;
  duration: number;
  detail: unknown;
}

const CAPTURED_METHODS: Record<string, PerformanceEvent["type"]> = {
  mark: "mark",
  measure: "measure",
};

/** Captures `performance.mark()` and `performance.measure()` calls so they can be read out. */
export class PerformanceCapability extends AutomationCapability {
  readonly automationName = "performance";

  private events: PerformanceEvent[] = [];
  private original: Performance | undefined;

  constructor(
    private globalScope: typeof globalThis,
    hookMode: PerformanceHookMode,
  ) {
    super();

    if (hookMode === PerformanceHookMode.Auto) {
      this.hookPerformance();
    }
  }

  /**
   * Replace the global `performance` with a proxy that records marks and measures.
   * Calls pass through unchanged. Does nothing when already hooked.
   */
  hookPerformance(): void {
    if (this.original) {
      return;
    }

    this.original = this.globalScope.performance;

    Object.defineProperty(this.globalScope, "performance", {
      value: this.createProxy(this.original),
      configurable: true,
      writable: true,
    });
  }

  /** Restore the original global `performance`. Captured events are kept. */
  unhookPerformance(): void {
    if (!this.original) {
      return;
    }

    Object.defineProperty(this.globalScope, "performance", {
      value: this.original,
      configurable: true,
      writable: true,
    });
    this.original = undefined;
  }

  isHooked(): boolean {
    return this.original !== undefined;
  }

  /** Read all captured events, oldest first. */
  readEvents(): PerformanceEvent[] {
    return [...this.events];
  }

  clearEvents(): void {
    this.events = [];
  }

  private createProxy(target: Performance): Performance {
    return new Proxy(target, {
      get: (obj, prop) => {
        const value = Reflect.get(obj, prop, obj);
        if (typeof value !== "function") {
          return value;
        }

        // Native methods throw "Illegal invocation" unless called on the real object.
        const bound = value.bind(obj);
        const type = typeof prop === "string" ? CAPTURED_METHODS[prop] : undefined;
        if (!type) {
          return bound;
        }

        return (...args: unknown[]) => {
          const entry = bound(...args) as PerformanceEntry & { detail?: unknown };
          this.record(type, entry);
          return entry;
        };
      },
    });
  }

  private record(type: PerformanceEvent["type"], entry: PerformanceEntry & { detail?: unknown }) {
    this.events.push({
      type,
      name: entry.name,
      startTime: entry.startTime,
      duration: entry.duration,
      detail: entry.detail ?? null,
    });

    // Drop the oldest so a long-running dev session cannot grow without bound.
    if (this.events.length > MAX_EVENTS) {
      this.events.shift();
    }
  }
}
