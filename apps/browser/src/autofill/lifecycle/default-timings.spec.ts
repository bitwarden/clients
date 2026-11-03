import { Observable } from "rxjs";

import { defaultTimings } from "./default-timings";

describe("defaultTimings", () => {
  /** Subscribes to a duration and reports what it emitted and whether it completed. */
  function observe(duration$: Observable<number>) {
    const values: number[] = [];
    let completed = false;
    duration$.subscribe({ next: (ms) => values.push(ms), complete: () => (completed = true) });
    return { values, completed };
  }

  it("settles after half a second", () => {
    expect(observe(defaultTimings.settleMs$).values).toEqual([500]);
  });

  it("cools down after fifteen seconds", () => {
    expect(observe(defaultTimings.coolDownMs$).values).toEqual([15_000]);
  });

  it("re-attempts a slow-rendering fill after a second and a half", () => {
    expect(observe(defaultTimings.slowRenderMs$).values).toEqual([1500]);
  });

  it("keeps a transition actionable for two minutes", () => {
    expect(observe(defaultTimings.transitionMaxAgeMs$).values).toEqual([120_000]);
  });

  it.each(["settleMs$", "coolDownMs$", "slowRenderMs$", "transitionMaxAgeMs$"] as const)(
    "gives %s one value and completes, so each subscription reads the same duration",
    (name) => {
      const first = observe(defaultTimings[name]);
      const second = observe(defaultTimings[name]);

      expect(first.values).toHaveLength(1);
      expect(first.completed).toBe(true);
      expect(second.values).toEqual(first.values);
    },
  );
});
