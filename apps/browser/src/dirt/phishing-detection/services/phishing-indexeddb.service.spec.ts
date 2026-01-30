import { ReadableStream as NodeReadableStream } from "stream/web";

import { mock, MockProxy } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { PhishingIndexedDbService } from "./phishing-indexeddb.service";

describe("PhishingIndexedDbService", () => {
  let service: PhishingIndexedDbService;
  let logService: MockProxy<LogService>;

  // Mock IndexedDB storage (keyed by URL for row-per-URL storage)
  let mockStore: Map<string, { url: string }>;
  let mockObjectStore: any;
  let mockTransaction: any;
  let mockDb: any;
  let mockOpenRequest: any;

  beforeEach(() => {
    logService = mock<LogService>();
    mockStore = new Map();

    // Mock IDBObjectStore
    mockObjectStore = {
      put: jest.fn().mockImplementation((record: { url: string }) => {
        const request = {
          error: null as DOMException | null,
          result: undefined as undefined,
          onsuccess: null as (() => void) | null,
          onerror: null as (() => void) | null,
        };
        setTimeout(() => {
          mockStore.set(record.url, record);
          request.onsuccess?.();
        }, 0);
        return request;
      }),
      get: jest.fn().mockImplementation((key: string) => {
        const request = {
          error: null as DOMException | null,
          result: mockStore.get(key),
          onsuccess: null as (() => void) | null,
          onerror: null as (() => void) | null,
        };
        setTimeout(() => {
          request.result = mockStore.get(key);
          request.onsuccess?.();
        }, 0);
        return request;
      }),
      clear: jest.fn().mockImplementation(() => {
        const request = {
          error: null as DOMException | null,
          result: undefined as undefined,
          onsuccess: null as (() => void) | null,
          onerror: null as (() => void) | null,
        };
        setTimeout(() => {
          mockStore.clear();
          request.onsuccess?.();
        }, 0);
        return request;
      }),
      openCursor: jest.fn().mockImplementation(() => {
        const entries = Array.from(mockStore.entries());
        let index = 0;
        const request = {
          error: null as DOMException | null,
          result: null as any,
          onsuccess: null as ((e: any) => void) | null,
          onerror: null as (() => void) | null,
        };
        const advanceCursor = () => {
          if (index < entries.length) {
            const [, value] = entries[index];
            index++;
            request.result = {
              value,
              continue: () => setTimeout(advanceCursor, 0),
            };
          } else {
            request.result = null;
          }
          request.onsuccess?.({ target: request });
        };
        setTimeout(advanceCursor, 0);
        return request;
      }),
    };

    // Mock IDBTransaction
    mockTransaction = {
      objectStore: jest.fn().mockReturnValue(mockObjectStore),
      oncomplete: null as (() => void) | null,
      onerror: null as (() => void) | null,
    };

    // Trigger oncomplete after a tick
    const originalObjectStore = mockTransaction.objectStore;
    mockTransaction.objectStore = jest.fn().mockImplementation((...args: any[]) => {
      setTimeout(() => mockTransaction.oncomplete?.(), 0);
      return originalObjectStore(...args);
    });

    // Mock IDBDatabase
    mockDb = {
      transaction: jest.fn().mockReturnValue(mockTransaction),
      close: jest.fn(),
      objectStoreNames: {
        contains: jest.fn().mockReturnValue(true),
      },
      createObjectStore: jest.fn(),
    };

    // Mock IDBOpenDBRequest
    mockOpenRequest = {
      error: null as DOMException | null,
      result: mockDb,
      onsuccess: null as (() => void) | null,
      onerror: null as (() => void) | null,
      onupgradeneeded: null as ((event: any) => void) | null,
    };

    // Mock indexedDB.open
    const mockIndexedDB = {
      open: jest.fn().mockImplementation(() => {
        setTimeout(() => {
          mockOpenRequest.onsuccess?.();
        }, 0);
        return mockOpenRequest;
      }),
    };

    global.indexedDB = mockIndexedDB as any;

    service = new PhishingIndexedDbService(logService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete (global as any).indexedDB;
  });

  describe("saveUrls", () => {
    it("stores URLs in IndexedDB and returns true", async () => {
      const urls = ["https://phishing.com", "https://malware.net"];

      const result = await service.saveUrls(urls);

      expect(result).toBe(true);
      expect(mockDb.transaction).toHaveBeenCalledWith("phishing-urls", "readwrite");
      expect(mockObjectStore.clear).toHaveBeenCalled();
      expect(mockObjectStore.put).toHaveBeenCalledTimes(2);
      expect(mockDb.close).toHaveBeenCalled();
    });

    it("handles empty array", async () => {
      const result = await service.saveUrls([]);

      expect(result).toBe(true);
      expect(mockObjectStore.clear).toHaveBeenCalled();
    });

    it("trims whitespace from URLs", async () => {
      const urls = ["  https://example.com  ", "\nhttps://test.org\n"];

      await service.saveUrls(urls);

      expect(mockObjectStore.put).toHaveBeenCalledWith({ url: "https://example.com" });
      expect(mockObjectStore.put).toHaveBeenCalledWith({ url: "https://test.org" });
    });

    it("skips empty lines", async () => {
      const urls = ["https://example.com", "", "  ", "https://test.org"];

      await service.saveUrls(urls);

      expect(mockObjectStore.put).toHaveBeenCalledTimes(2);
    });

    it("handles duplicate URLs via upsert (keyPath deduplication)", async () => {
      const urls = [
        "https://example.com",
        "https://example.com", // duplicate
        "https://test.org",
      ];

      const result = await service.saveUrls(urls);

      expect(result).toBe(true);
      // put() is called 3 times, but mockStore (using Map with URL as key)
      // only stores 2 unique entries - demonstrating upsert behavior
      expect(mockObjectStore.put).toHaveBeenCalledTimes(3);
      expect(mockStore.size).toBe(2);
    });

    it("logs error and returns false on failure", async () => {
      const error = new Error("IndexedDB error");
      mockOpenRequest.error = error;
      (global.indexedDB.open as jest.Mock).mockImplementation(() => {
        setTimeout(() => {
          mockOpenRequest.onerror?.();
        }, 0);
        return mockOpenRequest;
      });

      const result = await service.saveUrls(["https://test.com"]);

      expect(result).toBe(false);
      expect(logService.error).toHaveBeenCalledWith(
        "[PhishingIndexedDbService] Save failed",
        expect.any(Error),
      );
    });
  });

  describe("addUrls", () => {
    it("appends URLs to IndexedDB without clearing", async () => {
      // Pre-populate store with existing data
      mockStore.set("https://existing.com", { url: "https://existing.com" });

      const urls = ["https://phishing.com", "https://malware.net"];
      const result = await service.addUrls(urls);

      expect(result).toBe(true);
      expect(mockDb.transaction).toHaveBeenCalledWith("phishing-urls", "readwrite");
      expect(mockObjectStore.clear).not.toHaveBeenCalled();
      expect(mockObjectStore.put).toHaveBeenCalledTimes(2);
      // Existing data should still be present
      expect(mockStore.has("https://existing.com")).toBe(true);
      expect(mockStore.size).toBe(3);
      expect(mockDb.close).toHaveBeenCalled();
    });

    it("handles empty array without clearing", async () => {
      mockStore.set("https://existing.com", { url: "https://existing.com" });

      const result = await service.addUrls([]);

      expect(result).toBe(true);
      expect(mockObjectStore.clear).not.toHaveBeenCalled();
      expect(mockStore.has("https://existing.com")).toBe(true);
    });

    it("trims whitespace from URLs", async () => {
      const urls = ["  https://example.com  ", "\nhttps://test.org\n"];

      await service.addUrls(urls);

      expect(mockObjectStore.put).toHaveBeenCalledWith({ url: "https://example.com" });
      expect(mockObjectStore.put).toHaveBeenCalledWith({ url: "https://test.org" });
    });

    it("skips empty lines", async () => {
      const urls = ["https://example.com", "", "  ", "https://test.org"];

      await service.addUrls(urls);

      expect(mockObjectStore.put).toHaveBeenCalledTimes(2);
    });

    it("handles duplicate URLs via upsert", async () => {
      mockStore.set("https://example.com", { url: "https://example.com" });

      const urls = [
        "https://example.com", // Already exists
        "https://test.org",
      ];

      const result = await service.addUrls(urls);

      expect(result).toBe(true);
      expect(mockObjectStore.put).toHaveBeenCalledTimes(2);
      expect(mockStore.size).toBe(2);
    });

    it("logs error and returns false on failure", async () => {
      const error = new Error("IndexedDB error");
      mockOpenRequest.error = error;
      (global.indexedDB.open as jest.Mock).mockImplementation(() => {
        setTimeout(() => {
          mockOpenRequest.onerror?.();
        }, 0);
        return mockOpenRequest;
      });

      const result = await service.addUrls(["https://test.com"]);

      expect(result).toBe(false);
      expect(logService.error).toHaveBeenCalledWith(
        "[PhishingIndexedDbService] Add failed",
        expect.any(Error),
      );
    });
  });

  describe("hasUrl", () => {
    it("returns true for existing URL", async () => {
      mockStore.set("https://example.com", { url: "https://example.com" });

      const result = await service.hasUrl("https://example.com");

      expect(result).toBe(true);
      expect(mockDb.transaction).toHaveBeenCalledWith("phishing-urls", "readonly");
      expect(mockObjectStore.get).toHaveBeenCalledWith("https://example.com");
    });

    it("returns false for non-existing URL", async () => {
      const result = await service.hasUrl("https://notfound.com");

      expect(result).toBe(false);
    });

    it("returns false on error", async () => {
      const error = new Error("IndexedDB error");
      mockOpenRequest.error = error;
      (global.indexedDB.open as jest.Mock).mockImplementation(() => {
        setTimeout(() => {
          mockOpenRequest.onerror?.();
        }, 0);
        return mockOpenRequest;
      });

      const result = await service.hasUrl("https://example.com");

      expect(result).toBe(false);
      expect(logService.error).toHaveBeenCalledWith(
        "[PhishingIndexedDbService] Check failed",
        expect.any(Error),
      );
    });
  });

  describe("loadAllUrls", () => {
    it("loads all URLs using cursor", async () => {
      mockStore.set("https://example.com", { url: "https://example.com" });
      mockStore.set("https://test.org", { url: "https://test.org" });

      const result = await service.loadAllUrls();

      expect(result).toContain("https://example.com");
      expect(result).toContain("https://test.org");
      expect(result.length).toBe(2);
    });

    it("returns empty array when no data exists", async () => {
      const result = await service.loadAllUrls();

      expect(result).toEqual([]);
    });

    it("returns empty array on error", async () => {
      const error = new Error("IndexedDB error");
      mockOpenRequest.error = error;
      (global.indexedDB.open as jest.Mock).mockImplementation(() => {
        setTimeout(() => {
          mockOpenRequest.onerror?.();
        }, 0);
        return mockOpenRequest;
      });

      const result = await service.loadAllUrls();

      expect(result).toEqual([]);
      expect(logService.error).toHaveBeenCalledWith(
        "[PhishingIndexedDbService] Load failed",
        expect.any(Error),
      );
    });
  });

  describe("saveUrlsFromStream", () => {
    it("saves URLs from stream", async () => {
      const content = "https://example.com\nhttps://test.org\nhttps://phishing.net";
      const stream = new NodeReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(content));
          controller.close();
        },
      }) as unknown as ReadableStream<Uint8Array>;

      const result = await service.saveUrlsFromStream(stream);

      expect(result).toBe(true);
      expect(mockObjectStore.clear).toHaveBeenCalled();
      expect(mockObjectStore.put).toHaveBeenCalledTimes(3);
    });

    it("handles chunked stream data", async () => {
      const content = "https://url1.com\nhttps://url2.com";
      const encoder = new TextEncoder();
      const encoded = encoder.encode(content);

      // Split into multiple small chunks
      const stream = new NodeReadableStream({
        start(controller) {
          controller.enqueue(encoded.slice(0, 5));
          controller.enqueue(encoded.slice(5, 10));
          controller.enqueue(encoded.slice(10));
          controller.close();
        },
      }) as unknown as ReadableStream<Uint8Array>;

      const result = await service.saveUrlsFromStream(stream);

      expect(result).toBe(true);
      expect(mockObjectStore.put).toHaveBeenCalledTimes(2);
    });

    it("returns false on error", async () => {
      const error = new Error("IndexedDB error");
      mockOpenRequest.error = error;
      (global.indexedDB.open as jest.Mock).mockImplementation(() => {
        setTimeout(() => {
          mockOpenRequest.onerror?.();
        }, 0);
        return mockOpenRequest;
      });

      const stream = new NodeReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("https://test.com"));
          controller.close();
        },
      }) as unknown as ReadableStream<Uint8Array>;

      const result = await service.saveUrlsFromStream(stream);

      expect(result).toBe(false);
      expect(logService.error).toHaveBeenCalledWith(
        "[PhishingIndexedDbService] Stream save failed",
        expect.any(Error),
      );
    });
  });

  describe("findMatchingUrl", () => {
    it("returns true when matcher finds a match", async () => {
      mockStore.set("https://example.com", { url: "https://example.com" });
      mockStore.set("https://phishing.net", { url: "https://phishing.net" });
      mockStore.set("https://test.org", { url: "https://test.org" });

      const matcher = (url: string) => url.includes("phishing");
      const result = await service.findMatchingUrl(matcher);

      expect(result).toBe(true);
      expect(mockDb.transaction).toHaveBeenCalledWith("phishing-urls", "readonly");
      expect(mockObjectStore.openCursor).toHaveBeenCalled();
    });

    it("returns false when no URLs match", async () => {
      mockStore.set("https://example.com", { url: "https://example.com" });
      mockStore.set("https://test.org", { url: "https://test.org" });

      const matcher = (url: string) => url.includes("notfound");
      const result = await service.findMatchingUrl(matcher);

      expect(result).toBe(false);
    });

    it("returns false when store is empty", async () => {
      const matcher = (url: string) => url.includes("anything");
      const result = await service.findMatchingUrl(matcher);

      expect(result).toBe(false);
    });

    it("exits early on first match without iterating all records", async () => {
      mockStore.set("https://match1.com", { url: "https://match1.com" });
      mockStore.set("https://match2.com", { url: "https://match2.com" });
      mockStore.set("https://match3.com", { url: "https://match3.com" });

      const matcherCallCount = jest
        .fn()
        .mockImplementation((url: string) => url.includes("match2"));
      await service.findMatchingUrl(matcherCallCount);

      // Matcher should be called for match1.com and match2.com, but NOT match3.com
      // because it exits early on first match
      expect(matcherCallCount).toHaveBeenCalledWith("https://match1.com");
      expect(matcherCallCount).toHaveBeenCalledWith("https://match2.com");
      expect(matcherCallCount).not.toHaveBeenCalledWith("https://match3.com");
      expect(matcherCallCount).toHaveBeenCalledTimes(2);
    });

    it("supports complex matcher logic", async () => {
      mockStore.set("https://example.com/path", { url: "https://example.com/path" });
      mockStore.set("https://test.org", { url: "https://test.org" });
      mockStore.set("https://phishing.net/login", { url: "https://phishing.net/login" });

      const matcher = (url: string) => {
        return url.includes("phishing") && url.includes("login");
      };
      const result = await service.findMatchingUrl(matcher);

      expect(result).toBe(true);
    });

    it("returns false on error", async () => {
      const error = new Error("IndexedDB error");
      mockOpenRequest.error = error;
      (global.indexedDB.open as jest.Mock).mockImplementation(() => {
        setTimeout(() => {
          mockOpenRequest.onerror?.();
        }, 0);
        return mockOpenRequest;
      });

      const matcher = (url: string) => url.includes("test");
      const result = await service.findMatchingUrl(matcher);

      expect(result).toBe(false);
      expect(logService.error).toHaveBeenCalledWith(
        "[PhishingIndexedDbService] Cursor search failed",
        expect.any(Error),
      );
    });
  });

  describe("database initialization", () => {
    it("creates object store with keyPath on upgrade", async () => {
      mockDb.objectStoreNames.contains.mockReturnValue(false);

      (global.indexedDB.open as jest.Mock).mockImplementation(() => {
        setTimeout(() => {
          mockOpenRequest.onupgradeneeded?.({ target: mockOpenRequest });
          mockOpenRequest.onsuccess?.();
        }, 0);
        return mockOpenRequest;
      });

      await service.hasUrl("https://test.com");

      expect(mockDb.createObjectStore).toHaveBeenCalledWith("phishing-urls", { keyPath: "url" });
    });
  });
});
