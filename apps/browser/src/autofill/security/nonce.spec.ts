import { NonceStore } from "./nonce";

describe("NonceStore", () => {
  describe("mint", () => {
    it("returns a non-empty base64url string", () => {
      const store = new NonceStore();
      const nonce = store.mint();
      expect(typeof nonce).toBe("string");
      expect(nonce.length).toBeGreaterThan(20);
      expect(nonce).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it("never returns the same value twice", () => {
      const store = new NonceStore();
      const seen = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        seen.add(store.mint());
      }
      expect(seen.size).toBe(1000);
    });
  });

  describe("consume", () => {
    it("returns true on the first consume of a minted nonce", () => {
      const store = new NonceStore();
      const n = store.mint();
      expect(store.consume(n)).toBe(true);
    });

    it("returns false on the second consume of the same nonce", () => {
      const store = new NonceStore();
      const n = store.mint();
      store.consume(n);
      expect(store.consume(n)).toBe(false);
    });

    it("returns false for a nonce never minted by this store", () => {
      const store = new NonceStore();
      expect(store.consume("not-from-this-store")).toBe(false);
    });

    it("returns false for a nonce minted by a different store instance", () => {
      // Single-use semantics are per-store. Two stores are independent.
      const a = new NonceStore();
      const b = new NonceStore();
      const fromA = a.mint();
      expect(b.consume(fromA)).toBe(false);
      // The nonce is still valid in its own store.
      expect(a.consume(fromA)).toBe(true);
    });
  });

  describe("TTL", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("returns false for a nonce past its TTL", () => {
      const store = new NonceStore(1_000);
      const n = store.mint();
      jest.advanceTimersByTime(1_500);
      expect(store.consume(n)).toBe(false);
    });

    it("still returns true if consumed within TTL", () => {
      const store = new NonceStore(1_000);
      const n = store.mint();
      jest.advanceTimersByTime(500);
      expect(store.consume(n)).toBe(true);
    });
  });

  describe("capacity eviction", () => {
    it("evicts the oldest entry when capacity is exceeded on mint", () => {
      const store = new NonceStore(60_000, 3);
      const a = store.mint();
      const b = store.mint();
      const c = store.mint();
      // Capacity is 3, store is full. Minting forces eviction of `a` (oldest).
      const d = store.mint();
      expect(store.consume(a)).toBe(false);
      expect(store.consume(b)).toBe(true);
      expect(store.consume(c)).toBe(true);
      expect(store.consume(d)).toBe(true);
    });

    it("keeps store size bounded by capacity", () => {
      const store = new NonceStore(60_000, 5);
      for (let i = 0; i < 50; i++) {
        store.mint();
      }
      expect(store.__size()).toBeLessThanOrEqual(5);
    });
  });
});
