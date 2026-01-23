import { MockProxy, mock } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  DefaultTaskSchedulerService,
  TaskSchedulerService,
} from "@bitwarden/common/platform/scheduling";
import { FakeGlobalStateProvider } from "@bitwarden/common/spec";
import { LogService } from "@bitwarden/logging";

import { PhishingDataService } from "./phishing-data.service";
import type { PhishingIndexedDbService } from "./phishing-indexeddb.service";

describe("PhishingDataService", () => {
  let service: PhishingDataService;
  let apiService: MockProxy<ApiService>;
  let taskSchedulerService: TaskSchedulerService;
  let logService: MockProxy<LogService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let mockIndexedDbService: MockProxy<PhishingIndexedDbService>;
  const fakeGlobalStateProvider: FakeGlobalStateProvider = new FakeGlobalStateProvider();
  let fetchChecksumSpy: jest.SpyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Mock Request global if not available
    if (typeof Request === "undefined") {
      (global as any).Request = class {
        constructor(public url: string) {}
      };
    }

    apiService = mock<ApiService>();
    logService = mock<LogService>();
    mockIndexedDbService = mock<PhishingIndexedDbService>();

    // Set default mock behaviors
    mockIndexedDbService.hasUrl.mockResolvedValue(false);
    mockIndexedDbService.loadAllUrls.mockResolvedValue([]);
    mockIndexedDbService.saveUrls.mockResolvedValue(undefined);
    mockIndexedDbService.addUrls.mockResolvedValue(undefined);
    mockIndexedDbService.saveUrlsFromStream.mockResolvedValue(undefined);

    platformUtilsService = mock<PlatformUtilsService>();
    platformUtilsService.getApplicationVersion.mockResolvedValue("1.0.0");

    taskSchedulerService = new DefaultTaskSchedulerService(logService);

    service = new PhishingDataService(
      apiService,
      taskSchedulerService,
      fakeGlobalStateProvider,
      logService,
      platformUtilsService,
    );

    // Replace the IndexedDB service with our mock
    service["indexedDbService"] = mockIndexedDbService;

    fetchChecksumSpy = jest.spyOn(service as any, "fetchPhishingChecksum");
    fetchChecksumSpy.mockResolvedValue("new-checksum");
  });

  describe("initialization", () => {
    it("should initialize with IndexedDB service", () => {
      expect(service["indexedDbService"]).toBeDefined();
    });

    it("should detect QA test addresses", async () => {
      // The QA test address should always return true
      const QAurl = new URL("http://phishing.testcategory.com");
      expect(await service.isPhishingWebAddress(QAurl)).toBe(true);
      // IndexedDB should not be called for test addresses
      expect(mockIndexedDbService.hasUrl).not.toHaveBeenCalled();
    });
  });

  describe("isPhishingWebAddress", () => {
    it("should detect a phishing web address using quick hasUrl lookup", async () => {
      // Mock hasUrl to return true for direct hostname match
      mockIndexedDbService.hasUrl.mockResolvedValue(true);

      const url = new URL("http://phish.com");
      const result = await service.isPhishingWebAddress(url);

      expect(result).toBe(true);
      expect(mockIndexedDbService.hasUrl).toHaveBeenCalledWith("phish.com");
      // Should not fall back to custom matcher when hasUrl returns true
      expect(mockIndexedDbService.loadAllUrls).not.toHaveBeenCalled();
    });

    it("should fall back to custom matcher when hasUrl returns false", async () => {
      // Mock hasUrl to return false (no direct hostname match)
      mockIndexedDbService.hasUrl.mockResolvedValue(false);
      // Mock loadAllUrls to return phishing URLs for custom matcher
      mockIndexedDbService.loadAllUrls.mockResolvedValue(["http://phish.com/path"]);

      const url = new URL("http://phish.com/path");
      const result = await service.isPhishingWebAddress(url);

      expect(result).toBe(true);
      expect(mockIndexedDbService.hasUrl).toHaveBeenCalledWith("phish.com");
      expect(mockIndexedDbService.loadAllUrls).toHaveBeenCalled();
    });

    it("should not detect a safe web address", async () => {
      // Mock hasUrl to return false
      mockIndexedDbService.hasUrl.mockResolvedValue(false);
      // Mock loadAllUrls to return phishing URLs that don't match
      mockIndexedDbService.loadAllUrls.mockResolvedValue(["http://phish.com", "http://badguy.net"]);

      const url = new URL("http://safe.com");
      const result = await service.isPhishingWebAddress(url);

      expect(result).toBe(false);
      expect(mockIndexedDbService.hasUrl).toHaveBeenCalledWith("safe.com");
      expect(mockIndexedDbService.loadAllUrls).toHaveBeenCalled();
    });

    it("should match against root web address with subpaths using custom matcher", async () => {
      // Mock hasUrl to return false (no direct hostname match)
      mockIndexedDbService.hasUrl.mockResolvedValue(false);
      // Mock loadAllUrls to return entry that matches with subpath
      mockIndexedDbService.loadAllUrls.mockResolvedValue(["http://phish.com/login"]);

      const url = new URL("http://phish.com/login/page");
      const result = await service.isPhishingWebAddress(url);

      expect(result).toBe(true);
      expect(mockIndexedDbService.hasUrl).toHaveBeenCalledWith("phish.com");
      expect(mockIndexedDbService.loadAllUrls).toHaveBeenCalled();
    });

    it("should handle IndexedDB errors gracefully", async () => {
      // Mock hasUrl to throw error
      mockIndexedDbService.hasUrl.mockRejectedValue(new Error("hasUrl error"));
      // Mock loadAllUrls to also throw error
      mockIndexedDbService.loadAllUrls.mockRejectedValue(new Error("IndexedDB error"));

      const url = new URL("http://phish.com/about");
      const result = await service.isPhishingWebAddress(url);

      expect(result).toBe(false);
      expect(logService.error).toHaveBeenCalledWith(
        "[PhishingDataService] IndexedDB lookup via hasUrl failed",
        expect.any(Error),
      );
      expect(logService.error).toHaveBeenCalledWith(
        "[PhishingDataService] Error running custom matcher",
        expect.any(Error),
      );
    });
  });

  describe("data updates", () => {
    it("should update full dataset via stream", async () => {
      // Mock full dataset update
      const mockResponse = {
        ok: true,
        body: {} as ReadableStream,
      } as Response;
      apiService.nativeFetch.mockResolvedValue(mockResponse);

      await firstValueFrom(service["_updateFullDataSet"]());

      expect(mockIndexedDbService.saveUrlsFromStream).toHaveBeenCalled();
    });

    it("should update daily dataset via addUrls", async () => {
      // Mock daily update
      const mockResponse = {
        ok: true,
        text: jest.fn().mockResolvedValue("newphish.com\nanotherbad.net"),
      } as unknown as Response;
      apiService.nativeFetch.mockResolvedValue(mockResponse);

      await firstValueFrom(service["_updateDailyDataSet"]());

      expect(mockIndexedDbService.addUrls).toHaveBeenCalledWith(["newphish.com", "anotherbad.net"]);
    });

    it("should get updated meta information", async () => {
      fetchChecksumSpy.mockResolvedValue("new-checksum");
      platformUtilsService.getApplicationVersion.mockResolvedValue("2.0.0");

      const meta = await firstValueFrom(service["_getUpdatedMeta"]());

      expect(meta).toBeDefined();
      expect(meta.checksum).toBe("new-checksum");
      expect(meta.applicationVersion).toBe("2.0.0");
      expect(meta.timestamp).toBeDefined();
    });
  });
});
