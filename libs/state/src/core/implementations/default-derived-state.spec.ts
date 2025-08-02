/**
 * need to update test environment so trackEmissions works appropriately
 * @jest-environment ../shared/test.environment.ts
 */
import { Subject, firstValueFrom } from "rxjs";

import { awaitAsync, trackEmissions } from "@bitwarden/core-test-utils";

import { DeriveDefinition } from "../derive-definition";
import { StateDefinition } from "../state-definition";

import { DefaultDerivedState } from "./default-derived-state";
import { DefaultDerivedStateProvider } from "./default-derived-state.provider";

let callCount = 0;
const cleanupDelayMs = 10;
const stateDefinition = new StateDefinition("test", "memory");
const deriveDefinition = new DeriveDefinition<string, Date, { date: Date }>(
  stateDefinition,
  "test",
  {
    derive: (dateString: string) => {
      callCount++;
      return new Date(dateString);
    },
    deserializer: (dateString: string) => new Date(dateString),
    cleanupDelayMs,
  },
);

describe("DefaultDerivedState", () => {
  let parentState$: Subject<string>;
  let sut: DefaultDerivedState<string, Date, { date: Date }>;
  const deps = {
    date: new Date(),
  };

  beforeEach(() => {
    callCount = 0;
    parentState$ = new Subject();
    sut = new DefaultDerivedState(parentState$, deriveDefinition, deps);
  });

  afterEach(() => {
    parentState$.complete();
    jest.resetAllMocks();
  });

  it("should derive the state", async () => {
    const dateString = "2020-01-01";
    const emissions = trackEmissions(sut.state$);

    parentState$.next(dateString);
    await awaitAsync();

    expect(emissions).toEqual([new Date(dateString)]);
  });

  it("should derive the state once", async () => {
    const dateString = "2020-01-01";
    trackEmissions(sut.state$);

    parentState$.next(dateString);

    expect(callCount).toBe(1);
  });

  describe("forceValue", () => {
    const initialParentValue = "2020-01-01";
    const forced = new Date("2020-02-02");
    let emissions: Date[];

    beforeEach(async () => {
      emissions = trackEmissions(sut.state$);
      parentState$.next(initialParentValue);
      await awaitAsync();
    });

    it("should force the value", async () => {
      await sut.forceValue(forced);
      expect(emissions).toEqual([new Date(initialParentValue), forced]);
    });

    it("should only force the value once", async () => {
      await sut.forceValue(forced);

      parentState$.next(initialParentValue);
      await awaitAsync();

      expect(emissions).toEqual([
        new Date(initialParentValue),
        forced,
        new Date(initialParentValue),
      ]);
    });
  });

  describe("cleanup", () => {
    const newDate = "2020-02-02";

    it("should cleanup after last subscriber", async () => {
      const subscription = sut.state$.subscribe();
      await awaitAsync();

      subscription.unsubscribe();
      // Wait for cleanup
      await awaitAsync(cleanupDelayMs * 2);

      expect(parentState$.observed).toBe(false);
    });

    it("should not cleanup if there are still subscribers", async () => {
      const subscription1 = sut.state$.subscribe();
      const sub2Emissions: Date[] = [];
      const subscription2 = sut.state$.subscribe((v) => sub2Emissions.push(v));
      await awaitAsync();

      subscription1.unsubscribe();

      // Wait for cleanup
      await awaitAsync(cleanupDelayMs * 2);

      // Still be listening to parent updates
      parentState$.next(newDate);
      await awaitAsync();
      expect(sub2Emissions).toEqual([new Date(newDate)]);

      subscription2.unsubscribe();
      // Wait for cleanup
      await awaitAsync(cleanupDelayMs * 2);

      expect(parentState$.observed).toBe(false);
    });

    it("can re-initialize after cleanup", async () => {
      const subscription = sut.state$.subscribe();
      await awaitAsync();

      subscription.unsubscribe();
      // Wait for cleanup
      await awaitAsync(cleanupDelayMs * 2);

      const emissions = trackEmissions(sut.state$);
      await awaitAsync();

      parentState$.next(newDate);
      await awaitAsync();

      expect(emissions).toEqual([new Date(newDate)]);
    });

    it("should not cleanup if a subscriber joins during the cleanup delay", async () => {
      const subscription = sut.state$.subscribe();
      await awaitAsync();

      await parentState$.next(newDate);
      await awaitAsync();

      subscription.unsubscribe();
      // Do not wait long enough for cleanup
      await awaitAsync(cleanupDelayMs / 2);

      expect(parentState$.observed).toBe(true); // still listening to parent

      const emissions = trackEmissions(sut.state$);
      expect(emissions).toEqual([new Date(newDate)]); // we didn't lose our buffered value
    });

    it("state$ observables are durable to cleanup", async () => {
      const observable = sut.state$;
      let subscription = observable.subscribe();

      await parentState$.next(newDate);
      await awaitAsync();

      subscription.unsubscribe();
      // Wait for cleanup
      await awaitAsync(cleanupDelayMs * 2);

      subscription = observable.subscribe();
      await parentState$.next(newDate);
      await awaitAsync();

      expect(await firstValueFrom(observable)).toEqual(new Date(newDate));
    });
  });

  describe("account switching", () => {
    let provider: DefaultDerivedStateProvider;

    beforeEach(() => {
      provider = new DefaultDerivedStateProvider();
    });

    it("should provide a dedicated cache for each account", async () => {
      const user1State$ = new Subject<string>();
      const user1Derived = provider.get(user1State$, deriveDefinition, deps);
      const user1Emissions = trackEmissions(user1Derived.state$);

      const user2State$ = new Subject<string>();
      const user2Derived = provider.get(user2State$, deriveDefinition, deps);
      const user2Emissions = trackEmissions(user2Derived.state$);

      user1State$.next("2015-12-30");
      user2State$.next("2020-12-29");
      await awaitAsync();

      expect(user1Emissions).toEqual([new Date("2015-12-30")]);
      expect(user2Emissions).toEqual([new Date("2020-12-29")]);
    });
  });
});
