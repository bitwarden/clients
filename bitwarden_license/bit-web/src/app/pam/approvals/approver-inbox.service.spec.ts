import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { Subject, firstValueFrom, of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserId } from "@bitwarden/common/types/guid";

import { AccessEventService, AccessLeaseSdkService, AccessRequestSdkService } from "..";
import type {
  AccessLeaseId,
  AccessRequestId,
  AccessRequestView,
} from "../abstractions/access-lease";
import {
  AccessNameResolverService,
  ResolvedNames,
  emptyResolvedNames,
} from "../access-requests/access-name-resolver.service";

import { ApprovalApiService } from "./approval-api.service";
import { ApproverInboxService } from "./approver-inbox.service";
import type { AccessRequestDetailsResponse } from "./responses/access-request.response";

const ME = "11111111-1111-4111-8111-111111111111" as UserId;

/** A future window, so rows are actionable unless a test says otherwise. */
const FUTURE = new Date(Date.now() + 60 * 60 * 1000).toISOString();

function request(overrides: Record<string, unknown> = {}): AccessRequestDetailsResponse {
  return {
    id: "req-1",
    cipherId: "cipher-1",
    collectionId: "col-1",
    requesterId: "someone-else",
    status: "pending",
    leaseNotBefore: new Date().toISOString(),
    leaseNotAfter: FUTURE,
    submittedAt: new Date(Date.now() - 60_000).toISOString(),
    decisions: [],
    requesterName: "Grace",
    ...overrides,
  } as unknown as AccessRequestDetailsResponse;
}

