import { PerformanceCapability, PerformanceHookMode } from "./performance";

describe("PerformanceCapability", () => {
  let fakePerformance: Performance;
  let globalScope: typeof globalThis;

  beforeEach(() => {
    // Mimics native objects: methods only work when `this` is the real object.
    fakePerformance = new (class {
      private clock = 0;

      mark(name: string) {
        this.assertReceiver();
        return { name, startTime: ++this.clock, duration: 0, detail: { id: name } };
      }

      measure(name: string) {
        this.assertReceiver();
        return { name, startTime: 1, duration: 5, detail: null };
      }

      now() {
        this.assertReceiver();
        return 42;
      }

      private assertReceiver() {
        if (!(this instanceof Object) || this.clock === undefined) {
          throw new TypeError("Illegal invocation");
        }
      }
    })() as unknown as Performance;
    globalScope = { performance: fakePerformance } as unknown as typeof globalThis;
  });

  const create = (mode: PerformanceHookMode) => new PerformanceCapability(globalScope, mode);

  it("does not hook in manual mode until asked", () => {
    const sut = create(PerformanceHookMode.Manual);

    expect(sut.isHooked()).toBe(false);
    expect(globalScope.performance).toBe(fakePerformance);

    sut.hookPerformance();

    expect(sut.isHooked()).toBe(true);
    expect(globalScope.performance).not.toBe(fakePerformance);
  });

  it("hooks on construction in auto mode", () => {
    const sut = create(PerformanceHookMode.Auto);

    expect(sut.isHooked()).toBe(true);
  });

  it("captures marks and measures and returns the original entries", () => {
    const sut = create(PerformanceHookMode.Auto);

    const mark = globalScope.performance.mark("a");
    globalScope.performance.measure("b");

    expect(mark.name).toBe("a");
    expect(sut.readEvents()).toEqual([
      { type: "mark", name: "a", startTime: 1, duration: 0, detail: { id: "a" } },
      { type: "measure", name: "b", startTime: 1, duration: 5, detail: null },
    ]);
  });

  it("passes other methods through", () => {
    const sut = create(PerformanceHookMode.Auto);

    expect(globalScope.performance.now()).toBe(42);
    expect(sut.readEvents()).toEqual([]);
  });

  it("hooks only once", () => {
    const sut = create(PerformanceHookMode.Auto);
    const proxy = globalScope.performance;

    sut.hookPerformance();

    expect(globalScope.performance).toBe(proxy);

    sut.unhookPerformance();

    expect(globalScope.performance).toBe(fakePerformance);
  });

  it("stops capturing after unhook but keeps events", () => {
    const sut = create(PerformanceHookMode.Auto);
    globalScope.performance.mark("a");

    sut.unhookPerformance();
    globalScope.performance.mark("b");

    expect(sut.isHooked()).toBe(false);
    expect(sut.readEvents().map((e) => e.name)).toEqual(["a"]);
  });

  it("clears events", () => {
    const sut = create(PerformanceHookMode.Auto);
    globalScope.performance.mark("a");

    sut.clearEvents();

    expect(sut.readEvents()).toEqual([]);
  });

  it("returns a copy of the events", () => {
    const sut = create(PerformanceHookMode.Auto);
    globalScope.performance.mark("a");

    sut.readEvents().pop();

    expect(sut.readEvents()).toHaveLength(1);
  });

  it("drops the oldest events beyond the cap", () => {
    const sut = create(PerformanceHookMode.Auto);

    for (let i = 0; i < 10_001; i++) {
      globalScope.performance.mark(`m${i}`);
    }

    const events = sut.readEvents();
    expect(events).toHaveLength(10_000);
    expect(events[0].name).toBe("m1");
  });
});
