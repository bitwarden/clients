let perfModule: typeof import("./performance");

// jsdom lacks User Timing — define stubs so spyOn can attach.
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
});

describe("Performance instrumentation", () => {
  describe("when enabled", () => {
    let markSpy: jest.SpyInstance;
    let measureSpy: jest.SpyInstance;
    let setTimeoutSpy: jest.SpyInstance;

    beforeEach(async () => {
      markSpy = jest.spyOn(performance, "mark").mockImplementation();
      measureSpy = jest.spyOn(performance, "measure").mockImplementation();
      jest.spyOn(console, "warn").mockImplementation();

      // Default: execute the flush callback synchronously
      setTimeoutSpy = jest.spyOn(globalThis, "setTimeout").mockImplementation((cb: any) => {
        if (typeof cb === "function") {
          cb();
        }
        return 0 as any;
      });

      process.env.BW_INCLUDE_CONTENT_SCRIPT_MEASUREMENTS = "true";

      await jest.isolateModulesAsync(async () => {
        perfModule = await import("./performance");
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
      delete process.env.BW_INCLUDE_CONTENT_SCRIPT_MEASUREMENTS;
    });

    describe("stopwatch", () => {
      it("always returns a wrapper", () => {
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

      it("preserves this context", () => {
        const obj = {
          value: 99,
          getValue: perfModule.stopwatch("getValue", function (this: { value: number }) {
            return this.value;
          }),
        };

        expect(obj.getValue()).toBe(99);
      });

      it("records timestamps to the buffer and flushes to performance API", () => {
        let nowValue = 100;
        jest.spyOn(performance, "now").mockImplementation(() => {
          const v = nowValue;
          nowValue += 5;
          return v;
        });

        const fn = jest.fn();
        const wrapped = perfModule.stopwatch("myFunc", fn);
        wrapped();

        expect(markSpy).toHaveBeenCalledWith("myFunc:start:autofill:bw", { startTime: 100 });
        expect(markSpy).toHaveBeenCalledWith("myFunc:end:autofill:bw", { startTime: 105 });
        expect(measureSpy).toHaveBeenCalledWith(
          "myFunc:autofill:bw",
          "myFunc:start:autofill:bw",
          "myFunc:end:autofill:bw",
        );
      });

      it("does not record a timing entry when the wrapped function throws", () => {
        jest.spyOn(performance, "now").mockReturnValue(0);

        const error = new Error("boom");
        const fn = jest.fn().mockImplementation(() => {
          throw error;
        });
        const wrapped = perfModule.stopwatch("throws", fn);

        expect(() => wrapped()).toThrow(error);

        expect(measureSpy).not.toHaveBeenCalled();
        const markCalls = markSpy.mock.calls.map((c: unknown[]) => c[0]);
        expect(markCalls).not.toContain("throws:start:autofill:bw");
        expect(markCalls).not.toContain("throws:end:autofill:bw");
      });
    });

    describe("measure", () => {
      it("records timestamps and returns result", () => {
        let nowValue = 200;
        jest.spyOn(performance, "now").mockImplementation(() => {
          const v = nowValue;
          nowValue += 10;
          return v;
        });

        const result = perfModule.measure("block", () => 42);

        expect(result).toBe(42);
        expect(markSpy).toHaveBeenCalledWith("block:start:autofill:bw", { startTime: 200 });
        expect(markSpy).toHaveBeenCalledWith("block:end:autofill:bw", { startTime: 210 });
        expect(measureSpy).toHaveBeenCalledWith(
          "block:autofill:bw",
          "block:start:autofill:bw",
          "block:end:autofill:bw",
        );
      });

      it("does not record a timing entry when the function throws", () => {
        jest.spyOn(performance, "now").mockReturnValue(0);

        const error = new Error("boom");
        expect(() =>
          perfModule.measure("throws", () => {
            throw error;
          }),
        ).toThrow(error);

        expect(measureSpy).not.toHaveBeenCalled();
        const markCalls = markSpy.mock.calls.map((c: unknown[]) => c[0]);
        expect(markCalls).not.toContain("throws:start:autofill:bw");
        expect(markCalls).not.toContain("throws:end:autofill:bw");
      });
    });

    describe("createMeter", () => {
      it("records a meter mark at performance.now() when called with no fields", () => {
        jest.spyOn(performance, "now").mockReturnValue(123);

        const tick = perfModule.createMeter("tick");
        tick();

        expect(markSpy).toHaveBeenCalledWith("tick:meter:autofill:bw", { startTime: 123 });
      });

      it("records the registered keys as a detail object", () => {
        jest.spyOn(performance, "now").mockReturnValue(456);

        const recordMutation = perfModule.createMeter("mutation", "count", "depth");
        recordMutation(5, 12);

        expect(markSpy).toHaveBeenCalledWith("mutation:meter:autofill:bw", {
          startTime: 456,
          detail: { count: 5, depth: 12 },
        });
      });

      it("accepts string, number, and boolean values", () => {
        jest.spyOn(performance, "now").mockReturnValue(0);

        const recordEvent = perfModule.createMeter("event", "label", "ok", "count");
        recordEvent("submit", true, 7);

        expect(markSpy).toHaveBeenCalledWith("event:meter:autofill:bw", {
          startTime: 0,
          detail: { label: "submit", ok: true, count: 7 },
        });
      });

      it("accepts a configuration object for buffer sizing", () => {
        jest.spyOn(performance, "now").mockReturnValue(0);

        const recordSpan = perfModule.createMeter({ name: "span", bits: 4 }, "value");
        recordSpan(1);

        expect(markSpy).toHaveBeenCalledWith("span:meter:autofill:bw", {
          startTime: 0,
          detail: { value: 1 },
        });
      });

      it("wraps and overwrites oldest entries when its buffer is full", () => {
        // Don't auto-flush so entries accumulate
        setTimeoutSpy.mockImplementation(() => 0);

        jest.spyOn(performance, "now").mockReturnValue(0);

        const record = perfModule.createMeter({ name: "wrap", bits: 3 }, "v");

        // 8-slot buffer (1 << 3 = 8). Write 10 entries — 2 oldest are overwritten.
        for (let i = 0; i < 10; i++) {
          record(i);
        }

        const flushCallback = setTimeoutSpy.mock.calls[0][0];
        flushCallback();

        // Only 8 surviving entries should be flushed
        const meterMarks = markSpy.mock.calls.filter(
          (c: unknown[]) => c[0] === "wrap:meter:autofill:bw",
        );
        expect(meterMarks).toHaveLength(8);

        // The earliest surviving entries are v=2..9
        const recordedValues = meterMarks.map(
          (c: any[]) => (c[1] as { detail: { v: number } }).detail.v,
        );
        expect(recordedValues).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
      });

      it("returns distinct functions for distinct meters", () => {
        const a = perfModule.createMeter("a");
        const b = perfModule.createMeter("b");
        expect(a).not.toBe(b);
      });

      it("flushes all registered meters in a single setTimeout cycle", () => {
        let flushCallback: any;
        setTimeoutSpy.mockImplementation((cb: any) => {
          flushCallback = cb;
          return 0;
        });

        jest.spyOn(performance, "now").mockReturnValue(0);

        const a = perfModule.createMeter("a");
        const b = perfModule.createMeter("b");

        a();
        b();
        a();

        // Only one setTimeout should have been scheduled
        expect(setTimeoutSpy).toHaveBeenCalledTimes(1);

        flushCallback();

        const meterMarkCalls = markSpy.mock.calls.filter((c: unknown[]) =>
          (c[0] as string).endsWith(":meter:autofill:bw"),
        );
        expect(meterMarkCalls).toHaveLength(3);
      });
    });

    describe("poison", () => {
      it("creates a poison mark for the given name", () => {
        perfModule.poison("myFunc");
        expect(markSpy).toHaveBeenCalledWith("myFunc:poison:autofill:bw");
      });
    });

    describe("watch buffer", () => {
      it("handles multiple entries in sequence", () => {
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

        // 3 entries × 2 marks each = 6
        expect(markSpy).toHaveBeenCalledTimes(6);
        expect(measureSpy).toHaveBeenCalledTimes(3);
      });

      it("overwrites oldest entries when buffer is full", () => {
        // Prevent auto-flush so entries accumulate
        setTimeoutSpy.mockImplementation(() => 0);

        let nowValue = 0;
        jest.spyOn(performance, "now").mockImplementation(() => nowValue++);

        const fn = jest.fn();
        const wrapped = perfModule.stopwatch("fill", fn);

        // Watch buffer is 1024 slots (10 bits). Write 1026 entries — 2 oldest are overwritten.
        for (let i = 0; i < 1026; i++) {
          wrapped();
        }

        const flushCallback = setTimeoutSpy.mock.calls[0][0];
        flushCallback();

        // Only 1024 surviving entries should be flushed
        expect(measureSpy).toHaveBeenCalledTimes(1024);
      });
    });

    describe("flush coalescing", () => {
      it("schedules one setTimeout and flushes all entries", () => {
        const flushCallbacks: Array<() => void> = [];
        setTimeoutSpy.mockImplementation((cb: any) => {
          flushCallbacks.push(cb);
          return 0;
        });

        let nowValue = 0;
        jest.spyOn(performance, "now").mockImplementation(() => nowValue++);

        const fn = jest.fn();
        const wrapped = perfModule.stopwatch("coalesce", fn);

        wrapped();
        wrapped();
        wrapped();

        expect(flushCallbacks).toHaveLength(1);

        flushCallbacks[0]();
        expect(measureSpy).toHaveBeenCalledTimes(3);
      });
    });

    describe("flush rescheduling", () => {
      it("reschedules when new entries are written during flush", () => {
        const flushCallbacks: Array<() => void> = [];
        setTimeoutSpy.mockImplementation((cb: any) => {
          flushCallbacks.push(cb);
          return 0;
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

        flushCallbacks[0]();

        expect(flushCallbacks.length).toBeGreaterThan(1);
      });
    });
  });

  describe("when disabled", () => {
    let markSpy: jest.SpyInstance;
    let measureSpy: jest.SpyInstance;
    let setTimeoutSpy: jest.SpyInstance;

    beforeEach(async () => {
      markSpy = jest.spyOn(performance, "mark").mockImplementation();
      measureSpy = jest.spyOn(performance, "measure").mockImplementation();
      setTimeoutSpy = jest.spyOn(globalThis, "setTimeout").mockImplementation((cb: any) => {
        if (typeof cb === "function") {
          cb();
        }
        return 0 as any;
      });

      delete process.env.BW_INCLUDE_CONTENT_SCRIPT_MEASUREMENTS;

      await jest.isolateModulesAsync(async () => {
        perfModule = await import("./performance");
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("stopwatch delegates to the wrapped function without recording", () => {
      const fn = jest.fn().mockReturnValue(42);
      const wrapped = perfModule.stopwatch("test", fn);

      expect(wrapped()).toBe(42);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(markSpy).not.toHaveBeenCalled();
      expect(measureSpy).not.toHaveBeenCalled();
      expect(setTimeoutSpy).not.toHaveBeenCalled();
    });

    it("measure calls fn directly without recording", () => {
      const fn = jest.fn().mockReturnValue("hello");
      const result = perfModule.measure("test", fn);

      expect(result).toBe("hello");
      expect(fn).toHaveBeenCalledTimes(1);
      expect(markSpy).not.toHaveBeenCalled();
      expect(measureSpy).not.toHaveBeenCalled();
      expect(setTimeoutSpy).not.toHaveBeenCalled();
    });

    it("createMeter returns a no-op that does not record", () => {
      const recordSomething = perfModule.createMeter("event", "count");
      recordSomething(5);

      expect(markSpy).not.toHaveBeenCalled();
      expect(setTimeoutSpy).not.toHaveBeenCalled();
    });

    it("createMeter returns the same shared no-op across calls", () => {
      const a = perfModule.createMeter("a");
      const b = perfModule.createMeter("b", "x");
      expect(a).toBe(b);
    });

    it("poison does not record a mark", () => {
      perfModule.poison("myFunc");
      expect(markSpy).not.toHaveBeenCalled();
    });
  });
});
