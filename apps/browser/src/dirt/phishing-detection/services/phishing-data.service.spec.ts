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

  describe("delta sync - background update", () => {
    const mockManifest = {
      version: 1,
      full_list: {
        path: "link-blocklist.txt",
        sha256: "current-full-sha256",
        sorted_sha256: "current-sorted-sha256",
        line_count: 100,
      },
      patches: [
        {
          date: "2026-03-10",
          path: "patches/2026-03-10.patch",
          from_sha256: "old-sha256",
          to_sha256: "current-full-sha256",
        },
      ],
    };

    let fetchManifestSpy: jest.SpyInstance;
    let computeLocalHashesSpy: jest.SpyInstance;

    beforeEach(() => {
      fetchManifestSpy = jest.spyOn(service as any, "fetchManifest");
      computeLocalHashesSpy = jest.spyOn(service as any, "computeLocalHashes");
    });

    it("should no-op when local sha256 matches manifest", async () => {
      const existingMeta = {
        checksum: "",
        timestamp: Date.now() - 1000,
        applicationVersion: "1.0.0",
        sha256: "current-full-sha256",
        sortedSha256: "current-sorted-sha256",
      };

      fetchManifestSpy.mockResolvedValue(mockManifest);

      const result = await firstValueFrom(service["_backgroundUpdate"](existingMeta));

      expect(result).toBeDefined();
      // No download should have occurred
      expect(mockIndexedDbService.saveUrlsFromStream).not.toHaveBeenCalled();
      expect(mockIndexedDbService.addUrls).not.toHaveBeenCalled();
    });

    it("should perform full update on app version change", async () => {
      const existingMeta = {
        checksum: "",
        timestamp: Date.now() - 1000,
        applicationVersion: "1.0.0",
        sha256: "current-full-sha256",
        sortedSha256: "current-sorted-sha256",
      };

      platformUtilsService.getApplicationVersion.mockResolvedValue("2.0.0");
      fetchManifestSpy.mockResolvedValue(mockManifest);
      computeLocalHashesSpy.mockResolvedValue({
        sha256: "new-sha256",
        sortedSha256: "new-sorted-sha256",
      });

      const mockResponse = {
        ok: true,
        body: {} as ReadableStream,
      } as Response;
      apiService.nativeFetch.mockResolvedValue(mockResponse);

      const result = await firstValueFrom(service["_backgroundUpdate"](existingMeta));

      expect(result?.applicationVersion).toBe("2.0.0");
      expect(mockIndexedDbService.saveUrlsFromStream).toHaveBeenCalled();
    });

    it("should perform full update when no local sha256 exists (first install)", async () => {
      const existingMeta = {
        checksum: "old-checksum",
        timestamp: Date.now() - 1000,
        applicationVersion: "1.0.0",
        // No sha256 — first install or upgrade
      };

      fetchManifestSpy.mockResolvedValue(mockManifest);
      computeLocalHashesSpy.mockResolvedValue({
        sha256: "current-full-sha256",
        sortedSha256: "current-sorted-sha256",
      });

      const mockResponse = {
        ok: true,
        body: {} as ReadableStream,
      } as Response;
      apiService.nativeFetch.mockResolvedValue(mockResponse);

      const result = await firstValueFrom(service["_backgroundUpdate"](existingMeta));

      expect(result?.sha256).toBe("current-full-sha256");
      expect(mockIndexedDbService.saveUrlsFromStream).toHaveBeenCalled();
    });

    it("should fall back to legacy sync when manifest fetch fails", async () => {
      const existingMeta = {
        checksum: "old-checksum",
        timestamp: Date.now() - 1000,
        applicationVersion: "1.0.0",
      };

      fetchManifestSpy.mockRejectedValue(new Error("Network error"));
      fetchChecksumSpy.mockResolvedValue("new-checksum");

      const mockResponse = {
        ok: true,
        body: {} as ReadableStream,
      } as Response;
      apiService.nativeFetch.mockResolvedValue(mockResponse);

      const result = await firstValueFrom(service["_backgroundUpdate"](existingMeta));

      expect(result?.checksum).toBe("new-checksum");
      expect(mockIndexedDbService.saveUrlsFromStream).toHaveBeenCalled();
    });

    it("should return previous meta when legacy sync checksum unchanged and manifest unavailable", async () => {
      const existingMeta = {
        checksum: "same-checksum",
        timestamp: Date.now() - 1000,
        applicationVersion: "1.0.0",
      };

      fetchManifestSpy.mockRejectedValue(new Error("Network error"));
      fetchChecksumSpy.mockResolvedValue("same-checksum");

      const result = await firstValueFrom(service["_backgroundUpdate"](existingMeta));

      expect(mockIndexedDbService.saveUrlsFromStream).not.toHaveBeenCalled();
    });
  });
});
