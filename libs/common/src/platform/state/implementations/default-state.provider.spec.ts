/**
 * need to update test environment so structuredClone works appropriately
 * @jest-environment ../shared/test.environment.ts
 */
import { Observable, of } from "rxjs";

import { UserId } from "@bitwarden/user-core";

import { awaitAsync, trackEmissions } from "../../../../spec";
import {
  FakeActiveUserAccessor,
  FakeActiveUserStateProvider,
  FakeDerivedStateProvider,
  FakeGlobalStateProvider,
  FakeSingleUserStateProvider,
} from "../../../../spec/fake-state-provider";
import { DeriveDefinition } from "../derive-definition";
import { KeyDefinition } from "../key-definition";
import { StateDefinition } from "../state-definition";
import { UserKeyDefinition } from "../user-key-definition";

import { DefaultStateProvider } from "./default-state.provider";

describe("DefaultStateProvider", () => {
  let sut: DefaultStateProvider;
  let activeUserStateProvider: FakeActiveUserStateProvider;
  let singleUserStateProvider: FakeSingleUserStateProvider;
  let globalStateProvider: FakeGlobalStateProvider;
  let derivedStateProvider: FakeDerivedStateProvider;
  let activeAccountAccessor: FakeActiveUserAccessor;
  const userId = "fakeUserId" as UserId;

  beforeEach(() => {
    activeAccountAccessor = new FakeActiveUserAccessor(userId);
    activeUserStateProvider = new FakeActiveUserStateProvider(activeAccountAccessor);
    singleUserStateProvider = new FakeSingleUserStateProvider();
    globalStateProvider = new FakeGlobalStateProvider();
    derivedStateProvider = new FakeDerivedStateProvider();
    sut = new DefaultStateProvider(
      activeUserStateProvider,
      singleUserStateProvider,
      globalStateProvider,
      derivedStateProvider,
    );
  });

  describe("activeUserId$", () => {
    it("should track the active User id from active user state provider", () => {
      expect(sut.activeUserId$).toBe(activeUserStateProvider.activeUserId$);
    });
  });

  describe.each([
    [
      "getUserState$",
      (keyDefinition: UserKeyDefinition<string>, userId?: UserId) =>
        sut.getUserState$(keyDefinition, userId),
    ],
    [
      "getUserStateOrDefault$",
      (keyDefinition: UserKeyDefinition<string>, userId?: UserId) =>
        sut.getUserStateOrDefault$(keyDefinition, { userId: userId }),
    ],
  ])(
    "Shared behavior for %s",
    (
      _testName: string,
      methodUnderTest: (
        keyDefinition: UserKeyDefinition<string>,
        userId?: UserId,
      ) => Observable<string>,
    ) => {
      const keyDefinition = new UserKeyDefinition<string>(
        new StateDefinition("test", "disk"),
        "test",
        {
          deserializer: (s) => s,
          clearOn: [],
        },
      );

      it("should follow the specified user if userId is provided", async () => {
        const state = singleUserStateProvider.getFake(userId, keyDefinition);
        state.nextState("value");
        const emissions = trackEmissions(methodUnderTest(keyDefinition, userId));

        state.nextState("value2");
        state.nextState("value3");

        expect(emissions).toEqual(["value", "value2", "value3"]);
      });

      it("should follow the current active user if no userId is provided", async () => {
        activeAccountAccessor.switch(userId);
        const state = singleUserStateProvider.getFake(userId, keyDefinition);
        state.nextState("value");
        const emissions = trackEmissions(methodUnderTest(keyDefinition));

        state.nextState("value2");
        state.nextState("value3");

        expect(emissions).toEqual(["value", "value2", "value3"]);
      });

      it("should continue to follow the state of the user that was active when called, even if active user changes", async () => {
        const state = singleUserStateProvider.getFake(userId, keyDefinition);
        state.nextState("value");
        const emissions = trackEmissions(methodUnderTest(keyDefinition));

        activeAccountAccessor.switch("newUserId" as UserId);
        const newUserEmissions = trackEmissions(sut.getUserState$(keyDefinition));
        state.nextState("value2");
        state.nextState("value3");

        expect(emissions).toEqual(["value", "value2", "value3"]);
        expect(newUserEmissions).toEqual([null]);
      });
    },
  );

  describe("getUserState$", () => {
    const keyDefinition = new UserKeyDefinition<string>(
      new StateDefinition("test", "disk"),
      "test",
      {
        deserializer: (s) => s,
        clearOn: [],
      },
    );

    it("should not emit any values until a truthy user id is supplied", async () => {
      activeAccountAccessor.switch(null);
      const state = singleUserStateProvider.getFake(userId, keyDefinition);
      state.nextState("value");

      const emissions = trackEmissions(sut.getUserState$(keyDefinition));

      await awaitAsync();

      expect(emissions).toHaveLength(0);

      activeAccountAccessor.switch(userId);

      await awaitAsync();

      expect(emissions).toEqual(["value"]);
    });
  });

  describe("getUserStateOrDefault$", () => {
    const keyDefinition = new UserKeyDefinition<string>(
      new StateDefinition("test", "disk"),
      "test",
      {
        deserializer: (s) => s,
        clearOn: [],
      },
    );

    it("should emit default value if no userId supplied and first active user id emission in falsy", async () => {
      activeAccountAccessor.switch(null);

      const emissions = trackEmissions(
        sut.getUserStateOrDefault$(keyDefinition, {
          userId: undefined,
          defaultValue: "I'm default!",
        }),
      );

      expect(emissions).toEqual(["I'm default!"]);
    });
  });

  describe("setUserState", () => {
    const keyDefinition = new UserKeyDefinition<string>(
      new StateDefinition("test", "disk"),
      "test",
      {
        deserializer: (s) => s,
        clearOn: [],
      },
    );

    it("should set the state for the active user if no userId is provided", async () => {
      const value = "value";
      await sut.setUserState(keyDefinition, value);
      const state = activeUserStateProvider.getFake(keyDefinition);
      expect(state.nextMock).toHaveBeenCalledWith([expect.any(String), value]);
    });

    it("should not set state for a single user if no userId is provided", async () => {
      const value = "value";
      await sut.setUserState(keyDefinition, value);
      const state = singleUserStateProvider.getFake(userId, keyDefinition);
      expect(state.nextMock).not.toHaveBeenCalled();
    });

    it("should set the state for the provided userId", async () => {
      const value = "value";
      await sut.setUserState(keyDefinition, value, userId);
      const state = singleUserStateProvider.getFake(userId, keyDefinition);
      expect(state.nextMock).toHaveBeenCalledWith(value);
    });

    it("should not set the active user state if userId is provided", async () => {
      const value = "value";
      await sut.setUserState(keyDefinition, value, userId);
      const state = activeUserStateProvider.getFake(keyDefinition);
      expect(state.nextMock).not.toHaveBeenCalled();
    });
  });

  it("should bind the activeUserStateProvider", () => {
    const keyDefinition = new UserKeyDefinition(new StateDefinition("test", "disk"), "test", {
      deserializer: () => null,
      clearOn: [],
    });
    const existing = activeUserStateProvider.get(keyDefinition);
    const actual = sut.getActive(keyDefinition);
    expect(actual).toBe(existing);
  });

  it("should bind the singleUserStateProvider", () => {
    const userId = "user" as UserId;
    const keyDefinition = new UserKeyDefinition(new StateDefinition("test", "disk"), "test", {
      deserializer: () => null,
      clearOn: [],
    });
    const existing = singleUserStateProvider.get(userId, keyDefinition);
    const actual = sut.getUser(userId, keyDefinition);
    expect(actual).toBe(existing);
  });

  it("should bind the globalStateProvider", () => {
    const keyDefinition = new KeyDefinition(new StateDefinition("test", "disk"), "test", {
      deserializer: () => null,
    });
    const existing = globalStateProvider.get(keyDefinition);
    const actual = sut.getGlobal(keyDefinition);
    expect(actual).toBe(existing);
  });

  it("should bind the derivedStateProvider", () => {
    const derivedDefinition = new DeriveDefinition(new StateDefinition("test", "disk"), "test", {
      derive: () => null,
      deserializer: () => null,
    });
    const parentState$ = of(null);
    const existing = derivedStateProvider.get(parentState$, derivedDefinition, {});
    const actual = sut.getDerived(parentState$, derivedDefinition, {});
    expect(actual).toBe(existing);
  });
});
