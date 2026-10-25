import {
  limitPerformanceMeasurements,
  MAX_AGE_MS,
  MAX_ENTRIES,
} from "./performance-measurement-limit";

/** Records `count` entries, alternating marks and measures. */
function recordEntries(count: number) {
  for (let i = 0; i < count; i++) {
    if (i % 2 === 0) {
      performance.mark(`mark-${i}`);
    } else {
      performance.measure(`measure-${i}`, { start: performance.now() });
    }
  }
}

/** Waits for the observer to receive the entries recorded so far. */
async function flushObserver() {
  await new Promise((resolve) => setImmediate(resolve));
}

describe("limitPerformanceMeasurements", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    performance.clearMarks();
    performance.clearMeasures();
  });

  it("clears marks and measures once there are more than MAX_ENTRIES", async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    using limit = limitPerformanceMeasurements();

    recordEntries(MAX_ENTRIES + 1);
    await flushObserver();

    expect(performance.getEntries().length).toBe(0);
  });

  it("keeps entries when there are exactly MAX_ENTRIES", async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    using limit = limitPerformanceMeasurements();

    recordEntries(MAX_ENTRIES);
    await flushObserver();

    expect(performance.getEntries().length).toBe(MAX_ENTRIES);
  });

  it("clears entries once the oldest is older than MAX_AGE_MS", async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    using limit = limitPerformanceMeasurements();

    const now = performance.now();
    jest.spyOn(performance, "now").mockReturnValue(now + MAX_AGE_MS + 1);
    performance.mark("old", { startTime: now });
    await flushObserver();

    expect(performance.getEntries().length).toBe(0);
  });

  it("counts entries recorded before it was installed", async () => {
    recordEntries(MAX_ENTRIES + 1);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    using limit = limitPerformanceMeasurements();
    await flushObserver();

    expect(performance.getEntries().length).toBe(0);
  });

  it("counts again from zero after clearing", async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    using limit = limitPerformanceMeasurements();
    recordEntries(MAX_ENTRIES + 1);
    await flushObserver();

    recordEntries(MAX_ENTRIES);
    await flushObserver();

    expect(performance.getEntries().length).toBe(MAX_ENTRIES);
  });

  it("does nothing where PerformanceObserver is unavailable", async () => {
    const original = globalThis.PerformanceObserver;
    Object.defineProperty(globalThis, "PerformanceObserver", {
      value: undefined,
      configurable: true,
    });

    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      using limit = limitPerformanceMeasurements();
      recordEntries(MAX_ENTRIES + 1);
      await flushObserver();

      expect(performance.getEntries().length).toBe(MAX_ENTRIES + 1);
    } finally {
      Object.defineProperty(globalThis, "PerformanceObserver", {
        value: original,
        configurable: true,
      });
    }
  });
});
