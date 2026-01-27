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

import { PHISHING_DOMAINS_META_KEY, PhishingDataService } from "./phishing-data.service";
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
    mockIndexedDbService.findMatchingUrl.mockResolvedValue(false);
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

    it("should detect QA test addresses - http protocol", async () => {
      const url = new URL("http://phishing.testcategory.com");
      expect(await service.isPhishingWebAddress(url)).toBe(true);
      // IndexedDB should not be called for test addresses
      expect(mockIndexedDbService.hasUrl).not.toHaveBeenCalled();
    });

    it("should detect QA test addresses - https protocol", async () => {
      const url = new URL("https://phishing.testcategory.com");
      expect(await service.isPhishingWebAddress(url)).toBe(true);
      expect(mockIndexedDbService.hasUrl).not.toHaveBeenCalled();
    });

    it("should detect QA test addresses - specific subpath /block", async () => {
      const url = new URL("https://phishing.testcategory.com/block");
      expect(await service.isPhishingWebAddress(url)).toBe(true);
      expect(mockIndexedDbService.hasUrl).not.toHaveBeenCalled();
    });

    it("should NOT detect QA test addresses - different subpath", async () => {
      mockIndexedDbService.hasUrl.mockResolvedValue(false);
      mockIndexedDbService.findMatchingUrl.mockResolvedValue(false);

      const url = new URL("https://phishing.testcategory.com/other");
      const result = await service.isPhishingWebAddress(url);

      // This should NOT be detected as a test address since only /block subpath is hardcoded
      expect(result).toBe(false);
    });

    it("should detect QA test addresses - root path with trailing slash", async () => {
      const url = new URL("https://phishing.testcategory.com/");
      const result = await service.isPhishingWebAddress(url);

      // This SHOULD be detected since URLs are normalized (trailing slash added to root URLs)
      expect(result).toBe(true);
      expect(mockIndexedDbService.hasUrl).not.toHaveBeenCalled();
    });
  });

  describe("isPhishingWebAddress", () => {
    it("should detect a phishing web address using quick hasUrl lookup", async () => {
      // Mock hasUrl to return true for direct hostname match
      mockIndexedDbService.hasUrl.mockResolvedValue(true);

      const url = new URL("http://phish.com/testing-param");
      const result = await service.isPhishingWebAddress(url);

      expect(result).toBe(true);
      expect(mockIndexedDbService.hasUrl).toHaveBeenCalledWith("http://phish.com/testing-param");
      // Should not fall back to custom matcher when hasUrl returns true
      expect(mockIndexedDbService.findMatchingUrl).not.toHaveBeenCalled();
    });

    it("should return false when hasUrl returns false (custom matcher disabled)", async () => {
      // Mock hasUrl to return false (no direct href match)
      mockIndexedDbService.hasUrl.mockResolvedValue(false);

      const url = new URL("http://phish.com/path");
      const result = await service.isPhishingWebAddress(url);

      // Custom matcher is currently disabled (useCustomMatcher: false), so result is false
      expect(result).toBe(false);
      expect(mockIndexedDbService.hasUrl).toHaveBeenCalledWith("http://phish.com/path");
      // Custom matcher should NOT be called since it's disabled
      expect(mockIndexedDbService.findMatchingUrl).not.toHaveBeenCalled();
    });

    it("should not detect a safe web address", async () => {
      // Mock hasUrl to return false
      mockIndexedDbService.hasUrl.mockResolvedValue(false);

      const url = new URL("http://safe.com");
      const result = await service.isPhishingWebAddress(url);

      expect(result).toBe(false);
      expect(mockIndexedDbService.hasUrl).toHaveBeenCalledWith("http://safe.com/");
      // Custom matcher is disabled, so findMatchingUrl should NOT be called
      expect(mockIndexedDbService.findMatchingUrl).not.toHaveBeenCalled();
    });

    it("should not match against root web address with subpaths (custom matcher disabled)", async () => {
      // Mock hasUrl to return false (no direct href match)
      mockIndexedDbService.hasUrl.mockResolvedValue(false);

      const url = new URL("http://phish.com/login/page");
      const result = await service.isPhishingWebAddress(url);

      expect(result).toBe(false);
      expect(mockIndexedDbService.hasUrl).toHaveBeenCalledWith("http://phish.com/login/page");
      // Custom matcher is disabled, so findMatchingUrl should NOT be called
      expect(mockIndexedDbService.findMatchingUrl).not.toHaveBeenCalled();
    });

    it("should not match against root web address with different subpaths (custom matcher disabled)", async () => {
      // Mock hasUrl to return false (no direct hostname match)
      mockIndexedDbService.hasUrl.mockResolvedValue(false);

      const url = new URL("http://phish.com/login/page2");
      const result = await service.isPhishingWebAddress(url);

      expect(result).toBe(false);
      expect(mockIndexedDbService.hasUrl).toHaveBeenCalledWith("http://phish.com/login/page2");
      // Custom matcher is disabled, so findMatchingUrl should NOT be called
      expect(mockIndexedDbService.findMatchingUrl).not.toHaveBeenCalled();
    });

    it("should handle IndexedDB errors gracefully", async () => {
      // Mock hasUrl to throw error
      mockIndexedDbService.hasUrl.mockRejectedValue(new Error("hasUrl error"));

      const url = new URL("http://phish.com/about");
      const result = await service.isPhishingWebAddress(url);

      expect(result).toBe(false);
      expect(logService.error).toHaveBeenCalledWith(
        "[PhishingDataService] IndexedDB lookup via hasUrl failed",
        expect.any(Error),
      );
      // Custom matcher is disabled, so no custom matcher error is expected
      expect(mockIndexedDbService.findMatchingUrl).not.toHaveBeenCalled();
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

  describe("phishing meta data updates", () => {
    it("should not update metadata when no data updates occur", async () => {
      // Set up existing metadata
      const existingMeta = {
        checksum: "existing-checksum",
        timestamp: Date.now() - 1000, // 1 second ago (not expired)
        applicationVersion: "1.0.0",
      };
      await fakeGlobalStateProvider.get(PHISHING_DOMAINS_META_KEY).update(() => existingMeta);

      // Mock conditions where no update is needed
      fetchChecksumSpy.mockResolvedValue("existing-checksum"); // Same checksum
      platformUtilsService.getApplicationVersion.mockResolvedValue("1.0.0"); // Same version
      const mockResponse = {
        ok: true,
        body: {} as ReadableStream,
      } as Response;
      apiService.nativeFetch.mockResolvedValue(mockResponse);

      // Trigger background update
      const result = await firstValueFrom(service["_backgroundUpdate"](existingMeta));

      // Verify metadata was NOT updated (same reference returned)
      expect(result).toEqual(existingMeta);
      expect(result?.timestamp).toBe(existingMeta.timestamp);

      // Verify no data updates were performed
      expect(mockIndexedDbService.saveUrlsFromStream).not.toHaveBeenCalled();
      expect(mockIndexedDbService.addUrls).not.toHaveBeenCalled();
    });

    it("should update metadata when full dataset update occurs due to checksum change", async () => {
      // Set up existing metadata
      const existingMeta = {
        checksum: "old-checksum",
        timestamp: Date.now() - 1000,
        applicationVersion: "1.0.0",
      };
      await fakeGlobalStateProvider.get(PHISHING_DOMAINS_META_KEY).update(() => existingMeta);

      // Mock conditions for full update
      fetchChecksumSpy.mockResolvedValue("new-checksum"); // Different checksum
      platformUtilsService.getApplicationVersion.mockResolvedValue("1.0.0");
      const mockResponse = {
        ok: true,
        body: {} as ReadableStream,
      } as Response;
      apiService.nativeFetch.mockResolvedValue(mockResponse);

      // Trigger background update
      const result = await firstValueFrom(service["_backgroundUpdate"](existingMeta));

      // Verify metadata WAS updated with new values
      expect(result?.checksum).toBe("new-checksum");
      expect(result?.timestamp).toBeGreaterThan(existingMeta.timestamp);

      // Verify full update was performed
      expect(mockIndexedDbService.saveUrlsFromStream).toHaveBeenCalled();
      expect(mockIndexedDbService.addUrls).not.toHaveBeenCalled(); // Daily should not run
    });

    it("should update metadata when full dataset update occurs due to version change", async () => {
      // Set up existing metadata
      const existingMeta = {
        checksum: "same-checksum",
        timestamp: Date.now() - 1000,
        applicationVersion: "1.0.0",
      };
      await fakeGlobalStateProvider.get(PHISHING_DOMAINS_META_KEY).update(() => existingMeta);

      // Mock conditions for full update
      fetchChecksumSpy.mockResolvedValue("same-checksum");
      platformUtilsService.getApplicationVersion.mockResolvedValue("2.0.0"); // Different version
      const mockResponse = {
        ok: true,
        body: {} as ReadableStream,
      } as Response;
      apiService.nativeFetch.mockResolvedValue(mockResponse);

      // Trigger background update
      const result = await firstValueFrom(service["_backgroundUpdate"](existingMeta));

      // Verify metadata WAS updated
      expect(result?.applicationVersion).toBe("2.0.0");
      expect(result?.timestamp).toBeGreaterThan(existingMeta.timestamp);

      // Verify full update was performed
      expect(mockIndexedDbService.saveUrlsFromStream).toHaveBeenCalled();
      expect(mockIndexedDbService.addUrls).not.toHaveBeenCalled();
    });

    it("should update metadata when daily update occurs due to cache expiration", async () => {
      // Set up existing metadata (expired cache)
      const existingMeta = {
        checksum: "same-checksum",
        timestamp: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago (expired)
        applicationVersion: "1.0.0",
      };
      await fakeGlobalStateProvider.get(PHISHING_DOMAINS_META_KEY).update(() => existingMeta);

      // Mock conditions for daily update only
      fetchChecksumSpy.mockResolvedValue("same-checksum"); // Same checksum (no full update)
      platformUtilsService.getApplicationVersion.mockResolvedValue("1.0.0"); // Same version
      const mockFullResponse = {
        ok: true,
        body: {} as ReadableStream,
      } as Response;
      const mockDailyResponse = {
        ok: true,
        text: jest.fn().mockResolvedValue("newdomain.com"),
      } as unknown as Response;
      apiService.nativeFetch
        .mockResolvedValueOnce(mockFullResponse)
        .mockResolvedValueOnce(mockDailyResponse);

      // Trigger background update
      const result = await firstValueFrom(service["_backgroundUpdate"](existingMeta));

      // Verify metadata WAS updated
      expect(result?.timestamp).toBeGreaterThan(existingMeta.timestamp);
      expect(result?.checksum).toBe("same-checksum");

      // Verify only daily update was performed
      expect(mockIndexedDbService.saveUrlsFromStream).not.toHaveBeenCalled();
      expect(mockIndexedDbService.addUrls).toHaveBeenCalledWith(["newdomain.com"]);
    });
  });
});