describe("ApproverInboxService", () => {
  let service: ApproverInboxService;
  let approvalApi: MockProxy<ApprovalApiService>;
  let requestsApi: MockProxy<AccessRequestSdkService>;
  let leasesApi: MockProxy<AccessLeaseSdkService>;
  let nameResolver: MockProxy<AccessNameResolverService>;
  let push$: Subject<void>;
  let inboxPush$: Subject<void>;

  beforeEach(() => {
    approvalApi = mock<ApprovalApiService>();
    requestsApi = mock<AccessRequestSdkService>();
    leasesApi = mock<AccessLeaseSdkService>();
    nameResolver = mock<AccessNameResolverService>();
    push$ = new Subject<void>();
    inboxPush$ = new Subject<void>();

    approvalApi.listInbox.mockResolvedValue([]);
    approvalApi.listHistory.mockResolvedValue([]);
    nameResolver.resolveNames.mockResolvedValue(emptyResolvedNames() as ResolvedNames);

    TestBed.configureTestingModule({
      providers: [
        ApproverInboxService,
        { provide: ApprovalApiService, useValue: approvalApi },
        { provide: AccessRequestSdkService, useValue: requestsApi },
        { provide: AccessLeaseSdkService, useValue: leasesApi },
        { provide: AccessNameResolverService, useValue: nameResolver },
        {
          provide: AccessEventService,
          useValue: {
            accessChanged$: () => push$.asObservable(),
            approverInboxChanged$: () => inboxPush$.asObservable(),
          },
        },
        { provide: AccountService, useValue: { activeAccount$: of({ id: ME }) } },
      ],
    });
    service = TestBed.inject(ApproverInboxService);
  });

  describe("load", () => {
    it("reads the inbox and the history and resolves their names together", async () => {
      approvalApi.listInbox.mockResolvedValue([request({ id: "pending-1" })]);
      approvalApi.listHistory.mockResolvedValue([request({ id: "done-1", status: "approved" })]);

      await service.load();

      expect(nameResolver.resolveNames).toHaveBeenCalledWith([
        { cipherId: "cipher-1", collectionId: "col-1" },
        { cipherId: "cipher-1", collectionId: "col-1" },
      ]);
      expect(await firstValueFrom(service.inboxRows$)).toHaveLength(1);
      expect(await firstValueFrom(service.historyRows$)).toHaveLength(1);
      expect(await firstValueFrom(service.loading$)).toBe(false);
    });

    it("records a failure rather than throwing, so the page can toast it", async () => {
      approvalApi.listInbox.mockRejectedValue(new Error("boom"));

      await service.load();

      expect(await firstValueFrom(service.loadError$)).toBeTruthy();
      expect(await firstValueFrom(service.loading$)).toBe(false);
    });

    it("drops a timed-out request from the actionable inbox", async () => {
      approvalApi.listInbox.mockResolvedValue([
        request({ id: "live" }),
        request({ id: "lapsed", leaseNotAfter: new Date(Date.now() - 1000).toISOString() }),
      ]);

      await service.load();

      const rows = await firstValueFrom(service.inboxRows$);
      expect(rows.map((r) => r.id)).toEqual(["live"]);
    });

    it("refuses self-approval on the caller's own request", async () => {
      approvalApi.listInbox.mockResolvedValue([
        request({ id: "mine", requesterId: ME }),
        request({ id: "theirs", requesterId: "other" }),
      ]);

      await service.load();

      const rows = await firstValueFrom(service.inboxRows$);
      expect(rows.find((r) => r.id === ("mine" as unknown))?.canDecide).toBe(false);
      expect(rows.find((r) => r.id === ("theirs" as unknown))?.canDecide).toBe(true);
    });

    it("counts the actionable rows for the tab badge", async () => {
      approvalApi.listInbox.mockResolvedValue([request({ id: "a" }), request({ id: "b" })]);

      await service.load();

      expect(await firstValueFrom(service.pendingCount$)).toBe(2);
    });

    it("exposes the managed ids so history knows which rows it may act on", async () => {
      approvalApi.listHistory.mockResolvedValue([request({ id: "managed-1", status: "denied" })]);

      await service.load();

      expect(await firstValueFrom(service.managedIds$)).toEqual(new Set(["managed-1"]));
    });

    it("reloads on a server push", async () => {
      await service.load();
      approvalApi.listInbox.mockClear();

      push$.next();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(approvalApi.listInbox).toHaveBeenCalledTimes(1);
    });

    it("reloads on an approver-inbox push", async () => {
      // The push an approver actually gets: someone else's request landed against a collection they
      // manage, so nothing arrives on the requester-scoped stream.
      await service.load();
      approvalApi.listInbox.mockClear();

      inboxPush$.next();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(approvalApi.listInbox).toHaveBeenCalledTimes(1);
    });
  });

  describe("decide", () => {
    beforeEach(async () => {
      approvalApi.listInbox.mockResolvedValue([request({ id: "req-1" })]);
      await service.load();
    });

    it("removes the row from the inbox and moves it to history on success", async () => {
      approvalApi.decide.mockResolvedValue(
        request({ id: "req-1", status: "approved", resolvedAt: "2026-08-17T12:00:00.000Z" }),
      );

      await service.decide("req-1" as unknown as AccessRequestId, "approve", "fine");

      expect(await firstValueFrom(service.inboxRows$)).toHaveLength(0);
      const history = await firstValueFrom(service.historyRows$);
      expect(history).toHaveLength(1);
      expect(history[0].status).toBe("approved");
    });

    it("keeps the fields the decision response does not populate", async () => {
      // Only status/resolvedAt/decisions come back; replacing the row wholesale would blank the
      // requester's resolved name.
      approvalApi.decide.mockResolvedValue(
        request({ id: "req-1", status: "approved", requesterName: undefined }),
      );
      nameResolver.resolveNames.mockResolvedValue({
        ...emptyResolvedNames(),
        cipherNameById: new Map([["cipher-1", "Prod database"]]),
      } as ResolvedNames);
      await service.load();

      await service.decide("req-1" as unknown as AccessRequestId, "approve", undefined);

      const history = await firstValueFrom(service.historyRows$);
      expect(history[0].cipherName).toBe("Prod database");
    });

    it("puts the row back and rethrows when the decision fails", async () => {
      approvalApi.decide.mockRejectedValue(new Error("boom"));

      await expect(
        service.decide("req-1" as unknown as AccessRequestId, "deny", undefined),
      ).rejects.toThrow("boom");
      expect(await firstValueFrom(service.inboxRows$)).toHaveLength(1);
    });

    it("still calls through for a row already gone, so one click is one request", async () => {
      approvalApi.decide.mockResolvedValue(request({ id: "gone", status: "approved" }));

      await service.decide("gone" as unknown as AccessRequestId, "approve", undefined);

      expect(approvalApi.decide).toHaveBeenCalledTimes(1);
    });
  });

  describe("approver-side mutations go through the SDK, not the HTTP seam", () => {
    beforeEach(async () => {
      approvalApi.listHistory.mockResolvedValue([
        request({
          id: "req-1",
          status: "activated",
          producedLeaseId: "lease-1",
          producedLeaseStatus: "active",
        }),
      ]);
      await service.load();
    });

    it("revokes a lease via leases().end()", async () => {
      await service.revokeLease(
        "req-1" as unknown as AccessRequestId,
        "lease-1" as unknown as AccessLeaseId,
      );

      expect(leasesApi.endLease).toHaveBeenCalledWith("lease-1", { reason: undefined });
    });

    it("marks the produced lease revoked so the row re-buckets", async () => {
      await service.revokeLease(
        "req-1" as unknown as AccessRequestId,
        "lease-1" as unknown as AccessLeaseId,
      );

      const history = await firstValueFrom(service.historyRows$);
      expect(history[0].statusLabelKey).toBe("pamStatusRevoked");
    });

    it("restores the row and rethrows when the revoke fails", async () => {
      leasesApi.endLease.mockRejectedValue(new Error("boom"));

      await expect(
        service.revokeLease(
          "req-1" as unknown as AccessRequestId,
          "lease-1" as unknown as AccessLeaseId,
        ),
      ).rejects.toThrow("boom");
      const history = await firstValueFrom(service.historyRows$);
      expect(history[0].statusLabelKey).toBe("pamStatusActivated");
    });

    it("cancels an approval via access_requests().cancel()", async () => {
      await service.cancelApproval("req-1" as unknown as AccessRequestId);

      expect(requestsApi.cancelAccessRequest).toHaveBeenCalledWith("req-1");
    });

    it("restores the row and rethrows when cancelling an approval fails", async () => {
      requestsApi.cancelAccessRequest.mockRejectedValue(new Error("boom"));

      await expect(service.cancelApproval("req-1" as unknown as AccessRequestId)).rejects.toThrow(
        "boom",
      );
      const history = await firstValueFrom(service.historyRows$);
      expect(history[0].status).toBe("activated");
    });

    it("never reaches for the HTTP seam to mutate", async () => {
      await service.revokeLease(
        "req-1" as unknown as AccessRequestId,
        "lease-1" as unknown as AccessLeaseId,
      );
      await service.cancelApproval("req-1" as unknown as AccessRequestId);

      // The seam is exactly three routes; revoke and cancel are not among them.
      expect(approvalApi.decide).not.toHaveBeenCalled();
    });
  });

  it("sorts history newest-resolved first", async () => {
    approvalApi.listHistory.mockResolvedValue([
      request({ id: "older", status: "denied", resolvedAt: "2026-08-17T09:00:00.000Z" }),
      request({ id: "newer", status: "denied", resolvedAt: "2026-08-17T11:00:00.000Z" }),
    ] as unknown as AccessRequestView[] as AccessRequestDetailsResponse[]);

    await service.load();

    const history = await firstValueFrom(service.historyRows$);
    expect(history.map((r) => r.id)).toEqual(["newer", "older"]);
  });
});
