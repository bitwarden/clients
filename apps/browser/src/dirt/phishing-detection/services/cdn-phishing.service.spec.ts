import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { CDNPhishingService } from "./cdn-phishing.service";

// Mock fetch globally
global.fetch = jest.fn();

describe("CDNPhishingService", () => {
  let service: CDNPhishingService;
  let logService: LogService;
  let parserService: any;
  let checksumService: any;

  beforeEach(() => {
    logService = {
      info: jest.fn(),
      debug: jest.fn(),
      warning: jest.fn(),
      error: jest.fn(),
    } as any;

    parserService = {
      parseDomains: jest.fn(),
    } as any;

    checksumService = {
      calculateChecksum: jest.fn(),
      validateChecksum: jest.fn(),
    } as any;

    service = new CDNPhishingService(logService, parserService, checksumService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getPhishingDomainsAsync", () => {
    it("should fetch and parse domains successfully", async () => {
      const mockContent = "phishing1.com\nphishing2.com\n# comment\nphishing3.com";
      const mockDomains = ["phishing1.com", "phishing2.com", "phishing3.com"];
      const mockResponse = {
        ok: true,
        text: jest.fn().mockResolvedValue(mockContent),
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);
      parserService.parseDomains.mockReturnValue(mockDomains);

      const result = await service.getPhishingDomainsAsync();

      expect(global.fetch).toHaveBeenCalledWith(
        "https://raw.githubusercontent.com/Phishing-Database/Phishing.Database/master/phishing-domains-ACTIVE.txt",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Accept: "text/plain",
          }),
        }),
      );
      expect(parserService.parseDomains).toHaveBeenCalledWith(mockContent);
      expect(result).toEqual(mockDomains);
      expect(logService.info).toHaveBeenCalledWith(
        "[CDNPhishingService] Fetching phishing domains from GitHub CDN",
      );
      expect(logService.info).toHaveBeenCalledWith(
        "[CDNPhishingService] Successfully parsed 3 domains from GitHub CDN",
      );
    });

    it("should handle HTTP error responses", async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: "Not Found",
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      await expect(service.getPhishingDomainsAsync()).rejects.toThrow("HTTP 404: Not Found");
      expect(logService.error).toHaveBeenCalledWith(
        "[CDNPhishingService] Failed to fetch phishing domains from GitHub CDN:",
        expect.any(Error),
      );
    });

    it("should handle network errors", async () => {
      const networkError = new Error("Network error");
      (global.fetch as jest.Mock).mockRejectedValue(networkError);

      await expect(service.getPhishingDomainsAsync()).rejects.toThrow("Network error");
      expect(logService.error).toHaveBeenCalledWith(
        "[CDNPhishingService] Failed to fetch phishing domains from GitHub CDN:",
        networkError,
      );
    });

    it("should handle timeout errors", async () => {
      const timeoutError = new Error("Request timeout after 15000ms");
      (global.fetch as jest.Mock).mockRejectedValue(timeoutError);

      await expect(service.getPhishingDomainsAsync()).rejects.toThrow(
        "Request timeout after 15000ms",
      );
    });
  });

  describe("getRemoteChecksumAsync", () => {
    it("should fetch and parse remote SHA-256 checksum successfully", async () => {
      const mockChecksumLine =
        "00feeac3b6deed8baf165f00cce816971e8da9e2cb8a59d3cec5823f1f4787d2 *phishing-domains-ACTIVE.txt";
      const mockResponse = {
        ok: true,
        text: jest.fn().mockResolvedValue(mockChecksumLine),
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);
      checksumService.validateChecksum.mockReturnValue(true);

      const result = await service.getRemoteChecksumAsync();

      expect(global.fetch).toHaveBeenCalledWith(
        "https://raw.githubusercontent.com/Phishing-Database/checksums/refs/heads/master/phishing-domains-ACTIVE.txt.sha256",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Accept: "text/plain",
          }),
        }),
      );
      expect(result).toBe("00feeac3b6deed8baf165f00cce816971e8da9e2cb8a59d3cec5823f1f4787d2");
      expect(logService.info).toHaveBeenCalledWith(
        "[CDNPhishingService] Fetching remote checksum (SHA-256) from GitHub checksums repo",
      );
      expect(logService.info).toHaveBeenCalledWith(
        "[CDNPhishingService] Successfully retrieved remote checksum: 00feeac3b6deed8baf165f00cce816971e8da9e2cb8a59d3cec5823f1f4787d2",
      );
    });

    it("should handle HTTP error responses", async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      await expect(service.getRemoteChecksumAsync()).rejects.toThrow(
        "HTTP 500: Internal Server Error",
      );
      expect(logService.error).toHaveBeenCalledWith(
        "[CDNPhishingService] Failed to fetch remote checksum from GitHub:",
        expect.any(Error),
      );
    });

    it("should handle invalid checksum formats", async () => {
      const invalidContent = "not-a-checksum-value";
      const mockResponse = { ok: true, text: jest.fn().mockResolvedValue(invalidContent) };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);
      checksumService.validateChecksum.mockReturnValue(false);

      await expect(service.getRemoteChecksumAsync()).rejects.toThrow(
        "Invalid checksum format received from remote checksums repo",
      );
    });

    it("should handle network errors", async () => {
      const networkError = new Error("Network error");
      (global.fetch as jest.Mock).mockRejectedValue(networkError);

      await expect(service.getRemoteChecksumAsync()).rejects.toThrow("Network error");
      expect(logService.error).toHaveBeenCalledWith(
        "[CDNPhishingService] Failed to fetch remote checksum from GitHub:",
        networkError,
      );
    });
  });

  describe("_fetchWithTimeout", () => {
    it("should handle successful requests within timeout", async () => {
      const mockResponse = { ok: true, text: jest.fn() };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service["_fetchWithTimeout"]("https://example.com");

      expect(result).toBe(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        "https://example.com",
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        }),
      );
    });

    it("should handle timeout errors", async () => {
      // Mock fetch to never resolve
      (global.fetch as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve, reject) => {
            // Simulate timeout by rejecting with AbortError
            setTimeout(() => {
              const error = new Error("Request timeout after 60000ms");
              error.name = "AbortError";
              reject(error);
            }, 100);
          }),
      );

      await expect(service["_fetchWithTimeout"]("https://example.com")).rejects.toThrow(
        "Request timeout after 15000ms",
      );
    });

    it("should handle abort errors", async () => {
      const abortError = new Error("Request aborted");
      abortError.name = "AbortError";
      (global.fetch as jest.Mock).mockRejectedValue(abortError);

      await expect(service["_fetchWithTimeout"]("https://example.com")).rejects.toThrow(
        "Request timeout after 15000ms",
      );
    });
  });
});
