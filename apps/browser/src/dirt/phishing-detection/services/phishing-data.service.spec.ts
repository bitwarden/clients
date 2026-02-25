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
        "[PhishingDataService] IndexedDB lookup failed",
        expect.any(Error),
      );
      // Custom matcher is disabled, so no custom matcher error is expected
      expect(mockIndexedDbService.findMatchingUrl).not.toHaveBeenCalled();
    });

    it("should use cursor-based search when useCustomMatcher is enabled", async () => {
      // Temporarily enable custom matcher for this test
      const originalValue = (PhishingDataService as any).USE_CUSTOM_MATCHER;
      (PhishingDataService as any).USE_CUSTOM_MATCHER = true;

      try {
        // Mock hasUrl to return false (no direct match)
        mockIndexedDbService.hasUrl.mockResolvedValue(false);
        // Mock findMatchingUrl to return true (custom matcher finds it)
        mockIndexedDbService.findMatchingUrl.mockResolvedValue(true);

        const url = new URL("http://phish.com/path");
        const result = await service.isPhishingWebAddress(url);

        expect(result).toBe(true);
        expect(mockIndexedDbService.hasUrl).toHaveBeenCalled();
        expect(mockIndexedDbService.findMatchingUrl).toHaveBeenCalled();
      } finally {
        // Restore original value
        (PhishingDataService as any).USE_CUSTOM_MATCHER = originalValue;
      }
    });

    it("should return false when custom matcher finds no match (when enabled)", async () => {
      const originalValue = (PhishingDataService as any).USE_CUSTOM_MATCHER;
      (PhishingDataService as any).USE_CUSTOM_MATCHER = true;

      try {
        mockIndexedDbService.hasUrl.mockResolvedValue(false);
        mockIndexedDbService.findMatchingUrl.mockResolvedValue(false);

        const url = new URL("http://safe.com/path");
        const result = await service.isPhishingWebAddress(url);

        expect(result).toBe(false);
        expect(mockIndexedDbService.findMatchingUrl).toHaveBeenCalled();
      } finally {
        (PhishingDataService as any).USE_CUSTOM_MATCHER = originalValue;
      }
    });

    it("should handle custom matcher errors gracefully (when enabled)", async () => {
      const originalValue = (PhishingDataService as any).USE_CUSTOM_MATCHER;
      (PhishingDataService as any).USE_CUSTOM_MATCHER = true;

      try {
        mockIndexedDbService.hasUrl.mockResolvedValue(false);
        mockIndexedDbService.findMatchingUrl.mockRejectedValue(new Error("Cursor error"));

        const url = new URL("http://error.com/path");
        const result = await service.isPhishingWebAddress(url);

        expect(result).toBe(false);
        expect(logService.error).toHaveBeenCalledWith(
          "[PhishingDataService] Custom matcher failed",
          expect.any(Error),
        );
      } finally {
        (PhishingDataService as any).USE_CUSTOM_MATCHER = originalValue;
      }
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

  describe("rate limiting", () => {
    it("should skip update when last check was within 24h", async () => {
      const recentMeta = {
        checksum: "any",
        timestamp: Date.now() - 1000,
        applicationVersion: "1.0.0",
      };

      const result = await firstValueFrom(service["_backgroundUpdate"](recentMeta));

      expect(result).toEqual(recentMeta);
      expect(apiService.nativeFetch).not.toHaveBeenCalled();
      expect(mockIndexedDbService.saveUrlsFromStream).not.toHaveBeenCalled();
    });

    it("should allow update when last check was over 24h ago", async () => {
      const expiredMeta = {
        checksum: "old",
        timestamp: Date.now() - 25 * 60 * 60 * 1000,
        applicationVersion: "1.0.0",
      };
      await fakeGlobalStateProvider.get(PHISHING_DOMAINS_META_KEY).update(() => expiredMeta);

      fetchChecksumSpy.mockResolvedValue("new-checksum");
      platformUtilsService.getApplicationVersion.mockResolvedValue("1.0.0");
      apiService.nativeFetch.mockResolvedValue({
        ok: true,
        body: {} as ReadableStream,
      } as Response);

      const result = await firstValueFrom(service["_backgroundUpdate"](expiredMeta));

      expect(mockIndexedDbService.saveUrlsFromStream).toHaveBeenCalled();
      expect(result?.timestamp).toBeGreaterThan(expiredMeta.timestamp);
    });

    it("should allow update on first run with null metadata", async () => {
      fetchChecksumSpy.mockResolvedValue("first-checksum");
      platformUtilsService.getApplicationVersion.mockResolvedValue("1.0.0");
      apiService.nativeFetch.mockResolvedValue({
        ok: true,
        body: {} as ReadableStream,
      } as Response);

      const result = await firstValueFrom(service["_backgroundUpdate"](null));

      expect(mockIndexedDbService.saveUrlsFromStream).toHaveBeenCalled();
      expect(result?.checksum).toBe("first-checksum");
    });
  });

  describe("checksum-based skip", () => {
    it("should skip CDN download when checksum is unchanged", async () => {
      const meta = {
        checksum: "same-checksum",
        timestamp: Date.now() - 25 * 60 * 60 * 1000,
        applicationVersion: "1.0.0",
      };
      await fakeGlobalStateProvider.get(PHISHING_DOMAINS_META_KEY).update(() => meta);

      fetchChecksumSpy.mockResolvedValue("same-checksum");
      platformUtilsService.getApplicationVersion.mockResolvedValue("1.0.0");

      const result = await firstValueFrom(service["_backgroundUpdate"](meta));

      expect(fetchChecksumSpy).toHaveBeenCalled();
      expect(mockIndexedDbService.saveUrlsFromStream).not.toHaveBeenCalled();
      expect(result?.timestamp).toBeGreaterThan(meta.timestamp);
    });

    it("should download when checksum has changed", async () => {
      const meta = {
        checksum: "old-checksum",
        timestamp: Date.now() - 25 * 60 * 60 * 1000,
        applicationVersion: "1.0.0",
      };
      await fakeGlobalStateProvider.get(PHISHING_DOMAINS_META_KEY).update(() => meta);

      fetchChecksumSpy.mockResolvedValue("new-checksum");
      platformUtilsService.getApplicationVersion.mockResolvedValue("1.0.0");
      apiService.nativeFetch.mockResolvedValue({
        ok: true,
        body: {} as ReadableStream,
      } as Response);

      const result = await firstValueFrom(service["_backgroundUpdate"](meta));

      expect(mockIndexedDbService.saveUrlsFromStream).toHaveBeenCalled();
      expect(result?.checksum).toBe("new-checksum");
    });
  });

  describe("update triggers", () => {
    it("should download full dataset on app version change", async () => {
      const meta = {
        checksum: "same",
        timestamp: Date.now() - 25 * 60 * 60 * 1000,
        applicationVersion: "1.0.0",
      };
      await fakeGlobalStateProvider.get(PHISHING_DOMAINS_META_KEY).update(() => meta);

      fetchChecksumSpy.mockResolvedValue("same");
      platformUtilsService.getApplicationVersion.mockResolvedValue("2.0.0");
      apiService.nativeFetch.mockResolvedValue({
        ok: true,
        body: {} as ReadableStream,
      } as Response);

      const result = await firstValueFrom(service["_backgroundUpdate"](meta));

      expect(mockIndexedDbService.saveUrlsFromStream).toHaveBeenCalled();
      expect(result?.applicationVersion).toBe("2.0.0");
    });

    it("should always save metadata with fresh timestamp", async () => {
      const meta = {
        checksum: "old",
        timestamp: Date.now() - 25 * 60 * 60 * 1000,
        applicationVersion: "1.0.0",
      };
      await fakeGlobalStateProvider.get(PHISHING_DOMAINS_META_KEY).update(() => meta);

      fetchChecksumSpy.mockResolvedValue("new");
      platformUtilsService.getApplicationVersion.mockResolvedValue("1.0.0");
      apiService.nativeFetch.mockResolvedValue({
        ok: true,
        body: {} as ReadableStream,
      } as Response);

      const result = await firstValueFrom(service["_backgroundUpdate"](meta));

      expect(result?.timestamp).toBeGreaterThan(meta.timestamp);
      expect(result?.checksum).toBe("new");
    });

    it("should never invoke daily delta (mechanism removed)", async () => {
      const meta = {
        checksum: "same",
        timestamp: Date.now() - 25 * 60 * 60 * 1000,
        applicationVersion: "1.0.0",
      };
      await fakeGlobalStateProvider.get(PHISHING_DOMAINS_META_KEY).update(() => meta);

      fetchChecksumSpy.mockResolvedValue("different");
      platformUtilsService.getApplicationVersion.mockResolvedValue("1.0.0");
      apiService.nativeFetch.mockResolvedValue({
        ok: true,
        body: {} as ReadableStream,
      } as Response);

      await firstValueFrom(service["_backgroundUpdate"](meta));

      expect(mockIndexedDbService.addUrls).not.toHaveBeenCalled();
    });
  });
});
