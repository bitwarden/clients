import { SerializedMemoryStorageService } from "./serialized-memory-storage.service";

describe("SerializedMemoryStorageService", () => {
  let sut: SerializedMemoryStorageService;
  const key = "key";
  const value = { test: "value" };

  beforeEach(() => {
    sut = new SerializedMemoryStorageService();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("get", () => {
    it("should return null if the key does not exist", async () => {
      const result = await sut.get(key);
      expect(result).toBeNull();
    });

    it("should return the value if the key exists", async () => {
      await sut.save(key, value);
      const result = await sut.get(key);
      expect(result).toEqual(value);
    });

    it("should json parse stored values", async () => {
      sut["store"][key] = JSON.stringify({ test: "value" });
      const result = await sut.get(key);

      expect(result).toEqual({ test: "value" });
    });
  });

  describe("save", () => {
    it("should store the value as json string", async () => {
      const value = { test: "value" };
      await sut.save(key, value);

      expect(sut["store"][key]).toEqual(JSON.stringify(value));
    });
  });

  describe("remove", () => {
    it("should remove a value from store", async () => {
      await sut.save(key, value);
      await sut.remove(key);

      expect(Object.keys(sut["store"])).not.toContain(key);
    });
  });
});
