import { mock, MockProxy } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherId } from "@bitwarden/common/types/guid";

import type { AccessLeaseStatus, AccessLeaseView } from "../abstractions/access-lease";
import { AccessLeaseSdkService } from "../abstractions/access-lease-sdk.service";

import { PamCipherLeaseStateService } from "./pam-cipher-lease-state.service";

const CIPHER_ID = "cipher-1" as CipherId;
const OTHER_CIPHER_ID = "cipher-2" as CipherId;

function lease(
  cipherId: CipherId,
  notAfterMs: number,
  status: AccessLeaseStatus = "active",
): AccessLeaseView {
  return {
    id: `lease-${cipherId}`,
    cipherId,
    status,
    notAfter: new Date(notAfterMs).toISOString(),
  } as unknown as AccessLeaseView;
}

describe("PamCipherLeaseStateService", () => {
  let leasesApi: MockProxy<AccessLeaseSdkService>;
  let logService: MockProxy<LogService>;
  let service: PamCipherLeaseStateService;

  beforeEach(() => {
    leasesApi = mock<AccessLeaseSdkService>();
    logService = mock<LogService>();
    service = new PamCipherLeaseStateService(leasesApi, logService);
  });

  it("answers every id from one read", async () => {
    leasesApi.listMyLeases.mockResolvedValue([lease(CIPHER_ID, Date.now() + 60_000)]);

    await expect(service.leasedCipherIds([CIPHER_ID, OTHER_CIPHER_ID])).resolves.toEqual(
      new Set([CIPHER_ID]),
    );
    expect(leasesApi.listMyLeases).toHaveBeenCalledTimes(1);
  });

  it("treats a lapsed lease as none", async () => {
    leasesApi.listMyLeases.mockResolvedValue([lease(CIPHER_ID, Date.now() - 1)]);

    await expect(service.leasedCipherIds([CIPHER_ID])).resolves.toEqual(new Set());
  });

  it("treats an ended lease as none", async () => {
    leasesApi.listMyLeases.mockResolvedValue([lease(CIPHER_ID, Date.now() + 60_000, "revoked")]);

    await expect(service.leasedCipherIds([CIPHER_ID])).resolves.toEqual(new Set());
  });

  it("fails closed when the read fails", async () => {
    const error = new Error("read failed");
    leasesApi.listMyLeases.mockRejectedValue(error);

    await expect(service.leasedCipherIds([CIPHER_ID])).resolves.toEqual(new Set());
    expect(logService.error).toHaveBeenCalledWith(error);
  });
});
