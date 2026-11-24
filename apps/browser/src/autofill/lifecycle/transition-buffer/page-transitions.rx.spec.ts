import { mock } from "jest-mock-extended";
import { of, Subject, Subscription } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";
import { GlobalState, StateProvider } from "@bitwarden/state";

import { AccountEventKind, TabEdgeCause, TabState } from "../enums";
import type { AccountEvent, TabEdge } from "../types";

import { pageTransitionResolver } from "./page-transitions.rx";
import type { BufferedTransitions } from "./persistent-buffer";
import type { BufferedTransitionReport, ResolvedTransitionReport } from "./types";

/** The URL of the tab whose document reported; distinct for each document. */
const urlOf = (documentId: string) => `https://${documentId}.example/`;

const MAX_AGE_MS = 5000;
const user = "user-1" as UserId;
const otherUser = "user-2" as UserId;

const edge = (from: TabState, to: TabState, cause: TabEdgeCause): TabEdge => ({
  from,
  to,
  cause,
  focused: true,
});
const hot = edge(TabState.WarmUp, TabState.Hot, TabEdgeCause.Settle);
const warmUp = edge(TabState.Cold, TabState.WarmUp, TabEdgeCause.Activate);
const coolDownEnds = edge(TabState.CoolDown, TabState.Cold, TabEdgeCause.CoolDownElapsed);

const login = (id: UserId): AccountEvent => ({ kind: AccountEventKind.Login, userId: id });
const switchTo = (to: UserId, from: UserId | null = null): AccountEvent => ({
  kind: AccountEventKind.Switch,
  from,
  to,
});
const bootstrapped: AccountEvent = { kind: AccountEventKind.Bootstrapped };

