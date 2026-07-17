import { PermissionsPolicyHeaderCacheBackground } from "./permissions-policy-header-cache.background";

type HeadersListener = (details: chrome.webRequest.OnHeadersReceivedDetails) => void;
type TabRemovedListener = (tabId: number) => void;

interface MockEvent<L> {
  addListener: jest.Mock<void, [L, ...unknown[]]>;
  removeListener: jest.Mock<void, [L]>;
}

function createMockEvent<L>(): MockEvent<L> {
  return {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
}

function createDetails(
  overrides: Partial<chrome.webRequest.OnHeadersReceivedDetails> = {},
): chrome.webRequest.OnHeadersReceivedDetails {
  return {
    requestId: "req-1",
    url: "https://example.com/",
    method: "GET",
    frameId: 0,
    parentFrameId: -1,
    tabId: 1,
    type: "main_frame",
    timeStamp: 0,
    responseHeaders: [],
    statusLine: "HTTP/1.1 200 OK",
    statusCode: 200,
    ...overrides,
  } as chrome.webRequest.OnHeadersReceivedDetails;
}

describe("PermissionsPolicyHeaderCacheBackground", () => {
  let onHeadersReceived: MockEvent<HeadersListener>;
  let onTabRemoved: MockEvent<TabRemovedListener>;
  let mockWebRequest: typeof chrome.webRequest;
  let mockTabs: typeof chrome.tabs;
  let cache: PermissionsPolicyHeaderCacheBackground;

  beforeEach(() => {
    onHeadersReceived = createMockEvent<HeadersListener>();
    onTabRemoved = createMockEvent<TabRemovedListener>();
    mockWebRequest = { onHeadersReceived } as unknown as typeof chrome.webRequest;
    mockTabs = { onRemoved: onTabRemoved } as unknown as typeof chrome.tabs;
    cache = new PermissionsPolicyHeaderCacheBackground(mockWebRequest, mockTabs);
  });

  function startAndCaptureListeners(): {
    headers: HeadersListener;
    tabRemoved: TabRemovedListener;
  } {
    cache.startListening();
    const headers = onHeadersReceived.addListener.mock.calls[0][0];
    const tabRemoved = onTabRemoved.addListener.mock.calls[0][0];
    return { headers, tabRemoved };
  }

  describe("startListening", () => {
    it("registers a webRequest.onHeadersReceived listener for main and sub-frame loads with responseHeaders", () => {
      cache.startListening();

      expect(onHeadersReceived.addListener).toHaveBeenCalledTimes(1);
      const [, filter, extraInfoSpec] = onHeadersReceived.addListener.mock.calls[0];
      expect(filter).toEqual({ urls: ["<all_urls>"], types: ["main_frame", "sub_frame"] });
      expect(extraInfoSpec).toEqual(["responseHeaders"]);
    });

    it("registers a tabs.onRemoved listener for cleanup", () => {
      cache.startListening();

      expect(onTabRemoved.addListener).toHaveBeenCalledTimes(1);
    });

    it("is idempotent", () => {
      cache.startListening();
      cache.startListening();

      expect(onHeadersReceived.addListener).toHaveBeenCalledTimes(1);
      expect(onTabRemoved.addListener).toHaveBeenCalledTimes(1);
    });
  });

  describe("stopListening", () => {
    it("removes both listeners", () => {
      cache.startListening();
      cache.stopListening();

      expect(onHeadersReceived.removeListener).toHaveBeenCalledTimes(1);
      expect(onTabRemoved.removeListener).toHaveBeenCalledTimes(1);
    });

    it("is safe to call without start", () => {
      expect(() => cache.stopListening()).not.toThrow();
      expect(onHeadersReceived.removeListener).not.toHaveBeenCalled();
    });

    it("allows restart after stop", () => {
      cache.startListening();
      cache.stopListening();
      cache.startListening();

      expect(onHeadersReceived.addListener).toHaveBeenCalledTimes(2);
    });
  });

  describe("recording headers", () => {
    it("stores a Permissions-Policy header keyed by (tabId, frameId)", () => {
      const { headers } = startAndCaptureListeners();

      headers(
        createDetails({
          tabId: 7,
          frameId: 0,
          responseHeaders: [{ name: "Permissions-Policy", value: "publickey-credentials-get=()" }],
        }),
      );

      expect(cache.getRawHeader(7, 0)).toBe("publickey-credentials-get=()");
    });

    it("matches header name case-insensitively", () => {
      const { headers } = startAndCaptureListeners();

      headers(
        createDetails({
          tabId: 7,
          frameId: 1,
          responseHeaders: [
            { name: "permissions-policy", value: "publickey-credentials-create=*" },
          ],
        }),
      );

      expect(cache.getRawHeader(7, 1)).toBe("publickey-credentials-create=*");
    });

    it("joins multiple Permissions-Policy headers with `, ` (per RFC 8941)", () => {
      const { headers } = startAndCaptureListeners();

      headers(
        createDetails({
          tabId: 1,
          frameId: 0,
          responseHeaders: [
            { name: "Permissions-Policy", value: "publickey-credentials-get=()" },
            { name: "Permissions-Policy", value: "publickey-credentials-create=()" },
          ],
        }),
      );

      expect(cache.getRawHeader(1, 0)).toBe(
        "publickey-credentials-get=(), publickey-credentials-create=()",
      );
    });

    it("ignores other response headers", () => {
      const { headers } = startAndCaptureListeners();

      headers(
        createDetails({
          tabId: 1,
          frameId: 0,
          responseHeaders: [
            { name: "Content-Type", value: "text/html" },
            { name: "X-Frame-Options", value: "DENY" },
          ],
        }),
      );

      expect(cache.getRawHeader(1, 0)).toBeUndefined();
    });

    it("skips entries for non-tab requests (tabId < 0)", () => {
      const { headers } = startAndCaptureListeners();

      headers(
        createDetails({
          tabId: -1,
          frameId: 0,
          responseHeaders: [{ name: "Permissions-Policy", value: "x=()" }],
        }),
      );

      expect(cache.size()).toBe(0);
    });

    it("treats a header with empty/missing value as no header", () => {
      const { headers } = startAndCaptureListeners();

      headers(
        createDetails({
          tabId: 1,
          frameId: 0,
          responseHeaders: [{ name: "Permissions-Policy", value: "" }],
        }),
      );

      expect(cache.getRawHeader(1, 0)).toBeUndefined();
    });

    it("clears a stale entry when a fresh response has no Permissions-Policy header", () => {
      const { headers } = startAndCaptureListeners();
      headers(
        createDetails({
          tabId: 1,
          frameId: 0,
          responseHeaders: [{ name: "Permissions-Policy", value: "x=()" }],
        }),
      );
      expect(cache.getRawHeader(1, 0)).toBe("x=()");

      headers(createDetails({ tabId: 1, frameId: 0, responseHeaders: [] }));

      expect(cache.getRawHeader(1, 0)).toBeUndefined();
    });

    it("overwrites the entry when a fresh response brings a new Permissions-Policy header", () => {
      const { headers } = startAndCaptureListeners();
      headers(
        createDetails({
          tabId: 1,
          frameId: 0,
          responseHeaders: [{ name: "Permissions-Policy", value: "x=()" }],
        }),
      );

      headers(
        createDetails({
          tabId: 1,
          frameId: 0,
          responseHeaders: [{ name: "Permissions-Policy", value: "y=*" }],
        }),
      );

      expect(cache.getRawHeader(1, 0)).toBe("y=*");
    });

    it("keys entries independently per (tabId, frameId)", () => {
      const { headers } = startAndCaptureListeners();
      headers(
        createDetails({
          tabId: 1,
          frameId: 0,
          responseHeaders: [{ name: "Permissions-Policy", value: "a=()" }],
        }),
      );
      headers(
        createDetails({
          tabId: 1,
          frameId: 5,
          responseHeaders: [{ name: "Permissions-Policy", value: "b=()" }],
        }),
      );
      headers(
        createDetails({
          tabId: 2,
          frameId: 0,
          responseHeaders: [{ name: "Permissions-Policy", value: "c=()" }],
        }),
      );

      expect(cache.getRawHeader(1, 0)).toBe("a=()");
      expect(cache.getRawHeader(1, 5)).toBe("b=()");
      expect(cache.getRawHeader(2, 0)).toBe("c=()");
    });
  });

  describe("tab removal", () => {
    it("clears every cached entry for the removed tab", () => {
      const { headers, tabRemoved } = startAndCaptureListeners();
      headers(
        createDetails({
          tabId: 1,
          frameId: 0,
          responseHeaders: [{ name: "Permissions-Policy", value: "a=()" }],
        }),
      );
      headers(
        createDetails({
          tabId: 1,
          frameId: 5,
          responseHeaders: [{ name: "Permissions-Policy", value: "b=()" }],
        }),
      );
      headers(
        createDetails({
          tabId: 2,
          frameId: 0,
          responseHeaders: [{ name: "Permissions-Policy", value: "c=()" }],
        }),
      );

      tabRemoved(1);

      expect(cache.getRawHeader(1, 0)).toBeUndefined();
      expect(cache.getRawHeader(1, 5)).toBeUndefined();
      expect(cache.getRawHeader(2, 0)).toBe("c=()");
    });

    it("does not clear similar-prefixed tab IDs (no `10:` from a `1:` removal)", () => {
      const { headers, tabRemoved } = startAndCaptureListeners();
      headers(
        createDetails({
          tabId: 1,
          frameId: 0,
          responseHeaders: [{ name: "Permissions-Policy", value: "a=()" }],
        }),
      );
      headers(
        createDetails({
          tabId: 10,
          frameId: 0,
          responseHeaders: [{ name: "Permissions-Policy", value: "b=()" }],
        }),
      );

      tabRemoved(1);

      expect(cache.getRawHeader(1, 0)).toBeUndefined();
      expect(cache.getRawHeader(10, 0)).toBe("b=()");
    });
  });

  describe("invalidate", () => {
    it("drops a specific (tabId, frameId) entry", () => {
      const { headers } = startAndCaptureListeners();
      headers(
        createDetails({
          tabId: 1,
          frameId: 0,
          responseHeaders: [{ name: "Permissions-Policy", value: "a=()" }],
        }),
      );

      cache.invalidate(1, 0);

      expect(cache.getRawHeader(1, 0)).toBeUndefined();
    });
  });
});
