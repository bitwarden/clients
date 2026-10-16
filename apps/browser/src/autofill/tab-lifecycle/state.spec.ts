import { mock } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, Subject, toArray } from "rxjs";

import { FakeStateProvider, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { SingleUserState, StateProvider } from "@bitwarden/state";

import {
  BUFFERED_TRANSITIONS,
  persistTransitions$,
  rehydrateTransitions$,
  transitionKey,
} from "./state";
import type { BufferedTransitionReport, BufferedTransitions } from "./types";

function report(
  tabId: number,
  frameId: number | undefined,
  documentId: string,
  expiresAt = 10_000,
  stampedAt = 0,
): BufferedTransitionReport {
  return { tabId, frameId, documentId, stampedAt, expiresAt };
}

describe("BUFFERED_TRANSITIONS", () => {
  it("clears on lock and logout", () => {
    expect(BUFFERED_TRANSITIONS.clearOn).toEqual(["lock", "logout"]);
  });

  it("round-trips a record", () => {
    const record = {
      [transitionKey(report(1, 0, "a"))]: report(1, 0, "a"),
      [transitionKey(report(1, undefined, "top"))]: report(1, undefined, "top"),
    };

    expect(BUFFERED_TRANSITIONS.deserializer(JSON.parse(JSON.stringify(record)))).toEqual(record);
  });

  it("is an empty record when nothing is stored", () => {
    expect(BUFFERED_TRANSITIONS.deserializer(null as any)).toEqual({});
  });

  it.each([
    ["missing documentId", { tabId: 1, frameId: 0, stampedAt: 0, expiresAt: 5 }],
    ["empty documentId", { tabId: 1, frameId: 0, documentId: "", stampedAt: 0, expiresAt: 5 }],
    ["missing expiresAt", { tabId: 1, frameId: 0, documentId: "d", stampedAt: 0 }],
    [
      "non-numeric expiresAt",
      { tabId: 1, frameId: 0, documentId: "d", stampedAt: 0, expiresAt: "soon" },
    ],
    [
      "non-finite expiresAt",
      { tabId: 1, frameId: 0, documentId: "d", stampedAt: 0, expiresAt: null },
    ],
    ["missing tabId", { frameId: 0, documentId: "d", stampedAt: 0, expiresAt: 5 }],
    ["not an object", "d"],
  ])("drops an entry with %s and keeps the rest", (_name, bad) => {
    const good = report(2, 0, "good");

    const result = BUFFERED_TRANSITIONS.deserializer({ bad, good } as any);

    expect(result).toEqual({ good });
  });
});

describe("persisted buffer", () => {
  const userId = "user-1" as UserId;
  let stateProvider: FakeStateProvider;
  let singleUser$: BehaviorSubject<UserId>;
  let userState: SingleUserState<BufferedTransitions>;
  const now = 1_000;

  beforeEach(() => {
    stateProvider = new FakeStateProvider(mockAccountServiceWith(userId));
    singleUser$ = new BehaviorSubject(userId);
    userState = stateProvider.getUser(userId, BUFFERED_TRANSITIONS);
  });

  async function stored(): Promise<BufferedTransitions> {
    return (await firstValueFrom(userState.state$)) ?? {};
  }

  // the load resolves asynchronously, and writes complete asynchronously
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  describe("persistTransitions$", () => {
    let report$: Subject<BufferedTransitionReport>;
    let resolved$: Subject<BufferedTransitionReport>;

    beforeEach(() => {
      report$ = new Subject();
      resolved$ = new Subject();
      persistTransitions$({
        stateProvider,
        singleUser$,
        report$,
        resolved$,
        now: () => now,
      }).subscribe();
    });

    it("sets a reported transition", async () => {
      const a = report(1, 0, "a");

      report$.next(a);
      await settle();

      expect(await stored()).toEqual({ [transitionKey(a)]: a });
    });

    it("replaces the entry for a frame with its latest report", async () => {
      report$.next(report(1, 0, "a"));
      report$.next(report(1, 0, "a2", 10_000, 5));
      await settle();

      expect(Object.values(await stored()).map((r) => r.documentId)).toEqual(["a2"]);
    });

    it("keeps entries for other frames", async () => {
      report$.next(report(1, 0, "a"));
      report$.next(report(1, undefined, "top"));
      await settle();

      expect(Object.keys(await stored()).sort()).toEqual(
        [transitionKey(report(1, undefined, "")), transitionKey(report(1, 0, ""))].sort(),
      );
    });

    it("deletes a resolved transition", async () => {
      const a = report(1, 0, "a");
      report$.next(a);
      await settle();

      resolved$.next(a);
      await settle();

      expect(await stored()).toEqual({});
    });

    it("does not let a resolve delete a newer report from the same document", async () => {
      const old = report(1, 0, "a", 10_000, 0);
      const newer = report(1, 0, "a", 10_000, 5);
      report$.next(old);
      report$.next(newer);
      await settle();

      resolved$.next(old);
      await settle();

      expect(await stored()).toEqual({ [transitionKey(newer)]: newer });
    });

    it("ignores a resolve for a report that is not stored", async () => {
      const a = report(1, 0, "a");
      report$.next(a);
      await settle();

      resolved$.next(report(9, 9, "x"));
      await settle();

      expect(await stored()).toEqual({ [transitionKey(a)]: a });
    });

    it("does not let a resolve delete a newer report for the same frame", async () => {
      const old = report(1, 0, "a", 10_000, 0);
      const newer = report(1, 0, "a2", 10_000, 5);
      report$.next(old);
      report$.next(newer);
      await settle();

      resolved$.next(old);
      await settle();

      expect(await stored()).toEqual({ [transitionKey(newer)]: newer });
    });
  });

  // the load happens at subscription, so each of these builds its pipe after seeding the store
  describe("persistTransitions$ over a stored buffer", () => {
    it("keeps stored entries a fresh report has not replaced", async () => {
      const earlier = report(7, 0, "stored");
      await userState.update(() => ({ [transitionKey(earlier)]: earlier }));
      const fresh = report(1, 0, "fresh");
      const report$ = new Subject<BufferedTransitionReport>();
      persistTransitions$({
        stateProvider,
        singleUser$,
        report$,
        resolved$: new Subject(),
        now: () => now,
      }).subscribe();

      report$.next(fresh);
      await settle();

      expect(await stored()).toEqual({
        [transitionKey(earlier)]: earlier,
        [transitionKey(fresh)]: fresh,
      });
    });

    it("prunes stored entries past their deadline", async () => {
      const stale = report(7, 0, "stale", 500);
      await userState.update(() => ({ [transitionKey(stale)]: stale }));
      const fresh = report(1, 0, "fresh");
      const report$ = new Subject<BufferedTransitionReport>();
      persistTransitions$({
        stateProvider,
        singleUser$,
        report$,
        resolved$: new Subject(),
        now: () => now,
      }).subscribe();

      report$.next(fresh);
      await settle();

      expect(await stored()).toEqual({ [transitionKey(fresh)]: fresh });
    });
  });

  describe("persistTransitions$ and the user", () => {
    it("completes when the user completes", async () => {
      let completed = false;
      persistTransitions$({
        stateProvider,
        singleUser$,
        report$: new Subject(),
        resolved$: new Subject(),
        now: () => now,
      }).subscribe({ complete: () => (completed = true) });

      singleUser$.complete();
      await settle();

      expect(completed).toBe(true);
    });

    it("errors when the user changes", async () => {
      const errors: unknown[] = [];
      persistTransitions$({
        stateProvider,
        singleUser$,
        report$: new Subject(),
        resolved$: new Subject(),
        now: () => now,
      }).subscribe({ error: (e: unknown) => errors.push(e) });

      singleUser$.next("user-2" as UserId);
      await settle();

      expect(errors).toHaveLength(1);
      expect(String(errors[0])).toContain("only emit one value");
    });
  });

  describe("persistTransitions$ before the load", () => {
    it("holds every event emitted before the load, in order", async () => {
      const report$ = new Subject<BufferedTransitionReport>();
      const resolved$ = new Subject<BufferedTransitionReport>();
      const loaded = new Subject<BufferedTransitions | null>();
      const gated = mock<SingleUserState<BufferedTransitions>>();
      Object.assign(gated, { state$: loaded });
      gated.update.mockResolvedValue({});
      const gatedProvider = mock<StateProvider>();
      gatedProvider.getUser.mockReturnValue(gated);
      const out: BufferedTransitions[] = [];
      persistTransitions$({
        stateProvider: gatedProvider,
        singleUser$,
        report$,
        resolved$,
        now: () => now,
      }).subscribe((r) => out.push(r));
      const a = report(1, 0, "a");
      const b = report(2, 0, "b");

      report$.next(a);
      report$.next(b);
      resolved$.next(a);
      expect(gated.update).not.toHaveBeenCalled();
      loaded.next({});
      await settle();

      expect(out.at(-1)).toEqual({ [transitionKey(b)]: b });
      expect(out).toHaveLength(3);
    });
  });

  describe("rehydrateTransitions$", () => {
    it("emits each stored report that has not expired", async () => {
      const live = report(1, 0, "live", 2_000);
      const stale = report(1, 1, "stale", 1_000);
      const fresh = report(2, 0, "fresh", 5_000);
      await userState.update(() => ({
        [transitionKey(live)]: live,
        [transitionKey(stale)]: stale,
        [transitionKey(fresh)]: fresh,
      }));

      const restored = await firstValueFrom(
        rehydrateTransitions$({ stateProvider, singleUser$, now: () => now }).pipe(toArray()),
      );

      expect(restored).toEqual([live, fresh]);
    });

    it("emits nothing when no buffer is stored", async () => {
      const restored = await firstValueFrom(
        rehydrateTransitions$({ stateProvider, singleUser$, now: () => now }).pipe(toArray()),
      );

      expect(restored).toEqual([]);
    });
  });
});
