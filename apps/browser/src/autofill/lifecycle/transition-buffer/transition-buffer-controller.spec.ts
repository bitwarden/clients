import { mock, MockProxy } from "jest-mock-extended";
import { of, Subject, throwError } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";

import { AccountEventKind, TabEdgeCause, TabState } from "../enums";
import type { AccountEvent, TabEdge } from "../types";

import { TransitionBuffer } from "./abstractions";
import { TransitionBufferController } from "./transition-buffer-controller";
import type { BufferedTransitionReport, PageTransitionSignals } from "./types";

/** The URL of the tab whose document reported; distinct for each document. */
const urlOf = (documentId: string) => `https://${documentId}.example/`;

const NOW = 1000;
const MAX_AGE_MS = 5000;
const user = "user-1" as UserId;
const otherUser = "user-2" as UserId;

const edge = (from: TabState, to: TabState, cause: TabEdgeCause): TabEdge => ({
  from,
  to,
  cause,
  focused: true,
});
const toHot = edge(TabState.WarmUp, TabState.Hot, TabEdgeCause.Settle);
const toHotByCommand = edge(TabState.WarmUp, TabState.Hot, TabEdgeCause.Command);
const toWarmUp = edge(TabState.Cold, TabState.WarmUp, TabEdgeCause.Activate);
const toCold = edge(TabState.CoolDown, TabState.Cold, TabEdgeCause.CoolDownElapsed);
const toCoolDown = edge(TabState.Hot, TabState.CoolDown, TabEdgeCause.Deactivate);
const toWarm = edge(TabState.WarmUp, TabState.Warm, TabEdgeCause.Settle);
const toFrozen = edge(TabState.Cold, TabState.Frozen, TabEdgeCause.Logout);
const hotToWarm = edge(TabState.Hot, TabState.Warm, TabEdgeCause.Blur);

const login = (id: UserId): AccountEvent => ({ kind: AccountEventKind.Login, userId: id });
const logout = (id: UserId): AccountEvent => ({ kind: AccountEventKind.Logout, userId: id });
const lock = (id: UserId): AccountEvent => ({ kind: AccountEventKind.Lock, userId: id });
const unlock = (id: UserId): AccountEvent => ({ kind: AccountEventKind.Unlock, userId: id });
const switchTo = (to: UserId, from: UserId | null = null): AccountEvent => ({
  kind: AccountEventKind.Switch,
  from,
  to,
});
const bootstrapped: AccountEvent = { kind: AccountEventKind.Bootstrapped };

const stamped = (
  tabId: number,
  frameId: number | undefined,
  documentId: string,
  userId: UserId = user,
): BufferedTransitionReport => ({
  userId,
  tabId,
  frameId,
  documentId,
  url: urlOf(documentId),
  stampedAt: NOW,
  expiresAt: NOW + MAX_AGE_MS,
});

