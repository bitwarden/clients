import { mock, MockProxy } from "jest-mock-extended";

import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { CipherResponse } from "@bitwarden/common/vault/models/response/cipher.response";
import { PamApiService } from "@bitwarden/pam";

import { LeasedCipherFetcherService } from "./leased-cipher-fetcher.service";

describe("LeasedCipherFetcherService", () => {
  let pamApi: MockProxy<PamApiService>;
  let fetcher: LeasedCipherFetcherService;

  beforeEach(() => {
    pamApi = mock<PamApiService>();
    fetcher = new LeasedCipherFetcherService(pamApi);
  });

  it("returns the leased cipher as a domain object on success", async () => {
    pamApi.getLeasedCipher.mockResolvedValue(
      new CipherResponse({ Id: "cipher-1", Name: "n", Type: 1 }),
    );

    const result = await fetcher.fetch("cipher-1");

    expect(pamApi.getLeasedCipher).toHaveBeenCalledWith("cipher-1");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("cipher-1");
  });

  it("stamps the transient leaseGated marker so the banner keeps fetching state after the reveal", async () => {
    pamApi.getLeasedCipher.mockResolvedValue(
      new CipherResponse({ Id: "cipher-1", Name: "n", Type: 1 }),
    );

    const result = await fetcher.fetch("cipher-1");

    expect(result!.leaseGated).toBe(true);
    // The full leased cipher carries no partialData; leaseGated is the only signal.
    expect(result!.partialData).toBeUndefined();
  });

  it("returns null on a 404 — caller falls through to the request-access flow", async () => {
    pamApi.getLeasedCipher.mockRejectedValue(new ErrorResponse(null, 404));

    const result = await fetcher.fetch("cipher-1");

    expect(result).toBeNull();
  });

  it("rethrows non-404 errors so they surface as failures", async () => {
    const boom = new ErrorResponse(null, 500);
    pamApi.getLeasedCipher.mockRejectedValue(boom);

    await expect(fetcher.fetch("cipher-1")).rejects.toBe(boom);
  });

  it("rethrows non-ErrorResponse exceptions", async () => {
    const boom = new Error("network");
    pamApi.getLeasedCipher.mockRejectedValue(boom);

    await expect(fetcher.fetch("cipher-1")).rejects.toBe(boom);
  });
});
