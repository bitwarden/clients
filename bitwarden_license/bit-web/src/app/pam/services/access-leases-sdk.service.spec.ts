// Polyfill Symbol.dispose for explicit resource management (the SDK-consumption
// pattern's `using ref = sdk.take()`) — not reliably present in the jsdom test
// environment. See e.g. `local-generator-history.service.spec.ts` for the same fix.
if (!(Symbol as any).dispose) {
  (Symbol as any).dispose = Symbol("Symbol.dispose");
}

import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MockSdkService } from "@bitwarden/common/platform/spec/mock-sdk.service";
import { UserId } from "@bitwarden/common/types/guid";
import type {
  AccessLeaseExtensionRequest,
  AccessLeaseId,
  AccessLeaseRevokeRequest,
  AccessLeaseView,
  AccessRequestView,
} from "@bitwarden/sdk-internal";

import { AccessLeasesSdkService } from "./access-leases-sdk.service";

describe("AccessLeasesSdkService", () => {
  let sdkService: MockSdkService;
  let accountService: AccountService;
  let logService: LogService;
  let service: AccessLeasesSdkService;

  const userId = "3f5a3c8a-3b1e-4c8a-9b1e-3b1e4c8a9b1e" as UserId;
  const leaseId = "6c1e4c8a-9b1e-4c8a-9b1e-3b1e4c8a9b1e" as unknown as AccessLeaseId;

  const leaseView = {
    id: leaseId,
    requesterId: userId,
    status: "active",
  } as unknown as AccessLeaseView;

  const requestView = {
    id: "9b1e4c8a-3b1e-4c8a-9b1e-3b1e4c8a9b1e",
    requesterId: userId,
    status: "approved",
  } as unknown as AccessRequestView;

  beforeEach(() => {
    sdkService = new MockSdkService();
    accountService = { activeAccount$: of({ id: userId }) } as unknown as AccountService;
    logService = mock<LogService>();
    service = new AccessLeasesSdkService(sdkService, accountService, logService);
  });

  /** Deep-mocks the `client.commercial().pam().leases()` chain for the logged-in user. */
  function mockLeasesClient() {
    const client = sdkService.simulate.userLogin(userId);
    return client.commercial.mockDeep().pam.mockDeep().leases.mockDeep();
  }

  describe("listMyLeases", () => {
    it("calls leases().list_mine() and returns the result", async () => {
      const leases = mockLeasesClient();
      leases.list_mine.mockResolvedValue([leaseView]);

      const result = await service.listMyLeases();

      expect(leases.list_mine).toHaveBeenCalledWith();
      expect(result).toEqual([leaseView]);
    });

    it("logs and rethrows on failure", async () => {
      const leases = mockLeasesClient();
      const error = new Error("boom");
      leases.list_mine.mockRejectedValue(error);

      await expect(service.listMyLeases()).rejects.toBe(error);
      expect(logService.error).toHaveBeenCalled();
    });
  });

  describe("extendLease", () => {
    it("calls leases().extend() with the lease id and request", async () => {
      const leases = mockLeasesClient();
      leases.extend.mockResolvedValue(requestView);
      const request = { reason: "still working" } as unknown as AccessLeaseExtensionRequest;

      const result = await service.extendLease(leaseId, request);

      expect(leases.extend).toHaveBeenCalledWith(leaseId, request);
      expect(result).toEqual(requestView);
    });

    it("logs and rethrows on failure", async () => {
      const leases = mockLeasesClient();
      const error = new Error("cannot extend");
      leases.extend.mockRejectedValue(error);
      const request = { reason: "still working" } as unknown as AccessLeaseExtensionRequest;

      await expect(service.extendLease(leaseId, request)).rejects.toBe(error);
      expect(logService.error).toHaveBeenCalled();
    });
  });

  describe("endLease", () => {
    it("calls leases().end() with the lease id and request", async () => {
      const leases = mockLeasesClient();
      leases.end.mockResolvedValue(undefined);
      const request = { reason: "done early" } as unknown as AccessLeaseRevokeRequest;

      await service.endLease(leaseId, request);

      expect(leases.end).toHaveBeenCalledWith(leaseId, request);
    });

    it("logs and rethrows on failure", async () => {
      const leases = mockLeasesClient();
      const error = new Error("cannot end");
      leases.end.mockRejectedValue(error);
      const request = { reason: "done early" } as unknown as AccessLeaseRevokeRequest;

      await expect(service.endLease(leaseId, request)).rejects.toBe(error);
      expect(logService.error).toHaveBeenCalled();
    });
  });
});
