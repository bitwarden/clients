import { CachedBackend } from "./cached-backend";
import { StorageBackend } from "./storage-backend";

function createMockBackend(initial: Record<string, unknown> = {}): StorageBackend {
  let data = { ...initial };
  return {
    read: jest.fn(() => ({ ...data })),
    update: jest.fn((updater: (store: Record<string, unknown>) => Record<string, unknown>) => {
      data = updater(data);
    }),
    flush: jest.fn(() => {}),
  };
}

describe("CachedBackend", () => {
  let inner: StorageBackend;
  let sut: CachedBackend;

  beforeEach(() => {
    jest.useFakeTimers();
    inner = createMockBackend({ key1: "value1" });
    sut = new CachedBackend(inner);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("read", () => {
    it("should load data from inner backend during construction", () => {
      expect(inner.read).toHaveBeenCalledTimes(1);
      expect(sut.read()).toEqual({ key1: "value1" });
    });

    it("should return cached data on subsequent reads without calling inner backend again", () => {
      sut.read();
      sut.read();
      sut.read();

      expect(inner.read).toHaveBeenCalledTimes(1);
    });

    it("should return updated data immediately without waiting for flush", () => {
      sut.update((store) => ({ ...store, key1: "updated" }));

      expect(sut.read()).toEqual({ key1: "updated" });
      expect(inner.update).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("should flush to inner backend after debounce delay", async () => {
      sut.update((store) => ({ ...store, key1: "updated" }));

      expect(inner.update).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(200);

      expect(inner.update).toHaveBeenCalledTimes(1);
    });

    it("should coalesce rapid updates into a single flush", async () => {
      sut.update((store) => ({ ...store, key1: "first" }));
      await jest.advanceTimersByTimeAsync(100);

      sut.update((store) => ({ ...store, key1: "second" }));
      await jest.advanceTimersByTimeAsync(100);

      sut.update((store) => ({ ...store, key1: "third" }));
      await jest.advanceTimersByTimeAsync(200);

      expect(inner.update).toHaveBeenCalledTimes(1);
    });

    it("should flush after max wait even with continuous updates", async () => {
      for (let i = 0; i < 50; i++) {
        sut.update((store) => ({ ...store, iteration: i }));
        await jest.advanceTimersByTimeAsync(150);
      }

      expect((inner.update as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    it("should reset debounce cycle after flush", async () => {
      sut.update(() => ({ batch: 1 }));
      await jest.advanceTimersByTimeAsync(200);

      expect(inner.update).toHaveBeenCalledTimes(1);

      sut.update(() => ({ batch: 2 }));
      await jest.advanceTimersByTimeAsync(200);

      expect(inner.update).toHaveBeenCalledTimes(2);
    });

    it("should apply sequential updates correctly", () => {
      sut.update((store) => ({ ...store, a: 1 }));
      sut.update((store) => ({ ...store, b: 2 }));

      expect(sut.read().a).toBe(1);
      expect(sut.read().b).toBe(2);
    });
  });

  describe("flush", () => {
    it("should immediately persist pending data to inner backend", () => {
      sut.update((store) => ({ ...store, key1: "pending" }));

      expect(inner.update).not.toHaveBeenCalled();

      sut.flush();

      expect(inner.update).toHaveBeenCalledTimes(1);
    });

    it("should be a no-op when there are no pending changes", () => {
      sut.flush();

      expect(inner.update).not.toHaveBeenCalled();
    });

    it("should only write once when flush is called twice sequentially", () => {
      sut.update((store) => ({ ...store, key1: "value" }));
      sut.flush();
      sut.flush();

      expect(inner.update).toHaveBeenCalledTimes(1);
    });

    it("should not double-flush if debounce timer fires after explicit flush", async () => {
      sut.update((store) => ({ ...store, key1: "value" }));
      sut.flush();

      await jest.advanceTimersByTimeAsync(5000);

      expect(inner.update).toHaveBeenCalledTimes(1);
    });
  });
});
