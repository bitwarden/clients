import { Lazy } from "./lazy";

describe("Lazy", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("async", () => {
    let factory: jest.Mock<Promise<number>>;
    let lazy: Lazy<Promise<number>>;

    beforeEach(() => {
      factory = jest.fn();
      lazy = new Lazy(factory);
    });

    describe("get", () => {
      it("should call the factory once", async () => {
        await lazy.get();
        await lazy.get();

        expect(factory).toHaveBeenCalledTimes(1);
      });

      it("should return the value from the factory", async () => {
        factory.mockResolvedValue(42);

        const value = await lazy.get();

        expect(value).toBe(42);
      });
    });

    describe("factory throws", () => {
      it("should throw the error", async () => {
        factory.mockRejectedValue(new Error("factory error"));

        await expect(lazy.get()).rejects.toThrow("factory error");
      });
    });

    describe("factory returns undefined", () => {
      it("should return undefined", async () => {
        factory.mockResolvedValue(undefined);

        const value = await lazy.get();

        expect(value).toBeUndefined();
      });
    });

    describe("factory returns null", () => {
      it("should return null", async () => {
        factory.mockResolvedValue(null);

        const value = await lazy.get();

        expect(value).toBeNull();
      });
    });
  });

  describe("sync", () => {
    const syncFactory = jest.fn();
    let lazy: Lazy<number>;

    beforeEach(() => {
      syncFactory.mockReturnValue(42);
      lazy = new Lazy<number>(syncFactory);
    });

    it("should return the value from the factory", () => {
      const value = lazy.get();

      expect(value).toBe(42);
    });

    it("should call the factory once", () => {
      lazy.get();
      lazy.get();

      expect(syncFactory).toHaveBeenCalledTimes(1);
    });
  });
});
