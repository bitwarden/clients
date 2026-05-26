import { ApiService } from "@bitwarden/common/abstractions/api.service";

import { AccessRule } from "../abstractions/access-rule";

import { DefaultPamApiService } from "./default-pam-api.service";
import { AccessRuleRequest } from "./requests/access-rule.request";
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

  describe("listAccessRules", () => {
    it("GETs /organizations/{orgId}/access-rules and wraps in ListResponse", async () => {
      apiService.send.mockResolvedValue({
        Data: [
          {
            Id: "pol-1",
            OrganizationId: "org-1",
            Name: "Human approval",
            Description: null,
            Rule: { Kind: "human_approval" },
            CreationDate: "2026-05-25T00:00:00Z",
            RevisionDate: "2026-05-25T00:00:00Z",
          },
        ],
        ContinuationToken: null,
      });

      const result = await service.listAccessRules("org-1");

      expect(apiService.send).toHaveBeenCalledWith(
        "GET",
        "/organizations/org-1/access-rules",
        null,
        true,
        true,
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe("pol-1");
      expect(result.data[0].rule.kind).toBe("human_approval");
    });
  });

  describe("getAccessRule", () => {
    it("GETs /organizations/{orgId}/access-rules/{id} and wraps the response", async () => {
      apiService.send.mockResolvedValue({
        Id: "pol-1",
        OrganizationId: "org-1",
        Name: "Human approval",
        Description: null,
        Rule: { Kind: "human_approval" },
        CreationDate: "2026-05-25T00:00:00Z",
        RevisionDate: "2026-05-25T00:00:00Z",
      });

      const result = await service.getAccessRule("org-1", "pol-1");

      expect(apiService.send).toHaveBeenCalledWith(
        "GET",
        "/organizations/org-1/access-rules/pol-1",
        null,
        true,
        true,
      );
      expect(result.id).toBe("pol-1");
      expect(result.rule.kind).toBe("human_approval");
    });
  });

  describe("createAccessRule", () => {
    it("POSTs /organizations/{orgId}/access-rules and wraps the response", async () => {
      apiService.send.mockResolvedValue({
        Id: "pol-1",
        OrganizationId: "org-1",
        Name: "Human approval",
        Description: null,
        Rule: { Kind: "human_approval" },
        CreationDate: "2026-05-25T00:00:00Z",
        RevisionDate: "2026-05-25T00:00:00Z",
      });
      const rule: AccessRule = { kind: "human_approval" };
      const req = new AccessRuleRequest({ name: "Human approval", rule });

      const result = await service.createAccessRule("org-1", req);

      expect(apiService.send).toHaveBeenCalledWith(
        "POST",
        "/organizations/org-1/access-rules",
        req,
        true,
        true,
      );
      expect(result.id).toBe("pol-1");
    });
  });

  describe("updateAccessRule", () => {
    it("PUTs /organizations/{orgId}/access-rules/{id} and wraps the response", async () => {
      apiService.send.mockResolvedValue({
        Id: "pol-1",
        OrganizationId: "org-1",
        Name: "Human approval (updated)",
        Description: null,
        Rule: { Kind: "human_approval" },
        CreationDate: "2026-05-25T00:00:00Z",
        RevisionDate: "2026-05-26T00:00:00Z",
      });
      const rule: AccessRule = { kind: "human_approval" };
      const req = new AccessRuleRequest({ name: "Human approval (updated)", rule });

      const result = await service.updateAccessRule("org-1", "pol-1", req);

      expect(apiService.send).toHaveBeenCalledWith(
        "PUT",
        "/organizations/org-1/access-rules/pol-1",
        req,
        true,
        true,
      );
      expect(result.name).toBe("Human approval (updated)");
    });
  });

  describe("deleteAccessRule", () => {
    it("DELETEs /organizations/{orgId}/access-rules/{id} without expecting a response body", async () => {
      apiService.send.mockResolvedValue(undefined);

      await service.deleteAccessRule("org-1", "pol-1");

      expect(apiService.send).toHaveBeenCalledWith(
        "DELETE",
        "/organizations/org-1/access-rules/pol-1",
        null,
        true,
        false,
      );
    });
  });
});
