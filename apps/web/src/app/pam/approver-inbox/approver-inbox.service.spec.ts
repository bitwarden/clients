import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, Subject, firstValueFrom } from "rxjs";

import { ServerNotificationsService } from "@bitwarden/common/platform/server-notifications";
import {
  AccessRequestDetailsResponse,
  AccessDecisionRequest,
  AccessDecisionVerdict,
  PamApiService,
} from "@bitwarden/pam";

import { AccessRequestNameResolver } from "../access-request-name-resolver.service";

import { ApproverInboxRequestsService } from "./approver-inbox-requests.service";
import { ApproverInboxService, sortInbox } from "./approver-inbox.service";

const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

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
      | "listInboxHistory"
      | "decideAccessRequest"
      | "cancelAccessRequest"
      | "revokeAccessLease"
      | "mutations$"
    >
  >;
  let nameResolver: MockProxy<AccessRequestNameResolver>;
  let inboxRequests$: BehaviorSubject<AccessRequestDetailsResponse[]>;
  let inboxRequestsRefresh: jest.Mock;
  let service: ApproverInboxService;

  /** Push raw inbox rows through the shared stream and let the projection settle. */
  async function emitInbox(rows: AccessRequestDetailsResponse[]): Promise<void> {
    inboxRequests$.next(rows);
    await flushMicrotasks();
  }

  beforeEach(() => {
    pamApiService = {
      listInboxHistory: jest.fn().mockResolvedValue([]),
      decideAccessRequest: jest.fn(),
      cancelAccessRequest: jest.fn().mockResolvedValue(undefined),
      revokeAccessLease: jest.fn().mockResolvedValue(undefined),
      mutations$: new Subject<void>(),
    } as jest.Mocked<
      Pick<
        PamApiService,
        | "listInboxHistory"
        | "decideAccessRequest"
        | "cancelAccessRequest"
        | "revokeAccessLease"
        | "mutations$"
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

    inboxRequests$ = new BehaviorSubject<AccessRequestDetailsResponse[]>([]);
    inboxRequestsRefresh = jest.fn().mockResolvedValue(undefined);

    TestBed.configureTestingModule({
      providers: [
        ApproverInboxService,
        { provide: PamApiService, useValue: pamApiService },
        { provide: AccessRequestNameResolver, useValue: nameResolver },
        {
          provide: ApproverInboxRequestsService,
          useValue: { requests$: inboxRequests$, refresh: inboxRequestsRefresh },
        },
        { provide: ServerNotificationsService, useValue: { notifications$: new Subject() } },
      ],
    });

    service = TestBed.inject(ApproverInboxService);
  });

  describe("pending list", () => {
    it("projects the shared inbox stream, sorted oldest first", async () => {
      await emitInbox([
        makeRow({ id: "newer", submittedAt: "2026-05-15T13:00:00Z" }),
        makeRow({ id: "older", submittedAt: "2026-05-15T11:00:00Z" }),
      ]);

      const rows = await firstValueFrom(service.requests$);
      expect(rows.map((r) => r.id)).toEqual(["older", "newer"]);
    });

    it("resolves display names for the projected rows", async () => {
      await emitInbox([makeRow({ id: "a" })]);

      expect(nameResolver.resolveDisplayNames).toHaveBeenCalled();
      const resolved = nameResolver.resolveDisplayNames.mock.calls.at(-1)![0];
      expect(resolved.map((r) => r.id)).toEqual(["a"]);
    });

    it("excludes timed-out requests from the actionable list", async () => {
      await emitInbox([
        makeRow({ id: "live", requestedNotAfter: "2999-01-01T00:00:00Z" }),
        makeRow({ id: "timed-out", requestedNotAfter: "2000-01-01T00:00:00Z" }),
        makeRow({ id: "open-ended" }),
        makeRow({ id: "lapsed", expiredAt: "2000-01-01T00:00:00Z" }),
      ]);

      const rows = await firstValueFrom(service.requests$);
      expect(rows.map((r) => r.id).sort()).toEqual(["live", "open-ended"]);
    });

    it("publishes a badge count derived from the request list", async () => {
      await emitInbox([makeRow({ id: "a" }), makeRow({ id: "b" })]);

      expect(await firstValueFrom(service.badgeCount$)).toBe(2);
    });
  });

  describe("history", () => {
    it("loads history and resolves its display names on construction", async () => {
      // Construction already kicked an initial (empty) history load; reload with data.
      pamApiService.listInboxHistory.mockResolvedValue([makeRow({ id: "h" })]);
      await service.load();

      const history = await firstValueFrom(service.history$);
      expect(history.map((r) => r.id)).toEqual(["h"]);
    });

    it("captures history load errors and rethrows", async () => {
      pamApiService.listInboxHistory.mockRejectedValue(new Error("nope"));

      await expect(service.load()).rejects.toThrow("nope");
      expect(await firstValueFrom(service.loadError$)).toBeInstanceOf(Error);
    });
  });

  describe("decideAccessRequest", () => {
    it("removes the row optimistically and keeps it removed on success", async () => {
      const target = makeRow({ id: "target", submittedAt: "2026-05-15T11:00:00Z" });
      const sibling = makeRow({ id: "sibling", submittedAt: "2026-05-15T12:00:00Z" });
      await emitInbox([target, sibling]);
      pamApiService.decideAccessRequest.mockResolvedValue({} as never);

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
      await emitInbox([target]);
      pamApiService.decideAccessRequest.mockRejectedValue(new Error("server down"));

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
      await emitInbox([]);
      pamApiService.decideAccessRequest.mockResolvedValue({} as never);

      await service.decideAccessRequest(
        "missing",
        new AccessDecisionRequest({ verdict: AccessDecisionVerdict.Approve }),
      );

      expect(pamApiService.decideAccessRequest).toHaveBeenCalledTimes(1);
    });
  });

  describe("cancelApprovedRequest", () => {
    it("cancels via the API and flips the history row to denied", async () => {
      pamApiService.listInboxHistory.mockResolvedValue([makeRow({ id: "appr-1" })]);
      await service.load();

      await service.cancelApprovedRequest("appr-1");

      expect(pamApiService.cancelAccessRequest).toHaveBeenCalledWith("appr-1");
      const history = await firstValueFrom(service.history$);
      expect(history.find((r) => r.id === "appr-1")?.status).toBe("denied");
    });

    it("rethrows on API failure and leaves history untouched", async () => {
      pamApiService.listInboxHistory.mockResolvedValue([makeRow({ id: "appr-1" })]);
      pamApiService.cancelAccessRequest.mockRejectedValue(new Error("nope"));
      await service.load();

      await expect(service.cancelApprovedRequest("appr-1")).rejects.toThrow("nope");
      const history = await firstValueFrom(service.history$);
      expect(history.find((r) => r.id === "appr-1")?.status).toBe("pending");
    });
  });
});
