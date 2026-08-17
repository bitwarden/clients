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
} from "@bitwarden/sdk-internal";

import { AccessRequestsSdkService } from "./access-requests-sdk.service";

describe("AccessRequestsSdkService", () => {
  let sdkService: MockSdkService;
  let accountService: AccountService;
  let logService: LogService;
  let service: AccessRequestsSdkService;

  const userId = "3f5a3c8a-3b1e-4c8a-9b1e-3b1e4c8a9b1e" as UserId;
  const requestId = "9b1e4c8a-3b1e-4c8a-9b1e-3b1e4c8a9b1e" as unknown as AccessRequestId;
  const cipherId = "7d2b4c8a-9b1e-4c8a-9b1e-3b1e4c8a9b1e";

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

  describe("preCheck", () => {
    it("calls access_requests().pre_check() with the branded cipher id", async () => {
      const accessRequests = mockAccessRequestsClient();
      const preCheckView = {
        cipherId,
        approvalMode: "human",
        hasActiveLease: false,
      } as unknown as AccessPreCheckView;
      accessRequests.pre_check.mockResolvedValue(preCheckView);

      const result = await service.preCheck(cipherId);

      expect(accessRequests.pre_check).toHaveBeenCalledWith(cipherId);
      expect(result).toBe(preCheckView);
    });

    it("logs and rethrows on failure", async () => {
      const accessRequests = mockAccessRequestsClient();
      const error = new Error("cannot pre-check");
      accessRequests.pre_check.mockRejectedValue(error);

      await expect(service.preCheck(cipherId)).rejects.toBe(error);
      expect(logService.error).toHaveBeenCalled();
    });

    it("rejects a cipher id that is not a uuid before reaching the SDK", async () => {
      const accessRequests = mockAccessRequestsClient();

      await expect(service.preCheck("not-a-uuid")).rejects.toThrow();
      expect(accessRequests.pre_check).not.toHaveBeenCalled();
    });
  });

  describe("submitAccessRequest", () => {
    const createRequest = {
      durationSeconds: 3600,
      start: undefined,
      end: undefined,
      reason: undefined,
    } as unknown as AccessRequestCreateRequest;

    it("calls access_requests().request() with the cipher id and payload", async () => {
      const accessRequests = mockAccessRequestsClient();
      const resultView = {
        approvalMode: "automatic",
        request: { id: requestId },
      } as unknown as AccessRequestResultView;
      accessRequests.request.mockResolvedValue(resultView);

      const result = await service.submitAccessRequest(cipherId, createRequest);

      expect(accessRequests.request).toHaveBeenCalledWith(cipherId, createRequest);
      expect(result).toBe(resultView);
    });

    it("logs and rethrows on failure without echoing the payload", async () => {
      const accessRequests = mockAccessRequestsClient();
      const error = new Error("cannot request");
      accessRequests.request.mockRejectedValue(error);

      await expect(
        service.submitAccessRequest(cipherId, {
          ...createRequest,
          reason: "secret justification",
        } as unknown as AccessRequestCreateRequest),
      ).rejects.toBe(error);
      expect(logService.error).toHaveBeenCalled();
      // The justification is user-authored content and must never reach the log.
      const logged = (logService.error as jest.Mock).mock.calls.flat().join(" ");
      expect(logged).not.toContain("secret justification");
    });
  });
});
