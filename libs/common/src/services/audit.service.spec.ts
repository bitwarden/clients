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
