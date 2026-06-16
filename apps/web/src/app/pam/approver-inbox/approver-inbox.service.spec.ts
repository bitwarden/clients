import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";

import {
  AccessRequestDetailsResponse,
  AccessDecisionRequest,
  AccessDecisionVerdict,
  PamApiService,
} from "@bitwarden/pam";

import { AccessRequestNameResolver } from "../access-request-name-resolver.service";

import { ApproverInboxService, sortInbox } from "./approver-inbox.service";

function makeRow(
  overrides: Partial<{
    id: string;
    submittedAt: string;
    collectionName: string;
    requesterId: string;
    organizationId: string;
    cipherName: string;
    requestedNotAfter: string;
    expiredAt: string;
  }> = {},
): AccessRequestDetailsResponse {
  return new AccessRequestDetailsResponse({
    Id: overrides.id ?? "req-1",
    CipherId: "cipher-1",
    CollectionId: "col-1",
    OrganizationId: overrides.organizationId ?? "org-1",
    RequesterUserId: overrides.requesterId ?? "user-2",
    Status: "pending",
    RequestedTtlSeconds: 3600,
    RequestedNotAfter: overrides.requestedNotAfter,
    ExpiredAt: overrides.expiredAt,
    SubmittedAt: overrides.submittedAt ?? "2026-05-15T12:00:00Z",
    CipherName: overrides.cipherName ?? "2.encrypted-cipher-name",
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
  let pamApiService: jest.Mocked<
    Pick<
      PamApiService,
      "listInboxRequests" | "listInboxHistory" | "decideAccessRequest" | "cancelAccessRequest"
    >
  >;
  let nameResolver: MockProxy<AccessRequestNameResolver>;
  let service: ApproverInboxService;

  beforeEach(() => {
    pamApiService = {
      listInboxRequests: jest.fn(),
      listInboxHistory: jest.fn().mockResolvedValue([]),
      decideAccessRequest: jest.fn(),
      cancelAccessRequest: jest.fn().mockResolvedValue(undefined),
    } as jest.Mocked<
      Pick<
        PamApiService,
        "listInboxRequests" | "listInboxHistory" | "decideAccessRequest" | "cancelAccessRequest"
      >
    >;

    nameResolver = mock<AccessRequestNameResolver>();
    nameResolver.resolveDisplayNames.mockResolvedValue({
      cipherNameById: new Map(),
      collectionNameById: new Map(),
      cipherById: new Map(),
    });
    // Collection-name application is the resolver's job (covered in its own spec); pass rows through.
    nameResolver.applyCollectionNames$.mockImplementation((rows$) => rows$);

    TestBed.configureTestingModule({
      providers: [
        ApproverInboxService,
        { provide: PamApiService, useValue: pamApiService },
        { provide: AccessRequestNameResolver, useValue: nameResolver },
      ],
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

    it("resolves display names for the inbox and history together in one pass", async () => {
      pamApiService.listInboxRequests.mockResolvedValue([makeRow({ id: "a" })]);
      pamApiService.listInboxHistory.mockResolvedValue([makeRow({ id: "h" })]);

      await service.load();

      expect(nameResolver.resolveDisplayNames).toHaveBeenCalledTimes(1);
      const resolved = nameResolver.resolveDisplayNames.mock.calls[0][0];
      expect(resolved.map((r) => r.id).sort()).toEqual(["a", "h"]);
    });

    it("excludes timed-out requests from the actionable list", async () => {
      // Same cipher requested twice by the same user: one still live, one whose
      // window has lapsed. Only the live request should remain in the inbox.
      pamApiService.listInboxRequests.mockResolvedValue([
        makeRow({ id: "live", requestedNotAfter: "2999-01-01T00:00:00Z" }),
        makeRow({ id: "timed-out", requestedNotAfter: "2000-01-01T00:00:00Z" }),
        makeRow({ id: "open-ended" }),
        makeRow({ id: "lapsed", expiredAt: "2000-01-01T00:00:00Z" }),
      ]);

      await service.load();

      const rows = await firstValueFrom(service.requests$);
      expect(rows.map((r) => r.id).sort()).toEqual(["live", "open-ended"]);
    });

    it("captures load errors and rethrows", async () => {
      pamApiService.listInboxRequests.mockRejectedValue(new Error("nope"));

      await expect(service.load()).rejects.toThrow("nope");
      expect(await firstValueFrom(service.loadError$)).toBeInstanceOf(Error);
    });
  });

  describe("decideAccessRequest", () => {
    it("removes the row optimistically and keeps it removed on success", async () => {
      const target = makeRow({ id: "target", submittedAt: "2026-05-15T11:00:00Z" });
      const sibling = makeRow({ id: "sibling", submittedAt: "2026-05-15T12:00:00Z" });
      pamApiService.listInboxRequests.mockResolvedValue([target, sibling]);
      pamApiService.decideAccessRequest.mockResolvedValue({} as never);
      await service.load();

      await service.decideAccessRequest(
        "target",
        new AccessDecisionRequest({ verdict: AccessDecisionVerdict.Approve }),
      );

      expect(pamApiService.decideAccessRequest).toHaveBeenCalledTimes(1);
      const rows = await firstValueFrom(service.requests$);
      expect(rows.map((r) => r.id)).toEqual(["sibling"]);
    });

    it("restores the row on failure and rethrows", async () => {
      const target = makeRow({ id: "target", submittedAt: "2026-05-15T11:00:00Z" });
      pamApiService.listInboxRequests.mockResolvedValue([target]);
      pamApiService.decideAccessRequest.mockRejectedValue(new Error("server down"));
      await service.load();

      await expect(
        service.decideAccessRequest(
          "target",
          new AccessDecisionRequest({ verdict: AccessDecisionVerdict.Deny }),
        ),
      ).rejects.toThrow("server down");

      const rows = await firstValueFrom(service.requests$);
      expect(rows.map((r) => r.id)).toEqual(["target"]);
    });

    it("calls the API even when the row is already gone (double-click guard)", async () => {
      pamApiService.listInboxRequests.mockResolvedValue([]);
      pamApiService.decideAccessRequest.mockResolvedValue({} as never);
      await service.load();

      await service.decideAccessRequest(
        "missing",
        new AccessDecisionRequest({ verdict: AccessDecisionVerdict.Approve }),
      );

      expect(pamApiService.decideAccessRequest).toHaveBeenCalledTimes(1);
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

  describe("cancelApprovedRequest", () => {
    it("cancels via the API and flips the history row to denied", async () => {
      pamApiService.listInboxRequests.mockResolvedValue([]);
      pamApiService.listInboxHistory.mockResolvedValue([makeRow({ id: "appr-1" })]);
      await service.load();

      await service.cancelApprovedRequest("appr-1");

      expect(pamApiService.cancelAccessRequest).toHaveBeenCalledWith("appr-1");
      const history = await firstValueFrom(service.history$);
      expect(history.find((r) => r.id === "appr-1")?.status).toBe("denied");
    });

    it("rethrows on API failure and leaves history untouched", async () => {
      pamApiService.listInboxRequests.mockResolvedValue([]);
      pamApiService.listInboxHistory.mockResolvedValue([makeRow({ id: "appr-1" })]);
      pamApiService.cancelAccessRequest.mockRejectedValue(new Error("nope"));
      await service.load();

      await expect(service.cancelApprovedRequest("appr-1")).rejects.toThrow("nope");
      const history = await firstValueFrom(service.history$);
      expect(history.find((r) => r.id === "appr-1")?.status).toBe("pending");
    });
  });
});
