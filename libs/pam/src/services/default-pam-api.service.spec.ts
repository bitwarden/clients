import { ApiService } from "@bitwarden/common/abstractions/api.service";

import { LeasingPolicy } from "../abstractions/leasing-policy";

import { DefaultPamApiService } from "./default-pam-api.service";
import { CollectionLeasingRequest } from "./requests/collection-leasing.request";
import { LeaseDecisionRequest } from "./requests/lease-decision.request";
import { LeaseExtensionRequest } from "./requests/lease-extension.request";
import { LeaseRequestPatchRequest } from "./requests/lease-request-patch.request";
import { LeaseRevokeRequest } from "./requests/lease-revoke.request";

describe("DefaultPamApiService", () => {
  let apiService: jest.Mocked<Pick<ApiService, "send">>;
  let service: DefaultPamApiService;

  beforeEach(() => {
    apiService = { send: jest.fn() } as jest.Mocked<Pick<ApiService, "send">>;
    service = new DefaultPamApiService(apiService as unknown as ApiService);
  });

  describe("fetchGatedCipher", () => {
    it("rejects with a clear error pointing at PM-37264", async () => {
      await expect(service.fetchGatedCipher("cipher-1")).rejects.toThrow("PM-37264");
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
});
