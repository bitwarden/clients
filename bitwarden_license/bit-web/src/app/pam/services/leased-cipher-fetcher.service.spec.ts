import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherResponse } from "@bitwarden/common/vault/models/response/cipher.response";

import { LeasedCipherFetcherService } from "./leased-cipher-fetcher.service";

describe("LeasedCipherFetcherService", () => {
  let apiService: ReturnType<typeof mock<ApiService>>;
  let logService: ReturnType<typeof mock<LogService>>;
  let fetcher: LeasedCipherFetcherService;

  beforeEach(() => {
    apiService = mock<ApiService>();
    logService = mock<LogService>();

    TestBed.configureTestingModule({
      providers: [
        { provide: ApiService, useValue: apiService },
        { provide: LogService, useValue: logService },
      ],
    });
    fetcher = TestBed.inject(LeasedCipherFetcherService);
  });

  it("returns the full cipher as a domain object when it is no longer gated", async () => {
    apiService.getCipher.mockResolvedValue(
      new CipherResponse({ Id: "cipher-1", Name: "n", Type: 1 }),
    );

    const result = await fetcher.fetch("cipher-1");

    expect(apiService.getCipher).toHaveBeenCalledWith("cipher-1");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("cipher-1");
    expect(result!.partialData).toBeUndefined();
  });

  it("returns null when the server still reports the cipher as gated (partialData present)", async () => {
    apiService.getCipher.mockResolvedValue(
      new CipherResponse({ Id: "cipher-1", Name: "n", Type: 1, PartialData: '{"name":"enc"}' }),
    );

    const result = await fetcher.fetch("cipher-1");

    expect(result).toBeNull();
  });

  it("returns null on a 404 — caller falls through to the request-access flow", async () => {
    apiService.getCipher.mockRejectedValue(new ErrorResponse(null, 404));

    const result = await fetcher.fetch("cipher-1");

    expect(result).toBeNull();
  });

  it("logs and rethrows non-404 errors so they surface as failures", async () => {
    const boom = new ErrorResponse(null, 500);
    apiService.getCipher.mockRejectedValue(boom);

    await expect(fetcher.fetch("cipher-1")).rejects.toBe(boom);
    expect(logService.error).toHaveBeenCalled();
  });

  it("logs and rethrows non-ErrorResponse exceptions", async () => {
    const boom = new Error("network");
    apiService.getCipher.mockRejectedValue(boom);

    await expect(fetcher.fetch("cipher-1")).rejects.toBe(boom);
    expect(logService.error).toHaveBeenCalled();
  });
});
