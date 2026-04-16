let perfModule: typeof import("./performance");

// jsdom lacks User Timing and requestIdleCallback — define stubs so spyOn can attach.
beforeAll(() => {
  if (!performance.mark) {
    (performance as any).mark = () => {};
  }
  if (!performance.measure) {
    (performance as any).measure = () => {};
  }
  if (!performance.getEntriesByType) {
    (performance as any).getEntriesByType = () => [] as any[];
  }
  if (!performance.getEntriesByName) {
    (performance as any).getEntriesByName = () => [] as any[];
  }
  if (!performance.clearMarks) {
    (performance as any).clearMarks = () => {};
  }
  if (!performance.clearMeasures) {
    (performance as any).clearMeasures = () => {};
  }
  if (!globalThis.requestIdleCallback) {
    (globalThis as any).requestIdleCallback = (cb: () => void) => setTimeout(cb, 0);
  }
});

describe("Performance instrumentation", () => {
  let markSpy: jest.SpyInstance;
  let measureSpy: jest.SpyInstance;
  let requestIdleCallbackSpy: jest.SpyInstance;

  beforeEach(async () => {
    markSpy = jest.spyOn(performance, "mark").mockImplementation();
    measureSpy = jest.spyOn(performance, "measure").mockImplementation();

    // Execute idle callbacks synchronously by default
    requestIdleCallbackSpy = jest
      .spyOn(globalThis, "requestIdleCallback")
      .mockImplementation((cb: IdleRequestCallback) => {
        cb({} as IdleDeadline);
        return 0;
      });

    await jest.isolateModulesAsync(async () => {
      perfModule = await import("./performance");
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("enableInstrumentation", () => {
    it("starts disabled", () => {
      expect(perfModule.isInstrumentationEnabled()).toBe(false);
    });

    it("enables instrumentation and creates a perf:enabled mark", () => {
      perfModule.enableInstrumentation();
      expect(perfModule.isInstrumentationEnabled()).toBe(true);
      expect(markSpy).toHaveBeenCalledWith("perf:enabled");
    });

    it("remains enabled after being called multiple times", () => {
      perfModule.enableInstrumentation();
      perfModule.enableInstrumentation();
      expect(perfModule.isInstrumentationEnabled()).toBe(true);
      expect(markSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("stopwatch", () => {
    it("always returns a wrapper, even when disabled", () => {
      const fn = jest.fn().mockReturnValue(42);
      const wrapped = perfModule.stopwatch("test", fn);

      expect(wrapped).not.toBe(fn);
      expect(wrapped()).toBe(42);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("delegates arguments and return value", () => {
      const fn = jest.fn().mockReturnValue("result");
      const wrapped = perfModule.stopwatch("test", fn);

      expect(wrapped("arg1", "arg2")).toBe("result");
      expect(fn).toHaveBeenCalledWith("arg1", "arg2");
    });

    it("preserves this context when enabled", () => {
      perfModule.enableInstrumentation();
      const obj = {
        value: 99,
        getValue: perfModule.stopwatch("getValue", function (this: { value: number }) {
          return this.value;
        }),
      };

      expect(obj.getValue()).toBe(99);
    });

    it("records timestamps to the buffer and flushes to performance API", () => {
      perfModule.enableInstrumentation();

      let nowValue = 100;
      jest.spyOn(performance, "now").mockImplementation(() => {
        const v = nowValue;
        nowValue += 5;
        return v;
      });

      const fn = jest.fn();
      const wrapped = perfModule.stopwatch("myFunc", fn);
      wrapped();

      expect(markSpy).toHaveBeenCalledWith("myFunc:start", { startTime: 100 });
      expect(markSpy).toHaveBeenCalledWith("myFunc:end", { startTime: 105 });
      expect(measureSpy).toHaveBeenCalledWith("myFunc", "myFunc:start", "myFunc:end");
    });

    it("does not record a timing entry when the wrapped function throws", () => {
      perfModule.enableInstrumentation();

      jest.spyOn(performance, "now").mockReturnValue(0);

      const error = new Error("boom");
      const fn = jest.fn().mockImplementation(() => {
        throw error;
      });
      const wrapped = perfModule.stopwatch("throws", fn);

      expect(() => wrapped()).toThrow(error);

      // The throw prevents recordEntry from being called — no marks or measures leak
      expect(measureSpy).not.toHaveBeenCalled();
      const markCalls = markSpy.mock.calls.map((c: unknown[]) => c[0]);
      expect(markCalls).not.toContain("throws:start");
      expect(markCalls).not.toContain("throws:end");
    });

    it("responds to enableInstrumentation called after wrapping", () => {
      const fn = jest.fn();
      const wrapped = perfModule.stopwatch("late-enable", fn);

      // Call while disabled — no recording
      wrapped();
      expect(markSpy).not.toHaveBeenCalled();

      // Enable after wrapping
      perfModule.enableInstrumentation();

      let nowValue = 0;
      jest.spyOn(performance, "now").mockImplementation(() => nowValue++);
      wrapped();

      // Should now record
      expect(markSpy).toHaveBeenCalledWith("late-enable:start", { startTime: 0 });
    });
  });

  describe("measure", () => {
    it("calls fn directly and returns result when disabled", () => {
      const fn = jest.fn().mockReturnValue("hello");
      const result = perfModule.measure("test", fn);

      expect(result).toBe("hello");
      expect(fn).toHaveBeenCalledTimes(1);
      expect(markSpy).not.toHaveBeenCalled();
      expect(measureSpy).not.toHaveBeenCalled();
    });

    it("records timestamps and returns result when enabled", () => {
      perfModule.enableInstrumentation();

      let nowValue = 200;
      jest.spyOn(performance, "now").mockImplementation(() => {
        const v = nowValue;
        nowValue += 10;
        return v;
      });

      const result = perfModule.measure("block", () => 42);

      expect(result).toBe(42);
      expect(markSpy).toHaveBeenCalledWith("block:start", { startTime: 200 });
      expect(markSpy).toHaveBeenCalledWith("block:end", { startTime: 210 });
      expect(measureSpy).toHaveBeenCalledWith("block", "block:start", "block:end");
    });

    it("does not record a timing entry when the function throws", () => {
      perfModule.enableInstrumentation();

      jest.spyOn(performance, "now").mockReturnValue(0);

      const error = new Error("boom");
      expect(() =>
        perfModule.measure("throws", () => {
          throw error;
        }),
      ).toThrow(error);

      // The throw prevents recordEntry from being called — no marks or measures leak
      expect(measureSpy).not.toHaveBeenCalled();
      const markCalls = markSpy.mock.calls.map((c: unknown[]) => c[0]);
      expect(markCalls).not.toContain("throws:start");
      expect(markCalls).not.toContain("throws:end");
    });
  });

  describe("poison", () => {
    it("creates a poison mark for the given name", () => {
      perfModule.poison("myFunc");

      expect(markSpy).toHaveBeenCalledWith("myFunc:poison");
    });

    it("works regardless of enabled state", () => {
      // Do not call enableInstrumentation — poison should work even when disabled
      perfModule.poison("myFunc");

      expect(markSpy).toHaveBeenCalledWith("myFunc:poison");
    });
  });

  describe("circular buffer", () => {
    it("handles multiple entries in sequence", () => {
      perfModule.enableInstrumentation();

      let nowValue = 0;
      jest.spyOn(performance, "now").mockImplementation(() => {
        const v = nowValue;
        nowValue += 1;
        return v;
      });

      const fn = jest.fn();
      const wrapped = perfModule.stopwatch("seq", fn);

      wrapped();
      wrapped();
      wrapped();

      // 1 perf:enabled mark + 3 entries × 2 marks each = 7
      expect(markSpy).toHaveBeenCalledTimes(7);
      expect(measureSpy).toHaveBeenCalledTimes(3);
    });

    it("overwrites oldest entries when buffer is full", () => {
      perfModule.enableInstrumentation();

      // Prevent auto-flush so entries accumulate
      requestIdleCallbackSpy.mockImplementation(() => 0);

      let nowValue = 0;
      jest.spyOn(performance, "now").mockImplementation(() => nowValue++);

      const fn = jest.fn();
      const wrapped = perfModule.stopwatch("fill", fn);

      // Write 130 entries into a 128-slot buffer — 2 oldest are overwritten
      for (let i = 0; i < 130; i++) {
        wrapped();
      }

      // Manually trigger the flush
      const flushCallback = requestIdleCallbackSpy.mock.calls[0][0];
      flushCallback({} as IdleDeadline);

      // Only 128 surviving entries should be flushed
      expect(measureSpy).toHaveBeenCalledTimes(128);
    });
  });

  describe("flush coalescing", () => {
    it("schedules one idle callback and flushes all entries", () => {
      perfModule.enableInstrumentation();

      const flushCallbacks: IdleRequestCallback[] = [];
      requestIdleCallbackSpy.mockImplementation((cb: IdleRequestCallback) => {
        flushCallbacks.push(cb);
        return flushCallbacks.length;
      });

      let nowValue = 0;
      jest.spyOn(performance, "now").mockImplementation(() => nowValue++);

      const fn = jest.fn();
      const wrapped = perfModule.stopwatch("coalesce", fn);

      wrapped();
      wrapped();
      wrapped();

      expect(flushCallbacks).toHaveLength(1);

      // Trigger the single coalesced flush — all 3 entries should be flushed
      flushCallbacks[0]({} as IdleDeadline);
      expect(measureSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe("flush rescheduling", () => {
    it("reschedules when new entries are written during flush", () => {
      perfModule.enableInstrumentation();

      const flushCallbacks: IdleRequestCallback[] = [];
      requestIdleCallbackSpy.mockImplementation((cb: IdleRequestCallback) => {
        flushCallbacks.push(cb);
        return flushCallbacks.length;
      });

      let nowValue = 0;
      jest.spyOn(performance, "now").mockImplementation(() => nowValue++);

      const fn = jest.fn();
      const wrapped = perfModule.stopwatch("resched", fn);

      wrapped();
      expect(flushCallbacks).toHaveLength(1);

      // During flush, the mark mock triggers another write
      markSpy.mockImplementationOnce(() => {
        wrapped();
      });

      flushCallbacks[0]({} as IdleDeadline);

      expect(flushCallbacks.length).toBeGreaterThan(1);
    });
  });

  describe("setTimeout fallback", () => {
    let originalRIC: typeof globalThis.requestIdleCallback;

    beforeEach(() => {
      originalRIC = globalThis.requestIdleCallback;
    });

    afterEach(() => {
      globalThis.requestIdleCallback = originalRIC;
    });

    it("uses setTimeout when requestIdleCallback is unavailable", async () => {
      jest.restoreAllMocks();

      delete (globalThis as any).requestIdleCallback;

      const setTimeoutSpy = jest.spyOn(globalThis, "setTimeout");
      jest.spyOn(performance, "mark").mockImplementation();
      jest.spyOn(performance, "measure").mockImplementation();

      let freshModule: typeof import("./performance");
      await jest.isolateModulesAsync(async () => {
        freshModule = await import("./performance");
      });

      freshModule.enableInstrumentation();

      let nowValue = 0;
      jest.spyOn(performance, "now").mockImplementation(() => nowValue++);

      const fn = jest.fn();
      const wrapped = freshModule.stopwatch("fallback", fn);
      wrapped();

      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 0);
    });
  });

  describe("useTimeoutForFlush", () => {
    it("forces flush scheduling to use setTimeout even when requestIdleCallback is available", () => {
      perfModule.enableInstrumentation();
      perfModule.useTimeoutForFlush();

      const setTimeoutSpy = jest.spyOn(globalThis, "setTimeout");

      let nowValue = 0;
      jest.spyOn(performance, "now").mockImplementation(() => nowValue++);

      const fn = jest.fn();
      const wrapped = perfModule.stopwatch("timeout-mode", fn);
      wrapped();

      expect(requestIdleCallbackSpy).toHaveBeenCalledTimes(0);
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 0);
    });

    it("is a one-way latch — cannot revert to idle callbacks", () => {
      perfModule.enableInstrumentation();
      perfModule.useTimeoutForFlush();

      const flushCallbacks: any[] = [];
      requestIdleCallbackSpy.mockImplementation((cb: IdleRequestCallback) => {
        flushCallbacks.push(cb);
        return 0;
      });
      const setTimeoutSpy = jest.spyOn(globalThis, "setTimeout").mockImplementation((cb) => {
        if (typeof cb === "function") {
          cb();
        }
        return 0 as any;
      });

      let nowValue = 0;
      jest.spyOn(performance, "now").mockImplementation(() => nowValue++);

      const fn = jest.fn();
      const wrapped = perfModule.stopwatch("latch", fn);
      wrapped();
      wrapped();

      expect(flushCallbacks).toHaveLength(0);
      expect(setTimeoutSpy).toHaveBeenCalled();
    });
  });
});
