import { ApiService } from "../abstractions/api.service";
import { HibpApiService } from "../dirt/services/hibp-api.service";
import { CryptoFunctionService } from "../key-management/crypto/abstractions/crypto-function.service";
import { ErrorResponse } from "../models/response/error.response";

import { AuditService } from "./audit.service";

jest.useFakeTimers();

// Polyfill global Request for Jest environment if not present
if (typeof global.Request === "undefined") {
  global.Request = jest.fn((input: string | URL, init?: RequestInit) => {
    return { url: typeof input === "string" ? input : input.toString(), ...init };
  }) as any;
}

describe("AuditService", () => {
  let auditService: AuditService;
  let mockCrypto: jest.Mocked<CryptoFunctionService>;
  let mockApi: jest.Mocked<ApiService>;
  let mockHibpApi: jest.Mocked<HibpApiService>;

  beforeEach(() => {
    mockCrypto = {
      hash: jest.fn().mockResolvedValue(Buffer.from("AABBCCDDEEFF", "hex")),
    } as unknown as jest.Mocked<CryptoFunctionService>;

    mockApi = {
      nativeFetch: jest.fn().mockResolvedValue({
        text: jest.fn().mockResolvedValue(`CDDEEFF:4\nDDEEFF:2\n123456:1`),
      }),
    } as unknown as jest.Mocked<ApiService>;

    mockHibpApi = {
      getHibpBreach: jest.fn(),
    } as unknown as jest.Mocked<HibpApiService>;

    auditService = new AuditService(mockCrypto, mockApi, mockHibpApi, 2);
  });

  it("should not exceed max concurrent passwordLeaked requests", async () => {
    const inFlight: string[] = [];
    const maxInFlight: number[] = [];

    // Patch fetchLeakedPasswordCount to track concurrency
    const origFetch = (auditService as any).fetchLeakedPasswordCount.bind(auditService);
    jest
      .spyOn(auditService as any, "fetchLeakedPasswordCount")
      .mockImplementation(async (password: string) => {
        inFlight.push(password);
        maxInFlight.push(inFlight.length);
        // Simulate async work to allow concurrency limiter to take effect
        await new Promise((resolve) => setTimeout(resolve, 100));
        inFlight.splice(inFlight.indexOf(password), 1);
        return origFetch(password);
      });

    const p1 = auditService.passwordLeaked("password1");
    const p2 = auditService.passwordLeaked("password2");
    const p3 = auditService.passwordLeaked("password3");
    const p4 = auditService.passwordLeaked("password4");

    jest.advanceTimersByTime(250);

    // Flush all pending timers and microtasks
    await jest.runAllTimersAsync();
    await Promise.all([p1, p2, p3, p4]);

    // The max value in maxInFlight should not exceed 2 (the concurrency limit)
    expect(Math.max(...maxInFlight)).toBeLessThanOrEqual(2);
    expect((auditService as any).fetchLeakedPasswordCount).toHaveBeenCalledTimes(4);
    expect(mockCrypto.hash).toHaveBeenCalledTimes(4);
    expect(mockApi.nativeFetch).toHaveBeenCalledTimes(4);
  });

  it("should return empty array for breachedAccounts on 404", async () => {
    mockHibpApi.getHibpBreach.mockRejectedValueOnce({ statusCode: 404 } as ErrorResponse);
    const result = await auditService.breachedAccounts("user@example.com");
    expect(result).toEqual([]);
  });

  it("should throw error for breachedAccounts on non-404 error", async () => {
    mockHibpApi.getHibpBreach.mockRejectedValueOnce({ statusCode: 500 } as ErrorResponse);
    await expect(auditService.breachedAccounts("user@example.com")).rejects.toThrow();
  });
});

describe("AuditService phishing domains", () => {
  let auditService: AuditService;
  let mockApi: jest.Mocked<ApiService>;

  beforeEach(() => {
    mockApi = {
      nativeFetch: jest.fn(),
    } as unknown as jest.Mocked<ApiService>;

    auditService = new AuditService(
      {} as any, // cryptoFunctionService not needed for these tests
      mockApi,
      {} as any, // hibpApiService not needed for these tests
    );
  });

  it("should fetch and return phishing domains as array", async () => {
    mockApi.nativeFetch.mockResolvedValueOnce({
      text: jest.fn().mockResolvedValue("domain1.com\ndomain2.com\ndomain3.com"),
    } as any);

    const result = await auditService.getKnownPhishingDomains("https://example.com/domains.txt");
    expect(result).toEqual(["domain1.com", "domain2.com", "domain3.com"]);
  });

  it("should return null if checksum has not changed", async () => {
    mockApi.nativeFetch
      .mockResolvedValueOnce({ text: jest.fn().mockResolvedValue("abc123") } as any)
      .mockResolvedValueOnce({
        text: jest.fn().mockResolvedValue("domain1.com\ndomain2.com"),
      } as any);

    const prevChecksum = "abc123";
    const result = await auditService.getKnownPhishingDomainsIfChanged(
      prevChecksum,
      "https://example.com/checksum.txt",
      "https://example.com/domains.txt",
    );
    expect(result).toBeNull();
  });

  it("should fetch and return domains and checksum if checksum changed", async () => {
    mockApi.nativeFetch
      .mockResolvedValueOnce({ text: jest.fn().mockResolvedValue("newchecksum") } as any)
      .mockResolvedValueOnce({
        text: jest.fn().mockResolvedValue("domain1.com\ndomain2.com"),
      } as any);

    const prevChecksum = "oldchecksum";
    const result = await auditService.getKnownPhishingDomainsIfChanged(
      prevChecksum,
      "https://example.com/checksum.txt",
      "https://example.com/domains.txt",
    );
    expect(result).toEqual({
      domains: ["domain1.com", "domain2.com"],
      checksum: "newchecksum",
    });
    expect(mockApi.nativeFetch).toHaveBeenCalledTimes(2);
  });
});
