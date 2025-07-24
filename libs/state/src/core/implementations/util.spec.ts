import { FakeStorageService } from "@bitwarden/storage-test-utils";

import { getStoredValue } from "./util";

describe("getStoredValue", () => {
  const key = "key";
  const deserializedValue = { value: 1 };
  const value = JSON.stringify(deserializedValue);
  const deserializer = (v: string) => JSON.parse(v);
  let storageService: FakeStorageService;

  beforeEach(() => {
    storageService = new FakeStorageService();
  });

  describe("when the storage service requires deserialization", () => {
    beforeEach(() => {
      storageService.internalUpdateValuesRequireDeserialization(true);
    });

    it("should deserialize", async () => {
      await storageService.save(key, value);

      const result = await getStoredValue(key, storageService, deserializer);

      expect(result).toEqual(deserializedValue);
    });
  });
  describe("when the storage service does not require deserialization", () => {
    beforeEach(() => {
      storageService.internalUpdateValuesRequireDeserialization(false);
    });

    it("should not deserialize", async () => {
      await storageService.save(key, value);

      const result = await getStoredValue(key, storageService, deserializer);

      expect(result).toEqual(value);
    });

    it("should convert undefined to null", async () => {
      await storageService.save(key, undefined);

      const result = await getStoredValue(key, storageService, deserializer);

      expect(result).toEqual(null);
    });
  });
});
