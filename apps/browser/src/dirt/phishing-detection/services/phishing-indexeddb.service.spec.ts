import { mock, MockProxy } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { PhishingData } from "./phishing-data.service";
import { PhishingIndexedDbService } from "./phishing-indexeddb.service";

describe("PhishingIndexedDbService", () => {
  let service: PhishingIndexedDbService;
  let logService: MockProxy<LogService>;

  // Mock IndexedDB storage
  let mockStore: Record<string, any>;
  let mockObjectStore: any;
  let mockTransaction: any;
  let mockDb: any;
  let mockOpenRequest: any;

  const testData: PhishingData = {
    webAddresses: ["phishing.com", "malware.net"],
    timestamp: Date.now(),
    checksum: "abc123",
    applicationVersion: "1.0.0",
  };

  beforeEach(() => {
    logService = mock<LogService>();
    mockStore = {};

    // Mock IDBObjectStore
    mockObjectStore = {
      put: jest.fn().mockImplementation((data, key) => {
        const request = {
          error: null as DOMException | null,
          result: undefined as undefined,
          onsuccess: null as (() => void) | null,
          onerror: null as (() => void) | null,
        };
        setTimeout(() => {
          mockStore[key] = data;
          request.onsuccess?.();
        }, 0);
        return request;
      }),
      get: jest.fn().mockImplementation((key) => {
        const request = {
          error: null as DOMException | null,
          result: mockStore[key],
          onsuccess: null as (() => void) | null,
          onerror: null as (() => void) | null,
        };
        setTimeout(() => {
          request.result = mockStore[key];
          request.onsuccess?.();
        }, 0);
        return request;
      }),
      delete: jest.fn().mockImplementation((key) => {
        const request = {
          error: null as DOMException | null,
          result: undefined as undefined,
          onsuccess: null as (() => void) | null,
          onerror: null as (() => void) | null,
        };
        setTimeout(() => {
          delete mockStore[key];
          request.onsuccess?.();
        }, 0);
        return request;
      }),
    };

    // Mock IDBTransaction
    mockTransaction = {
      objectStore: jest.fn().mockReturnValue(mockObjectStore),
    };

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

  describe("save", () => {
    it("stores data in IndexedDB and returns true", async () => {
      const result = await service.save(testData);

      expect(result).toBe(true);
      expect(mockDb.transaction).toHaveBeenCalledWith("phishing-data", "readwrite");
      expect(mockObjectStore.put).toHaveBeenCalledWith(testData, "phishing-domains");
      expect(mockDb.close).toHaveBeenCalled();
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

      const result = await service.save(testData);

      expect(result).toBe(false);
      expect(logService.error).toHaveBeenCalledWith(
        "[PhishingIndexedDbService] Failed to save data",
        expect.any(Error),
      );
    });
  });

  describe("load", () => {
    it("retrieves stored data", async () => {
      mockStore["phishing-domains"] = testData;

      const result = await service.load();

      expect(mockDb.transaction).toHaveBeenCalledWith("phishing-data", "readonly");
      expect(mockObjectStore.get).toHaveBeenCalledWith("phishing-domains");
      expect(result).toEqual(testData);
      expect(mockDb.close).toHaveBeenCalled();
    });

    it("returns null when no data exists", async () => {
      const result = await service.load();

      expect(result).toBeNull();
    });

    it("logs error and returns null on failure", async () => {
      const error = new Error("IndexedDB error");
      mockOpenRequest.error = error;
      (global.indexedDB.open as jest.Mock).mockImplementation(() => {
        setTimeout(() => {
          mockOpenRequest.onerror?.();
        }, 0);
        return mockOpenRequest;
      });

      const result = await service.load();

      expect(result).toBeNull();
      expect(logService.error).toHaveBeenCalledWith(
        "[PhishingIndexedDbService] Failed to load data",
        expect.any(Error),
      );
    });
  });

  describe("clear", () => {
    it("removes stored data and returns true", async () => {
      mockStore["phishing-domains"] = testData;

      const result = await service.clear();

      expect(result).toBe(true);
      expect(mockDb.transaction).toHaveBeenCalledWith("phishing-data", "readwrite");
      expect(mockObjectStore.delete).toHaveBeenCalledWith("phishing-domains");
      expect(mockDb.close).toHaveBeenCalled();
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

      const result = await service.clear();

      expect(result).toBe(false);
      expect(logService.error).toHaveBeenCalledWith(
        "[PhishingIndexedDbService] Failed to clear data",
        expect.any(Error),
      );
    });
  });

  describe("database initialization", () => {
    it("creates object store on upgrade", async () => {
      mockDb.objectStoreNames.contains.mockReturnValue(false);

      (global.indexedDB.open as jest.Mock).mockImplementation(() => {
        setTimeout(() => {
          mockOpenRequest.onupgradeneeded?.({ target: mockOpenRequest });
          mockOpenRequest.onsuccess?.();
        }, 0);
        return mockOpenRequest;
      });

      await service.load();

      expect(mockDb.createObjectStore).toHaveBeenCalledWith("phishing-data");
    });
  });
});
