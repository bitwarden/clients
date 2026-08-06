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
  AccessLeaseView,
  AccessPreCheckView,
  AccessRequestCreateRequest,
  AccessRequestId,
  AccessRequestResultView,
  AccessRequestView,
  CipherAccessStateView,
} from "@bitwarden/sdk-internal";

import { AccessRequestsSdkService } from "./access-requests-sdk.service";

describe("AccessRequestsSdkService", () => {
  let sdkService: MockSdkService;
  let accountService: AccountService;
  let logService: LogService;
  let service: AccessRequestsSdkService;

  const userId = "3f5a3c8a-3b1e-4c8a-9b1e-3b1e4c8a9b1e" as UserId;
  const requestId = "9b1e4c8a-3b1e-4c8a-9b1e-3b1e4c8a9b1e" as unknown as AccessRequestId;

  const requestView = {
    id: requestId,
    requesterId: userId,
    status: "pending",
  } as unknown as AccessRequestView;

  const leaseView = {
    id: "6c1e4c8a-9b1e-4c8a-9b1e-3b1e4c8a9b1e",
    requestId,
    status: "active",
  } as unknown as AccessLeaseView;

  beforeEach(() => {
    sdkService = new MockSdkService();
    accountService = { activeAccount$: of({ id: userId }) } as unknown as AccountService;
    logService = mock<LogService>();
    service = new AccessRequestsSdkService(sdkService, accountService, logService);
  });

  /** Deep-mocks the `client.commercial().pam().access_requests()` chain for the logged-in user. */
  function mockAccessRequestsClient() {
    const client = sdkService.simulate.userLogin(userId);
    return client.commercial.mockDeep().pam.mockDeep().access_requests.mockDeep();
  }

  describe("listMyAccessRequests", () => {
    it("calls access_requests().list_mine() and returns the result", async () => {
      const accessRequests = mockAccessRequestsClient();
      accessRequests.list_mine.mockResolvedValue([requestView]);

      const result = await service.listMyAccessRequests();

      expect(accessRequests.list_mine).toHaveBeenCalledWith();
      expect(result).toEqual([requestView]);
    });

    it("logs and rethrows on failure", async () => {
      const accessRequests = mockAccessRequestsClient();
      const error = new Error("boom");
      accessRequests.list_mine.mockRejectedValue(error);

      await expect(service.listMyAccessRequests()).rejects.toBe(error);
      expect(logService.error).toHaveBeenCalled();
    });
  });

  describe("getAccessRequest", () => {
    it("calls access_requests().get() with the request id", async () => {
      const accessRequests = mockAccessRequestsClient();
      accessRequests.get.mockResolvedValue(requestView);

      const result = await service.getAccessRequest(requestId);

      expect(accessRequests.get).toHaveBeenCalledWith(requestId);
      expect(result).toEqual(requestView);
    });

    it("logs and rethrows on failure", async () => {
      const accessRequests = mockAccessRequestsClient();
      const error = new Error("not found");
      accessRequests.get.mockRejectedValue(error);

      await expect(service.getAccessRequest(requestId)).rejects.toBe(error);
      expect(logService.error).toHaveBeenCalled();
    });
  });

  describe("activateAccessRequest", () => {
    it("calls access_requests().activate() with the request id and returns the lease", async () => {
      const accessRequests = mockAccessRequestsClient();
      accessRequests.activate.mockResolvedValue(leaseView);

      const result = await service.activateAccessRequest(requestId);

      expect(accessRequests.activate).toHaveBeenCalledWith(requestId);
      expect(result).toEqual(leaseView);
    });

    it("logs and rethrows on failure", async () => {
      const accessRequests = mockAccessRequestsClient();
      const error = new Error("cannot activate");
      accessRequests.activate.mockRejectedValue(error);

      await expect(service.activateAccessRequest(requestId)).rejects.toBe(error);
      expect(logService.error).toHaveBeenCalled();
    });
  });

  describe("cancelAccessRequest", () => {
    it("calls access_requests().cancel() with the request id", async () => {
      const accessRequests = mockAccessRequestsClient();
      accessRequests.cancel.mockResolvedValue(undefined);

      await service.cancelAccessRequest(requestId);

      expect(accessRequests.cancel).toHaveBeenCalledWith(requestId);
    });

    it("logs and rethrows on failure", async () => {
      const accessRequests = mockAccessRequestsClient();
      const error = new Error("cannot cancel");
      accessRequests.cancel.mockRejectedValue(error);

      await expect(service.cancelAccessRequest(requestId)).rejects.toBe(error);
      expect(logService.error).toHaveBeenCalled();
    });
  });

  const cipherId = "1b1e4c8a-3b1e-4c8a-9b1e-3b1e4c8a9b1e";

  describe("getCipherAccessState", () => {
    it("calls access_requests().cipher_access_state() with the cipher id", async () => {
      const accessRequests = mockAccessRequestsClient();
      const state = { cipherId, activeLease: undefined } as unknown as CipherAccessStateView;
      accessRequests.cipher_access_state.mockResolvedValue(state);

      const result = await service.getCipherAccessState(cipherId);

      expect(accessRequests.cipher_access_state).toHaveBeenCalledWith(cipherId);
      expect(result).toEqual(state);
    });

    it("logs and rethrows on failure", async () => {
      const accessRequests = mockAccessRequestsClient();
      const error = new Error("boom");
      accessRequests.cipher_access_state.mockRejectedValue(error);

      await expect(service.getCipherAccessState(cipherId)).rejects.toBe(error);
      expect(logService.error).toHaveBeenCalled();
    });
  });

  describe("preCheckAccessRequest", () => {
    it("calls access_requests().pre_check() with the cipher id", async () => {
      const accessRequests = mockAccessRequestsClient();
      const preCheck = {
        cipherId,
        approvalMode: "automatic",
        hasActiveLease: false,
      } as unknown as AccessPreCheckView;
      accessRequests.pre_check.mockResolvedValue(preCheck);

      const result = await service.preCheckAccessRequest(cipherId);

      expect(accessRequests.pre_check).toHaveBeenCalledWith(cipherId);
      expect(result).toEqual(preCheck);
    });

    it("logs and rethrows on failure", async () => {
      const accessRequests = mockAccessRequestsClient();
      const error = new Error("boom");
      accessRequests.pre_check.mockRejectedValue(error);

      await expect(service.preCheckAccessRequest(cipherId)).rejects.toBe(error);
      expect(logService.error).toHaveBeenCalled();
    });
  });

  describe("createAccessRequest", () => {
    it("calls access_requests().request() with the cipher id and body", async () => {
      const accessRequests = mockAccessRequestsClient();
      const body = { durationSeconds: 3600 } as unknown as AccessRequestCreateRequest;
      const result_ = {
        approvalMode: "automatic",
        request: { id: requestId, cipherId },
      } as unknown as AccessRequestResultView;
      accessRequests.request.mockResolvedValue(result_);

      const result = await service.createAccessRequest(cipherId, body);

      expect(accessRequests.request).toHaveBeenCalledWith(cipherId, body);
      expect(result).toEqual(result_);
    });

    it("logs and rethrows on failure", async () => {
      const accessRequests = mockAccessRequestsClient();
      const error = new Error("boom");
      const body = { durationSeconds: 3600 } as unknown as AccessRequestCreateRequest;
      accessRequests.request.mockRejectedValue(error);

      await expect(service.createAccessRequest(cipherId, body)).rejects.toBe(error);
      expect(logService.error).toHaveBeenCalled();
    });
  });
});
