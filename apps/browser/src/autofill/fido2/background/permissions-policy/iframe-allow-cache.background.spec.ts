import { IframeAllowAttribute } from "../../content/iframe-allow-scraper";

import { IframeAllowCacheBackground } from "./iframe-allow-cache.background";

type TabRemovedListener = (tabId: number) => void;

interface MockEvent<L> {
  addListener: jest.Mock<void, [L]>;
  removeListener: jest.Mock<void, [L]>;
}

function createMockEvent<L>(): MockEvent<L> {
  return { addListener: jest.fn(), removeListener: jest.fn() };
}

function entry(src: string, allow: string, srcdoc = false): IframeAllowAttribute {
  return { src, allow, srcdoc };
}

describe("IframeAllowCacheBackground", () => {
  let onTabRemoved: MockEvent<TabRemovedListener>;
  let mockTabs: typeof chrome.tabs;
  let cache: IframeAllowCacheBackground;

  beforeEach(() => {
    onTabRemoved = createMockEvent<TabRemovedListener>();
    mockTabs = { onRemoved: onTabRemoved } as unknown as typeof chrome.tabs;
    cache = new IframeAllowCacheBackground(mockTabs);
  });

  describe("startListening / stopListening", () => {
    it("registers a tabs.onRemoved listener", () => {
      cache.startListening();
      expect(onTabRemoved.addListener).toHaveBeenCalledTimes(1);
    });

    it("is idempotent", () => {
      cache.startListening();
      cache.startListening();
      expect(onTabRemoved.addListener).toHaveBeenCalledTimes(1);
    });

    it("stopListening removes the listener", () => {
      cache.startListening();
      cache.stopListening();
      expect(onTabRemoved.removeListener).toHaveBeenCalledTimes(1);
    });

    it("stopListening is safe to call before start", () => {
      expect(() => cache.stopListening()).not.toThrow();
      expect(onTabRemoved.removeListener).not.toHaveBeenCalled();
    });
  });

  describe("recording reports", () => {
    it("stores a report keyed by (tabId, parentFrameId)", () => {
      cache.recordReport(7, 0, [entry("https://child.example/", "publickey-credentials-get")]);

      expect(cache.getAllowForChildFrame(7, 0, "https://child.example/")).toBe(
        "publickey-credentials-get",
      );
    });

    it("overwrites a prior report for the same (tabId, parentFrameId)", () => {
      cache.recordReport(1, 0, [entry("https://a.example/", "a")]);
      cache.recordReport(1, 0, [entry("https://b.example/", "b")]);

      expect(cache.getAllowForChildFrame(1, 0, "https://a.example/")).toBeUndefined();
      expect(cache.getAllowForChildFrame(1, 0, "https://b.example/")).toBe("b");
    });

    it("keys reports independently per (tabId, parentFrameId)", () => {
      cache.recordReport(1, 0, [entry("https://a.example/", "a")]);
      cache.recordReport(1, 5, [entry("https://b.example/", "b")]);
      cache.recordReport(2, 0, [entry("https://c.example/", "c")]);

      expect(cache.getAllowForChildFrame(1, 0, "https://a.example/")).toBe("a");
      expect(cache.getAllowForChildFrame(1, 5, "https://b.example/")).toBe("b");
      expect(cache.getAllowForChildFrame(2, 0, "https://c.example/")).toBe("c");
    });

    it("skips entries for non-tab requests (tabId < 0)", () => {
      cache.recordReport(-1, 0, [entry("https://x.example/", "x")]);
      expect(cache.size()).toBe(0);
    });

    it("stores an empty report (useful as a 'parent has been heard from' marker)", () => {
      cache.recordReport(1, 0, []);
      expect(cache.size()).toBe(1);
      // Still nothing to find.
      expect(cache.getAllowForChildFrame(1, 0, "https://anywhere.example/")).toBeUndefined();
    });
  });

  describe("getAllowForChildFrame", () => {
    it("returns undefined when no parent report is cached", () => {
      expect(cache.getAllowForChildFrame(1, 0, "https://child.example/")).toBeUndefined();
    });

    it("returns undefined when no iframe in the report matches the child URL", () => {
      cache.recordReport(1, 0, [entry("https://a.example/", "a")]);

      expect(cache.getAllowForChildFrame(1, 0, "https://b.example/")).toBeUndefined();
    });

    it("returns the matching iframe's allow attribute", () => {
      cache.recordReport(1, 0, [
        entry("https://a.example/", "publickey-credentials-create"),
        entry("https://b.example/", "publickey-credentials-get"),
      ]);

      expect(cache.getAllowForChildFrame(1, 0, "https://b.example/")).toBe(
        "publickey-credentials-get",
      );
    });

    it("returns undefined when the matching iframe has an empty allow attribute", () => {
      cache.recordReport(1, 0, [entry("https://a.example/", "")]);

      expect(cache.getAllowForChildFrame(1, 0, "https://a.example/")).toBeUndefined();
    });

    it("does not match srcdoc iframes (no URL to match on)", () => {
      cache.recordReport(1, 0, [entry("", "publickey-credentials-get", true)]);

      expect(cache.getAllowForChildFrame(1, 0, "")).toBeUndefined();
      expect(cache.getAllowForChildFrame(1, 0, "about:srcdoc")).toBeUndefined();
    });

    it("returns the first match when multiple iframes share a src URL", () => {
      cache.recordReport(1, 0, [
        entry("https://a.example/", "first"),
        entry("https://a.example/", "second"),
      ]);

      expect(cache.getAllowForChildFrame(1, 0, "https://a.example/")).toBe("first");
    });

    describe("origin-level fallback (handles redirects / URL normalization)", () => {
      it("matches by origin when the frame URL differs from iframe.src by a trailing slash after 301", () => {
        cache.recordReport(1, 0, [
          entry("http://x.example:8081/foo?q=1", "publickey-credentials-get"),
        ]);

        expect(cache.getAllowForChildFrame(1, 0, "http://x.example:8081/foo/?q=1")).toBe(
          "publickey-credentials-get",
        );
      });

      it("matches by origin when the frame URL has a different path than iframe.src", () => {
        cache.recordReport(1, 0, [
          entry("https://a.example/entry", "publickey-credentials-create"),
        ]);

        expect(cache.getAllowForChildFrame(1, 0, "https://a.example/after-redirect")).toBe(
          "publickey-credentials-create",
        );
      });

      it("does not match when only the scheme differs (origins are distinct)", () => {
        cache.recordReport(1, 0, [entry("http://a.example/", "a")]);

        expect(cache.getAllowForChildFrame(1, 0, "https://a.example/")).toBeUndefined();
      });

      it("does not match when only the port differs (origins are distinct)", () => {
        cache.recordReport(1, 0, [entry("http://a.example:8080/", "a")]);

        expect(cache.getAllowForChildFrame(1, 0, "http://a.example:8081/")).toBeUndefined();
      });

      it("prefers the exact-URL match over the origin fallback", () => {
        cache.recordReport(1, 0, [
          entry("https://a.example/first", "first"),
          entry("https://a.example/exact", "exact"),
        ]);

        expect(cache.getAllowForChildFrame(1, 0, "https://a.example/exact")).toBe("exact");
      });

      it("returns undefined when childUrl is unparseable (e.g. about:srcdoc)", () => {
        cache.recordReport(1, 0, [entry("https://a.example/", "a")]);

        expect(cache.getAllowForChildFrame(1, 0, "about:srcdoc")).toBeUndefined();
      });
    });
  });

  describe("tab removal", () => {
    it("clears every report for the removed tab", () => {
      cache.startListening();
      const tabRemoved = onTabRemoved.addListener.mock.calls[0][0];

      cache.recordReport(1, 0, [entry("https://a.example/", "a")]);
      cache.recordReport(1, 5, [entry("https://b.example/", "b")]);
      cache.recordReport(2, 0, [entry("https://c.example/", "c")]);

      tabRemoved(1);

      expect(cache.getAllowForChildFrame(1, 0, "https://a.example/")).toBeUndefined();
      expect(cache.getAllowForChildFrame(1, 5, "https://b.example/")).toBeUndefined();
      expect(cache.getAllowForChildFrame(2, 0, "https://c.example/")).toBe("c");
    });

    it("doesn't clear similar-prefixed tab IDs (no `10:` from a `1:` removal)", () => {
      cache.startListening();
      const tabRemoved = onTabRemoved.addListener.mock.calls[0][0];

      cache.recordReport(1, 0, [entry("https://a.example/", "a")]);
      cache.recordReport(10, 0, [entry("https://b.example/", "b")]);

      tabRemoved(1);

      expect(cache.getAllowForChildFrame(1, 0, "https://a.example/")).toBeUndefined();
      expect(cache.getAllowForChildFrame(10, 0, "https://b.example/")).toBe("b");
    });
  });

  describe("invalidate", () => {
    it("drops a specific (tabId, parentFrameId) entry", () => {
      cache.recordReport(1, 0, [entry("https://a.example/", "a")]);

      cache.invalidate(1, 0);

      expect(cache.getAllowForChildFrame(1, 0, "https://a.example/")).toBeUndefined();
    });
  });
});
