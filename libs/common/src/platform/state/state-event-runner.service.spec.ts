import { mock } from "jest-mock-extended";

import { FakeGlobalStateProvider } from "../../../spec";
import { UserId } from "../../types/guid";
import { AbstractStorageService, ObservableStorageService } from "../abstractions/storage.service";
import { StorageServiceProvider } from "../services/storage-service.provider";

import { STATE_LOCK_EVENT } from "./state-event-registrar.service";
import { StateEventRunnerService } from "./state-event-runner.service";

describe("EventRunnerService", () => {
  const fakeGlobalStateProvider = new FakeGlobalStateProvider();
  const lockState = fakeGlobalStateProvider.getFake(STATE_LOCK_EVENT);

  const storageServiceProvider = mock<StorageServiceProvider>();

  const sut = new StateEventRunnerService(fakeGlobalStateProvider, storageServiceProvider);

  describe("handleEvent", () => {
    it("does nothing if there are no events in state", async () => {
      const mockStorageService = mock<AbstractStorageService & ObservableStorageService>();
      storageServiceProvider.get.mockReturnValue(["disk", mockStorageService]);

      await sut.handleEvent("lock", "bff09d3c-762a-4551-9275-45b137b2f073" as UserId);

      expect(lockState.nextMock).not.toHaveBeenCalled();
    });

    it("loops through and acts on all events", async () => {
      const mockDiskStorageService = mock<AbstractStorageService & ObservableStorageService>();
      const mockMemoryStorageService = mock<AbstractStorageService & ObservableStorageService>();

      lockState.stateSubject.next([
        {
          state: "fakeState1",
          key: "fakeKey1",
          location: "disk",
        },
        {
          state: "fakeState2",
          key: "fakeKey2",
          location: "memory",
        },
      ]);

      storageServiceProvider.get.mockImplementation((defaultLocation, overrides) => {
        if (defaultLocation === "disk") {
          return [defaultLocation, mockDiskStorageService];
        } else if (defaultLocation === "memory") {
          return [defaultLocation, mockMemoryStorageService];
        }
      });

      mockMemoryStorageService.get.mockResolvedValue("something");

      await sut.handleEvent("lock", "bff09d3c-762a-4551-9275-45b137b2f073" as UserId);

      expect(mockDiskStorageService.get).toHaveBeenCalledTimes(1);
      expect(mockDiskStorageService.get).toHaveBeenCalledWith(
        "user_bff09d3c-762a-4551-9275-45b137b2f073_fakeState1_fakeKey1",
      );
      expect(mockMemoryStorageService.get).toHaveBeenCalledTimes(1);
      expect(mockMemoryStorageService.get).toHaveBeenCalledWith(
        "user_bff09d3c-762a-4551-9275-45b137b2f073_fakeState2_fakeKey2",
      );
      expect(mockMemoryStorageService.remove).toHaveBeenCalledTimes(1);
    });
  });
});
