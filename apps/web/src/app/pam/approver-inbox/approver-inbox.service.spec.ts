import { TestBed } from "@angular/core/testing";
import { firstValueFrom } from "rxjs";

import { InboxLeaseRequestResponse, LeaseDecisionRequest, PamApiService } from "@bitwarden/pam";

import { ApproverInboxService, sortInbox } from "./approver-inbox.service";

function makeRow(
  overrides: Partial<{
    id: string;
    submittedAt: string;
    collectionName: string;
    requesterUserId: string;
  }> = {},
): InboxLeaseRequestResponse {
  return new InboxLeaseRequestResponse({
    Id: overrides.id ?? "req-1",
    CipherId: "cipher-1",
    CollectionId: "col-1",
    RequesterUserId: overrides.requesterUserId ?? "user-2",
    Status: "pending",
    RequestedTtlSeconds: 3600,
    SubmittedAt: overrides.submittedAt ?? "2026-05-15T12:00:00Z",
    CipherName: "Prod DB",
    CollectionName: overrides.collectionName ?? "Production",
    RequesterName: "Bob",
    RequesterEmail: "bob@example.com",
  });
}

describe("sortInbox", () => {
  it("sorts by submittedAt ascending (oldest first)", () => {
    const a = makeRow({ id: "a", submittedAt: "2026-05-15T12:00:00Z" });
    const b = makeRow({ id: "b", submittedAt: "2026-05-15T10:00:00Z" });
    const c = makeRow({ id: "c", submittedAt: "2026-05-15T11:00:00Z" });

    const result = sortInbox([a, b, c]);

    expect(result.map((r) => r.id)).toEqual(["b", "c", "a"]);
  });

  it("breaks submittedAt ties by collection name", () => {
    const submittedAt = "2026-05-15T12:00:00Z";
    const a = makeRow({ id: "a", submittedAt, collectionName: "Zeta" });
    const b = makeRow({ id: "b", submittedAt, collectionName: "alpha" });
    const c = makeRow({ id: "c", submittedAt, collectionName: "Mike" });

    const result = sortInbox([a, b, c]);

    expect(result.map((r) => r.id)).toEqual(["b", "c", "a"]);
  });
});

describe("ApproverInboxService", () => {
  let pamApiService: jest.Mocked<Pick<PamApiService, "listInboxRequests" | "submitDecision">>;
  let service: ApproverInboxService;

  beforeEach(() => {
    pamApiService = {
      listInboxRequests: jest.fn(),
      submitDecision: jest.fn(),
    } as jest.Mocked<Pick<PamApiService, "listInboxRequests" | "submitDecision">>;

    TestBed.configureTestingModule({
      providers: [ApproverInboxService, { provide: PamApiService, useValue: pamApiService }],
    });

    service = TestBed.inject(ApproverInboxService);
  });

  describe("load", () => {
    it("publishes sorted requests on success", async () => {
      pamApiService.listInboxRequests.mockResolvedValue([
        makeRow({ id: "newer", submittedAt: "2026-05-15T13:00:00Z" }),
        makeRow({ id: "older", submittedAt: "2026-05-15T11:00:00Z" }),
      ]);

      await service.load();

      const rows = await firstValueFrom(service.requests$);
      expect(rows.map((r) => r.id)).toEqual(["older", "newer"]);
    });

    it("captures load errors and rethrows", async () => {
      pamApiService.listInboxRequests.mockRejectedValue(new Error("nope"));

      await expect(service.load()).rejects.toThrow("nope");
      expect(await firstValueFrom(service.loadError$)).toBeInstanceOf(Error);
    });
  });

  describe("submitDecision", () => {
    it("removes the row optimistically and keeps it removed on success", async () => {
      const target = makeRow({ id: "target", submittedAt: "2026-05-15T11:00:00Z" });
      const sibling = makeRow({ id: "sibling", submittedAt: "2026-05-15T12:00:00Z" });
      pamApiService.listInboxRequests.mockResolvedValue([target, sibling]);
      pamApiService.submitDecision.mockResolvedValue({} as never);
      await service.load();

      await service.submitDecision("target", new LeaseDecisionRequest({ decision: "approve" }));

      expect(pamApiService.submitDecision).toHaveBeenCalledTimes(1);
      const rows = await firstValueFrom(service.requests$);
      expect(rows.map((r) => r.id)).toEqual(["sibling"]);
    });

    it("restores the row on failure and rethrows", async () => {
      const target = makeRow({ id: "target", submittedAt: "2026-05-15T11:00:00Z" });
      pamApiService.listInboxRequests.mockResolvedValue([target]);
      pamApiService.submitDecision.mockRejectedValue(new Error("server down"));
      await service.load();

      await expect(
        service.submitDecision("target", new LeaseDecisionRequest({ decision: "deny" })),
      ).rejects.toThrow("server down");

      const rows = await firstValueFrom(service.requests$);
      expect(rows.map((r) => r.id)).toEqual(["target"]);
    });

    it("calls the API even when the row is already gone (double-click guard)", async () => {
      pamApiService.listInboxRequests.mockResolvedValue([]);
      pamApiService.submitDecision.mockResolvedValue({} as never);
      await service.load();

      await service.submitDecision("missing", new LeaseDecisionRequest({ decision: "approve" }));

      expect(pamApiService.submitDecision).toHaveBeenCalledTimes(1);
    });

    it("publishes a badge count derived from the request list", async () => {
      pamApiService.listInboxRequests.mockResolvedValue([
        makeRow({ id: "a" }),
        makeRow({ id: "b" }),
      ]);
      await service.load();

      expect(await firstValueFrom(service.badgeCount$)).toBe(2);
    });
  });
});
