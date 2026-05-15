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
});
