import { BehaviorSubject, firstValueFrom, Subject } from "rxjs";

import { FakeStateProvider, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { SingleUserState, StateDefinition, UserKeyDefinition } from "@bitwarden/state";

import { StateSubject } from "./state-subject";

const KEY = new UserKeyDefinition<number[]>(
  new StateDefinition("stateSubjectSpec", "memory"),
  "values",
  { deserializer: (value) => value, clearOn: [] },
);

describe("StateSubject", () => {
  const userId = "user-1" as UserId;
  let stateProvider: FakeStateProvider;
  let backend: SingleUserState<number[]>;

  beforeEach(() => {
    stateProvider = new FakeStateProvider(mockAccountServiceWith(userId));
    backend = stateProvider.getUser(userId, KEY);
  });

  // the load resolves asynchronously, and writes complete asynchronously
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  const stored = async () => (await firstValueFrom(backend.state$)) ?? [];

  it("reads the fallback when nothing is stored", async () => {
    const subject = new StateSubject(new BehaviorSubject(backend), [0]);

    expect(await firstValueFrom(subject)).toEqual([0]);
  });

  it("writes what it receives to the backend", async () => {
    const subject = new StateSubject(new BehaviorSubject(backend), []);

    subject.next([1]);
    await settle();

    expect(await stored()).toEqual([1]);
  });

  it("hands a subscriber the stored value from memory, once the state has emitted", async () => {
    const subject = new StateSubject(new BehaviorSubject(backend), []);
    subject.next([1]);
    await settle();
    const received: number[][] = [];

    subject.subscribe((value) => received.push(value));

    expect(received).toEqual([[1]]);
  });

  it("holds writes until the backend is known, and writes only the last", async () => {
    const state$ = new Subject<SingleUserState<number[]>>();
    const subject = new StateSubject(state$, []);

    subject.next([1]);
    subject.next([2]);
    await settle();
    expect(await stored()).toEqual([]);

    state$.next(backend);
    await settle();

    expect(await stored()).toEqual([2]);
  });

  it("writes in the order received", async () => {
    const subject = new StateSubject(new BehaviorSubject(backend), []);

    subject.next([1]);
    subject.next([2]);
    subject.next([3]);
    await settle();

    expect(await stored()).toEqual([3]);
  });

  it("errors when bound to a second, different backend", async () => {
    const state$ = new BehaviorSubject(backend);
    const subject = new StateSubject(state$, []);
    const errors: unknown[] = [];
    subject.subscribe({ error: (e: unknown) => errors.push(e) });

    state$.next(stateProvider.getUser("user-2" as UserId, KEY));
    await settle();

    expect(errors).toHaveLength(1);
    expect(String(errors[0])).toContain("only emit one value");
  });

  it("is not disturbed by the same backend arriving again", async () => {
    const state$ = new BehaviorSubject(backend);
    const subject = new StateSubject(state$, []);
    const errors: unknown[] = [];
    subject.subscribe({ error: (e: unknown) => errors.push(e) });

    state$.next(backend);
    await settle();

    expect(errors).toEqual([]);
  });

  it("completes when the backend completes", async () => {
    const state$ = new BehaviorSubject(backend);
    const subject = new StateSubject(state$, []);
    let completed = false;
    subject.subscribe({ complete: () => (completed = true) });

    state$.complete();
    await settle();

    expect(completed).toBe(true);
  });

  it("stops writing once completed", async () => {
    const subject = new StateSubject(new BehaviorSubject(backend), []);
    subject.complete();

    subject.next([9]);
    await settle();

    expect(await stored()).toEqual([]);
  });
});