describe("TransitionBufferController", () => {
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
  let buffer: MockProxy<TransitionBuffer>;
  let bufferResolved$: Subject<BufferedTransitionReport>;
  let bufferRestored$: Subject<BufferedTransitionReport>;
  let controller: TransitionBufferController;
  let resolved: BufferedTransitionReport[];
  let errors: unknown[];

  const frame = (tabId: number, frameId: number | undefined, documentId: string) => ({
    tabId,
    frameId,
    documentId,
    url: urlOf(documentId),
  });

  /** The accounts as the first observation describes them, with `id` signed in and active. */
  const observeAccounts = (id: UserId = user) => {
    accountEvents$.next(login(id));
    accountEvents$.next(switchTo(id));
    accountEvents$.next(bootstrapped);
  };

  const construct = (maxAgeMs$ = of(MAX_AGE_MS)) => {
    controller = new TransitionBufferController(
      {
        report$,
        accountEvents$,
        tabLifecycleChanged$,
        tabRemoved$,
        frameLost$,
        scriptsReloading$,
      } satisfies PageTransitionSignals,
      buffer,
      { now: () => NOW, maxAgeMs$ },
    );
    controller.resolved$.subscribe({
      next: (r) => resolved.push(r),
      error: (e: unknown) => errors.push(e),
    });
  };

  beforeEach(() => {
    report$ = new Subject();
    accountEvents$ = new Subject();
    tabLifecycleChanged$ = new Subject();
    tabRemoved$ = new Subject();
    frameLost$ = new Subject();
    scriptsReloading$ = new Subject();
    buffer = mock<TransitionBuffer>();
    bufferResolved$ = new Subject();
    bufferRestored$ = new Subject();
    Object.assign(buffer, { resolved$: bufferResolved$, restored$: bufferRestored$ });
    resolved = [];
    errors = [];
    construct();
  });

  afterEach(() => controller[Symbol.dispose]());

  describe("a report", () => {
    it("is stamped with the account switched to, the moment it arrived, and the age bound", () => {
      observeAccounts();

      report$.next(frame(1, 0, "a"));

      expect(buffer.buffer).toHaveBeenCalledWith(stamped(1, 0, "a"));
    });

    it("is stamped for the latest account switched to", () => {
      observeAccounts();
      accountEvents$.next(login(otherUser));
      accountEvents$.next(switchTo(otherUser, user));

      report$.next(frame(1, 0, "a"));

      expect(buffer.buffer).toHaveBeenCalledWith(stamped(1, 0, "a", otherUser));
    });

    it("that arrives before the accounts are observed waits, and is not lost", () => {
      report$.next(frame(1, 0, "a"));
      expect(buffer.buffer).not.toHaveBeenCalled();

      observeAccounts();

      expect(buffer.buffer).toHaveBeenCalledWith(stamped(1, 0, "a"));
    });

    it("that arrives before the accounts are observed is judged in the order it arrived", () => {
      report$.next(frame(1, 0, "a"));
      report$.next(frame(2, 0, "b"));
      report$.next(frame(1, 5, "c"));

      observeAccounts();

      expect(buffer.buffer.mock.calls.map(([r]) => r.documentId)).toEqual(["a", "b", "c"]);
    });

    it("waits for the age bound as well, when it is not yet known", () => {
      const maxAgeMs$ = new Subject<number>();
      controller[Symbol.dispose]();
      construct(maxAgeMs$);
      observeAccounts();

      report$.next(frame(1, 0, "a"));
      expect(buffer.buffer).not.toHaveBeenCalled();
      maxAgeMs$.next(MAX_AGE_MS);

      expect(buffer.buffer).toHaveBeenCalledWith(stamped(1, 0, "a"));
    });

    it("is dropped when no account is signed in", () => {
      report$.next(frame(1, 0, "a"));

      accountEvents$.next(bootstrapped);
      report$.next(frame(1, 0, "b"));

      expect(buffer.buffer).not.toHaveBeenCalled();
    });

    it("is dropped when it names no document or no tab", () => {
      observeAccounts();

      report$.next({ tabId: 1, frameId: 0, documentId: "", url: urlOf("") });
      report$.next({
        tabId: undefined as unknown as number,
        frameId: 0,
        documentId: "a",
        url: urlOf("a"),
      });

      expect(buffer.buffer).not.toHaveBeenCalled();
    });
  });

  describe("the disposition of a report's tab", () => {
    beforeEach(() => observeAccounts());

    it("is to buffer for a tab that has reported no change, so a tab opened in the background waits", () => {
      report$.next(frame(1, 0, "a"));

      expect(buffer.buffer).toHaveBeenCalledWith(stamped(1, 0, "a"));
      expect(resolved).toEqual([]);
    });

    it.each([
      ["cold", toCold],
      ["warming up", toWarmUp],
      ["cooling down", toCoolDown],
    ])("is to buffer for a tab that is %s", (_name, change) => {
      tabLifecycleChanged$.next([1, change]);

      report$.next(frame(1, 0, "a"));

      expect(buffer.buffer).toHaveBeenCalledWith(stamped(1, 0, "a"));
    });

    it("is to resolve at once for a hot tab, and nothing is stored", () => {
      tabLifecycleChanged$.next([1, toHot]);

      report$.next(frame(1, 0, "a"));

      expect(resolved).toEqual([stamped(1, 0, "a")]);
      expect(buffer.buffer).not.toHaveBeenCalled();
    });

    it("is to resolve at once for a tab that became hot by a command", () => {
      tabLifecycleChanged$.next([1, toHotByCommand]);

      report$.next(frame(1, 0, "a"));

      expect(resolved).toEqual([stamped(1, 0, "a")]);
    });

    it.each([
      ["warm", toWarm],
      ["frozen", toFrozen],
    ])("is to drop for a tab that is %s", (_name, change) => {
      tabLifecycleChanged$.next([1, change]);

      report$.next(frame(1, 0, "a"));

      expect(resolved).toEqual([]);
      expect(buffer.buffer).not.toHaveBeenCalled();
    });

    it("follows the tab's latest change, so a tab that leaves hot buffers again", () => {
      tabLifecycleChanged$.next([1, toHot]);
      tabLifecycleChanged$.next([1, toCoolDown]);

      report$.next(frame(1, 0, "a"));

      expect(buffer.buffer).toHaveBeenCalledWith(stamped(1, 0, "a"));
      expect(resolved).toEqual([]);
    });

    it("is kept apart for each tab", () => {
      tabLifecycleChanged$.next([1, toHot]);

      report$.next(frame(2, 0, "other"));

      expect(buffer.buffer).toHaveBeenCalledWith(stamped(2, 0, "other"));
    });

    it("is learned before the accounts are observed", () => {
      controller[Symbol.dispose]();
      construct();
      tabLifecycleChanged$.next([1, toHot]);

      report$.next(frame(1, 0, "early"));
      observeAccounts();

      expect(resolved).toEqual([stamped(1, 0, "early")]);
    });
  });

  describe("a transition restored from storage", () => {
    beforeEach(() => observeAccounts());

    it("is buffered for a tab that has reported no change", () => {
      bufferRestored$.next(stamped(1, 0, "restored"));

      expect(buffer.buffer).toHaveBeenCalledWith(stamped(1, 0, "restored"));
    });

    it("resolves at once for a tab that is already hot, so it does not wait for a change that has passed", () => {
      tabLifecycleChanged$.next([1, toHot]);

      bufferRestored$.next(stamped(1, 0, "restored"));

      expect(resolved).toEqual([stamped(1, 0, "restored")]);
      expect(buffer.buffer).not.toHaveBeenCalled();
    });

    it("is dropped for a tab that is warm", () => {
      tabLifecycleChanged$.next([1, toWarm]);

      bufferRestored$.next(stamped(1, 0, "restored"));

      expect(buffer.buffer).not.toHaveBeenCalled();
      expect(resolved).toEqual([]);
    });

    it("is dropped for a tab that was removed", () => {
      tabRemoved$.next(1);

      bufferRestored$.next(stamped(1, 0, "restored"));

      expect(buffer.buffer).not.toHaveBeenCalled();
    });

    it("is not resolved once it has expired", () => {
      tabLifecycleChanged$.next([1, toHot]);

      bufferRestored$.next({ ...stamped(1, 0, "restored"), expiresAt: NOW });

      expect(resolved).toEqual([]);
    });
  });

  describe("a report that waits", () => {
    const maxAgeMs$ = new Subject<number>();
    let clock: number;

    beforeEach(() => {
      controller[Symbol.dispose]();
      clock = NOW;
      controller = new TransitionBufferController(
        {
          report$,
          accountEvents$,
          tabLifecycleChanged$,
          tabRemoved$,
          frameLost$,
          scriptsReloading$,
        },
        buffer,
        { now: () => clock, maxAgeMs$ },
      );
      controller.resolved$.subscribe((r) => resolved.push(r));
      observeAccounts();
    });

    it("keeps the moment it arrived, and so its deadline, however long it waited", () => {
      report$.next(frame(1, 0, "a"));
      clock = NOW + 2000;

      maxAgeMs$.next(MAX_AGE_MS);

      expect(buffer.buffer).toHaveBeenCalledWith(stamped(1, 0, "a"));
    });

    it.each([
      ["a lock of the active account", () => accountEvents$.next(lock(user))],
      [
        "a switch of the active account",
        () => {
          accountEvents$.next(login(otherUser));
          accountEvents$.next(switchTo(otherUser, user));
        },
      ],
      ["a reload of the scripts", () => scriptsReloading$.next()],
    ])("is dropped by %s, with the session or scripts it belonged to", (_name, end) => {
      report$.next(frame(1, 0, "a"));

      end();
      maxAgeMs$.next(MAX_AGE_MS);

      expect(buffer.buffer).not.toHaveBeenCalled();
    });

    it("is dropped when its tab is removed", () => {
      report$.next(frame(1, 0, "a"));
      report$.next(frame(2, 0, "b"));

      tabRemoved$.next(1);
      maxAgeMs$.next(MAX_AGE_MS);

      expect(buffer.buffer.mock.calls.map(([r]) => r.documentId)).toEqual(["b"]);
    });

    it("is dropped when its frame is lost", () => {
      report$.next(frame(1, 0, "a"));
      report$.next(frame(1, 5, "b"));

      frameLost$.next({ tabId: 1, frameId: 0 });
      maxAgeMs$.next(MAX_AGE_MS);

      expect(buffer.buffer.mock.calls.map(([r]) => r.documentId)).toEqual(["b"]);
    });

    it("is not resolved once it has expired while it waited", () => {
      tabLifecycleChanged$.next([1, toHot]);
      report$.next(frame(1, 0, "a"));
      clock = NOW + MAX_AGE_MS;

      maxAgeMs$.next(MAX_AGE_MS);

      expect(resolved).toEqual([]);
    });
  });

  describe("a report for a tab that was removed", () => {
    beforeEach(() => observeAccounts());

    it("is dropped, though the tab's disposition was forgotten with it", () => {
      tabRemoved$.next(1);

      report$.next(frame(1, 0, "late"));

      expect(buffer.buffer).not.toHaveBeenCalled();
      expect(resolved).toEqual([]);
    });
  });

  describe("a reload of the scripts before the accounts are observed", () => {
    it("leaves the buffer, which is not yet enabled, alone", () => {
      accountEvents$.next(login(user));
      accountEvents$.next(switchTo(user));

      scriptsReloading$.next();

      expect(buffer.clear).not.toHaveBeenCalled();
    });
  });

  describe("an event caused by applying another", () => {
    it("is applied after the event that caused it, so waiting reports keep their order", () => {
      report$.next(frame(1, 0, "first"));
      report$.next(frame(1, 1, "second"));
      // judging the first waiting report causes a new report
      buffer.buffer.mockImplementationOnce(() => report$.next(frame(1, 2, "caused")));

      observeAccounts();

      expect(buffer.buffer.mock.calls.map(([r]) => r.documentId)).toEqual([
        "first",
        "second",
        "caused",
      ]);
    });

    it("finds the disposition of a tab current when the instruction it gave is heard", () => {
      observeAccounts();
      // resolving the tab's transitions reports a change of state for the same tab
      buffer.resolve.mockImplementation(() => tabLifecycleChanged$.next([1, toCoolDown]));

      tabLifecycleChanged$.next([1, toHot]);
      report$.next(frame(1, 0, "after"));

      expect(buffer.buffer).toHaveBeenCalledWith(stamped(1, 0, "after"));
      expect(resolved).toEqual([]);
    });
  });

  describe("a change of a tab's state", () => {
    beforeEach(() => observeAccounts());

    it("into hot resolves the tab's buffered transitions", () => {
      tabLifecycleChanged$.next([1, toHot]);

      expect(buffer.resolve).toHaveBeenCalledWith(1);
      expect(buffer.drop).not.toHaveBeenCalled();
    });

    it("into hot by a command drops them, because the command carries its own fill", () => {
      tabLifecycleChanged$.next([1, toHotByCommand]);

      expect(buffer.drop).toHaveBeenCalledWith(1);
      expect(buffer.resolve).not.toHaveBeenCalled();
    });

    it("into warm drops them", () => {
      tabLifecycleChanged$.next([1, toWarm]);

      expect(buffer.drop).toHaveBeenCalledWith(1);
    });

    it("into frozen drops them", () => {
      tabLifecycleChanged$.next([1, toFrozen]);

      expect(buffer.drop).toHaveBeenCalledWith(1);
    });

    it("that leaves hot for warm drops them", () => {
      tabLifecycleChanged$.next([1, hotToWarm]);

      expect(buffer.drop).toHaveBeenCalledWith(1);
    });

    it.each([
      ["from cold to warming up", toWarmUp],
      ["from cooling down to cold, which stops monitoring", toCold],
    ])("%s leaves them as they are", (_name, change) => {
      tabLifecycleChanged$.next([1, change]);

      expect(buffer.resolve).not.toHaveBeenCalled();
      expect(buffer.drop).not.toHaveBeenCalled();
    });
  });

  describe("a tab, a frame, or the scripts change", () => {
    beforeEach(() => observeAccounts());

    it("forgets a removed tab", () => {
      tabRemoved$.next(7);

      expect(buffer.forget).toHaveBeenCalledWith(7);
    });

    it("drops a lost frame's transition", () => {
      frameLost$.next({ tabId: 1, frameId: 5 });

      expect(buffer.dropFrame).toHaveBeenCalledWith(1, 5);
    });

    it("clears the buffer when the scripts begin reloading, and keeps admitting", () => {
      scriptsReloading$.next();
      report$.next(frame(1, 0, "after"));

      expect(buffer.clear).toHaveBeenCalledTimes(1);
      expect(buffer.setEnabled).not.toHaveBeenCalledWith(false);
      expect(buffer.buffer).toHaveBeenCalledWith(stamped(1, 0, "after"));
    });

    it("leaves a buffer that admits nothing as it is when the scripts begin reloading", () => {
      accountEvents$.next(logout(user));
      buffer.clear.mockClear();

      scriptsReloading$.next();

      expect(buffer.clear).not.toHaveBeenCalled();
    });
  });

  describe("the accounts", () => {
    it("enable the buffer at the first observation when the active account is signed in", () => {
      observeAccounts();

      expect(buffer.setEnabled).toHaveBeenCalledTimes(1);
      expect(buffer.setEnabled).toHaveBeenCalledWith(true);
    });

    it("disable the buffer at the first observation when nobody is signed in", () => {
      accountEvents$.next(bootstrapped);

      expect(buffer.setEnabled).toHaveBeenCalledWith(false);
    });

    it("say nothing before the first observation is complete", () => {
      accountEvents$.next(login(user));
      accountEvents$.next(switchTo(user));

      expect(buffer.setEnabled).not.toHaveBeenCalled();
      expect(buffer.clear).not.toHaveBeenCalled();
    });

    describe("once observed", () => {
      beforeEach(() => {
        observeAccounts();
        buffer.setEnabled.mockClear();
      });

      it("disable the buffer at logout of the active account", () => {
        accountEvents$.next(logout(user));

        expect(buffer.setEnabled).toHaveBeenCalledWith(false);
      });

      it("enable it again at a login that makes the active account signed in", () => {
        accountEvents$.next(logout(user));
        buffer.setEnabled.mockClear();

        accountEvents$.next(login(user));

        expect(buffer.setEnabled).toHaveBeenCalledWith(true);
      });

      it("clear the buffer at a lock of the active account, and keep admitting", () => {
        accountEvents$.next(lock(user));

        expect(buffer.clear).toHaveBeenCalledTimes(1);
        expect(buffer.setEnabled).not.toHaveBeenCalled();
      });

      it("clear the buffer at a switch between signed-in accounts, and keep admitting", () => {
        accountEvents$.next(login(otherUser));
        accountEvents$.next(switchTo(otherUser, user));

        expect(buffer.clear).toHaveBeenCalledTimes(1);
        expect(buffer.setEnabled).not.toHaveBeenCalled();
      });

      it("disable the buffer at a switch to an account that is signed out", () => {
        accountEvents$.next(switchTo(otherUser, user));

        expect(buffer.setEnabled).toHaveBeenCalledWith(false);
        expect(buffer.clear).not.toHaveBeenCalled();
      });

      it("leave the buffer alone at an unlock, or a lock of an account that is not active", () => {
        accountEvents$.next(login(otherUser));
        accountEvents$.next(unlock(user));
        accountEvents$.next(lock(otherUser));

        expect(buffer.clear).not.toHaveBeenCalled();
        expect(buffer.setEnabled).not.toHaveBeenCalled();
      });
    });
  });

  describe("resolved$", () => {
    it("emits what the buffer resolves", () => {
      const a = stamped(1, 0, "a");

      bufferResolved$.next(a);

      expect(resolved).toEqual([a]);
    });

    it("errors when a signal fails, and the buffer is no longer directed", () => {
      controller[Symbol.dispose]();
      errors = [];
      const failure = new Error("signal failed");
      const failing = new TransitionBufferController(
        {
          report$,
          accountEvents$: throwError(() => failure),
          tabLifecycleChanged$,
          tabRemoved$,
          frameLost$,
          scriptsReloading$,
        },
        buffer,
        { now: () => NOW, maxAgeMs$: of(MAX_AGE_MS) },
      );
      failing.resolved$.subscribe({ error: (e: unknown) => errors.push(e) });

      expect(errors).toEqual([failure]);
      failing[Symbol.dispose]();
    });

    it("completes when the controller is disposed", () => {
      let completed = false;
      controller.resolved$.subscribe({ complete: () => (completed = true) });
      bufferResolved$.complete();

      controller[Symbol.dispose]();

      expect(completed).toBe(true);
    });
  });
});
