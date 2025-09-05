import { mock } from "jest-mock-extended";

import { LogService } from "@bitwarden/logging";
import {
  KeyDefinition,
  StateDefinition,
  StateEventRegistrarService,
  UserKeyDefinition,
} from "@bitwarden/state";
import { FakeActiveUserAccessor } from "@bitwarden/state-test-utils";
import { StorageServiceProvider } from "@bitwarden/storage-core";
import { FakeStorageService } from "@bitwarden/storage-test-utils";
import { UserId } from "@bitwarden/user-core";

import { DefaultActiveUserState } from "./default-active-user-state";
import { DefaultActiveUserStateProvider } from "./default-active-user-state.provider";
import { DefaultGlobalState } from "./default-global-state";
import { DefaultGlobalStateProvider } from "./default-global-state.provider";
import { DefaultSingleUserState } from "./default-single-user-state";
import { DefaultSingleUserStateProvider } from "./default-single-user-state.provider";

describe("Specific State Providers", () => {
  const storageServiceProvider = mock<StorageServiceProvider>();
  const stateEventRegistrarService = mock<StateEventRegistrarService>();
  const logService = mock<LogService>();

  let singleSut: DefaultSingleUserStateProvider;
  let activeSut: DefaultActiveUserStateProvider;
  let globalSut: DefaultGlobalStateProvider;

  const fakeUser1 = "00000000-0000-1000-a000-000000000001" as UserId;

  beforeEach(() => {
    storageServiceProvider.get.mockImplementation((location) => {
      return [location, new FakeStorageService()];
    });

    singleSut = new DefaultSingleUserStateProvider(
      storageServiceProvider,
      stateEventRegistrarService,
      logService,
    );
    activeSut = new DefaultActiveUserStateProvider(new FakeActiveUserAccessor(null), singleSut);
    globalSut = new DefaultGlobalStateProvider(storageServiceProvider, logService);
  });

  const fakeDiskStateDefinition = new StateDefinition("fake", "disk");
  const fakeAlternateDiskStateDefinition = new StateDefinition("fakeAlternate", "disk");
  const fakeMemoryStateDefinition = new StateDefinition("fake", "memory");
  const makeKeyDefinition = (stateDefinition: StateDefinition, key: string) =>
    new KeyDefinition<boolean>(stateDefinition, key, {
      deserializer: (b) => b,
    });
  const makeUserKeyDefinition = (stateDefinition: StateDefinition, key: string) =>
    new UserKeyDefinition<boolean>(stateDefinition, key, {
      deserializer: (b) => b,
      clearOn: [],
    });
  const keyDefinitions = {
    disk: {
      keyDefinition: makeKeyDefinition(fakeDiskStateDefinition, "fake"),
      userKeyDefinition: makeUserKeyDefinition(fakeDiskStateDefinition, "fake"),
      altKeyDefinition: makeKeyDefinition(fakeDiskStateDefinition, "fakeAlternate"),
      altUserKeyDefinition: makeUserKeyDefinition(fakeDiskStateDefinition, "fakeAlternate"),
    },
    memory: {
      keyDefinition: makeKeyDefinition(fakeMemoryStateDefinition, "fake"),
      userKeyDefinition: makeUserKeyDefinition(fakeMemoryStateDefinition, "fake"),
    },
    alternateDisk: {
      keyDefinition: makeKeyDefinition(fakeAlternateDiskStateDefinition, "fake"),
      userKeyDefinition: makeUserKeyDefinition(fakeAlternateDiskStateDefinition, "fake"),
    },
  };

  describe("active provider", () => {
    it("returns a DefaultActiveUserState", () => {
      const state = activeSut.get(keyDefinitions.disk.userKeyDefinition);

      expect(state).toBeInstanceOf(DefaultActiveUserState);
    });

    it("returns different instances when the storage location differs", () => {
      const stateDisk = activeSut.get(keyDefinitions.disk.userKeyDefinition);
      const stateMemory = activeSut.get(keyDefinitions.memory.userKeyDefinition);
      expect(stateDisk).not.toStrictEqual(stateMemory);
    });

    it("returns different instances when the state name differs", () => {
      const state = activeSut.get(keyDefinitions.disk.userKeyDefinition);
      const stateAlt = activeSut.get(keyDefinitions.alternateDisk.userKeyDefinition);
      expect(state).not.toStrictEqual(stateAlt);
    });

    it("returns different instances when the key differs", () => {
      const state = activeSut.get(keyDefinitions.disk.userKeyDefinition);
      const stateAlt = activeSut.get(keyDefinitions.disk.altUserKeyDefinition);
      expect(state).not.toStrictEqual(stateAlt);
    });
  });

  describe("single provider", () => {
    it("returns a DefaultSingleUserState", () => {
      const state = singleSut.get(fakeUser1, keyDefinitions.disk.userKeyDefinition);

      expect(state).toBeInstanceOf(DefaultSingleUserState);
    });

    it("returns different instances when the storage location differs", () => {
      const stateDisk = singleSut.get(fakeUser1, keyDefinitions.disk.userKeyDefinition);
      const stateMemory = singleSut.get(fakeUser1, keyDefinitions.memory.userKeyDefinition);
      expect(stateDisk).not.toStrictEqual(stateMemory);
    });

    it("returns different instances when the state name differs", () => {
      const state = singleSut.get(fakeUser1, keyDefinitions.disk.userKeyDefinition);
      const stateAlt = singleSut.get(fakeUser1, keyDefinitions.alternateDisk.userKeyDefinition);
      expect(state).not.toStrictEqual(stateAlt);
    });

    it("returns different instances when the key differs", () => {
      const state = singleSut.get(fakeUser1, keyDefinitions.disk.userKeyDefinition);
      const stateAlt = singleSut.get(fakeUser1, keyDefinitions.disk.altUserKeyDefinition);
      expect(state).not.toStrictEqual(stateAlt);
    });

    const fakeUser2 = "00000000-0000-1000-a000-000000000002" as UserId;

    it("returns different instances when the user id differs", () => {
      const user1State = singleSut.get(fakeUser1, keyDefinitions.disk.userKeyDefinition);
      const user2State = singleSut.get(fakeUser2, keyDefinitions.disk.userKeyDefinition);
      expect(user1State).not.toStrictEqual(user2State);
    });

    it("returns an instance with the userId property corresponding to the user id passed in", () => {
      const userState = singleSut.get(fakeUser1, keyDefinitions.disk.userKeyDefinition);
      expect(userState.userId).toBe(fakeUser1);
    });

    it("returns cached instance on repeated request", () => {
      const stateFirst = singleSut.get(fakeUser1, keyDefinitions.disk.userKeyDefinition);
      const stateCached = singleSut.get(fakeUser1, keyDefinitions.disk.userKeyDefinition);
      expect(stateFirst).toStrictEqual(stateCached);
    });
  });

  describe("global provider", () => {
    it("returns a DefaultGlobalState", () => {
      const state = globalSut.get(keyDefinitions.disk.keyDefinition);

      expect(state).toBeInstanceOf(DefaultGlobalState);
    });

    it("returns different instances when the storage location differs", () => {
      const stateDisk = globalSut.get(keyDefinitions.disk.keyDefinition);
      const stateMemory = globalSut.get(keyDefinitions.memory.keyDefinition);
      expect(stateDisk).not.toStrictEqual(stateMemory);
    });

    it("returns different instances when the state name differs", () => {
      const state = globalSut.get(keyDefinitions.disk.keyDefinition);
      const stateAlt = globalSut.get(keyDefinitions.alternateDisk.keyDefinition);
      expect(state).not.toStrictEqual(stateAlt);
    });

    it("returns different instances when the key differs", () => {
      const state = globalSut.get(keyDefinitions.disk.keyDefinition);
      const stateAlt = globalSut.get(keyDefinitions.disk.altKeyDefinition);
      expect(state).not.toStrictEqual(stateAlt);
    });

    it("returns cached instance on repeated request", () => {
      const stateFirst = globalSut.get(keyDefinitions.disk.keyDefinition);
      const stateCached = globalSut.get(keyDefinitions.disk.keyDefinition);
      expect(stateFirst).toStrictEqual(stateCached);
    });
  });
});
