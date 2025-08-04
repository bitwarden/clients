/**
 * need to update test environment so trackEmissions works appropriately
 * @jest-environment ../shared/test.environment.ts
 */
import { any, mock } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, of, timeout } from "rxjs";
import { Jsonify } from "type-fest";

import { awaitAsync, trackEmissions } from "@bitwarden/core-test-utils";
import { LogService } from "@bitwarden/logging";
import { StorageServiceProvider } from "@bitwarden/storage-core";
import { FakeStorageService } from "@bitwarden/storage-test-utils";
import { UserId } from "@bitwarden/user-core";

import { StateDefinition } from "../state-definition";
import { StateEventRegistrarService } from "../state-event-registrar.service";
import { UserKeyDefinition } from "../user-key-definition";

import { DefaultActiveUserState } from "./default-active-user-state";
import { DefaultSingleUserStateProvider } from "./default-single-user-state.provider";

class TestState {
  date: Date;
  array: string[];

  static fromJSON(jsonState: Jsonify<TestState>) {
    if (jsonState == null) {
      return null;
    }

    return Object.assign(new TestState(), jsonState, {
      date: new Date(jsonState.date),
    });
  }
}

const testStateDefinition = new StateDefinition("fake", "disk");
const cleanupDelayMs = 15;
const testKeyDefinition = new UserKeyDefinition<TestState>(testStateDefinition, "fake", {
  deserializer: TestState.fromJSON,
  cleanupDelayMs,
  clearOn: [],
});

