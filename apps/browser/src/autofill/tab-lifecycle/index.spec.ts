import { BehaviorSubject, firstValueFrom, map, merge, NEVER, Subject } from "rxjs";
import { TestScheduler } from "rxjs/testing";

import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { FakeStateProvider, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";

import { accountEvents$ } from "../rx";

import { TabState } from "./enums";
import { SETTLE_MS, tabLifecycle } from "./rx";
import {
  BufferedTransitionReport,
  bufferEnabled,
  persistentTransitionBuffer$,
  registerTransition,
  transitionBuffer$,
} from "./transition-buffer";
import { BUFFERED_TRANSITIONS } from "./transition-buffer/persistent";
import type { TabLifecycleEvent } from "./types";
import { isMonitoring } from "./utils";

const activate = (focused: boolean): TabLifecycleEvent => ({ kind: "activate", focused });
const deactivate: TabLifecycleEvent = { kind: "deactivate" };
const focus: TabLifecycleEvent = { kind: "focus" };
const command: TabLifecycleEvent = { kind: "command" };
const login: TabLifecycleEvent = { kind: "login" };
const logout: TabLifecycleEvent = { kind: "logout" };

describe("tab lifecycle integration tests", () => {
  let scheduler: TestScheduler;
  beforeEach(() => {
    scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
  });

  describe("monitoring", () => {
    // These read the machine the way the lifecycle service will: every edge it emits, interpreted
    // through `isMonitoring`. That collapses an edge to the one fact the service acts on, so what they
    // assert is a design invariant over a whole sequence rather than the shape of any single edge.
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

  describe("buffering", () => {
    const TAB = 1;
    const document: BufferedTransitionReport = {
      userId: "user-1" as UserId,
      tabId: TAB,
      frameId: 0,
      documentId: "doc",
      stampedAt: 0,
      expiresAt: Number.MAX_SAFE_INTEGER,
    };

    const otherDocument: BufferedTransitionReport = {
      ...document,
      tabId: 2,
      documentId: "other-doc",
    };

    /** A marble string placing each symbol at its absolute frame. */
    function at(...marks: [ms: number, symbol: string][]): string {
      let next = 0;
      return marks
        .map(([ms, symbol]) => {
          const gap = ms - next;
          next = ms + 1;
          return gap > 0 ? `${gap}ms ${symbol}` : symbol;
        })
        .join(" ");
    }

    const events = {
      a: activate(true),
      u: activate(false),
      d: deactivate,
      f: focus,
      c: command,
      i: login,
      l: logout,
    };

    it("a report buffered through an aborted activation resolves on the next real one", () => {
      scheduler.run(({ hot, expectObservable }) => {
        const tabLifecycleChanged$ = hot(at([1, "u"], [101, "d"], [301, "a"]), events).pipe(
          tabLifecycle(TabState.Cold),
          map((change) => [TAB, change] as const),
        );

        const resolved$ = transitionBuffer$({
          report$: hot(at([50, "r"]), { r: document }),
          tabLifecycleChanged$,
          frameLost$: NEVER,
          tabRemoved$: NEVER,
          enabled$: new BehaviorSubject(true),
          now: () => scheduler.now(),
        });

        expectObservable(resolved$).toBe(at([301 + SETTLE_MS, "r"]), { r: document });
      });
    });

    it("a report buffered in cool-down resolves when the user returns inside the grace period", () => {
      scheduler.run(({ hot, expectObservable }) => {
        const tabLifecycleChanged$ = hot(at([1, "a"], [1001, "d"], [5000, "a"]), events).pipe(
          tabLifecycle(TabState.Cold),
          map((change) => [TAB, change] as const),
        );

        const resolved$ = transitionBuffer$({
          report$: hot(at([1999, "r"]), { r: document }),
          tabLifecycleChanged$,
          frameLost$: NEVER,
          tabRemoved$: NEVER,
          enabled$: new BehaviorSubject(true),
          now: () => scheduler.now(),
        });

        expectObservable(resolved$).toBe(at([5000, "r"]), { r: document });
      });
    });

    it("a report on a hot tab resolves at once and only once", () => {
      // the tab leaves and returns afterwards; the resolved report does not fill again
      scheduler.run(({ hot, expectObservable }) => {
        const tabLifecycleChanged$ = hot(at([1, "a"], [2000, "d"], [3000, "a"]), events).pipe(
          tabLifecycle(TabState.Cold),
          map((change) => [TAB, change] as const),
        );

        const resolved$ = transitionBuffer$({
          report$: hot(at([1000, "r"]), { r: document }),
          tabLifecycleChanged$,
          frameLost$: NEVER,
          tabRemoved$: NEVER,
          enabled$: new BehaviorSubject(true),
          now: () => scheduler.now(),
        });

        expectObservable(resolved$).toBe(at([1000, "r"]), { r: document });
      });
    });

    it("a command-caused arrival at hot drops the report buffered for the settle", () => {
      scheduler.run(({ hot, expectObservable }) => {
        const tabLifecycleChanged$ = hot(at([1, "u"], [100, "c"]), events).pipe(
          tabLifecycle(TabState.Cold),
          map((change) => [TAB, change] as const),
        );

        const resolved$ = transitionBuffer$({
          report$: hot(at([50, "r"]), { r: document }),
          tabLifecycleChanged$,
          frameLost$: NEVER,
          tabRemoved$: NEVER,
          enabled$: new BehaviorSubject(true),
          now: () => scheduler.now(),
        });

        expectObservable(resolved$).toBe("-", { r: document });
      });
    });

    it("a focus redirecting the settle resolves the report at the settle it caused", () => {
      scheduler.run(({ hot, expectObservable }) => {
        const tabLifecycleChanged$ = hot(at([1, "u"], [100, "f"]), events).pipe(
          tabLifecycle(TabState.Cold),
          map((change) => [TAB, change] as const),
        );

        const resolved$ = transitionBuffer$({
          report$: hot(at([50, "r"]), { r: document }),
          tabLifecycleChanged$,
          frameLost$: NEVER,
          tabRemoved$: NEVER,
          enabled$: new BehaviorSubject(true),
          now: () => scheduler.now(),
        });

        expectObservable(resolved$).toBe(at([100 + SETTLE_MS, "r"]), { r: document });
      });
    });

    it("an activation that settles unfocused drops the report for good", () => {
      // the report is dropped at warm; the focus that later makes the tab hot cannot revive it
      scheduler.run(({ hot, expectObservable }) => {
        const tabLifecycleChanged$ = hot(at([1, "u"], [600, "f"]), events).pipe(
          tabLifecycle(TabState.Cold),
          map((change) => [TAB, change] as const),
        );

        const resolved$ = transitionBuffer$({
          report$: hot(at([50, "r"]), { r: document }),
          tabLifecycleChanged$,
          frameLost$: NEVER,
          tabRemoved$: NEVER,
          enabled$: new BehaviorSubject(true),
          now: () => scheduler.now(),
        });

        expectObservable(resolved$).toBe("-", { r: document });
      });
    });

    it("logout while a report is buffered drops it, and signing back in does not revive it", () => {
      scheduler.run(({ hot, expectObservable }) => {
        const tabLifecycleChanged$ = hot(
          at([1, "a"], [100, "l"], [200, "i"], [300, "a"]),
          events,
        ).pipe(
          tabLifecycle(TabState.Cold),
          map((change) => [TAB, change] as const),
        );

        const resolved$ = transitionBuffer$({
          report$: hot(at([50, "r"]), { r: document }),
          tabLifecycleChanged$,
          frameLost$: NEVER,
          tabRemoved$: NEVER,
          enabled$: new BehaviorSubject(true),
          now: () => scheduler.now(),
        });

        expectObservable(resolved$).toBe("-", { r: document });
      });
    });

    it("each tab's report resolves on its own tab's lifecycle", () => {
      scheduler.run(({ hot, expectObservable }) => {
        // tab 1 is hot when tab 2's report arrives, and tab 2 is still cold
        const tabLifecycleChanged$ = merge(
          hot(at([1, "a"], [1000, "d"]), events).pipe(
            tabLifecycle(TabState.Cold),
            map((change) => [1, change] as const),
          ),
          hot(at([1000, "a"]), events).pipe(
            tabLifecycle(TabState.Cold),
            map((change) => [2, change] as const),
          ),
        );

        const resolved$ = transitionBuffer$({
          report$: hot(at([50, "a"], [600, "b"]), { a: document, b: otherDocument }),
          tabLifecycleChanged$,
          frameLost$: NEVER,
          tabRemoved$: NEVER,
          enabled$: new BehaviorSubject(true),
          now: () => scheduler.now(),
        });

        expectObservable(resolved$).toBe(at([1 + SETTLE_MS, "a"], [1000 + SETTLE_MS, "b"]), {
          a: document,
          b: otherDocument,
        });
      });
    });

    it("a removed tab's report is dropped while another tab's resolves", () => {
      scheduler.run(({ hot, expectObservable }) => {
        // both tabs are settling toward hot; tab 1 closes first, though its machine keeps running
        const tabLifecycleChanged$ = merge(
          hot(at([1, "a"]), events).pipe(
            tabLifecycle(TabState.Cold),
            map((change) => [1, change] as const),
          ),
          hot(at([1, "a"]), events).pipe(
            tabLifecycle(TabState.Cold),
            map((change) => [2, change] as const),
          ),
        );

        const resolved$ = transitionBuffer$({
          report$: hot(at([50, "a"], [60, "b"]), { a: document, b: otherDocument }),
          tabLifecycleChanged$,
          frameLost$: NEVER,
          tabRemoved$: hot(at([200, "x"]), { x: 1 }),
          enabled$: new BehaviorSubject(true),
          now: () => scheduler.now(),
        });

        expectObservable(resolved$).toBe(at([1 + SETTLE_MS, "b"]), { b: otherDocument });
      });
    });
  });

  describe("persistence", () => {
    const TAB = 1;
    const MAX_AGE_MS = 60_000;
    const userId = "user-1" as UserId;
    const { Locked, LoggedOut, Unlocked } = AuthenticationStatus;
    let stateProvider: FakeStateProvider;
    let activeAccount$: BehaviorSubject<Account | null>;
    let authStatuses$: BehaviorSubject<Record<UserId, AuthenticationStatus>>;

    beforeEach(() => {
      jest.useFakeTimers();
      stateProvider = new FakeStateProvider(mockAccountServiceWith(userId));
      activeAccount$ = new BehaviorSubject<Account | null>({ id: userId } as Account);
      authStatuses$ = new BehaviorSubject<Record<UserId, AuthenticationStatus>>({
        [userId]: Unlocked,
      });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    const now = () => Date.now();
    const advance = (ms: number) => jest.advanceTimersByTimeAsync(ms);
    const stored = async () =>
      Object.values(
        (await firstValueFrom(stateProvider.getGlobal(BUFFERED_TRANSITIONS).state$)) ?? {},
      );
    const reported = (documentId: string, frameId = 0) =>
      registerTransition(
        { userId, tabId: TAB, frameId, documentId },
        { now: now(), maxAgeMs: MAX_AGE_MS },
      )!;

    /**
     * The buffer as the lifecycle service wires it, once per service-worker lifetime: the machine's
     * changes, the registered reports and the session's `enabled$` in; the resolved reports out.
     */
    function wire() {
      const events$ = new Subject<TabLifecycleEvent>();
      const registered$ = new Subject<BufferedTransitionReport>();

      const resolved: BufferedTransitionReport[] = [];
      const subscription = persistentTransitionBuffer$({
        stateProvider,
        report$: registered$,
        tabLifecycleChanged$: events$.pipe(
          tabLifecycle(TabState.Cold),
          map((change) => [TAB, change] as const),
        ),
        frameLost$: NEVER,
        tabRemoved$: NEVER,
        enabled$: accountEvents$(activeAccount$, authStatuses$).pipe(bufferEnabled()),
        now,
      }).subscribe((report) => resolved.push(report));

      return { events$, registered$, resolved, unload: () => subscription.unsubscribe() };
    }

    it("a report waiting at unload resolves after the restart, and only once", async () => {
      const first = wire();
      const registered = reported("doc");
      first.registered$.next(registered);
      await advance(0);
      expect(await stored()).toEqual([registered]);
      first.unload();

      // the rebuilt machine has no edges yet, so the restored report waits
      const second = wire();
      await advance(0);
      expect(second.resolved).toEqual([]);
      second.events$.next(activate(true));
      await advance(SETTLE_MS);

      expect(second.resolved).toEqual([registered]);
      expect(await stored()).toEqual([]);
      second.unload();

      // the resolved report left storage, so a later restart does not fill it again
      const third = wire();
      third.events$.next(activate(true));
      await advance(SETTLE_MS);

      expect(third.resolved).toEqual([]);
    });

    it("a report resolved on arrival is not filled again after a restart", async () => {
      const first = wire();
      first.events$.next(activate(true));
      await advance(SETTLE_MS);
      const registered = reported("doc");

      first.registered$.next(registered);
      await advance(0);
      expect(first.resolved).toEqual([registered]);
      first.unload();

      const second = wire();
      second.events$.next(activate(true));
      await advance(SETTLE_MS);

      expect(second.resolved).toEqual([]);
    });

    it("a report that expired during the outage is not restored", async () => {
      const first = wire();
      first.registered$.next(reported("doc"));
      await advance(0);
      first.unload();

      await advance(MAX_AGE_MS);
      const second = wire();
      second.events$.next(activate(true));
      await advance(SETTLE_MS);

      expect(second.resolved).toEqual([]);
    });

    it("a lock drops what was buffered before it, and buffers what is reported after", async () => {
      // separate frames, so the report after the lock cannot simply replace the one before it
      const buffer = wire();
      buffer.registered$.next(reported("before", 1));
      await advance(0);

      authStatuses$.next({ [userId]: Locked });
      const after = reported("after", 0);
      buffer.registered$.next(after);
      await advance(0);
      buffer.events$.next(activate(true));
      await advance(SETTLE_MS);

      expect(await stored()).toEqual([]);
      expect(buffer.resolved).toEqual([after]);
    });

    it("a lock leaves storage holding only what was reported after it", async () => {
      const buffer = wire();
      buffer.registered$.next(reported("before", 1));
      await advance(0);

      authStatuses$.next({ [userId]: Locked });
      const after = reported("after", 0);
      buffer.registered$.next(after);
      await advance(0);

      expect(await stored()).toEqual([after]);
    });

    it("a report made after a lock survives a restart", async () => {
      const first = wire();
      authStatuses$.next({ [userId]: Locked });
      const after = reported("after");
      first.registered$.next(after);
      await advance(0);
      first.unload();

      const second = wire();
      second.events$.next(activate(true));
      await advance(SETTLE_MS);

      expect(second.resolved).toEqual([after]);
    });

    it("logout empties storage, and nothing is buffered until an account signs in", async () => {
      const buffer = wire();
      buffer.registered$.next(reported("before"));
      await advance(0);

      activeAccount$.next(null);
      authStatuses$.next({ [userId]: LoggedOut });
      buffer.registered$.next(reported("during"));
      await advance(0);
      expect(await stored()).toEqual([]);

      buffer.events$.next(activate(true));
      await advance(SETTLE_MS);
      expect(buffer.resolved).toEqual([]);
    });

    it("a buffer started while logged out discards what it finds stored", async () => {
      const first = wire();
      first.registered$.next(reported("before"));
      await advance(0);
      first.unload();

      activeAccount$.next(null);
      wire();
      await advance(0);

      expect(await stored()).toEqual([]);
    });
  });
});
