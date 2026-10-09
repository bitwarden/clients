import { mock, MockProxy } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherId } from "@bitwarden/common/types/guid";

import type { CipherAccessStateView } from "../abstractions/access-lease";
import { AccessRequestSdkService } from "../abstractions/access-request-sdk.service";

import { PamCipherLeaseStateService } from "./pam-cipher-lease-state.service";

const CIPHER_ID = "cipher-1" as CipherId;

function stateWithLease(notAfterMs: number): CipherAccessStateView {
  return {
    cipherId: CIPHER_ID,
    activeLease: { id: "lease-1", notAfter: new Date(notAfterMs).toISOString() },
  } as unknown as CipherAccessStateView;
}

describe("PamCipherLeaseStateService", () => {
  let requestsApi: MockProxy<AccessRequestSdkService>;
  let logService: MockProxy<LogService>;
  let service: PamCipherLeaseStateService;

  beforeEach(() => {
    requestsApi = mock<AccessRequestSdkService>();
    logService = mock<LogService>();
    service = new PamCipherLeaseStateService(requestsApi, logService);
  });

  it("reports a live lease", async () => {
    requestsApi.getCipherAccessState.mockResolvedValue(stateWithLease(Date.now() + 60_000));

    await expect(service.hasActiveLease(CIPHER_ID)).resolves.toBe(true);
    expect(requestsApi.getCipherAccessState).toHaveBeenCalledWith(CIPHER_ID);
  });

  it("treats a lapsed lease as none", async () => {
    requestsApi.getCipherAccessState.mockResolvedValue(stateWithLease(Date.now() - 1));

    await expect(service.hasActiveLease(CIPHER_ID)).resolves.toBe(false);
  });

  it("treats no lease as none", async () => {
    requestsApi.getCipherAccessState.mockResolvedValue({
      cipherId: CIPHER_ID,
      activeLease: undefined,
    } as unknown as CipherAccessStateView);

    await expect(service.hasActiveLease(CIPHER_ID)).resolves.toBe(false);
  });

  it("fails closed when the read fails", async () => {
    const error = new Error("read failed");
    requestsApi.getCipherAccessState.mockRejectedValue(error);

    await expect(service.hasActiveLease(CIPHER_ID)).resolves.toBe(false);
    expect(logService.error).toHaveBeenCalledWith(error);
  });
});