describe("DefaultActiveUserState", () => {
  let diskStorageService: FakeStorageService;
  const storageServiceProvider = mock<StorageServiceProvider>();
  const stateEventRegistrarService = mock<StateEventRegistrarService>();
  const logService = mock<LogService>();
  let activeAccountSubject: BehaviorSubject<UserId | null>;

  let singleUserStateProvider: DefaultSingleUserStateProvider;

  let userState: DefaultActiveUserState<TestState>;

  beforeEach(() => {
    diskStorageService = new FakeStorageService();
    storageServiceProvider.get.mockReturnValue(["disk", diskStorageService]);

    singleUserStateProvider = new DefaultSingleUserStateProvider(
      storageServiceProvider,
      stateEventRegistrarService,
      logService,
    );

    activeAccountSubject = new BehaviorSubject<UserId | null>(null);

    userState = new DefaultActiveUserState(
      testKeyDefinition,
      activeAccountSubject.asObservable(),
      singleUserStateProvider,
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  const makeUserId = (id: string) => {
    return id != null ? (`00000000-0000-1000-a000-00000000000${id}` as UserId) : undefined;
  };

  const changeActiveUser = async (id: string) => {
    const userId = makeUserId(id);
    activeAccountSubject.next(userId);
    await awaitAsync();
  };

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("emits updates for each user switch and update", async () => {
    const user1 = "user_00000000-0000-1000-a000-000000000001_fake_fake";
    const user2 = "user_00000000-0000-1000-a000-000000000002_fake_fake";
    const state1 = {
      date: new Date(2021, 0),
      array: ["user1"],
    };
    const state2 = {
      date: new Date(2022, 0),
      array: ["user2"],
    };
    const initialState: Record<string, TestState> = {};
    initialState[user1] = state1;
    initialState[user2] = state2;
    diskStorageService.internalUpdateStore(initialState);

    const emissions = trackEmissions(userState.state$);

    // User signs in
    await changeActiveUser("1");

    // Service does an update
    const updatedState = {
      date: new Date(2023, 0),
      array: ["user1-update"],
    };
    await userState.update(() => updatedState);
    await awaitAsync();

    // Emulate an account switch
    await changeActiveUser("2");

    // #1 initial state from user1
    // #2 updated state for user1
    // #3 switched state to initial state for user2
    expect(emissions).toEqual([state1, updatedState, state2]);

    // Should be called 4 time to get state, update state for user, emitting update, and switching users
    expect(diskStorageService.mock.get).toHaveBeenCalledTimes(4);
    // Initial subscribe to state$
    expect(diskStorageService.mock.get).toHaveBeenNthCalledWith(
      1,
      "user_00000000-0000-1000-a000-000000000001_fake_fake",
      any(), // options
    );
    // The updating of state for user1
    expect(diskStorageService.mock.get).toHaveBeenNthCalledWith(
      2,
      "user_00000000-0000-1000-a000-000000000001_fake_fake",
      any(), // options
    );
    // The emission from being actively subscribed to user1
    expect(diskStorageService.mock.get).toHaveBeenNthCalledWith(
      3,
      "user_00000000-0000-1000-a000-000000000001_fake_fake",
      any(), // options
    );
    // Switch to user2
    expect(diskStorageService.mock.get).toHaveBeenNthCalledWith(
      4,
      "user_00000000-0000-1000-a000-000000000002_fake_fake",
      any(), // options
    );
    // Should only have saved data for the first user
    expect(diskStorageService.mock.save).toHaveBeenCalledTimes(1);
    expect(diskStorageService.mock.save).toHaveBeenNthCalledWith(
      1,
      "user_00000000-0000-1000-a000-000000000001_fake_fake",
      updatedState,
      any(), // options
    );
  });

  it("will not emit any value if there isn't an active user", async () => {
    let resolvedValue: TestState | undefined = undefined;
    let rejectedError: Error | undefined = undefined;

    const promise = firstValueFrom(userState.state$.pipe(timeout(20)))
      .then((value) => {
        resolvedValue = value;
      })
      .catch((err) => {
        rejectedError = err;
      });
    await promise;

    expect(diskStorageService.mock.get).not.toHaveBeenCalled();

    expect(resolvedValue).toBe(undefined);
    expect(rejectedError).toBeTruthy();
    expect(rejectedError.message).toBe("Timeout has occurred");
  });

  it("will emit value for a new active user after subscription started", async () => {
    let resolvedValue: TestState | undefined = undefined;
    let rejectedError: Error | undefined = undefined;

    diskStorageService.internalUpdateStore({
      "user_00000000-0000-1000-a000-000000000001_fake_fake": {
        date: new Date(2020, 0),
        array: ["testValue"],
      } as TestState,
    });

    const promise = firstValueFrom(userState.state$.pipe(timeout(20)))
      .then((value) => {
        resolvedValue = value;
      })
      .catch((err) => {
        rejectedError = err;
      });
    await changeActiveUser("1");
    await promise;

    expect(diskStorageService.mock.get).toHaveBeenCalledTimes(1);

    expect(resolvedValue).toBeTruthy();
    expect(resolvedValue.array).toHaveLength(1);
    expect(resolvedValue.date.getFullYear()).toBe(2020);
    expect(rejectedError).toBeFalsy();
  });

  it("should not emit a previous users value if that user is no longer active", async () => {
    const user1Data: Jsonify<TestState> = {
      date: "2020-09-21T13:14:17.648Z",
      // NOTE: `as any` is here until we migrate to Nx: https://bitwarden.atlassian.net/browse/PM-6493
      array: ["value"] as any,
    };
    const user2Data: Jsonify<TestState> = {
      date: "2020-09-21T13:14:17.648Z",
      array: [],
    };
    diskStorageService.internalUpdateStore({
      "user_00000000-0000-1000-a000-000000000001_fake_fake": user1Data,
      "user_00000000-0000-1000-a000-000000000002_fake_fake": user2Data,
    });

    // This starts one subscription on the observable for tracking emissions throughout
    // the whole test.
    const emissions = trackEmissions(userState.state$);

    // Change to a user with data
    await changeActiveUser("1");

    // This should always return a value right await
    const value = await firstValueFrom(
      userState.state$.pipe(
        timeout({
          first: 20,
          with: () => {
            throw new Error("Did not emit data from newly active user.");
          },
        }),
      ),
    );
    expect(value).toEqual(user1Data);

    // Make it such that there is no active user
    await changeActiveUser(undefined);

    let resolvedValue: TestState | undefined = undefined;
    let rejectedError: Error | undefined = undefined;

    // Even if the observable has previously emitted a value it shouldn't have
    // a value for the user subscribing to it because there isn't an active user
    // to get data for.
    await firstValueFrom(userState.state$.pipe(timeout(20)))
      .then((value) => {
        resolvedValue = value;
      })
      .catch((err) => {
        rejectedError = err;
      });

    expect(resolvedValue).toBeUndefined();
    expect(rejectedError).not.toBeUndefined();
    expect(rejectedError.message).toBe("Timeout has occurred");

    // We need to figure out if something should be emitted
    // when there becomes no active user, if we don't want that to emit
    // this value is correct.
    expect(emissions).toEqual([user1Data]);
  });

  it("should not emit twice if there are two listeners", async () => {
    await changeActiveUser("1");
    const emissions = trackEmissions(userState.state$);
    const emissions2 = trackEmissions(userState.state$);
    await awaitAsync();

    expect(emissions).toEqual([
      null, // Initial value
    ]);
    expect(emissions2).toEqual([
      null, // Initial value
    ]);
  });

  describe("update", () => {
    const newData = { date: new Date(), array: ["test"] };
    beforeEach(async () => {
      await changeActiveUser("1");
    });

    it("should save on update", async () => {
      const [setUserId, result] = await userState.update((state, dependencies) => {
        return newData;
      });

      expect(diskStorageService.mock.save).toHaveBeenCalledTimes(1);
      expect(result).toEqual(newData);
      expect(setUserId).toEqual("00000000-0000-1000-a000-000000000001");
    });

    it("should emit once per update", async () => {
      const emissions = trackEmissions(userState.state$);
      await awaitAsync(); // Need to await for the initial value to be emitted

      await userState.update((state, dependencies) => {
        return newData;
      });
      await awaitAsync();

      expect(emissions).toEqual([
        null, // initial value
        newData,
      ]);
    });

    it("should provide combined dependencies", async () => {
      const emissions = trackEmissions(userState.state$);
      await awaitAsync(); // Need to await for the initial value to be emitted

      const combinedDependencies = { date: new Date() };

      await userState.update(
        (state, dependencies) => {
          expect(dependencies).toEqual(combinedDependencies);
          return newData;
        },
        {
          combineLatestWith: of(combinedDependencies),
        },
      );
      await awaitAsync();

      expect(emissions).toEqual([
        null, // initial value
        newData,
      ]);
    });

    it("should not update if shouldUpdate returns false", async () => {
      const emissions = trackEmissions(userState.state$);
      await awaitAsync(); // Need to await for the initial value to be emitted

      const [userIdResult, result] = await userState.update(
        (state, dependencies) => {
          return newData;
        },
        {
          shouldUpdate: () => false,
        },
      );

      await awaitAsync();

      expect(diskStorageService.mock.save).not.toHaveBeenCalled();
      expect(userIdResult).toEqual("00000000-0000-1000-a000-000000000001");
      expect(result).toBeNull();
      expect(emissions).toEqual([null]);
    });

    it("should provide the current state to the update callback", async () => {
      const emissions = trackEmissions(userState.state$);
      await awaitAsync(); // Need to await for the initial value to be emitted

      // Seed with interesting data
      const initialData = { date: new Date(2020, 0), array: ["value1", "value2"] };
      await userState.update((state, dependencies) => {
        return initialData;
      });

      await awaitAsync();

      await userState.update((state, dependencies) => {
        expect(state).toEqual(initialData);
        return newData;
      });

      await awaitAsync();

      expect(emissions).toEqual([
        null, // Initial value
        initialData,
        newData,
      ]);
    });

    it("should throw on an attempted update when there is no active user", async () => {
      await changeActiveUser(undefined);

      await expect(async () => await userState.update(() => null)).rejects.toThrow(
        "No active user at this time.",
      );
    });

    it("should throw on an attempted update where there is no active user even if there used to be one", async () => {
      // Arrange
      diskStorageService.internalUpdateStore({
        "user_00000000-0000-1000-a000-000000000001_fake_fake": {
          date: new Date(2019, 1),
          array: [],
        },
      });

      const [userId, state] = await firstValueFrom(userState.combinedState$);
      expect(userId).toBe("00000000-0000-1000-a000-000000000001");
      expect(state.date.getUTCFullYear()).toBe(2019);

      await changeActiveUser(undefined);
      // Act

      await expect(async () => await userState.update(() => null)).rejects.toThrow(
        "No active user at this time.",
      );
    });

    it.each([null, undefined])(
      "should register user key definition when state transitions from null-ish (%s) to non-null",
      async (startingValue: TestState | null) => {
        diskStorageService.internalUpdateStore({
          "user_00000000-0000-1000-a000-000000000001_fake_fake": startingValue,
        });

        await userState.update(() => ({ array: ["one"], date: new Date() }));

        expect(stateEventRegistrarService.registerEvents).toHaveBeenCalledWith(testKeyDefinition);
      },
    );

    it("should not register user key definition when state has preexisting value", async () => {
      diskStorageService.internalUpdateStore({
        "user_00000000-0000-1000-a000-000000000001_fake_fake": {
          date: new Date(2019, 1),
          array: [],
        },
      });

      await userState.update(() => ({ array: ["one"], date: new Date() }));

      expect(stateEventRegistrarService.registerEvents).not.toHaveBeenCalled();
    });

    it.each([null, undefined])(
      "should not register user key definition when setting value to null-ish (%s) value",
      async (updatedValue: TestState | null) => {
        diskStorageService.internalUpdateStore({
          "user_00000000-0000-1000-a000-000000000001_fake_fake": {
            date: new Date(2019, 1),
            array: [],
          },
        });

        await userState.update(() => updatedValue);

        expect(stateEventRegistrarService.registerEvents).not.toHaveBeenCalled();
      },
    );
  });

  describe("update races", () => {
    const newData = { date: new Date(), array: ["test"] };
    const userId = makeUserId("1");

    beforeEach(async () => {
      await changeActiveUser("1");
      await awaitAsync();
    });

    test("subscriptions during an update should receive the current and latest", async () => {
      const oldData = { date: new Date(2019, 1, 1), array: ["oldValue1"] };
      await userState.update(() => {
        return oldData;
      });
      const initialData = { date: new Date(2020, 1, 1), array: ["value1", "value2"] };
      await userState.update(() => {
        return initialData;
      });

      await awaitAsync();

      const emissions = trackEmissions(userState.state$);
      await awaitAsync();
      expect(emissions).toEqual([initialData]);

      let emissions2: TestState[];
      const originalSave = diskStorageService.save.bind(diskStorageService);
      diskStorageService.save = jest.fn().mockImplementation(async (key: string, obj: any) => {
        emissions2 = trackEmissions(userState.state$);
        await originalSave(key, obj);
      });

      const [userIdResult, val] = await userState.update(() => {
        return newData;
      });

      await awaitAsync(10);

      expect(userIdResult).toEqual(userId);
      expect(val).toEqual(newData);
      expect(emissions).toEqual([initialData, newData]);
      expect(emissions2).toEqual([initialData, newData]);
    });

    test("subscription during an aborted update should receive the last value", async () => {
      // Seed with interesting data
      const initialData = { date: new Date(2020, 1, 1), array: ["value1", "value2"] };
      await userState.update(() => {
        return initialData;
      });

      await awaitAsync();

      const emissions = trackEmissions(userState.state$);
      await awaitAsync();
      expect(emissions).toEqual([initialData]);

      let emissions2: TestState[];
      const [userIdResult, val] = await userState.update(
        (state) => {
          return newData;
        },
        {
          shouldUpdate: () => {
            emissions2 = trackEmissions(userState.state$);
            return false;
          },
        },
      );

      await awaitAsync();

      expect(userIdResult).toEqual(userId);
      expect(val).toEqual(initialData);
      expect(emissions).toEqual([initialData]);

      expect(emissions2).toEqual([initialData]);
    });

    test("updates should wait until previous update is complete", async () => {
      trackEmissions(userState.state$);
      await awaitAsync(); // storage updates are behind a promise

      const originalSave = diskStorageService.save.bind(diskStorageService);
      diskStorageService.save = jest
        .fn()
        .mockImplementationOnce(async (key: string, obj: any) => {
          let resolved = false;
          await Promise.race([
            userState.update(() => {
              // deadlocks
              resolved = true;
              return newData;
            }),
            awaitAsync(100), // limit test to 100ms
          ]);
          expect(resolved).toBe(false);
        })
        .mockImplementation((...args) => {
          return originalSave(...args);
        });

      await userState.update(() => {
        return newData;
      });
    });

    test("updates with FAKE_DEFAULT initial value should resolve correctly", async () => {
      expect(diskStorageService["updatesSubject"]["observers"]).toHaveLength(0);
      const [userIdResult, val] = await userState.update((state) => {
        return newData;
      });

      expect(userIdResult).toEqual(userId);
      expect(val).toEqual(newData);
      const call = diskStorageService.mock.save.mock.calls[0];
      expect(call[0]).toEqual(`user_${userId}_fake_fake`);
      expect(call[1]).toEqual(newData);
    });

    it("does not await updates if the active user changes", async () => {
      const initialUserId = activeAccountSubject.value;
      expect(initialUserId).toBe(userId);
      trackEmissions(userState.state$);
      await awaitAsync(); // storage updates are behind a promise

      const originalSave = diskStorageService.save.bind(diskStorageService);
      diskStorageService.save = jest
        .fn()
        .mockImplementationOnce(async (key: string, obj: any) => {
          let resolved = false;
          await changeActiveUser("2");
          await Promise.race([
            userState.update(() => {
              // should not deadlock because we updated the user
              resolved = true;
              return newData;
            }),
            awaitAsync(100), // limit test to 100ms
          ]);
          expect(resolved).toBe(true);
        })
        .mockImplementation((...args) => {
          return originalSave(...args);
        });

      await userState.update(() => {
        return newData;
      });
    });

    it("stores updates for users in the correct place when active user changes mid-update", async () => {
      trackEmissions(userState.state$);
      await awaitAsync(); // storage updates are behind a promise

      const user2Data = { date: new Date(), array: ["user 2 data"] };

      const originalSave = diskStorageService.save.bind(diskStorageService);
      diskStorageService.save = jest
        .fn()
        .mockImplementationOnce(async (key: string, obj: any) => {
          let resolved = false;
          await changeActiveUser("2");
          await Promise.race([
            userState.update(() => {
              // should not deadlock because we updated the user
              resolved = true;
              return user2Data;
            }),
            awaitAsync(100), // limit test to 100ms
          ]);
          expect(resolved).toBe(true);
          await originalSave(key, obj);
        })
        .mockImplementation((...args) => {
          return originalSave(...args);
        });

      await userState.update(() => {
        return newData;
      });
      await awaitAsync();

      expect(diskStorageService.mock.save).toHaveBeenCalledTimes(2);
      const innerCall = diskStorageService.mock.save.mock.calls[0];
      expect(innerCall[0]).toEqual(`user_${makeUserId("2")}_fake_fake`);
      expect(innerCall[1]).toEqual(user2Data);
      const outerCall = diskStorageService.mock.save.mock.calls[1];
      expect(outerCall[0]).toEqual(`user_${makeUserId("1")}_fake_fake`);
      expect(outerCall[1]).toEqual(newData);
    });
  });

  describe("cleanup", () => {
    const newData = { date: new Date(), array: ["test"] };
    const userId = makeUserId("1");
    let userKey: string;

    beforeEach(async () => {
      await changeActiveUser("1");
      userKey = testKeyDefinition.buildKey(userId);
    });

    function assertClean() {
      expect(activeAccountSubject["observers"]).toHaveLength(0);
      expect(diskStorageService["updatesSubject"]["observers"]).toHaveLength(0);
    }

    it("should cleanup after last subscriber", async () => {
      const subscription = userState.state$.subscribe();
      await awaitAsync(); // storage updates are behind a promise

      subscription.unsubscribe();
      expect(diskStorageService["updatesSubject"]["observers"]).toHaveLength(1);
      // Wait for cleanup
      await awaitAsync(cleanupDelayMs * 2);

      assertClean();
    });

    it("should not cleanup if there are still subscribers", async () => {
      const subscription1 = userState.state$.subscribe();
      const sub2Emissions: TestState[] = [];
      const subscription2 = userState.state$.subscribe((v) => sub2Emissions.push(v));
      await awaitAsync(); // storage updates are behind a promise

      subscription1.unsubscribe();

      // Wait for cleanup
      await awaitAsync(cleanupDelayMs * 2);

      expect(diskStorageService["updatesSubject"]["observers"]).toHaveLength(1);

      // Still be listening to storage updates
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      diskStorageService.save(userKey, newData);
      await awaitAsync(); // storage updates are behind a promise
      expect(sub2Emissions).toEqual([null, newData]);

      subscription2.unsubscribe();
      // Wait for cleanup
      await awaitAsync(cleanupDelayMs * 2);

      assertClean();
    });

    it("can re-initialize after cleanup", async () => {
      const subscription = userState.state$.subscribe();
      await awaitAsync();

      subscription.unsubscribe();
      // Wait for cleanup
      await awaitAsync(cleanupDelayMs * 2);

      const emissions = trackEmissions(userState.state$);
      await awaitAsync();

      await diskStorageService.save(userKey, newData);
      await awaitAsync();

      expect(emissions).toEqual([null, newData]);
    });

    it("should not cleanup if a subscriber joins during the cleanup delay", async () => {
      const subscription = userState.state$.subscribe();
      await awaitAsync();

      await diskStorageService.save(userKey, newData);
      await awaitAsync();

      subscription.unsubscribe();
      // Do not wait long enough for cleanup
      await awaitAsync(cleanupDelayMs / 2);

      const state = await firstValueFrom(userState.state$);

      expect(state).toEqual(newData); // digging in to check that it hasn't been cleared

      // Should be called once for the initial subscription and once from the save
      // but should NOT be called for the second subscription from the `firstValueFrom`
      expect(diskStorageService.mock.get).toHaveBeenCalledTimes(2);
    });

    it("state$ observables are durable to cleanup", async () => {
      const observable = userState.state$;
      let subscription = observable.subscribe();

      await diskStorageService.save(userKey, newData);
      await awaitAsync();

      subscription.unsubscribe();
      // Wait for cleanup
      await awaitAsync(cleanupDelayMs * 2);

      subscription = observable.subscribe();
      await diskStorageService.save(userKey, newData);
      await awaitAsync();

      expect(await firstValueFrom(observable)).toEqual(newData);
    });
  });
});
