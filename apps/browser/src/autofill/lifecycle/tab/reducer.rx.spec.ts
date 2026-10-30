import { BehaviorSubject, Subject } from "rxjs";

import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { UserId } from "@bitwarden/common/types/guid";

import { signedIn, tabSignals$ } from "./reducer.rx";
import type { ObservedWindow, ReducerSources, TabLifecycleEvent, TabSignal } from "./types";

const { LoggedOut, Locked, Unlocked } = AuthenticationStatus;

const activate = (focused: boolean): TabLifecycleEvent => ({ kind: "activate", focused });
const deactivate: TabLifecycleEvent = { kind: "deactivate" };
const focus: TabLifecycleEvent = { kind: "focus" };
const blur: TabLifecycleEvent = { kind: "blur" };

/** The signal that delivers `event` to a tab, while someone is signed in. */
const tab = (tabId: number, event: TabLifecycleEvent): TabSignal => ({
  kind: "tab",
  tabId,
  event,
  signedIn: true,
});
const removed = (tabId: number): TabSignal => ({ kind: "removed", tabId });
const seeded: TabSignal = { kind: "seeded" };

/** A window with the given active tab, and another tab that is not active. */
const win = (id: number, activeTabId: number, focused = false): ObservedWindow => ({
  id,
  focused,
  tabs: [
    { id: activeTabId, active: true },
    { id: 999, active: false },
  ],
});

describe("signedIn", () => {
  const user1 = "user-1" as UserId;
  const user2 = "user-2" as UserId;

  it.each([
    ["no account is listed", {}, false],
    ["every account is logged out", { [user1]: LoggedOut, [user2]: LoggedOut }, false],
    ["an account is locked", { [user1]: Locked }, true],
    ["one account is signed in", { [user1]: LoggedOut, [user2]: Unlocked }, true],
  ])("is %s", (_, statuses, expected) => {
    const statuses$ = new Subject<Record<UserId, AuthenticationStatus>>();
    const values: boolean[] = [];
    signedIn(statuses$).subscribe((value) => values.push(value));

    statuses$.next(statuses);

    expect(values).toEqual([expected]);
  });

  it("emits once per crossing", () => {
    const statuses$ = new Subject<Record<UserId, AuthenticationStatus>>();
    const values: boolean[] = [];
    signedIn(statuses$).subscribe((value) => values.push(value));

    statuses$.next({ [user1]: Unlocked });
    statuses$.next({ [user1]: Locked });
    statuses$.next({ [user1]: Locked, [user2]: Unlocked });
    statuses$.next({ [user1]: LoggedOut, [user2]: LoggedOut });
    statuses$.next({});
    statuses$.next({ [user1]: Unlocked });

    expect(values).toEqual([true, false, true]);
  });
});

