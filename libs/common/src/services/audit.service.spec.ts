// eslint-disable-next-line no-restricted-imports
import { CryptoFunctionService } from "@bitwarden/legacy-crypto";

import { ApiService } from "../abstractions/api.service";
import { HibpApiService } from "../dirt/services/hibp-api.service";

import { AuditService, RangeRequestTimeoutMs } from "./audit.service";

jest.useFakeTimers();

// Polyfill global Request for Jest environment if not present
if (typeof global.Request === "undefined") {
  global.Request = jest.fn((input: string | URL, init?: RequestInit) => {
    return { url: typeof input === "string" ? input : input.toString(), ...init };
  }) as any;
}

/** Typed view of the protected members the concurrency test needs to spy on. */
type AuditServiceInternals = {
  fetchLeakedPasswordCount(password: string): Promise<number>;
};

/** A request that never responds, rejecting on abort the way a real fetch does. */
function stalledFetch(request: Request): Promise<Response> {
  return new Promise<Response>((_resolve, reject) => {
    request.signal.addEventListener("abort", () => reject(new Error("aborted")));
  });
}

describe("AuditService", () => {
  let auditService: AuditService;
  let mockCrypto: jest.Mocked<CryptoFunctionService>;
  let mockApi: jest.Mocked<ApiService>;
  let mockHibpApi: jest.Mocked<HibpApiService>;

  beforeEach(() => {
    mockCrypto = {
      hash: jest.fn().mockResolvedValue(new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff])),
    } as unknown as jest.Mocked<CryptoFunctionService>;

    mockApi = {
      nativeFetch: jest.fn().mockResolvedValue({
        ok: true,
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
    const internals = auditService as unknown as AuditServiceInternals;
    const origFetch = internals.fetchLeakedPasswordCount.bind(auditService);
    jest
      .spyOn(internals, "fetchLeakedPasswordCount")
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
    expect(internals.fetchLeakedPasswordCount).toHaveBeenCalledTimes(4);
    expect(mockCrypto.hash).toHaveBeenCalledTimes(4);
    expect(mockApi.nativeFetch).toHaveBeenCalledTimes(4);
  });

  it("should include Add-Padding header when checking leaked passwords", async () => {
    const result = await auditService.passwordLeaked("password");

    expect(result).toBe(4);
    expect(mockApi.nativeFetch).toHaveBeenCalledTimes(1);
    const request = mockApi.nativeFetch.mock.calls[0][0] as any;
    expect(request.url).toBe("https://api.pwnedpasswords.com/range/AABBC");
    expect(request.headers).toEqual(expect.objectContaining({ "Add-Padding": "true" }));
  });

  it.each([
    ["LF", "CDDEEFF:4\nDDEEFF:2\n123456:1"],
    ["CRLF", "CDDEEFF:4\r\nDDEEFF:2\r\n123456:1"],
    ["not the first line", "DDEEFF:2\r\nCDDEEFF:4\r\n123456:1"],
  ])("should read the leak count from a %s response", async (_label, body) => {
    mockApi.nativeFetch.mockResolvedValueOnce({
      ok: true,
      text: jest.fn().mockResolvedValue(body),
    } as unknown as Response);

    await expect(auditService.passwordLeaked("password")).resolves.toBe(4);
  });

  it("should not match a hash suffix that appears mid-line", async () => {
    // Counts and suffixes are only distinguishable by position, so the match has to be anchored to
    // the start of a line.
    mockApi.nativeFetch.mockResolvedValueOnce({
      ok: true,
      text: jest.fn().mockResolvedValue("AACDDEEFF:99\r\nCDDEEFF:4"),
    } as unknown as Response);

    await expect(auditService.passwordLeaked("password")).resolves.toBe(4);
  });

  it("should report not exposed when the hash is absent from the range", async () => {
    mockApi.nativeFetch.mockResolvedValueOnce({
      ok: true,
      text: jest.fn().mockResolvedValue("DDEEFF:2\r\n123456:1"),
    } as unknown as Response);

    await expect(auditService.passwordLeaked("password")).resolves.toBe(0);
  });

  it("should reject rather than report not exposed when the range request fails", async () => {
    // An error body parses as a hash list that matches nothing, which would otherwise report a
    // leaked password as safe.
    mockApi.nativeFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: jest.fn().mockResolvedValue("rate limited"),
    } as unknown as Response);

    await expect(auditService.passwordLeaked("password")).rejects.toThrow("status 429");
  });

  it("should reject when a range request never responds", async () => {
    mockApi.nativeFetch.mockImplementationOnce((request) => stalledFetch(request));

    // Attach the expectation before advancing timers, or the rejection escapes as unhandled.
    const leaked = expect(auditService.passwordLeaked("password")).rejects.toThrow("aborted");
    await jest.advanceTimersByTimeAsync(RangeRequestTimeoutMs);

    await leaked;
  });

  it("should release the concurrency slot when a request times out", async () => {
    // A request that never settles used to hold its slot for the lifetime of the service, so a
    // report fanning out over a whole vault silently lost throughput until nothing was left.
    const service = new AuditService(mockCrypto, mockApi, mockHibpApi, 1);
    mockApi.nativeFetch.mockImplementationOnce((request) => stalledFetch(request));

    const stalled = expect(service.passwordLeaked("stalled")).rejects.toThrow("aborted");
    const queuedBehindIt = service.passwordLeaked("queued");

    await jest.advanceTimersByTimeAsync(RangeRequestTimeoutMs);

    await stalled;
    await expect(queuedBehindIt).resolves.toBe(4);
  });

  it("should return empty array for breachedAccounts when no breaches found", async () => {
    // Server returns 200 with empty array (correct REST semantics)
    mockHibpApi.getHibpBreach.mockResolvedValueOnce([]);
    const result = await auditService.breachedAccounts("user@example.com");
    expect(result).toEqual([]);
  });

  it("should propagate errors from breachedAccounts", async () => {
    const error = new Error("API error");
    mockHibpApi.getHibpBreach.mockRejectedValueOnce(error);
    await expect(auditService.breachedAccounts("user@example.com")).rejects.toBe(error);
  });
});
