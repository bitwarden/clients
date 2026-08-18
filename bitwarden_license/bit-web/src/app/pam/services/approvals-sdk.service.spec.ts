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
  AccessDecisionRequest,
  AccessRequestId,
  AccessRequestView,
} from "@bitwarden/sdk-internal";

import { ApprovalsSdkService } from "./approvals-sdk.service";

describe("ApprovalsSdkService", () => {
  let sdkService: MockSdkService;
  let accountService: AccountService;
  let logService: LogService;
  let service: ApprovalsSdkService;

  const userId = "3f5a3c8a-3b1e-4c8a-9b1e-3b1e4c8a9b1e" as UserId;
  const requestId = "9b1e4c8a-3b1e-4c8a-9b1e-3b1e4c8a9b1e" as unknown as AccessRequestId;

  const requestView = {
    id: requestId,
    requesterId: userId,
    status: "pending",
  } as unknown as AccessRequestView;

  const decidedView = {
    id: requestId,
    status: "approved",
  } as unknown as AccessRequestView;

  beforeEach(() => {
    sdkService = new MockSdkService();
    accountService = { activeAccount$: of({ id: userId }) } as unknown as AccountService;
    logService = mock<LogService>();
    service = new ApprovalsSdkService(sdkService, accountService, logService);
  });

  /** Deep-mocks the `client.commercial().pam().approvals()` chain for the logged-in user. */
  function mockApprovalsClient() {
    const client = sdkService.simulate.userLogin(userId);
    return client.commercial.mockDeep().pam.mockDeep().approvals.mockDeep();
  }

  describe("listInbox", () => {
    it("calls approvals().list_inbox() and returns the result", async () => {
      const approvals = mockApprovalsClient();
      approvals.list_inbox.mockResolvedValue([requestView]);

      const result = await service.listInbox();

      expect(approvals.list_inbox).toHaveBeenCalledWith();
      expect(result).toEqual([requestView]);
    });

    it("logs and rethrows on failure", async () => {
      const approvals = mockApprovalsClient();
      const error = new Error("boom");
      approvals.list_inbox.mockRejectedValue(error);

      await expect(service.listInbox()).rejects.toBe(error);
      expect(logService.error).toHaveBeenCalled();
    });
  });

  describe("listHistory", () => {
    it("calls approvals().list_history() and returns the result", async () => {
      const approvals = mockApprovalsClient();
      approvals.list_history.mockResolvedValue([decidedView]);

      const result = await service.listHistory();

      expect(approvals.list_history).toHaveBeenCalledWith();
      expect(result).toEqual([decidedView]);
    });

    it("logs and rethrows on failure", async () => {
      const approvals = mockApprovalsClient();
      const error = new Error("boom");
      approvals.list_history.mockRejectedValue(error);

      await expect(service.listHistory()).rejects.toBe(error);
      expect(logService.error).toHaveBeenCalled();
    });
  });

  describe("decide", () => {
    const decision = { verdict: "approve", comment: "looks fine" } as AccessDecisionRequest;

    it("calls approvals().decide() with the request id and decision", async () => {
      const approvals = mockApprovalsClient();
      approvals.decide.mockResolvedValue(decidedView);

      const result = await service.decide(requestId, decision);

      expect(approvals.decide).toHaveBeenCalledWith(requestId, decision);
      expect(result).toEqual(decidedView);
    });

    it("logs and rethrows on failure without echoing the comment", async () => {
      const approvals = mockApprovalsClient();
      const error = new Error("cannot decide");
      approvals.decide.mockRejectedValue(error);

      await expect(
        service.decide(requestId, {
          verdict: "deny",
          comment: "secret reason",
        } as AccessDecisionRequest),
      ).rejects.toBe(error);
      expect(logService.error).toHaveBeenCalled();
      // The approver's comment is user-authored content and must never reach the log.
      const logged = (logService.error as jest.Mock).mock.calls.flat().join(" ");
      expect(logged).not.toContain("secret reason");
    });
  });
});
