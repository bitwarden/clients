import { mock } from "jest-mock-extended";

import { StateDefinition, UserKeyDefinition } from "@bitwarden/state";
import { FakeGlobalStateProvider } from "@bitwarden/state-test-utils";
import {
  AbstractStorageService,
  ObservableStorageService,
  StorageServiceProvider,
} from "@bitwarden/storage-core";

import {
  DefaultStateEventRegistrarService,
  STATE_LOCK_EVENT,
} from "./default-state-event-registrar.service";

describe("StateEventRegistrarService", () => {
  const globalStateProvider = new FakeGlobalStateProvider();
  const lockState = globalStateProvider.getFake(STATE_LOCK_EVENT);
  const storageServiceProvider = mock<StorageServiceProvider>();

  const sut = new DefaultStateEventRegistrarService(globalStateProvider, storageServiceProvider);

  describe("registerEvents", () => {
    const fakeKeyDefinition = new UserKeyDefinition<boolean>(
      new StateDefinition("fakeState", "disk"),
      "fakeKey",
      {
        deserializer: (s) => s,
        clearOn: ["lock"],
      },
    );

    beforeEach(() => {
      jest.resetAllMocks();
    });

    it("adds event on null storage", async () => {
      storageServiceProvider.get.mockReturnValue([
        "disk",
        mock<AbstractStorageService & ObservableStorageService>(),
      ]);

      await sut.registerEvents(fakeKeyDefinition);

      expect(lockState.nextMock).toHaveBeenCalledWith([
        {
          key: "fakeKey",
          location: "disk",
          state: "fakeState",
        },
      ]);
    });

    it("adds event on empty array in storage", async () => {
      lockState.stateSubject.next([]);
      storageServiceProvider.get.mockReturnValue([
        "disk",
        mock<AbstractStorageService & ObservableStorageService>(),
      ]);

      await sut.registerEvents(fakeKeyDefinition);

      expect(lockState.nextMock).toHaveBeenCalledWith([
        {
          key: "fakeKey",
          location: "disk",
          state: "fakeState",
        },
      ]);
    });

    it("doesn't add a duplicate", async () => {
      lockState.stateSubject.next([
        {
          key: "fakeKey",
          location: "disk",
          state: "fakeState",
        },
      ]);
      storageServiceProvider.get.mockReturnValue([
        "disk",
        mock<AbstractStorageService & ObservableStorageService>(),
      ]);

      await sut.registerEvents(fakeKeyDefinition);

      expect(lockState.nextMock).not.toHaveBeenCalled();
    });
  });
});
