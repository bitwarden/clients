import { FakeStorageService } from "../../../../spec/fake-storage.service";

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
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      storageService.save(key, value);

      const result = await getStoredValue(key, storageService, deserializer);

      expect(result).toEqual(deserializedValue);
    });
  });
  describe("when the storage service does not require deserialization", () => {
    beforeEach(() => {
      storageService.internalUpdateValuesRequireDeserialization(false);
    });

    it("should not deserialize", async () => {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      storageService.save(key, value);

      const result = await getStoredValue(key, storageService, deserializer);

      expect(result).toEqual(value);
    });

    it("should convert undefined to null", async () => {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      storageService.save(key, undefined);

      const result = await getStoredValue(key, storageService, deserializer);

      expect(result).toEqual(null);
    });
  });
});
