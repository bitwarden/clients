import { of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { UserId } from "@bitwarden/common/types/guid";

import { LeasingPolicy } from "../abstractions/leasing-policy";

import { DefaultPamApiService } from "./default-pam-api.service";
import { CollectionLeasingRequest } from "./requests/collection-leasing.request";
import { LeaseDecisionRequest } from "./requests/lease-decision.request";
import { LeaseExtensionRequest } from "./requests/lease-extension.request";
import { LeaseRequestPatchRequest } from "./requests/lease-request-patch.request";
import { LeaseRevokeRequest } from "./requests/lease-revoke.request";

describe("DefaultPamApiService", () => {
  let apiService: jest.Mocked<Pick<ApiService, "send" | "fetch" | "getActiveBearerToken">>;
  let environmentService: jest.Mocked<Pick<EnvironmentService, "getEnvironment$">>;
  let accountService: Pick<AccountService, "activeAccount$">;
  let service: DefaultPamApiService;

  beforeEach(() => {
    apiService = {
      send: jest.fn(),
      fetch: jest.fn(),
      getActiveBearerToken: jest.fn(),
    } as jest.Mocked<Pick<ApiService, "send" | "fetch" | "getActiveBearerToken">>;
    environmentService = {
      getEnvironment$: jest.fn().mockReturnValue(of({ getApiUrl: () => "https://api.test" })),
    } as jest.Mocked<Pick<EnvironmentService, "getEnvironment$">>;
    accountService = {
      activeAccount$: of({
        id: "user-1" as UserId,
        email: "u@example.com",
        emailVerified: true,
        name: undefined,
        creationDate: undefined,
      }),
    };
    service = new DefaultPamApiService(
      apiService as unknown as ApiService,
      environmentService as unknown as EnvironmentService,
      accountService as AccountService,
    );
  });

  describe("fetchGatedCipher", () => {
    const cipherId = "cipher-1";

    const buildResponse = (status: number, body: unknown, headers: Record<string, string> = {}) =>
      new Response(body == null ? null : JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json", ...headers },
      });

    it("issues exactly one GET /ciphers/{id} authenticated request", async () => {
      apiService.getActiveBearerToken.mockResolvedValue("token-abc");
      apiService.fetch.mockResolvedValue(buildResponse(200, { Id: cipherId }));

      await service.fetchGatedCipher(cipherId);

      expect(apiService.fetch).toHaveBeenCalledTimes(1);
      const request = apiService.fetch.mock.calls[0][0];
      expect(request.method).toBe("GET");
      expect(request.url).toBe(`https://api.test/ciphers/${cipherId}`);
      expect(request.headers.get("Authorization")).toBe("Bearer token-abc");
    });

    it("encodes the cipher id into the URL path", async () => {
      apiService.getActiveBearerToken.mockResolvedValue("token-abc");
      apiService.fetch.mockResolvedValue(buildResponse(200, { Id: "a/b" }));

      await service.fetchGatedCipher("a/b");

      expect(apiService.fetch.mock.calls[0][0].url).toBe("https://api.test/ciphers/a%2Fb");
    });

    it("returns an approved result on 200 with the cipher body and optional lease id header", async () => {
      apiService.getActiveBearerToken.mockResolvedValue("token-abc");
      apiService.fetch.mockResolvedValue(
        buildResponse(200, { Id: cipherId, Name: "name" }, { "X-Lease-Id": "lease-9" }),
      );

      const result = await service.fetchGatedCipher(cipherId);

      expect(result.kind).toBe("approved");
      if (result.kind === "approved") {
        expect(result.cipher.id).toBe(cipherId);
        expect(result.leaseId).toBe("lease-9");
      }
    });

    it("returns approved with leaseId=null when the header is absent", async () => {
      apiService.getActiveBearerToken.mockResolvedValue("token-abc");
      apiService.fetch.mockResolvedValue(buildResponse(200, { Id: cipherId }));

      const result = await service.fetchGatedCipher(cipherId);

      expect(result.kind === "approved" && result.leaseId).toBe(null);
    });

    it("returns a pending result on 202 with the lease request body preserved", async () => {
      apiService.getActiveBearerToken.mockResolvedValue("token-abc");
      apiService.fetch.mockResolvedValue(
        buildResponse(202, { Id: "req-7", Status: "pending", CipherId: cipherId }),
      );

      const result = await service.fetchGatedCipher(cipherId);

      expect(result.kind).toBe("pending");
      if (result.kind === "pending") {
        expect(result.request.id).toBe("req-7");
        expect(result.request.status).toBe("pending");
      }
    });

    it("returns a denied result on 403 carrying the server-provided reason verbatim", async () => {
      apiService.getActiveBearerToken.mockResolvedValue("token-abc");
      apiService.fetch.mockResolvedValue(
        buildResponse(403, { Reason: "Outside allowed time window" }),
      );

      const result = await service.fetchGatedCipher(cipherId);

      expect(result.kind).toBe("denied");
      if (result.kind === "denied") {
        expect(result.reason).toBe("Outside allowed time window");
      }
    });

    it("returns a denied result with an empty reason when the 403 body is missing or malformed", async () => {
      apiService.getActiveBearerToken.mockResolvedValue("token-abc");
      apiService.fetch.mockResolvedValue(buildResponse(403, null));

      const result = await service.fetchGatedCipher(cipherId);

      expect(result.kind === "denied" && result.reason).toBe("");
    });

    it("never delegates to apiService.send (which would 403→logout and drop the 202 body)", async () => {
      apiService.getActiveBearerToken.mockResolvedValue("token-abc");
      apiService.fetch.mockResolvedValue(buildResponse(200, { Id: cipherId }));

      await service.fetchGatedCipher(cipherId);

      expect(apiService.send).not.toHaveBeenCalled();
    });

    it("throws on unexpected status codes (e.g. 500) — these are bugs, not routing decisions", async () => {
      apiService.getActiveBearerToken.mockResolvedValue("token-abc");
      apiService.fetch.mockResolvedValue(buildResponse(500, { Message: "boom" }));

      await expect(service.fetchGatedCipher(cipherId)).rejects.toThrow("Unexpected status 500");
    });

    it("rejects with a clear error pointing at PM-37264 when DI collaborators are missing", async () => {
      const partial = new DefaultPamApiService(apiService as unknown as ApiService);

      await expect(partial.fetchGatedCipher(cipherId)).rejects.toThrow("PM-37264");
    });
  });

  describe("patchLeaseRequest", () => {
    it("PATCHes /leasing/requests/{id} and wraps the response", async () => {
      apiService.send.mockResolvedValue({ Id: "req-1", Status: "pending" });
      const req = new LeaseRequestPatchRequest({
        notAfter: new Date("2026-01-01T00:00:00Z"),
        reason: "needed",
      });

      const result = await service.patchLeaseRequest("req-1", req);

      expect(apiService.send).toHaveBeenCalledWith(
        "PATCH",
        "/leasing/requests/req-1",
        req,
        true,
        true,
      );
      expect(result.id).toBe("req-1");
      expect(result.status).toBe("pending");
    });
  });

  describe("cancelLeaseRequest", () => {
    it("DELETEs /leasing/requests/{id} without expecting a response body", async () => {
      apiService.send.mockResolvedValue(undefined);

      await service.cancelLeaseRequest("req-1");

      expect(apiService.send).toHaveBeenCalledWith(
        "DELETE",
        "/leasing/requests/req-1",
        null,
        true,
        false,
      );
    });
  });

  describe("requestLeaseExtension", () => {
    it("POSTs /leasing/requests/extension and wraps the response", async () => {
      apiService.send.mockResolvedValue({ Id: "req-2", Status: "pending" });
      const req = new LeaseExtensionRequest({
        leaseId: "lease-1",
        notAfter: new Date("2026-01-01T02:00:00Z"),
      });

      const result = await service.requestLeaseExtension(req);

      expect(apiService.send).toHaveBeenCalledWith(
        "POST",
        "/leasing/requests/extension",
        req,
        true,
        true,
      );
      expect(result.id).toBe("req-2");
    });
  });

  describe("decideLeaseRequest", () => {
    it("POSTs /leasing/requests/{id}/decision and wraps the response", async () => {
      apiService.send.mockResolvedValue({ Id: "req-1", Status: "approved" });
      const req = new LeaseDecisionRequest({ decision: "approve" });

      const result = await service.decideLeaseRequest("req-1", req);

      expect(apiService.send).toHaveBeenCalledWith(
        "POST",
        "/leasing/requests/req-1/decision",
        req,
        true,
        true,
      );
      expect(result.status).toBe("approved");
    });
  });

  describe("revokeLease", () => {
    it("POSTs /leasing/leases/{id}/revoke without expecting a response body", async () => {
      apiService.send.mockResolvedValue(undefined);
      const req = new LeaseRevokeRequest({ reason: "policy violation" });

      await service.revokeLease("lease-1", req);

      expect(apiService.send).toHaveBeenCalledWith(
        "POST",
        "/leasing/leases/lease-1/revoke",
        req,
        true,
        false,
      );
    });
  });

  describe("getCollectionLeasingConfig", () => {
    it("GETs /collections/{id}/leasing and wraps the response", async () => {
      apiService.send.mockResolvedValue({
        CollectionId: "col-1",
        LeasingEnabled: false,
        Policy: null,
      });

      const result = await service.getCollectionLeasingConfig("col-1");

      expect(apiService.send).toHaveBeenCalledWith(
        "GET",
        "/collections/col-1/leasing",
        null,
        true,
        true,
      );
      expect(result.collectionId).toBe("col-1");
      expect(result.leasingEnabled).toBe(false);
      expect(result.policy).toBeNull();
    });
  });

  describe("listMyRequests", () => {
    it("GETs /leasing/requests/mine and unwraps the ListResponse", async () => {
      apiService.send.mockResolvedValue({
        Data: [
          { Id: "req-a", Status: "pending" },
          { Id: "req-b", Status: "approved" },
        ],
      });

      const result = await service.listMyRequests();

      expect(apiService.send).toHaveBeenCalledWith(
        "GET",
        "/leasing/requests/mine",
        null,
        true,
        true,
      );
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("req-a");
      expect(result[1].id).toBe("req-b");
    });

    it("returns an empty array when the server omits Data", async () => {
      apiService.send.mockResolvedValue({});

      const result = await service.listMyRequests();

      expect(result).toEqual([]);
    });
  });

  describe("listActiveLeases", () => {
    it("GETs /leasing/leases?status=active and unwraps the list response", async () => {
      apiService.send.mockResolvedValue({
        Data: [
          {
            Id: "lease-1",
            RequestId: "req-1",
            CipherId: "cipher-1",
            CollectionId: "col-1",
            GranteeUserId: "user-1",
            NotBefore: "2026-01-01T00:00:00Z",
            NotAfter: "2026-01-01T01:00:00Z",
            Status: "active",
          },
          {
            Id: "lease-2",
            RequestId: "req-2",
            CipherId: "cipher-2",
            CollectionId: "col-2",
            GranteeUserId: "user-2",
            NotBefore: "2026-01-01T00:00:00Z",
            NotAfter: "2026-01-01T00:15:00Z",
            Status: "active",
          },
        ],
        ContinuationToken: null,
      });

      const result = await service.listActiveLeases();

      expect(apiService.send).toHaveBeenCalledWith(
        "GET",
        "/leasing/leases?status=active",
        null,
        true,
        true,
      );
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("lease-1");
      expect(result[0].status).toBe("active");
      expect(result[1].id).toBe("lease-2");
    });

    it("returns an empty array when the API returns no data", async () => {
      apiService.send.mockResolvedValue({ Data: null });

      const result = await service.listActiveLeases();

      expect(result).toEqual([]);
    });
  });


  describe("setCollectionLeasingConfig", () => {
    it("PUTs /collections/{id}/leasing and wraps the response", async () => {
      apiService.send.mockResolvedValue({
        CollectionId: "col-1",
        LeasingEnabled: true,
        Policy: { Kind: "human_approval" },
      });
      const policy: LeasingPolicy = { kind: "human_approval" };
      const req = new CollectionLeasingRequest({ leasingEnabled: true, policy });

      const result = await service.setCollectionLeasingConfig("col-1", req);

      expect(apiService.send).toHaveBeenCalledWith(
        "PUT",
        "/collections/col-1/leasing",
        req,
        true,
        true,
      );
      expect(result.collectionId).toBe("col-1");
      expect(result.leasingEnabled).toBe(true);
      expect(result.policy?.kind).toBe("human_approval");
    });
  });

  describe("listInboxRequests", () => {
    it("GETs /leasing/requests/inbox and wraps each row", async () => {
      apiService.send.mockResolvedValue([
        {
          Id: "req-1",
          CipherId: "cipher-1",
          CollectionId: "col-1",
          RequesterUserId: "user-2",
          Status: "pending",
          RequestedTtlSeconds: 3600,
          SubmittedAt: "2026-05-15T12:00:00Z",
          CipherName: "Prod DB",
          CollectionName: "Production",
          RequesterName: "Bob",
          RequesterEmail: "bob@example.com",
        },
      ]);

      const result = await service.listInboxRequests();

      expect(apiService.send).toHaveBeenCalledWith(
        "GET",
        "/leasing/requests/inbox",
        null,
        true,
        true,
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("req-1");
      expect(result[0].cipherName).toBe("Prod DB");
      expect(result[0].collectionName).toBe("Production");
      expect(result[0].requesterName).toBe("Bob");
      expect(result[0].requesterEmail).toBe("bob@example.com");
    });

    it("returns an empty array when the server returns nothing iterable", async () => {
      apiService.send.mockResolvedValue(undefined);

      const result = await service.listInboxRequests();

      expect(result).toEqual([]);
    });
  });

  describe("submitDecision", () => {
    it("delegates to decideLeaseRequest", async () => {
      apiService.send.mockResolvedValue({ Id: "req-1", Status: "approved" });
      const req = new LeaseDecisionRequest({ decision: "approve", comment: "ok" });

      const result = await service.submitDecision("req-1", req);

      expect(apiService.send).toHaveBeenCalledWith(
        "POST",
        "/leasing/requests/req-1/decision",
        req,
        true,
        true,
      );
      expect(result.status).toBe("approved");
    });
  });

  describe("getLeaseRequest", () => {
    it("GETs /leasing/requests/{id} and wraps the response", async () => {
      apiService.send.mockResolvedValue({
        Id: "req-1",
        CipherId: "cipher-1",
        CollectionId: "col-1",
        RequesterUserId: "user-2",
        Status: "pending",
        RequestedTtlSeconds: 3600,
        SubmittedAt: "2026-05-15T12:00:00Z",
        CipherName: "Prod DB",
        CollectionName: "Production",
        RequesterName: "Bob",
        RequesterEmail: "bob@example.com",
      });

      const result = await service.getLeaseRequest("req-1");

      expect(apiService.send).toHaveBeenCalledWith(
        "GET",
        "/leasing/requests/req-1",
        null,
        true,
        true,
      );
      expect(result.id).toBe("req-1");
      expect(result.cipherName).toBe("Prod DB");
      expect(result.requesterEmail).toBe("bob@example.com");
    });
  });

  describe("getInboxBadgeCount", () => {
    it("GETs /leasing/requests/inbox/count and wraps the response", async () => {
      apiService.send.mockResolvedValue({ Count: 3 });

      const result = await service.getInboxBadgeCount();

      expect(apiService.send).toHaveBeenCalledWith(
        "GET",
        "/leasing/requests/inbox/count",
        null,
        true,
        true,
      );
      expect(result.count).toBe(3);
    });

    it("defaults to zero when the server omits Count", async () => {
      apiService.send.mockResolvedValue({});

      const result = await service.getInboxBadgeCount();

      expect(result.count).toBe(0);
    });
  });

  describe("bulkRevokeLeases", () => {
    it("POSTs /organizations/{id}/leasing/leases/revoke-all and returns ok shape", async () => {
      apiService.send.mockResolvedValue({ Kind: "ok", RevokedCount: 5 });

      const result = await service.bulkRevokeLeases("org-1");

      expect(apiService.send).toHaveBeenCalledWith(
        "POST",
        "/organizations/org-1/leasing/leases/revoke-all",
        null,
        true,
        true,
      );
      expect(result).toEqual({ kind: "ok", revokedCount: 5 });
    });

    it("returns partial shape when Kind is 'partial'", async () => {
      apiService.send.mockResolvedValue({
        Kind: "partial",
        RevokedCount: 3,
        FailedCount: 2,
        Failures: [
          { LeaseId: "lease-a", Reason: "already expired" },
          { LeaseId: "lease-b", Reason: "concurrent revoke" },
        ],
      });

      const result = await service.bulkRevokeLeases("org-1");

      expect(result).toEqual({
        kind: "partial",
        revokedCount: 3,
        failedCount: 2,
        failures: [
          { leaseId: "lease-a", reason: "already expired" },
          { leaseId: "lease-b", reason: "concurrent revoke" },
        ],
      });
    });

    it("defaults RevokedCount to 0 when absent from the response", async () => {
      apiService.send.mockResolvedValue({ Kind: "ok" });

      const result = await service.bulkRevokeLeases("org-1");

      expect(result).toEqual({ kind: "ok", revokedCount: 0 });
    });
  });

  describe("getGovernanceSummary", () => {
    it("GETs /organizations/{id}/leasing/governance and wraps the response", async () => {
      apiService.send.mockResolvedValue({
        OrganizationId: "org-1",
        LeasingEnabledCollectionCount: 2,
        TotalPendingRequestCount: 1,
        TotalActiveLeaseCount: 3,
        Collections: [
          {
            CollectionId: "col-1",
            CollectionName: "Servers",
            Policy: { Kind: "human_approval" },
            RequireLeaseMemberCount: 4,
            PendingRequestCount: 1,
            ActiveLeaseCount: 2,
            LastActivityAt: "2026-05-01T12:00:00Z",
          },
          {
            CollectionId: "col-2",
            CollectionName: "Databases",
            Policy: null,
            RequireLeaseMemberCount: 0,
            PendingRequestCount: 0,
            ActiveLeaseCount: 1,
            LastActivityAt: null,
          },
        ],
      });

      const result = await service.getGovernanceSummary("org-1");

      expect(apiService.send).toHaveBeenCalledWith(
        "GET",
        "/organizations/org-1/leasing/governance",
        null,
        true,
        true,
      );
      expect(result.organizationId).toBe("org-1");
      expect(result.leasingEnabledCollectionCount).toBe(2);
      expect(result.totalPendingRequestCount).toBe(1);
      expect(result.totalActiveLeaseCount).toBe(3);
      expect(result.collections).toHaveLength(2);
      expect(result.collections[0].collectionId).toBe("col-1");
      expect(result.collections[0].policy?.kind).toBe("human_approval");
      expect(result.collections[0].requireLeaseMemberCount).toBe(4);
      expect(result.collections[0].pendingRequestCount).toBe(1);
      expect(result.collections[0].activeLeaseCount).toBe(2);
      expect(result.collections[0].lastActivityAt).toBe("2026-05-01T12:00:00Z");
      expect(result.collections[1].policy).toBeNull();
      expect(result.collections[1].lastActivityAt).toBeNull();
    });

    it("tolerates a missing Collections array and missing counts", async () => {
      apiService.send.mockResolvedValue({ OrganizationId: "org-1" });

      const result = await service.getGovernanceSummary("org-1");

      expect(result.collections).toEqual([]);
      expect(result.leasingEnabledCollectionCount).toBe(0);
      expect(result.totalPendingRequestCount).toBe(0);
      expect(result.totalActiveLeaseCount).toBe(0);
    });
  });

});
