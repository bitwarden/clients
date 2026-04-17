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

    it("should detect HTTPS URL when block list contains HTTP version", async () => {
      mockIndexedDbService.hasUrl.mockImplementation(async (url: string) => {
        return url === "http://phish.com/malicious-page";
      });

      const url = new URL("https://phish.com/malicious-page");
      const result = await service.isPhishingWebAddress(url);

      expect(result).toBe(true);
      expect(mockIndexedDbService.hasUrl).toHaveBeenCalledWith("https://phish.com/malicious-page");
      expect(mockIndexedDbService.hasUrl).toHaveBeenCalledWith("http://phish.com/malicious-page");
    });

    it("should detect HTTP URL when block list contains HTTPS version", async () => {
      mockIndexedDbService.hasUrl.mockImplementation(async (url: string) => {
        return url === "https://phish.com/malicious-page";
      });

      const url = new URL("http://phish.com/malicious-page");
      const result = await service.isPhishingWebAddress(url);

      expect(result).toBe(true);
      expect(mockIndexedDbService.hasUrl).toHaveBeenCalledWith("http://phish.com/malicious-page");
      expect(mockIndexedDbService.hasUrl).toHaveBeenCalledWith("https://phish.com/malicious-page");
    });

    it("should detect HTTPS URL with trailing slash when block list contains HTTP without trailing slash", async () => {
      mockIndexedDbService.hasUrl.mockImplementation(async (url: string) => {
        return url === "http://phish.com";
      });

      // Browsers add trailing slash to root URLs: https://phish.com/
      const url = new URL("https://phish.com");
      const result = await service.isPhishingWebAddress(url);

      expect(result).toBe(true);
    });

    it("should not perform alternate-protocol lookup when exact match is found", async () => {
      mockIndexedDbService.hasUrl.mockImplementation(async (url: string) => {
        return url === "https://phish.com/exact";
      });

      const url = new URL("https://phish.com/exact");
      const result = await service.isPhishingWebAddress(url);

      expect(result).toBe(true);
      // Should have been called only once (exact match found on first try)
      expect(mockIndexedDbService.hasUrl).toHaveBeenCalledTimes(1);
    });

    it("should return false when neither protocol matches", async () => {
      mockIndexedDbService.hasUrl.mockResolvedValue(false);

      const url = new URL("https://safe-site.com/page");
      const result = await service.isPhishingWebAddress(url);

      expect(result).toBe(false);
    });

    it("should skip non-http protocols without alternate lookup", async () => {
      const url = new URL("ftp://phish.com/file");
      const result = await service.isPhishingWebAddress(url);

      expect(result).toBe(false);
      expect(mockIndexedDbService.hasUrl).not.toHaveBeenCalled();
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

    beforeEach(() => {
      fetchManifestSpy = jest.spyOn(service as any, "fetchManifest");
      // saveUrlsFromStream now returns a sha256 string
      mockIndexedDbService.saveUrlsFromStream.mockResolvedValue("current-full-sha256");
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

      await firstValueFrom(service["_backgroundUpdate"](existingMeta));

      expect(mockIndexedDbService.saveUrlsFromStream).not.toHaveBeenCalled();
    });

    it("should apply single patch when one patch behind", async () => {
      const existingMeta = {
        checksum: "",
        timestamp: Date.now() - 1000,
        applicationVersion: "1.0.0",
        sha256: "old-sha256",
        sortedSha256: "old-sorted",
      };

      fetchManifestSpy.mockResolvedValue(mockManifest);
      mockIndexedDbService.addUrls.mockResolvedValue(true);
      mockIndexedDbService.removeUrls.mockResolvedValue(true);

      const fetchPatchSpy = jest.spyOn(service as any, "fetchPatch");
      fetchPatchSpy.mockResolvedValue({
        additions: ["http://new-phish.com"],
        removals: ["http://old-false-positive.com"],
      });

      const result = await firstValueFrom(service["_backgroundUpdate"](existingMeta));

      expect(fetchPatchSpy).toHaveBeenCalledWith("patches/2026-03-10.patch");
      expect(mockIndexedDbService.addUrls).toHaveBeenCalledWith(["http://new-phish.com"]);
      expect(mockIndexedDbService.removeUrls).toHaveBeenCalledWith([
        "http://old-false-positive.com",
      ]);
      expect(result?.sha256).toBe("current-full-sha256");
    });

    it("should apply multiple patches in chain order", async () => {
      const multiPatchManifest = {
        ...mockManifest,
        patches: [
          {
            date: "2026-03-11",
            path: "patches/day2.patch",
            from_sha256: "mid-sha",
            to_sha256: "current-full-sha256",
          },
          {
            date: "2026-03-10",
            path: "patches/day1.patch",
            from_sha256: "old-sha",
            to_sha256: "mid-sha",
          },
        ],
      };

      const existingMeta = {
        checksum: "",
        timestamp: Date.now() - 1000,
        applicationVersion: "1.0.0",
        sha256: "old-sha",
        sortedSha256: "old-sorted",
      };

      fetchManifestSpy.mockResolvedValue(multiPatchManifest);
      mockIndexedDbService.addUrls.mockResolvedValue(true);
      mockIndexedDbService.removeUrls.mockResolvedValue(true);

      const fetchPatchSpy = jest.spyOn(service as any, "fetchPatch");
      fetchPatchSpy
        .mockResolvedValueOnce({ additions: ["http://day1.com"], removals: [] })
        .mockResolvedValueOnce({ additions: ["http://day2.com"], removals: [] });

      const result = await firstValueFrom(service["_backgroundUpdate"](existingMeta));

      expect(fetchPatchSpy).toHaveBeenCalledTimes(2);
      expect(mockIndexedDbService.addUrls).toHaveBeenCalledTimes(2);
      expect(result?.sha256).toBe("current-full-sha256");
    });

    it("should apply patch with only additions (no removals)", async () => {
      const existingMeta = {
        checksum: "",
        timestamp: Date.now() - 1000,
        applicationVersion: "1.0.0",
        sha256: "old-sha256",
        sortedSha256: "old-sorted",
      };

      fetchManifestSpy.mockResolvedValue(mockManifest);
      mockIndexedDbService.addUrls.mockResolvedValue(true);

      const fetchPatchSpy = jest.spyOn(service as any, "fetchPatch");
      fetchPatchSpy.mockResolvedValue({
        additions: ["http://new1.com", "http://new2.com"],
        removals: [],
      });

      await firstValueFrom(service["_backgroundUpdate"](existingMeta));

      expect(mockIndexedDbService.addUrls).toHaveBeenCalledWith([
        "http://new1.com",
        "http://new2.com",
      ]);
      expect(mockIndexedDbService.removeUrls).not.toHaveBeenCalled();
    });

    it("should apply patch with only removals (no additions)", async () => {
      const existingMeta = {
        checksum: "",
        timestamp: Date.now() - 1000,
        applicationVersion: "1.0.0",
        sha256: "old-sha256",
        sortedSha256: "old-sorted",
      };

      fetchManifestSpy.mockResolvedValue(mockManifest);
      mockIndexedDbService.removeUrls.mockResolvedValue(true);

      const fetchPatchSpy = jest.spyOn(service as any, "fetchPatch");
      fetchPatchSpy.mockResolvedValue({
        additions: [],
        removals: ["http://removed1.com", "http://removed2.com"],
      });

      await firstValueFrom(service["_backgroundUpdate"](existingMeta));

      expect(mockIndexedDbService.removeUrls).toHaveBeenCalledWith([
        "http://removed1.com",
        "http://removed2.com",
      ]);
      expect(mockIndexedDbService.addUrls).not.toHaveBeenCalled();
    });

    it("should throw when addUrls fails during patch application", async () => {
      mockIndexedDbService.addUrls.mockResolvedValue(false);

      const fetchPatchSpy = jest.spyOn(service as any, "fetchPatch");
      fetchPatchSpy.mockResolvedValue({
        additions: ["http://new.com"],
        removals: [],
      });

      // applyPatchChain should throw when addUrls returns false
      await expect(service["applyPatchChain"](mockManifest, "old-sha256")).rejects.toThrow(
        "Failed to add",
      );

      expect(mockIndexedDbService.addUrls).toHaveBeenCalled();
    });

    it("should throw when removeUrls fails during patch application", async () => {
      mockIndexedDbService.removeUrls.mockResolvedValue(false);

      const fetchPatchSpy = jest.spyOn(service as any, "fetchPatch");
      fetchPatchSpy.mockResolvedValue({
        additions: [],
        removals: ["http://old.com"],
      });

      await expect(service["applyPatchChain"](mockManifest, "old-sha256")).rejects.toThrow(
        "Failed to remove",
      );

      expect(mockIndexedDbService.removeUrls).toHaveBeenCalled();
    });

    it("should fall back to full download when no matching patch exists (stale client)", async () => {
      const existingMeta = {
        checksum: "",
        timestamp: Date.now() - 1000,
        applicationVersion: "1.0.0",
        sha256: "very-old-sha256-not-in-any-patch",
        sortedSha256: "old-sorted",
      };

      fetchManifestSpy.mockResolvedValue(mockManifest);

      const mockResponse = {
        ok: true,
        body: {} as ReadableStream,
      } as Response;
      apiService.nativeFetch.mockResolvedValue(mockResponse);

      const result = await firstValueFrom(service["_backgroundUpdate"](existingMeta));

      // No matching patch → falls back to full download
      expect(mockIndexedDbService.saveUrlsFromStream).toHaveBeenCalled();
      expect(result?.sha256).toBe("current-full-sha256");
    });

    it("should fall back to legacy sync when manifest returns malformed data", async () => {
      const existingMeta = {
        checksum: "old-checksum",
        timestamp: Date.now() - 1000,
        applicationVersion: "1.0.0",
      };

      // Manifest fetch succeeds but returns data that causes an error downstream
      fetchManifestSpy.mockRejectedValue(new TypeError("Cannot read properties of undefined"));
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
  });
});
