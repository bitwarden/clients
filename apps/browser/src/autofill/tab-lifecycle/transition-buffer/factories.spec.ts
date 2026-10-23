import { mock } from "jest-mock-extended";
import { BehaviorSubject, NEVER, Subject } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";
import { GlobalState, StateProvider } from "@bitwarden/state";

import { TabEdgeCause, TabState } from "../enums";
import type { TabEdge } from "../types";

import { persistentTransitionBuffer$, transitionBuffer$ } from "./factories";
import type { BufferedTransitionReport, BufferedTransitions } from "./types";
import { transitionKey } from "./utils";

const hot: TabEdge = {
  from: TabState.WarmUp,
  to: TabState.Hot,
  cause: TabEdgeCause.Settle,
  focused: true,
};

const userId = "user-1" as UserId;

function report(
  tabId: number,
  frameId: number | undefined,
  documentId: string,
  expiresAt = Number.MAX_SAFE_INTEGER,
  stampedAt = 0,
): BufferedTransitionReport {
  return { userId, tabId, frameId, documentId, stampedAt, expiresAt };
}

// the load resolves asynchronously, and writes complete asynchronously
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("transitionBuffer$", () => {
  it("resolves what its sources resolve", () => {
    const report$ = new Subject<BufferedTransitionReport>();
    const tabLifecycleChanged$ = new Subject<readonly [number, TabEdge]>();
    const resolved: BufferedTransitionReport[] = [];
    transitionBuffer$({
      report$,
      tabLifecycleChanged$,
      frameLost$: NEVER,
      tabRemoved$: NEVER,
      enabled$: new BehaviorSubject(true),
      now: () => 0,
    }).subscribe((r) => resolved.push(r));
    const a = report(1, 0, "a");

    report$.next(a);
    tabLifecycleChanged$.next([1, hot]);

    expect(resolved).toEqual([a]);
  });

  it("is a separate buffer for each subscription", () => {
    const report$ = new Subject<BufferedTransitionReport>();
    const tabLifecycleChanged$ = new Subject<readonly [number, TabEdge]>();
    const buffer$ = transitionBuffer$({
      report$,
      tabLifecycleChanged$,
      frameLost$: NEVER,
      tabRemoved$: NEVER,
      enabled$: new BehaviorSubject(true),
      now: () => 0,
    });
    const first: BufferedTransitionReport[] = [];
    const second: BufferedTransitionReport[] = [];
    buffer$.subscribe((r) => first.push(r));
    report$.next(report(1, 0, "a"));
    buffer$.subscribe((r) => second.push(r));

    tabLifecycleChanged$.next([1, hot]);

    expect(first.map((r) => r.documentId)).toEqual(["a"]);
    expect(second).toEqual([]);
  });
});

describe("persistentTransitionBuffer$", () => {
  const now = 1_000;
  let report$: Subject<BufferedTransitionReport>;
  let tabLifecycleChanged$: Subject<readonly [number, TabEdge]>;
  let enabled$: BehaviorSubject<boolean>;
  let loaded$: Subject<BufferedTransitions | null>;
  let state: GlobalState<BufferedTransitions>;
  let provider: StateProvider;

  beforeEach(() => {
    report$ = new Subject();
    tabLifecycleChanged$ = new Subject();
    enabled$ = new BehaviorSubject(true);
    loaded$ = new Subject();
    state = mock<GlobalState<BufferedTransitions>>();
    Object.assign(state, { state$: loaded$ });
    jest.mocked(state.update).mockResolvedValue({});
    provider = mock<StateProvider>();
    jest.mocked(provider.getGlobal).mockReturnValue(state as any);
  });

  function start() {
    const resolved: BufferedTransitionReport[] = [];
    const errors: unknown[] = [];
    persistentTransitionBuffer$({
      stateProvider: provider,
      report$,
      tabLifecycleChanged$,
      frameLost$: NEVER,
      tabRemoved$: NEVER,
      enabled$,
      now: () => now,
    }).subscribe({ next: (r) => resolved.push(r), error: (e: unknown) => errors.push(e) });
    return { resolved, errors };
  }

  it("resolves what its sources resolve", async () => {
    const { resolved } = start();
    loaded$.next({});
    const a = report(1, 0, "a");

    report$.next(a);
    tabLifecycleChanged$.next([1, hot]);

    expect(resolved).toEqual([a]);
  });

  it("passes a storage failure on, and stops reading its sources", async () => {
    const failure = new Error("storage unavailable");
    jest.mocked(state.update).mockRejectedValue(failure);
    const { errors } = start();
    loaded$.next({});

    report$.next(report(1, 0, "a"));
    await settle();

    expect(errors).toEqual([failure]);
    expect(report$.observed).toBe(false);
  });

  it("an unsubscribed buffer neither restores nor writes", async () => {
    const subscription = persistentTransitionBuffer$({
      stateProvider: provider,
      report$,
      tabLifecycleChanged$,
      frameLost$: NEVER,
      tabRemoved$: NEVER,
      enabled$,
      now: () => now,
    }).subscribe();
    report$.next(report(1, 0, "fresh"));

    subscription.unsubscribe();
    const stored = report(2, 0, "stored");
    loaded$.next({ [transitionKey(stored)]: stored });
    await settle();

    expect(state.update).not.toHaveBeenCalled();
  });
});
