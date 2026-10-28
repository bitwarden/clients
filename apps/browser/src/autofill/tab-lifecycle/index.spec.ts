import { map } from "rxjs";
import { TestScheduler } from "rxjs/testing";

import { TabState } from "./enums";
import { tabLifecycle } from "./rx";
import type { TabLifecycleEvent } from "./types";
import { isMonitoring } from "./utils";

const activate = (focused: boolean): TabLifecycleEvent => ({ kind: "activate", focused });
const deactivate: TabLifecycleEvent = { kind: "deactivate" };

// These read the machine the way the lifecycle service will: every edge it emits, interpreted
// through `isMonitoring`. That collapses an edge to the one fact the service acts on, so what they
// assert is a design invariant over a whole sequence rather than the shape of any single edge.
describe("tab lifecycle integration tests", () => {
  let scheduler: TestScheduler;
  beforeEach(() => {
    scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
  });

  it("a rapid unfocused activate→deactivate inside SETTLE_MS starts no monitoring", () => {
    scheduler.run(({ cold, expectObservable }) => {
      const events = cold("a 99ms d", { a: activate(false), d: deactivate });
      const out = events.pipe(
        tabLifecycle(TabState.Cold),
        map((e) => isMonitoring(e)),
      );
      // cold → warm-up → cold: neither destination monitors
      expectObservable(out).toBe("f 99ms g", { f: false, g: false });
    });
  });
  it("an A→B→A return within COOL_DOWN_MS never leaves monitoring", () => {
    scheduler.run(({ cold, expectObservable }) => {
      // hot@500, left@1000 (cool-down), back@5000 (well within 15s grace)
      const events = cold(`a 999ms d 3999ms r`, {
        a: activate(true),
        d: deactivate,
        r: activate(true),
      });
      const out = events.pipe(
        tabLifecycle(TabState.Cold),
        map((e) => isMonitoring(e)),
      );
      // warm-up(false) @0, hot(true) @500, cool-down(true) @1000, hot(true) @5000 — and crucially
      // NO false at 16000: the return cancelled the cool-down teardown.
      expectObservable(out).toBe("f 499ms t 499ms u 3999ms v", {
        f: false,
        t: true,
        u: true,
        v: true,
      });
    });
  });
});