describe("tabSignals$", () => {
  let signedIn$: BehaviorSubject<boolean>;
  let tabActivated$: Subject<{ tabId: number; windowId: number }>;
  let tabCreated$: Subject<{ id?: number; windowId: number; active: boolean }>;
  let tabRemoved$: Subject<{ tabId: number }>;
  let tabReplaced$: Subject<{ removedTabId: number }>;
  let tabAttached$: Subject<{ tabId: number }>;
  let tabDetached$: Subject<{ tabId: number; oldWindowId: number }>;
  let windowFocusChanged$: Subject<number>;
  let windowRemoved$: Subject<number>;
  let getWindows: jest.Mock<Promise<readonly ObservedWindow[]>, []>;
  let onReconcileError: jest.Mock;
  let sources: ReducerSources;
  let signals: TabSignal[];

  beforeEach(() => {
    jest.useFakeTimers();
    signedIn$ = new BehaviorSubject(true);
    tabActivated$ = new Subject();
    tabCreated$ = new Subject();
    tabRemoved$ = new Subject();
    tabReplaced$ = new Subject();
    tabAttached$ = new Subject();
    tabDetached$ = new Subject();
    windowFocusChanged$ = new Subject();
    windowRemoved$ = new Subject();
    getWindows = jest.fn(async () => [win(1, 10, true), win(2, 20)]);
    onReconcileError = jest.fn();
    sources = {
      signedIn$,
      tabActivated$,
      tabCreated$,
      tabRemoved$,
      tabReplaced$,
      tabAttached$,
      tabDetached$,
      windowFocusChanged$,
      windowRemoved$,
      getWindows,
      onReconcileError,
    };
    signals = [];
  });

  afterEach(() => jest.useRealTimers());

  const flush = () => jest.advanceTimersByTimeAsync(0);

  describe("starting", () => {
    it("reads the browser only once the accounts are observed", async () => {
      const accounts$ = new Subject<boolean>();
      tabSignals$({ ...sources, signedIn$: accounts$ }).subscribe((s) => signals.push(s));
      await flush();
      expect(getWindows).not.toHaveBeenCalled();

      accounts$.next(true);
      await flush();

      expect(getWindows).toHaveBeenCalledTimes(1);
      expect(signals).toEqual([tab(10, activate(true)), tab(20, activate(false)), seeded]);
    });

    it("is seeded, having reported the failure, when the browser cannot be read", async () => {
      const failure = new Error("nope");
      getWindows.mockRejectedValue(failure);
      tabSignals$(sources).subscribe((s) => signals.push(s));

      await flush();

      expect(signals).toEqual([seeded]);
      expect(onReconcileError).toHaveBeenCalledWith(failure);
    });

    it("does not hold an account change that arrives during the seed behind it", async () => {
      let release: () => void = () => undefined;
      getWindows.mockImplementationOnce(
        () => new Promise((resolve) => (release = () => resolve([win(7, 70, true)]))),
      );
      signedIn$.next(false);
      tabSignals$(sources).subscribe((s) => signals.push(s));
      await flush();

      signedIn$.next(true);
      release();
      await flush();

      expect(signals).toEqual([
        { kind: "all", event: { kind: "login" }, signedIn: true },
        tab(70, activate(true)),
        seeded,
      ]);
    });
  });

  describe("the browser's signals", () => {
    it("reads tabs activated", async () => {
      tabSignals$(sources).subscribe((s) => signals.push(s));
      await flush();
      signals.length = 0;

      tabActivated$.next({ tabId: 11, windowId: 1 });

      expect(signals).toEqual([tab(10, deactivate), tab(11, activate(true))]);
    });

    it("reads tabs created", async () => {
      tabSignals$(sources).subscribe((s) => signals.push(s));
      await flush();
      signals.length = 0;

      tabCreated$.next({ id: 12, windowId: 1, active: true });

      expect(signals).toEqual([tab(10, deactivate), tab(12, activate(true))]);
    });

    it("reads tabs removed", async () => {
      tabSignals$(sources).subscribe((s) => signals.push(s));
      await flush();
      signals.length = 0;

      tabRemoved$.next({ tabId: 20 });

      expect(signals).toEqual([removed(20)]);
    });

    it("reads tabs replaced", async () => {
      tabSignals$(sources).subscribe((s) => signals.push(s));
      await flush();
      signals.length = 0;

      getWindows.mockResolvedValueOnce([win(1, 11, true), win(2, 20)]);

      tabReplaced$.next({ removedTabId: 10 });
      await flush();

      expect(signals).toEqual([removed(10), tab(11, activate(true))]);
    });

    it("reads tabs attached", async () => {
      tabSignals$(sources).subscribe((s) => signals.push(s));
      await flush();
      signals.length = 0;

      getWindows.mockResolvedValueOnce([win(1, 10, true), win(3, 30)]);

      tabAttached$.next({ tabId: 30 });
      await flush();

      expect(signals).toEqual([tab(20, deactivate), tab(30, activate(false))]);
    });

    it("reads tabs detached", async () => {
      tabSignals$(sources).subscribe((s) => signals.push(s));
      await flush();
      signals.length = 0;

      tabDetached$.next({ tabId: 10, oldWindowId: 1 });

      expect(signals).toEqual([tab(10, deactivate)]);
    });

    it("reads windows focused", async () => {
      tabSignals$(sources).subscribe((s) => signals.push(s));
      await flush();
      signals.length = 0;

      windowFocusChanged$.next(2);

      expect(signals).toEqual([tab(10, blur), tab(20, focus)]);
    });

    it("reads windows removed", async () => {
      tabSignals$(sources).subscribe((s) => signals.push(s));
      await flush();
      signals.length = 0;

      tabRemoved$.next({ tabId: 20 });
      windowRemoved$.next(2);

      expect(signals).toEqual([removed(20)]);
    });
  });

  describe("asking the browser", () => {
    it("reads the windows for an activation in a window it has no record of", async () => {
      tabSignals$(sources).subscribe((s) => signals.push(s));
      await flush();
      signals.length = 0;

      getWindows.mockResolvedValueOnce([win(1, 10, true), win(2, 20), win(3, 30)]);

      tabActivated$.next({ tabId: 30, windowId: 3 });
      await flush();

      expect(signals).toEqual([tab(30, activate(false))]);
    });

    it("confirms with the browser that no window is focused before it blurs", async () => {
      tabSignals$(sources).subscribe((s) => signals.push(s));
      await flush();
      signals.length = 0;

      getWindows.mockResolvedValueOnce([win(1, 10), win(2, 20)]);

      windowFocusChanged$.next(-1);
      await flush();

      expect(signals).toEqual([tab(10, blur)]);
    });

    it("takes no window focused as spurious when the browser reports one focused", async () => {
      tabSignals$(sources).subscribe((s) => signals.push(s));
      await flush();
      signals.length = 0;

      getWindows.mockResolvedValueOnce([win(1, 10), win(2, 20, true)]);

      windowFocusChanged$.next(-1);
      await flush();

      expect(signals).toEqual([tab(10, blur), tab(20, focus)]);
    });

    it("applies the signals that arrive during a reconciliation after it, in order", async () => {
      tabSignals$(sources).subscribe((s) => signals.push(s));
      await flush();
      signals.length = 0;

      let release: () => void = () => undefined;
      getWindows.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = () => resolve([win(1, 10, true), win(2, 20), win(3, 30)]);
          }),
      );

      windowFocusChanged$.next(-1);
      tabActivated$.next({ tabId: 21, windowId: 2 });
      await flush();
      expect(signals).toEqual([]);

      release();
      await flush();

      // window 1 is still focused, so the report of no focus was spurious; then the activation
      expect(signals).toEqual([
        tab(30, activate(false)),
        tab(20, deactivate),
        tab(21, activate(false)),
      ]);
    });

    it("changes nothing when the browser cannot be read to resolve a signal", async () => {
      tabSignals$(sources).subscribe((s) => signals.push(s));
      await flush();
      signals.length = 0;

      const failure = new Error("nope");
      getWindows.mockRejectedValueOnce(failure);

      tabActivated$.next({ tabId: 30, windowId: 3 });
      await flush();

      expect(onReconcileError).toHaveBeenCalledWith(failure);
      expect(signals).toEqual([]);
    });

    it("does not hold a logout behind a browser that has not answered", async () => {
      tabSignals$(sources).subscribe((s) => signals.push(s));
      await flush();
      signals.length = 0;

      getWindows.mockImplementationOnce(() => new Promise(() => undefined));

      tabAttached$.next({ tabId: 21 });
      signedIn$.next(false);

      expect(signals).toEqual([{ kind: "all", event: { kind: "logout" }, signedIn: false }]);
    });

    it("gives up on a browser that does not answer, and goes on with the signals behind it", async () => {
      tabSignals$(sources).subscribe((s) => signals.push(s));
      await flush();
      signals.length = 0;

      getWindows.mockImplementationOnce(() => new Promise(() => undefined));

      tabAttached$.next({ tabId: 21 });
      tabActivated$.next({ tabId: 11, windowId: 1 });
      await flush();
      expect(signals).toEqual([]);

      await jest.advanceTimersByTimeAsync(5000);

      expect(onReconcileError).toHaveBeenCalledTimes(1);
      expect(signals).toEqual([tab(10, deactivate), tab(11, activate(true))]);
    });

    it("ends a reconciliation in flight when unsubscribed, so nothing is reported after", async () => {
      const subscription = tabSignals$({
        ...sources,
        getWindows: () => new Promise(() => undefined),
      }).subscribe();
      await flush();

      subscription.unsubscribe();
      await jest.advanceTimersByTimeAsync(5000);

      expect(onReconcileError).not.toHaveBeenCalled();
    });
  });
});
