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
  });

  describe("saveUrls", () => {
    it("stores URLs in IndexedDB and returns true", async () => {
      const urls = ["phishing.com", "malware.net"];

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
      const urls = ["  example.com  ", "\ntest.org\n"];

      await service.saveUrls(urls);

      expect(mockObjectStore.put).toHaveBeenCalledWith({ url: "example.com" });
      expect(mockObjectStore.put).toHaveBeenCalledWith({ url: "test.org" });
    });

    it("skips empty lines", async () => {
      const urls = ["example.com", "", "  ", "test.org"];

      await service.saveUrls(urls);

      expect(mockObjectStore.put).toHaveBeenCalledTimes(2);
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

      const result = await service.saveUrls(["test.com"]);

      expect(result).toBe(false);
      expect(logService.error).toHaveBeenCalledWith(
        "[PhishingIndexedDbService] Save failed",
        expect.any(Error),
      );
    });
  });

  describe("hasUrl", () => {
    it("returns true for existing URL", async () => {
      mockStore.set("example.com", { url: "example.com" });

      const result = await service.hasUrl("example.com");

      expect(result).toBe(true);
      expect(mockDb.transaction).toHaveBeenCalledWith("phishing-urls", "readonly");
      expect(mockObjectStore.get).toHaveBeenCalledWith("example.com");
    });

    it("returns false for non-existing URL", async () => {
      const result = await service.hasUrl("notfound.com");

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

      const result = await service.hasUrl("example.com");

      expect(result).toBe(false);
      expect(logService.error).toHaveBeenCalledWith(
        "[PhishingIndexedDbService] Check failed",
        expect.any(Error),
      );
    });
  });

  describe("loadAllUrls", () => {
    it("loads all URLs using cursor", async () => {
      mockStore.set("example.com", { url: "example.com" });
      mockStore.set("test.org", { url: "test.org" });

      const result = await service.loadAllUrls();

      expect(result).toContain("example.com");
      expect(result).toContain("test.org");
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
      const content = "example.com\ntest.org\nphishing.net";
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
      const content = "url1.com\nurl2.com";
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
          controller.enqueue(new TextEncoder().encode("test.com"));
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

      await service.hasUrl("test.com");

      expect(mockDb.createObjectStore).toHaveBeenCalledWith("phishing-urls", { keyPath: "url" });
    });
  });
});
