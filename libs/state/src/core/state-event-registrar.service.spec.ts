import { mock } from "jest-mock-extended";

import { FakeGlobalStateProvider } from "@bitwarden/state-test-utils";
import {
  AbstractStorageService,
  ObservableStorageService,
  StorageServiceProvider,
} from "@bitwarden/storage-core";

import { StateDefinition } from "./state-definition";
import { STATE_LOCK_EVENT, StateEventRegistrarService } from "./state-event-registrar.service";
import { UserKeyDefinition } from "./user-key-definition";

describe("StateEventRegistrarService", () => {
  const globalStateProvider = new FakeGlobalStateProvider();
  const lockState = globalStateProvider.getFake(STATE_LOCK_EVENT);
  const storageServiceProvider = mock<StorageServiceProvider>();

  const sut = new StateEventRegistrarService(globalStateProvider, storageServiceProvider);

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
