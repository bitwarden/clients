import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserId } from "@bitwarden/common/types/guid";

import type { AccessRequestId } from "../abstractions/access-lease";

import { AccessDecisionRequest } from "./access-decision.request";
import { DefaultApprovalApiService } from "./default-approval-api.service";

const USER_ID = "3f5a3c8a-3b1e-4c8a-9b1e-3b1e4c8a9b1e" as UserId;
const REQUEST_ID = "9b1e4c8a-3b1e-4c8a-9b1e-3b1e4c8a9b1e" as unknown as AccessRequestId;

function wireRequest(id: string, status = "pending") {
  return {
    Id: id,
    CipherId: "cipher-1",
    CollectionId: "col-1",
    RequesterId: "user-1",
    Status: status,
    SubmittedAt: "2026-08-17T11:00:00.000Z",
    LeaseNotBefore: "2026-08-17T12:00:00.000Z",
    LeaseNotAfter: "2026-08-17T13:00:00.000Z",
    Decisions: [],
  };
}

describe("DefaultApprovalApiService", () => {
  let apiService: MockProxy<ApiService>;
  let accountService: AccountService;
  let service: DefaultApprovalApiService;

  beforeEach(() => {
    apiService = mock<ApiService>();
    accountService = { activeAccount$: of({ id: USER_ID }) } as unknown as AccountService;
    service = new DefaultApprovalApiService(apiService, accountService);
  });

  describe("listInbox", () => {
    it("GETs the inbox authenticated for the active user and parses the list", async () => {
      apiService.send.mockResolvedValue({ Data: [wireRequest("req-1"), wireRequest("req-2")] });

      const result = await service.listInbox();

      expect(apiService.send).toHaveBeenCalledWith(
        "GET",
        "/access-requests/inbox",
        null,
        USER_ID,
        true,
      );
      expect(result.map((r) => r.id)).toEqual(["req-1", "req-2"]);
    });

    it("returns an empty list for a member who approves nothing", async () => {
      apiService.send.mockResolvedValue({ Data: [] });

      expect(await service.listInbox()).toEqual([]);
    });

    it("propagates a failure rather than swallowing it — the page toasts", async () => {
      // These handlers are NotImplementedException scaffolds on the current server, so a 500 here is
      // expected until that lands; it must surface, not silently render an empty inbox.
      apiService.send.mockRejectedValue(new Error("500"));

      await expect(service.listInbox()).rejects.toThrow("500");
    });
  });

  describe("listHistory", () => {
    it("GETs the history and parses the same response shape as the inbox", async () => {
      apiService.send.mockResolvedValue({ Data: [wireRequest("req-3", "approved")] });

      const result = await service.listHistory();

      expect(apiService.send).toHaveBeenCalledWith(
        "GET",
        "/access-requests/history",
        null,
        USER_ID,
        true,
      );
      expect(result[0].status).toBe("approved");
    });
  });

  describe("decide", () => {
    it("POSTs the decision to the request's own path and parses one response", async () => {
      apiService.send.mockResolvedValue(wireRequest("req-1", "approved"));
      const request = new AccessDecisionRequest({ verdict: "approve", comment: "ok" });

      const result = await service.decide(REQUEST_ID, request);

      expect(apiService.send).toHaveBeenCalledWith(
        "POST",
        `/access-requests/${REQUEST_ID}/decision`,
        request,
        USER_ID,
        true,
      );
      expect(result.status).toBe("approved");
    });

    it("sends the verdict as the server's numeric enum, not the SDK's string spelling", async () => {
      apiService.send.mockResolvedValue(wireRequest("req-1", "denied"));

      await service.decide(REQUEST_ID, new AccessDecisionRequest({ verdict: "deny" }));

      const body = apiService.send.mock.calls[0][2] as AccessDecisionRequest;
      // The endpoint binds AccessDecisionVerdict as a byte; a string body fails to deserialise and
      // comes back as a bare 400.
      expect(body.verdict).toBe(0);
      expect(body.comment).toBeUndefined();
    });

    it("sends approve as 1", async () => {
      apiService.send.mockResolvedValue(wireRequest("req-1", "approved"));

      await service.decide(REQUEST_ID, new AccessDecisionRequest({ verdict: "approve" }));

      const body = apiService.send.mock.calls[0][2] as AccessDecisionRequest;
      expect(body.verdict).toBe(1);
    });

    it("refuses to submit a verdict with no wire value", () => {
      expect(() => new AccessDecisionRequest({ verdict: "unknown" })).toThrow(
        'Cannot record the verdict "unknown"',
      );
    });
  });
});