// the stored buffer loads and writes asynchronously
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("pageTransitionResolver", () => {
  let now: number;
  let report$: Subject<{
    tabId: number;
    frameId: number | undefined;
    documentId: string;
    url: string | undefined;
  }>;
  let accountEvents$: Subject<AccountEvent>;
  let tabLifecycleChanged$: Subject<readonly [number, TabEdge]>;
  let tabRemoved$: Subject<number>;
  let frameLost$: Subject<{ tabId: number; frameId: number | undefined }>;
  let scriptsReloading$: Subject<void>;
  let loaded$: Subject<BufferedTransitions | null>;
  let state: GlobalState<BufferedTransitions>;
  let stateProvider: StateProvider;
  let storageFailures: unknown[];
  let resolved: ResolvedTransitionReport[];
  let errors: unknown[];
  let subscription: Subscription;

  const frame = (tabId: number, frameId: number | undefined, documentId: string) => ({
    tabId,
    frameId,
    documentId,
    url: urlOf(documentId),
  });
  const stamped = (
    tabId: number,
    frameId: number | undefined,
    documentId: string,
    userId: UserId = user,
    stampedAt = 1000,
  ): BufferedTransitionReport => ({
    userId,
    tabId,
    frameId,
    documentId,
    url: urlOf(documentId),
    stampedAt,
    expiresAt: stampedAt + MAX_AGE_MS,
  });

  /** A transition as the resolver hands it on: no bookkeeping of the buffer, and a token. */
  const resolvedAs = (
    tabId: number,
    frameId: number | undefined,
    documentId: string,
    userId: UserId = user,
    stampedAt = 1000,
  ) => ({
    userId,
    tabId,
    frameId,
    documentId,
    url: urlOf(documentId),
    expiresAt: stampedAt + MAX_AGE_MS,
    cancellation: expect.anything(),
  });

  /** The accounts as the first observation describes them, with `id` signed in and active. */
  const observeAccounts = (id: UserId = user) => {
    accountEvents$.next(login(id));
    accountEvents$.next(switchTo(id));
    accountEvents$.next(bootstrapped);
  };

  beforeEach(() => {
    now = 1000;
    report$ = new Subject();
    accountEvents$ = new Subject();
    tabLifecycleChanged$ = new Subject();
    tabRemoved$ = new Subject();
    frameLost$ = new Subject();
    scriptsReloading$ = new Subject();
    loaded$ = new Subject();
    state = mock<GlobalState<BufferedTransitions>>();
    Object.assign(state, { state$: loaded$ });
    jest.mocked(state.update).mockResolvedValue({});
    stateProvider = mock<StateProvider>();
    jest.mocked(stateProvider.getGlobal).mockReturnValue(state as any);
    storageFailures = [];
    resolved = [];
    errors = [];

    subscription = pageTransitionResolver({
      stateProvider,
      now: () => now,
      maxAgeMs$: of(MAX_AGE_MS),
      onStorageFailure: (error) => storageFailures.push(error),
    })({
      report$,
      accountEvents$,
      tabLifecycleChanged$,
      tabRemoved$,
      frameLost$,
      scriptsReloading$,
    }).subscribe({
      next: (r) => resolved.push(r),
      error: (e: unknown) => errors.push(e),
    });
    loaded$.next({});
  });

  afterEach(() => subscription.unsubscribe());

  describe("a report", () => {
    it("on a tab that has reported no change waits for the tab to be hot, stamped with the active account", () => {
      observeAccounts();

      report$.next(frame(1, 0, "a"));
      expect(resolved).toEqual([]);
      tabLifecycleChanged$.next([1, hot]);

      expect(resolved).toEqual([resolvedAs(1, 0, "a")]);
    });

    it("on a hot tab resolves at once", () => {
      observeAccounts();
      tabLifecycleChanged$.next([1, hot]);

      report$.next(frame(1, 0, "a"));

      expect(resolved).toEqual([resolvedAs(1, 0, "a")]);
    });

    it("is stamped for the account switched to, not the one before it", () => {
      observeAccounts();
      accountEvents$.next(login(otherUser));
      accountEvents$.next(switchTo(otherUser, user));

      report$.next(frame(1, 0, "a"));
      tabLifecycleChanged$.next([1, hot]);

      expect(resolved).toEqual([resolvedAs(1, 0, "a", otherUser)]);
    });

    it("that arrives before the accounts are observed waits, and is not lost", () => {
      report$.next(frame(1, 0, "a"));
      tabLifecycleChanged$.next([1, hot]);
      expect(resolved).toEqual([]);

      observeAccounts();

      expect(resolved).toEqual([resolvedAs(1, 0, "a")]);
    });

    it("that arrives before the accounts are observed is kept with every other that waits", () => {
      report$.next(frame(1, 0, "a"));
      report$.next(frame(2, 0, "b"));
      report$.next(frame(1, 5, "c"));

      observeAccounts();
      tabLifecycleChanged$.next([1, hot]);
      tabLifecycleChanged$.next([2, hot]);

      expect(resolved).toEqual([
        resolvedAs(1, 0, "a"),
        resolvedAs(1, 5, "c"),
        resolvedAs(2, 0, "b"),
      ]);
    });

    it("is dropped when no account is signed in", () => {
      report$.next(frame(1, 0, "a"));

      accountEvents$.next(bootstrapped);
      tabLifecycleChanged$.next([1, hot]);

      expect(resolved).toEqual([]);
    });

    it("is never resolved once it has expired", () => {
      observeAccounts();
      report$.next(frame(1, 0, "a"));

      now = 1000 + MAX_AGE_MS;
      tabLifecycleChanged$.next([1, hot]);

      expect(resolved).toEqual([]);
    });
  });

  describe("a buffered report", () => {
    beforeEach(() => {
      observeAccounts();
      report$.next(frame(1, 0, "a"));
    });

    it("waits through a cool-down that ends, which stops the tab monitoring, and resolves when the tab is hot again", () => {
      tabLifecycleChanged$.next([1, coolDownEnds]);
      tabLifecycleChanged$.next([1, warmUp]);
      expect(resolved).toEqual([]);

      tabLifecycleChanged$.next([1, hot]);

      expect(resolved).toEqual([resolvedAs(1, 0, "a")]);
    });

    it("is dropped when its frame is lost", () => {
      frameLost$.next({ tabId: 1, frameId: 0 });

      tabLifecycleChanged$.next([1, hot]);

      expect(resolved).toEqual([]);
    });

    it("is dropped when its tab is removed", () => {
      tabRemoved$.next(1);

      tabLifecycleChanged$.next([1, hot]);

      expect(resolved).toEqual([]);
    });

    it("is dropped when the active account logs out", () => {
      accountEvents$.next({ kind: AccountEventKind.Logout, userId: user });

      tabLifecycleChanged$.next([1, hot]);

      expect(resolved).toEqual([]);
    });

    it("is dropped when the active account locks, though later reports are kept", () => {
      accountEvents$.next({ kind: AccountEventKind.Lock, userId: user });
      report$.next(frame(1, 5, "later"));

      tabLifecycleChanged$.next([1, hot]);

      expect(resolved).toEqual([resolvedAs(1, 5, "later")]);
    });

    it("is dropped when the scripts begin reloading, though later reports are kept", () => {
      scriptsReloading$.next();
      report$.next(frame(1, 5, "later"));

      tabLifecycleChanged$.next([1, hot]);

      expect(resolved).toEqual([resolvedAs(1, 5, "later")]);
    });

    it("is dropped by a command, which carries its own fill", () => {
      tabLifecycleChanged$.next([1, edge(TabState.WarmUp, TabState.Hot, TabEdgeCause.Command)]);

      expect(resolved).toEqual([]);
    });
  });

  describe("a transition restored from storage", () => {
    const record = (...reports: BufferedTransitionReport[]): BufferedTransitions =>
      Object.fromEntries(reports.map((r) => [`${r.tabId}:${r.frameId ?? -1}`, r]));

    /** Starts the resolver again over a stored record, as a restarted worker does. */
    const restart = (stored: BufferedTransitions) => {
      subscription.unsubscribe();
      resolved = [];
      loaded$ = new Subject();
      Object.assign(state, { state$: loaded$ });
      subscription = pageTransitionResolver({
        stateProvider,
        now: () => now,
        maxAgeMs$: of(MAX_AGE_MS),
        onStorageFailure: (error) => storageFailures.push(error),
      })({
        report$,
        accountEvents$,
        tabLifecycleChanged$,
        tabRemoved$,
        frameLost$,
        scriptsReloading$,
      }).subscribe((r) => resolved.push(r));
      loaded$.next(stored);
    };

    it("resolves at once when its tab became hot before the record was read", async () => {
      restart(record(stamped(1, 0, "restored")));
      tabLifecycleChanged$.next([1, hot]);

      observeAccounts();
      await settle();

      expect(resolved).toEqual([resolvedAs(1, 0, "restored")]);
    });

    it("waits for its tab to be hot when the tab has reported no change", async () => {
      restart(record(stamped(1, 0, "restored")));

      observeAccounts();
      await settle();
      expect(resolved).toEqual([]);
      tabLifecycleChanged$.next([1, hot]);

      expect(resolved).toEqual([resolvedAs(1, 0, "restored")]);
    });

    it("is dropped when its tab is warm", async () => {
      restart(record(stamped(1, 0, "restored")));
      tabLifecycleChanged$.next([1, edge(TabState.WarmUp, TabState.Warm, TabEdgeCause.Settle)]);

      observeAccounts();
      await settle();
      tabLifecycleChanged$.next([1, hot]);

      expect(resolved).toEqual([]);
    });
  });

  describe("a reload of the scripts", () => {
    it("does not enable a buffer that admits nothing", () => {
      accountEvents$.next(bootstrapped);

      scriptsReloading$.next();
      report$.next(frame(1, 0, "a"));
      tabLifecycleChanged$.next([1, hot]);

      expect(resolved).toEqual([]);
    });

    it("empties the stored record", async () => {
      observeAccounts();
      report$.next(frame(1, 0, "before"));
      await settle();

      scriptsReloading$.next();
      await settle();

      const written = jest.mocked(state.update).mock.calls.at(-1)![0];
      expect(written({}, undefined as never)).toEqual({});
    });
  });

  describe("when storage fails", () => {
    beforeEach(() => observeAccounts());

    const failStorage = async () => {
      const failure = new Error("storage unavailable");
      jest.mocked(state.update).mockRejectedValueOnce(failure).mockResolvedValue({});
      report$.next(frame(1, 0, "lost"));
      await settle();
      return failure;
    };

    it("reports the failure, discards the stored record, and does not error", async () => {
      const failure = await failStorage();

      expect(storageFailures).toEqual([failure]);
      expect(errors).toEqual([]);
      const reset = jest.mocked(state.update).mock.calls.at(-1)![0];
      expect(reset({}, undefined as never)).toEqual({});
    });

    it("continues in memory with the accounts as they were, so reports are still admitted", async () => {
      await failStorage();

      report$.next(frame(2, 0, "after"));
      tabLifecycleChanged$.next([2, hot]);

      expect(resolved).toEqual([resolvedAs(2, 0, "after")]);
    });

    it("continues in memory with each tab where it was, so a report on a hot tab resolves", async () => {
      tabLifecycleChanged$.next([3, hot]);
      await failStorage();

      report$.next(frame(3, 0, "on-hot-tab"));

      expect(resolved).toEqual([resolvedAs(3, 0, "on-hot-tab")]);
    });

    it("loses what was waiting at the moment of failure", async () => {
      await failStorage();

      tabLifecycleChanged$.next([1, hot]);

      expect(resolved).toEqual([]);
    });
  });

  it("stops reading its signals when unsubscribed", () => {
    subscription.unsubscribe();

    expect(report$.observed).toBe(false);
    expect(accountEvents$.observed).toBe(false);
    expect(tabLifecycleChanged$.observed).toBe(false);
  });
  describe("the token of a resolved transition", () => {
    const leaveHot = edge(TabState.Hot, TabState.CoolDown, TabEdgeCause.Deactivate);

    it("is cancelled when its tab leaves hot", () => {
      observeAccounts();
      report$.next(frame(1, 0, "a"));
      tabLifecycleChanged$.next([1, hot]);
      expect(resolved[0].cancellation.cancelled).toBe(false);

      tabLifecycleChanged$.next([1, leaveHot]);

      expect(resolved[0].cancellation.cancelled).toBe(true);
    });

    it("is cancelled when its tab is removed", () => {
      observeAccounts();
      report$.next(frame(1, 0, "a"));
      tabLifecycleChanged$.next([1, hot]);

      tabRemoved$.next(1);

      expect(resolved[0].cancellation.cancelled).toBe(true);
    });

    it("is cancelled when its tab leaves hot, and not when another tab does", () => {
      observeAccounts();
      report$.next(frame(1, 0, "a"));
      tabLifecycleChanged$.next([1, hot]);

      tabLifecycleChanged$.next([2, leaveHot]);

      expect(resolved[0].cancellation.cancelled).toBe(false);
    });

    it("is cancelled when a newer transition for its frame resolves", () => {
      observeAccounts();
      tabLifecycleChanged$.next([1, hot]);

      report$.next(frame(1, 0, "older"));
      report$.next(frame(1, 0, "newer"));

      expect(resolved.map(({ cancellation }) => cancellation.cancelled)).toEqual([true, false]);
    });

    it("is cancelled for a transition restored from storage, when its tab leaves hot", async () => {
      const stored = Object.fromEntries([[`1:0`, stamped(1, 0, "restored")]]);
      subscription.unsubscribe();
      resolved = [];
      loaded$ = new Subject();
      Object.assign(state, { state$: loaded$ });
      subscription = pageTransitionResolver({
        stateProvider,
        now: () => now,
        maxAgeMs$: of(MAX_AGE_MS),
        onStorageFailure: (error) => storageFailures.push(error),
      })({
        report$,
        accountEvents$,
        tabLifecycleChanged$,
        tabRemoved$,
        frameLost$,
        scriptsReloading$,
      }).subscribe((r) => resolved.push(r));
      loaded$.next(stored);
      tabLifecycleChanged$.next([1, hot]);
      observeAccounts();
      await settle();
      expect(resolved).toEqual([resolvedAs(1, 0, "restored")]);
      expect(resolved[0].cancellation.cancelled).toBe(false);

      tabLifecycleChanged$.next([1, leaveHot]);

      expect(resolved[0].cancellation.cancelled).toBe(true);
    });
  });
});
