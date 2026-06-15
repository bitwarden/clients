import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { KeyService } from "@bitwarden/key-management";
import { AccessRequestDetailsResponse, AccessDecisionRequest, PamApiService } from "@bitwarden/pam";

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
    Pick<PamApiService, "listInboxRequests" | "listInboxHistory" | "decideAccessRequest">
  >;
  let encryptService: jest.Mocked<Pick<EncryptService, "decryptString">>;
  let service: ApproverInboxService;

  beforeEach(() => {
    pamApiService = {
      listInboxRequests: jest.fn(),
      listInboxHistory: jest.fn().mockResolvedValue([]),
      decideAccessRequest: jest.fn(),
    } as jest.Mocked<
      Pick<PamApiService, "listInboxRequests" | "listInboxHistory" | "decideAccessRequest">
    >;

    encryptService = {
      decryptString: jest.fn().mockResolvedValue("decrypted-name"),
    } as jest.Mocked<Pick<EncryptService, "decryptString">>;

    const accountService = mock<AccountService>();
    (accountService as unknown as { activeAccount$: BehaviorSubject<unknown> }).activeAccount$ =
      new BehaviorSubject({ id: "user-current", email: "me@example.com" });

    const keyService = mock<KeyService>();
    keyService.orgKeys$.mockReturnValue(of({ "org-1": "fake-org-key" } as never));

    TestBed.configureTestingModule({
      providers: [
        ApproverInboxService,
        { provide: PamApiService, useValue: pamApiService },
        { provide: AccountService, useValue: accountService },
        { provide: KeyService, useValue: keyService },
        { provide: EncryptService, useValue: encryptService },
        { provide: LogService, useValue: mock<LogService>() },
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

    it("decrypts cipher and collection names with the row's org key", async () => {
      pamApiService.listInboxRequests.mockResolvedValue([
        makeRow({ id: "a", cipherName: "2.cipher-blob" }),
      ]);

      await service.load();

      // One call per field (cipherName, collectionName).
      expect(encryptService.decryptString).toHaveBeenCalledTimes(2);
      const rows = await firstValueFrom(service.requests$);
      expect(rows[0].cipherName).toBe("decrypted-name");
      expect(rows[0].collectionName).toBe("decrypted-name");
    });

    it("falls back to a placeholder when decryption fails", async () => {
      pamApiService.listInboxRequests.mockResolvedValue([
        makeRow({ id: "a", cipherName: "2.cipher-blob" }),
      ]);
      encryptService.decryptString.mockRejectedValue(new Error("boom"));

      await service.load();

      const rows = await firstValueFrom(service.requests$);
      expect(rows[0].cipherName).toBe("[error: cannot decrypt]");
      expect(rows[0].collectionName).toBe("[error: cannot decrypt]");
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
        new AccessDecisionRequest({ verdict: "approve" }),
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
        service.decideAccessRequest("target", new AccessDecisionRequest({ verdict: "deny" })),
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
        new AccessDecisionRequest({ verdict: "approve" }),
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
});
