import { TestScheduler } from "rxjs/testing";

import { TabEdgeCause, TabState } from "./enums";
import { SETTLE_MS, tabLifecycle } from "./rx";
import type { TabEdge, TabLifecycleEvent } from "./types";

// Marble strings are positional: one character is one frame, so a value symbol cannot be longer
// than a single character and the diagrams below use a fixed legend.
//
//   w  warm-up      h  hot       p  cool-down     f/g/t/u/v  booleans
//   m  warm         c  cold      z  frozen
//
/** Terse edge builder for the marble value maps. */
function edge(from: TabState, to: TabState, cause: TabEdgeCause, focused: boolean): TabEdge {
  return { from, to, cause, focused };
}

const activate = (focused: boolean): TabLifecycleEvent => ({ kind: "activate", focused });
const deactivate: TabLifecycleEvent = { kind: "deactivate" };
const focus: TabLifecycleEvent = { kind: "focus" };
const blur: TabLifecycleEvent = { kind: "blur" };
const command: TabLifecycleEvent = { kind: "command" };
const login: TabLifecycleEvent = { kind: "login" };
const logout: TabLifecycleEvent = { kind: "logout" };

describe("tabLifecycle", () => {
  let scheduler: TestScheduler;
  beforeEach(() => {
    scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
  });

  it("login enters Thawed at cold", () => {
    scheduler.run(({ cold, expectObservable }) => {
      const events = cold("a", { a: login });
      expectObservable(events.pipe(tabLifecycle(TabState.Frozen))).toBe("c", {
        c: edge(TabState.Frozen, TabState.Cold, TabEdgeCause.Login, false),
      });
    });
  });

  it("seeds frozen when no seed is supplied", () => {
    scheduler.run(({ cold, expectObservable }) => {
      // A machine built before any auth fact has arrived must presume logged out. Seeded `Cold`
      // instead, this `login` would be a no-op and emit no edge at all.
      const events = cold("a", { a: login });
      expectObservable(events.pipe(tabLifecycle())).toBe("c", {
        c: edge(TabState.Frozen, TabState.Cold, TabEdgeCause.Login, false),
      });
    });
  });

  it("a focused activation commits to hot after SETTLE_MS", () => {
    scheduler.run(({ cold, expectObservable }) => {
      const events = cold("a", { a: activate(true) });
      expectObservable(events.pipe(tabLifecycle(TabState.Cold))).toBe(`w ${SETTLE_MS - 1}ms h`, {
        w: edge(TabState.Cold, TabState.WarmUp, TabEdgeCause.Activate, true),
        h: edge(TabState.WarmUp, TabState.Hot, TabEdgeCause.Settle, true),
      });
    });
  });

  it("an unfocused activation commits to warm after SETTLE_MS", () => {
    scheduler.run(({ cold, expectObservable }) => {
      const events = cold("a", { a: activate(false) });
      expectObservable(events.pipe(tabLifecycle(TabState.Cold))).toBe(`w ${SETTLE_MS - 1}ms m`, {
        w: edge(TabState.Cold, TabState.WarmUp, TabEdgeCause.Activate, false),
        m: edge(TabState.WarmUp, TabState.Warm, TabEdgeCause.Settle, false),
      });
    });
  });

  it("a ctrl-tab flick-through (deactivate inside SETTLE_MS) never commits", () => {
    scheduler.run(({ cold, expectObservable }) => {
      // active@0, gone@100 — before the settle fires
      const events = cold("a 99ms d", { a: activate(true), d: deactivate });
      expectObservable(events.pipe(tabLifecycle(TabState.Cold))).toBe("w 99ms c", {
        w: edge(TabState.Cold, TabState.WarmUp, TabEdgeCause.Activate, true),
        c: edge(TabState.WarmUp, TabState.Cold, TabEdgeCause.Deactivate, true),
      });
    });
  });

  it("a blur mid-settle redirects the destination to warm (never an early hot)", () => {
    scheduler.run(({ cold, expectObservable }) => {
      // focused activation, then blur before the settle — must land warm, not hot.
      // The blur restarts the settle timer (a switchScan limitation, benign), so warm arrives
      // SETTLE_MS after the blur (@100 + 500 = 600), not after the activation.
      const events = cold("a 99ms b", { a: activate(true), b: blur });
      expectObservable(events.pipe(tabLifecycle(TabState.Cold))).toBe(`w 599ms m`, {
        w: edge(TabState.Cold, TabState.WarmUp, TabEdgeCause.Activate, true),
        m: edge(TabState.WarmUp, TabState.Warm, TabEdgeCause.Settle, false),
      });
    });
  });

  it("warm promotes to hot immediately on focus", () => {
    scheduler.run(({ cold, expectObservable }) => {
      // settle to warm @500, then focus the window @1000
      const events = cold(`a 999ms f`, { a: activate(false), f: focus });
      expectObservable(events.pipe(tabLifecycle(TabState.Cold))).toBe(`w 499ms m 499ms h`, {
        w: edge(TabState.Cold, TabState.WarmUp, TabEdgeCause.Activate, false),
        m: edge(TabState.WarmUp, TabState.Warm, TabEdgeCause.Settle, false),
        h: edge(TabState.Warm, TabState.Hot, TabEdgeCause.Focus, true),
      });
    });
  });

  it("hot demotes to warm immediately on blur", () => {
    scheduler.run(({ cold, expectObservable }) => {
      // hot @500, blur @600
      const events = cold(`a 599ms b`, { a: activate(true), b: blur });
      expectObservable(events.pipe(tabLifecycle(TabState.Cold))).toBe(`w 499ms h 99ms m`, {
        w: edge(TabState.Cold, TabState.WarmUp, TabEdgeCause.Activate, true),
        h: edge(TabState.WarmUp, TabState.Hot, TabEdgeCause.Settle, true),
        m: edge(TabState.Hot, TabState.Warm, TabEdgeCause.Blur, false),
      });
    });
  });

  it("warm goes straight to cold on deactivate — no cool-down", () => {
    scheduler.run(({ cold, expectObservable }) => {
      // warm @500, deactivate @600
      const events = cold(`a 599ms d`, { a: activate(false), d: deactivate });
      expectObservable(events.pipe(tabLifecycle(TabState.Cold))).toBe(`w 499ms m 99ms c`, {
        w: edge(TabState.Cold, TabState.WarmUp, TabEdgeCause.Activate, false),
        m: edge(TabState.WarmUp, TabState.Warm, TabEdgeCause.Settle, false),
        c: edge(TabState.Warm, TabState.Cold, TabEdgeCause.Deactivate, false),
      });
    });
  });

  it("hot deactivates into cool-down and tears down after COOL_DOWN_MS", () => {
    scheduler.run(({ cold, expectObservable }) => {
      // hot @500, deactivate @600, cool-down elapses @600 + 15000 = 15600
      const events = cold(`a 599ms d`, { a: activate(true), d: deactivate });
      // The teardown frame is written out rather than derived from COOL_DOWN_MS: an expectation
      // computed from the constant it exists to pin moves with it and pins nothing. 14999ms is
      // COOL_DOWN_MS - 1.
      expectObservable(events.pipe(tabLifecycle(TabState.Cold))).toBe(
        `w 499ms h 99ms p 14999ms c`,
        {
          w: edge(TabState.Cold, TabState.WarmUp, TabEdgeCause.Activate, true),
          h: edge(TabState.WarmUp, TabState.Hot, TabEdgeCause.Settle, true),
          p: edge(TabState.Hot, TabState.CoolDown, TabEdgeCause.Deactivate, true),
          c: edge(TabState.CoolDown, TabState.Cold, TabEdgeCause.CoolDownElapsed, true),
        },
      );
    });
  });

  it("cool-down re-commits to hot immediately on a focused return", () => {
    scheduler.run(({ cold, expectObservable }) => {
      // hot @500, deactivate @600 (cool-down), focused return @700
      const events = cold(`a 599ms d 99ms r`, {
        a: activate(true),
        d: deactivate,
        r: activate(true),
      });
      expectObservable(events.pipe(tabLifecycle(TabState.Cold))).toBe(`w 499ms h 99ms p 99ms H`, {
        w: edge(TabState.Cold, TabState.WarmUp, TabEdgeCause.Activate, true),
        h: edge(TabState.WarmUp, TabState.Hot, TabEdgeCause.Settle, true),
        p: edge(TabState.Hot, TabState.CoolDown, TabEdgeCause.Deactivate, true),
        H: edge(TabState.CoolDown, TabState.Hot, TabEdgeCause.Activate, true),
      });
    });
  });

  it("cool-down re-commits to warm on an unfocused return", () => {
    scheduler.run(({ cold, expectObservable }) => {
      // hot @500, deactivate @600 (cool-down), then the tab reactivates in a now-unfocused window @700
      const events = cold(`a 599ms d 99ms r`, {
        a: activate(true),
        d: deactivate,
        r: activate(false),
      });
      expectObservable(events.pipe(tabLifecycle(TabState.Cold))).toBe(`w 499ms h 99ms p 99ms m`, {
        w: edge(TabState.Cold, TabState.WarmUp, TabEdgeCause.Activate, true),
        h: edge(TabState.WarmUp, TabState.Hot, TabEdgeCause.Settle, true),
        p: edge(TabState.Hot, TabState.CoolDown, TabEdgeCause.Deactivate, true),
        m: edge(TabState.CoolDown, TabState.Warm, TabEdgeCause.Activate, false),
      });
    });
  });

  it("a focus mid-settle redirects an unfocused warm-up to hot", () => {
    scheduler.run(({ cold, expectObservable }) => {
      // unfocused activation heading for warm, then focus before the settle — must land hot.
      // The focus restarts the settle timer, so hot arrives SETTLE_MS after the focus (@100 + 500).
      const events = cold("a 99ms f", { a: activate(false), f: focus });
      expectObservable(events.pipe(tabLifecycle(TabState.Cold))).toBe(`w 599ms h`, {
        w: edge(TabState.Cold, TabState.WarmUp, TabEdgeCause.Activate, false),
        h: edge(TabState.WarmUp, TabState.Hot, TabEdgeCause.Settle, true),
      });
    });
  });

  it("a command early-settles a warm-up target to hot ahead of the timer", () => {
    scheduler.run(({ cold, expectObservable }) => {
      // command arrives 100ms into the 500ms warm-up
      const events = cold("a 99ms k", { a: activate(true), k: command });
      expectObservable(events.pipe(tabLifecycle(TabState.Cold))).toBe("w 99ms h", {
        w: edge(TabState.Cold, TabState.WarmUp, TabEdgeCause.Activate, true),
        h: edge(TabState.WarmUp, TabState.Hot, TabEdgeCause.Command, true),
      });
    });
  });

  it("a command on an already-hot target is a machine no-op (no edge)", () => {
    scheduler.run(({ cold, expectObservable }) => {
      // hot @500, command @600 — no further edge
      const events = cold(`a 599ms k`, { a: activate(true), k: command });
      expectObservable(events.pipe(tabLifecycle(TabState.Cold))).toBe(`w 499ms h`, {
        w: edge(TabState.Cold, TabState.WarmUp, TabEdgeCause.Activate, true),
        h: edge(TabState.WarmUp, TabState.Hot, TabEdgeCause.Settle, true),
      });
    });
  });

  // `switchScan` cancels the inner on every event, so a no-op event arriving in a timed state
  // re-arms nothing and *strands* that state — the reason `tabLifecycle` requires a deduplicated
  // source. These pin the two states that can strand, so violating the precondition costs a failing
  // test rather than a wedged tab in the field.
  describe("a redundant event in a timed state strands it (precondition violated)", () => {
    it("strands warm-up, so the tab never begins monitoring", () => {
      scheduler.run(({ cold, expectObservable }) => {
        // The activation arms the settle for @500; the redundant focus @100 is a no-op on an
        // already-focused warm-up, which cancels the settle without re-arming it. No edge follows.
        const events = cold("a 99ms f", { a: activate(true), f: focus });
        expectObservable(events.pipe(tabLifecycle(TabState.Cold))).toBe("w", {
          w: edge(TabState.Cold, TabState.WarmUp, TabEdgeCause.Activate, true),
        });
      });
    });

    it("strands cool-down, so monitoring never stands down", () => {
      scheduler.run(({ cold, expectObservable }) => {
        // hot @500, deactivate @600 arms the teardown for @15600, command @700 is a no-op — the
        // command channel bypasses the upstream dedupe, which is why it is the realistic offender.
        const events = cold("a 599ms d 99ms k", {
          a: activate(true),
          d: deactivate,
          k: command,
        });
        expectObservable(events.pipe(tabLifecycle(TabState.Cold))).toBe("w 499ms h 99ms p", {
          w: edge(TabState.Cold, TabState.WarmUp, TabEdgeCause.Activate, true),
          h: edge(TabState.WarmUp, TabState.Hot, TabEdgeCause.Settle, true),
          p: edge(TabState.Hot, TabState.CoolDown, TabEdgeCause.Deactivate, true),
        });
      });
    });
  });

  it("logout is dominant: it drops to frozen from any state, cancelling timers", () => {
    scheduler.run(({ cold, expectObservable }) => {
      // hot @500, deactivate @600 (cool-down), logout @700 mid-grace
      const events = cold(`a 599ms d 99ms o`, {
        a: activate(true),
        d: deactivate,
        o: logout,
      });
      expectObservable(events.pipe(tabLifecycle(TabState.Cold))).toBe(`w 499ms h 99ms p 99ms z`, {
        w: edge(TabState.Cold, TabState.WarmUp, TabEdgeCause.Activate, true),
        h: edge(TabState.WarmUp, TabState.Hot, TabEdgeCause.Settle, true),
        p: edge(TabState.Hot, TabState.CoolDown, TabEdgeCause.Deactivate, true),
        z: edge(TabState.CoolDown, TabState.Frozen, TabEdgeCause.Logout, true),
      });
    });
  });
});
