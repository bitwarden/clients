import { mock } from "jest-mock-extended";

import { StorageServiceProvider } from "./storage-service.provider";
import { StorageService, ObservableStorageService } from "./storage.service";

describe("StorageServiceProvider", () => {
  const mockDiskStorage = mock<StorageService & ObservableStorageService>();
  const mockMemoryStorage = mock<StorageService & ObservableStorageService>();

  const sut = new StorageServiceProvider(mockDiskStorage, mockMemoryStorage);

  describe("get", () => {
    it("gets disk service when default location is disk", () => {
      const [computedLocation, computedService] = sut.get("disk", {});

      expect(computedLocation).toBe("disk");
      expect(computedService).toStrictEqual(mockDiskStorage);
    });

    it("gets memory service when default location is memory", () => {
      const [computedLocation, computedService] = sut.get("memory", {});

      expect(computedLocation).toBe("memory");
      expect(computedService).toStrictEqual(mockMemoryStorage);
    });
  });
});
