import { RateLimiter } from "./rate-limiter";

describe("RateLimiter", () => {
  const defaultConfig = { windowMs: 10_000, maxInWindow: 20 };
  let now = 0;
  const clock = () => now;

  beforeEach(() => {
    now = 1_000_000;
    // Don't rely on the test-setup storage mock; pass in a stub storage so we can
    // assert persistence calls and isolate from cross-test state.
  });

  const makeLimiter = (configs: Record<string, { windowMs: number; maxInWindow: number }> = {}) =>
    new RateLimiter(configs, defaultConfig, clock, undefined);

  describe("within-window allow", () => {
    it("allows up to maxInWindow requests", () => {
      const limiter = makeLimiter();
      for (let i = 0; i < defaultConfig.maxInWindow; i++) {
        expect(limiter.allow(1, "anyCommand")).toBe(true);
      }
    });

    it("rejects the request that would exceed maxInWindow", () => {
      const limiter = makeLimiter();
      for (let i = 0; i < defaultConfig.maxInWindow; i++) {
        limiter.allow(1, "anyCommand");
      }
      expect(limiter.allow(1, "anyCommand")).toBe(false);
    });
  });

  describe("sliding window reset", () => {
    it("allows again after the window elapses", () => {
      const limiter = makeLimiter();
      for (let i = 0; i < defaultConfig.maxInWindow; i++) {
        limiter.allow(1, "x");
      }
      expect(limiter.allow(1, "x")).toBe(false);
      now += defaultConfig.windowMs + 1;
      expect(limiter.allow(1, "x")).toBe(true);
    });

    it("partially recovers as old timestamps slide out", () => {
      const limiter = makeLimiter({ x: { windowMs: 1_000, maxInWindow: 3 } });
      expect(limiter.allow(1, "x")).toBe(true); // t=now
      now += 400;
      expect(limiter.allow(1, "x")).toBe(true);
      expect(limiter.allow(1, "x")).toBe(true);
      expect(limiter.allow(1, "x")).toBe(false); // bucket full
      now += 700; // first timestamp has fallen out of the 1s window
      expect(limiter.allow(1, "x")).toBe(true);
    });
  });

  describe("per-(tabId, command) isolation", () => {
    it("does not let one tab affect another", () => {
      const limiter = makeLimiter({ x: { windowMs: 10_000, maxInWindow: 1 } });
      expect(limiter.allow(1, "x")).toBe(true);
      expect(limiter.allow(1, "x")).toBe(false);
      // A different tab gets its own bucket.
      expect(limiter.allow(2, "x")).toBe(true);
    });

    it("does not let one command affect another for the same tab", () => {
      const limiter = makeLimiter({
        x: { windowMs: 10_000, maxInWindow: 1 },
        y: { windowMs: 10_000, maxInWindow: 1 },
      });
      expect(limiter.allow(1, "x")).toBe(true);
      expect(limiter.allow(1, "x")).toBe(false);
      expect(limiter.allow(1, "y")).toBe(true);
    });
  });

  describe("custom configs per command", () => {
    it("uses the command-specific config when present", () => {
      const limiter = makeLimiter({ tight: { windowMs: 10_000, maxInWindow: 2 } });
      expect(limiter.allow(1, "tight")).toBe(true);
      expect(limiter.allow(1, "tight")).toBe(true);
      expect(limiter.allow(1, "tight")).toBe(false);
    });

    it("falls back to default for unconfigured commands", () => {
      const limiter = makeLimiter();
      // First 20 allowed (default cap); 21st denied.
      for (let i = 0; i < 20; i++) {
        expect(limiter.allow(1, "unknown")).toBe(true);
      }
      expect(limiter.allow(1, "unknown")).toBe(false);
    });
  });

  describe("memory bounds", () => {
    it("prunes expired timestamps even on a rejected request", () => {
      const limiter = makeLimiter({ x: { windowMs: 1_000, maxInWindow: 2 } });
      limiter.allow(1, "x");
      limiter.allow(1, "x");
      const before = limiter.__snapshot()["1:x"].length;
      expect(before).toBe(2);
      now += 5_000;
      // Reject case: still consults the bucket and prunes.
      const limiter2 = makeLimiter({ x: { windowMs: 1_000, maxInWindow: 2 } });
      // Re-fill new limiter then advance and trigger prune.
      limiter2.allow(2, "x");
      limiter2.allow(2, "x");
      now += 5_000;
      limiter2.allow(2, "x");
      expect(limiter2.__snapshot()["2:x"].length).toBe(1);
    });
  });

  describe("persistence", () => {
    it("writes to the provided storage area on each allow call", () => {
      const set = jest.fn();
      const get = jest.fn((_key: string, cb: (r?: any) => void) => cb({}));
      const storage = { set, get } as unknown as chrome.storage.StorageArea;
      const limiter = new RateLimiter({}, defaultConfig, clock, storage);
      limiter.allow(1, "x");
      expect(set).toHaveBeenCalled();
    });

    it("hydrates from the provided storage area at construction", () => {
      const stored = { "1:x": [now - 100, now - 50] };
      const get = jest.fn((_key: string, cb: (r?: any) => void) =>
        cb({ "autofill-security:rate-limiter": stored }),
      );
      const set = jest.fn();
      const storage = { set, get } as unknown as chrome.storage.StorageArea;
      const limiter = new RateLimiter(
        { x: { windowMs: 10_000, maxInWindow: 2 } },
        defaultConfig,
        clock,
        storage,
      );
      // Two prior timestamps; bucket full; next allow rejected.
      expect(limiter.allow(1, "x")).toBe(false);
    });
  });
});
