import { firstValueFrom, Subject } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";

import { AccessEvent } from "../abstractions/access-event";
import { AccessEventService } from "../abstractions/access-event.service";
import { AccessCondition } from "../abstractions/access-rule";

import { DefaultPamApiService } from "./default-pam-api.service";
import { AccessDecisionRequest } from "./requests/access-decision.request";
import { AccessLeaseExtensionRequest } from "./requests/access-lease-extension.request";
import { AccessLeaseRevokeRequest } from "./requests/access-lease-revoke.request";
import { AccessRequestCreateRequest } from "./requests/access-request-create.request";
import { AccessRequestPatchRequest } from "./requests/access-request-patch.request";
import { AccessRuleRequest } from "./requests/access-rule.request";

const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("DefaultPamApiService", () => {
  let apiService: jest.Mocked<Pick<ApiService, "send">>;
  let accessEvents: Subject<AccessEvent>;
  let service: DefaultPamApiService;

  beforeEach(() => {
    apiService = { send: jest.fn() } as jest.Mocked<Pick<ApiService, "send">>;
    accessEvents = new Subject<AccessEvent>();
    const leaseEventService: AccessEventService = {
      events$: () => accessEvents.asObservable(),
      allEvents$: () => accessEvents.asObservable(),
    } as AccessEventService;
    service = new DefaultPamApiService(apiService as unknown as ApiService, leaseEventService);
  });

  describe("getAccessPreCheck", () => {
    it("GETs /ciphers/{id}/lease/pre-check and wraps the response", async () => {
      apiService.send.mockResolvedValue({
        Object: "accessPreCheck",
        CipherId: "cipher-1",
        ApprovalMode: "human",
      });

      const result = await service.getAccessPreCheck("cipher-1");

      expect(apiService.send).toHaveBeenCalledWith(
        "GET",
        "/ciphers/cipher-1/lease/pre-check",
        null,
        true,
        true,
      );
      expect(result.cipherId).toBe("cipher-1");
      expect(result.approvalMode).toBe("human");
    });
  });

  describe("submitAccessRequest", () => {
    it("POSTs /ciphers/{id}/lease with a duration body on the automatic path", async () => {
      apiService.send.mockResolvedValue({
        Object: "accessRequest",
        ApprovalMode: "automatic",
        Request: {
          Object: "leaseRequest",
          Id: "req-1",
          CipherId: "cipher-1",
          CollectionId: "col-1",
          OrganizationId: "org-1",
          Status: "approved",
          NotBefore: "2026-06-04T12:00:00Z",
          NotAfter: "2026-06-04T13:00:00Z",
          Reason: "incident",
          CreationDate: "2026-06-04T12:00:00Z",
        },
      });
      const body = new AccessRequestCreateRequest({ durationSeconds: 3600, reason: "incident" });

      const result = await service.submitAccessRequest("cipher-1", body);

      expect(apiService.send).toHaveBeenCalledWith(
        "POST",
        "/ciphers/cipher-1/lease",
        body,
        true,
        true,
      );
      expect(result.approvalMode).toBe("automatic");
      expect(result.request).not.toBeNull();
      expect(result.request?.id).toBe("req-1");
      expect(result.request?.status).toBe("approved");
      expect(result.request?.notAfter).toBe("2026-06-04T13:00:00Z");
    });

    it("POSTs /ciphers/{id}/lease with a window body on the human path", async () => {
      apiService.send.mockResolvedValue({
        Object: "accessRequest",
        ApprovalMode: "human",
        Lease: null,
        Request: {
          Object: "leaseRequest",
          Id: "req-1",
          CipherId: "cipher-1",
          CollectionId: "col-1",
          OrganizationId: "org-1",
          Status: "pending",
          NotBefore: "2026-06-05T09:00:00Z",
          NotAfter: "2026-06-05T17:00:00Z",
          Reason: "Investigating prod incident #4821",
          CreationDate: "2026-06-04T12:00:00Z",
        },
      });
      const body = new AccessRequestCreateRequest({
        start: new Date("2026-06-05T09:00:00Z"),
        end: new Date("2026-06-05T17:00:00Z"),
        reason: "Investigating prod incident #4821",
      });

      const result = await service.submitAccessRequest("cipher-1", body);

      expect(apiService.send).toHaveBeenCalledWith(
        "POST",
        "/ciphers/cipher-1/lease",
        body,
        true,
        true,
      );
      expect(result.approvalMode).toBe("human");
      expect(result.request).not.toBeNull();
      expect(result.request?.id).toBe("req-1");
      expect(result.request?.status).toBe("pending");
      expect(result.request?.reason).toBe("Investigating prod incident #4821");
      expect(result.request?.creationDate).toBe("2026-06-04T12:00:00Z");
    });

    it("pumps mutations$ after a successful automatic lease", async () => {
      apiService.send.mockResolvedValue({
        Object: "accessRequest",
        ApprovalMode: "automatic",
        Lease: {
          Object: "lease",
          Id: "lease-1",
          CipherId: "cipher-1",
          CollectionId: "col-1",
          OrganizationId: "org-1",
          Status: "active",
          NotBefore: "2026-06-04T12:00:00Z",
          NotAfter: "2026-06-04T13:00:00Z",
        },
        Request: null,
      });
      const mutations = jest.fn();
      const sub = service.mutations$.subscribe(mutations);

      await service.submitAccessRequest(
        "cipher-1",
        new AccessRequestCreateRequest({ durationSeconds: 3600 }),
      );

      expect(mutations).toHaveBeenCalledTimes(1);
      sub.unsubscribe();
    });

    it("pumps mutations$ after a successful human request", async () => {
      apiService.send.mockResolvedValue({
        Object: "accessRequest",
        ApprovalMode: "human",
        Lease: null,
        Request: {
          Object: "leaseRequest",
          Id: "req-1",
          CipherId: "cipher-1",
          CollectionId: "col-1",
          OrganizationId: "org-1",
          Status: "pending",
          NotBefore: "2026-06-05T09:00:00Z",
          NotAfter: "2026-06-05T17:00:00Z",
          Reason: "incident",
          CreationDate: "2026-06-04T12:00:00Z",
        },
      });
      const mutations = jest.fn();
      const sub = service.mutations$.subscribe(mutations);

      await service.submitAccessRequest(
        "cipher-1",
        new AccessRequestCreateRequest({
          start: new Date("2026-06-05T09:00:00Z"),
          end: new Date("2026-06-05T17:00:00Z"),
          reason: "incident",
        }),
      );

      expect(mutations).toHaveBeenCalledTimes(1);
      sub.unsubscribe();
    });

    it("does not pump mutations$ when the request fails", async () => {
      apiService.send.mockRejectedValue(new ErrorResponse({}, 400));
      const mutations = jest.fn();
      const sub = service.mutations$.subscribe(mutations);

      await expect(
        service.submitAccessRequest(
          "cipher-1",
          new AccessRequestCreateRequest({ durationSeconds: 3600 }),
        ),
      ).rejects.toBeInstanceOf(ErrorResponse);

      expect(mutations).not.toHaveBeenCalled();
      sub.unsubscribe();
    });
  });

  describe("getLeasedCipher", () => {
    it("GETs /ciphers/{id}/lease/cipher and wraps the response", async () => {
      apiService.send.mockResolvedValue({
        Id: "cipher-1",
        Name: "name-cipher",
        Type: 1,
      });

      const result = await service.getLeasedCipher("cipher-1");

      expect(apiService.send).toHaveBeenCalledWith(
        "GET",
        "/ciphers/cipher-1/lease/cipher",
        null,
        true,
        true,
      );
      expect(result.id).toBe("cipher-1");
    });
  });

  describe("AccessRequestCreateRequest", () => {
    it("serializes dates to UTC ISO 8601", () => {
      const req = new AccessRequestCreateRequest({
        start: new Date("2026-06-05T09:00:00Z"),
        end: new Date("2026-06-05T17:00:00Z"),
        reason: "test",
      });
      expect(req.start).toBe("2026-06-05T09:00:00.000Z");
      expect(req.end).toBe("2026-06-05T17:00:00.000Z");
      expect(req.durationSeconds).toBeUndefined();
    });

    it("leaves optional fields undefined when not provided", () => {
      const req = new AccessRequestCreateRequest({ durationSeconds: 3600 });
      expect(req.durationSeconds).toBe(3600);
      expect(req.start).toBeUndefined();
      expect(req.end).toBeUndefined();
      expect(req.reason).toBeUndefined();
    });
  });

  describe("patchAccessRequest", () => {
    it("PATCHes /leasing/requests/{id} and wraps the response", async () => {
      apiService.send.mockResolvedValue({ Id: "req-1", Status: "pending" });
      const req = new AccessRequestPatchRequest({
        notAfter: new Date("2026-01-01T00:00:00Z"),
        reason: "needed",
      });

      const result = await service.patchAccessRequest("req-1", req);

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

  describe("cancelAccessRequest", () => {
    it("DELETEs /leasing/requests/{id} without expecting a response body", async () => {
      apiService.send.mockResolvedValue(undefined);

      await service.cancelAccessRequest("req-1");

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
      const req = new AccessLeaseExtensionRequest({
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

  describe("decideAccessRequest", () => {
    it("POSTs /leasing/requests/{id}/decision and wraps the response", async () => {
      apiService.send.mockResolvedValue({ Id: "req-1", Status: "approved" });
      const req = new AccessDecisionRequest({ verdict: "approve" });

      const result = await service.decideAccessRequest("req-1", req);

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

  describe("activateLease", () => {
    it("POSTs /leasing/requests/{requestId}/activate with no body and wraps the response", async () => {
      apiService.send.mockResolvedValue({
        Id: "lease-1",
        RequestId: "req-1",
        CipherId: "cipher-1",
        CollectionId: "col-1",
        GranteeUserId: "user-1",
        NotBefore: "2026-05-25T00:00:00Z",
        NotAfter: "2026-05-25T01:00:00Z",
        Status: "active",
      });

      const result = await service.activateLease("req-1");

      expect(apiService.send).toHaveBeenCalledWith(
        "POST",
        "/leasing/requests/req-1/activate",
        null,
        true,
        true,
      );
      expect(result.id).toBe("lease-1");
      expect(result.requestId).toBe("req-1");
      expect(result.status).toBe("active");
    });
  });

  describe("revokeAccessLease", () => {
    it("POSTs /leasing/leases/{id}/revoke without expecting a response body", async () => {
      apiService.send.mockResolvedValue(undefined);
      const req = new AccessLeaseRevokeRequest({ reason: "rule violation" });

      await service.revokeAccessLease("lease-1", req);

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
            Conditions: [{ Kind: "human_approval" }],
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
      expect(result.data[0].conditions[0].kind).toBe("human_approval");
    });

    it("derives conditions from a tree-shaped `Conditions` on list items", async () => {
      apiService.send.mockResolvedValue({
        Data: [
          {
            Id: "pol-1",
            OrganizationId: "org-1",
            Name: "Approval + IP",
            Description: null,
            Conditions: {
              kind: "all_of",
              conditions: [
                { kind: "human_approval" },
                { kind: "ip_allowlist", cidrs: ["10.0.0.0/8"] },
              ],
            },
            CreationDate: "2026-05-25T00:00:00Z",
            RevisionDate: "2026-05-25T00:00:00Z",
          },
        ],
        ContinuationToken: null,
      });

      const result = await service.listAccessRules("org-1");

      expect(result.data[0].conditions).toEqual([
        { kind: "human_approval" },
        { kind: "ip_allowlist", cidrs: ["10.0.0.0/8"] },
      ]);
    });
  });

  describe("getAccessRule", () => {
    it("GETs /organizations/{orgId}/access-rules/{id} and wraps the response", async () => {
      apiService.send.mockResolvedValue({
        Id: "pol-1",
        OrganizationId: "org-1",
        Name: "Human approval",
        Description: null,
        Conditions: [{ Kind: "human_approval" }],
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
      expect(result.conditions[0].kind).toBe("human_approval");
    });

    it("derives conditions from a bare `Conditions` leaf", async () => {
      // Mirrors the real server response: a camelCase `conditions` tree.
      apiService.send.mockResolvedValue({
        id: "pol-1",
        organizationId: "org-1",
        name: "Test",
        description: null,
        conditions: { kind: "human_approval" },
        creationDate: "2026-06-08T08:49:30.7166667Z",
        revisionDate: "2026-06-08T17:50:25.84Z",
        object: "accessRule",
      });

      const result = await service.getAccessRule("org-1", "pol-1");

      expect(result.conditions).toEqual([{ kind: "human_approval" }]);
    });

    it("derives ip_allowlist cidrs from the `Conditions` tree", async () => {
      apiService.send.mockResolvedValue({
        Id: "pol-1",
        OrganizationId: "org-1",
        Name: "IP restricted",
        Description: null,
        Conditions: { kind: "ip_allowlist", cidrs: ["10.0.0.0/8", "192.168.0.0/16"] },
        CreationDate: "2026-05-25T00:00:00Z",
        RevisionDate: "2026-05-25T00:00:00Z",
      });

      const result = await service.getAccessRule("org-1", "pol-1");

      expect(result.conditions).toEqual([
        { kind: "ip_allowlist", cidrs: ["10.0.0.0/8", "192.168.0.0/16"] },
      ]);
    });

    it("flattens an `all_of` `Conditions` tree into multiple conditions", async () => {
      apiService.send.mockResolvedValue({
        Id: "pol-1",
        OrganizationId: "org-1",
        Name: "Approval + IP",
        Description: null,
        Conditions: {
          kind: "all_of",
          conditions: [{ kind: "human_approval" }, { kind: "ip_allowlist", cidrs: ["10.0.0.0/8"] }],
        },
        CreationDate: "2026-05-25T00:00:00Z",
        RevisionDate: "2026-05-25T00:00:00Z",
      });

      const result = await service.getAccessRule("org-1", "pol-1");

      expect(result.conditions).toEqual([
        { kind: "human_approval" },
        { kind: "ip_allowlist", cidrs: ["10.0.0.0/8"] },
      ]);
    });
  });

  describe("createAccessRule", () => {
    it("POSTs /organizations/{orgId}/access-rules and wraps the response", async () => {
      apiService.send.mockResolvedValue({
        Id: "pol-1",
        OrganizationId: "org-1",
        Name: "Human approval",
        Description: null,
        Conditions: [{ Kind: "human_approval" }],
        CreationDate: "2026-05-25T00:00:00Z",
        RevisionDate: "2026-05-25T00:00:00Z",
      });
      const createConditions: AccessCondition[] = [{ kind: "human_approval" }];
      const req = new AccessRuleRequest({ name: "Human approval", conditions: createConditions });

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
        Conditions: [{ Kind: "human_approval" }],
        CreationDate: "2026-05-25T00:00:00Z",
        RevisionDate: "2026-05-26T00:00:00Z",
      });
      const updateConditions: AccessCondition[] = [{ kind: "human_approval" }];
      const req = new AccessRuleRequest({
        name: "Human approval (updated)",
        conditions: updateConditions,
      });

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

  describe("getCipherAccessState$", () => {
    it("GETs /ciphers/{id}/lease/state on initial subscription and emits the mapped snapshot", async () => {
      apiService.send.mockResolvedValue({
        CipherId: "cipher-1",
        ActiveLease: {
          Id: "lease-1",
          RequestId: "req-1",
          CipherId: "cipher-1",
          CollectionId: "col-1",
          RequesterId: "user-1",
          NotBefore: "2026-06-04T12:00:00Z",
          NotAfter: "2026-06-04T13:00:00Z",
          Status: "active",
        },
        PendingRequest: null,
        ApprovedRequest: null,
      });

      const state = await firstValueFrom(service.getCipherAccessState$("cipher-1", "user-1"));

      expect(apiService.send).toHaveBeenCalledWith(
        "GET",
        "/ciphers/cipher-1/lease/state",
        null,
        true,
        true,
      );
      expect(state.activeLease?.id).toBe("lease-1");
      expect(state.activeLease?.notAfter).toBe("2026-06-04T13:00:00Z");
      expect(state.pendingRequest).toBeUndefined();
      expect(state.approvedRequest).toBeUndefined();
    });

    it("emits an empty snapshot when the endpoint rejects with 404", async () => {
      apiService.send.mockRejectedValue(new ErrorResponse({}, 404));

      const state = await firstValueFrom(service.getCipherAccessState$("cipher-1", "user-1"));

      expect(state).toEqual({});
    });

    it("propagates non-404 errors to the consumer", async () => {
      apiService.send.mockRejectedValue(new ErrorResponse({}, 500));

      await expect(
        firstValueFrom(service.getCipherAccessState$("cipher-1", "user-1")),
      ).rejects.toBeInstanceOf(ErrorResponse);
    });

    it("re-fetches when the lease event channel emits", async () => {
      apiService.send.mockResolvedValue({ CipherId: "cipher-1" });
      const sink = jest.fn();

      const sub = service.getCipherAccessState$("cipher-1", "user-1").subscribe(sink);
      await flushMicrotasks();
      expect(sink).toHaveBeenCalledTimes(1);
      expect(apiService.send).toHaveBeenCalledTimes(1);

      accessEvents.next({ kind: "approved", requestId: "req-1" });
      await flushMicrotasks();

      expect(apiService.send).toHaveBeenCalledTimes(2);
      expect(sink).toHaveBeenCalledTimes(2);
      sub.unsubscribe();
    });

    it("re-fetches after a local mutation succeeds", async () => {
      apiService.send.mockResolvedValue({ CipherId: "cipher-1" });
      const sink = jest.fn();

      const sub = service.getCipherAccessState$("cipher-1", "user-1").subscribe(sink);
      await flushMicrotasks();
      const fetchesAfterInitial = apiService.send.mock.calls.length;

      await service.cancelAccessRequest("req-1");
      await flushMicrotasks();

      // One extra send for cancelAccessRequest itself + one extra refresh fetch.
      expect(apiService.send.mock.calls.length).toBe(fetchesAfterInitial + 2);
      sub.unsubscribe();
    });
  });

  describe("listMyAccessRequests", () => {
    it("GETs /leasing/requests/mine and unwraps a ListResponse envelope", async () => {
      apiService.send.mockResolvedValue({
        Data: [
          {
            Id: "req-1",
            CipherId: "cipher-1",
            CollectionId: "col-1",
            RequesterUserId: "user-1",
            Status: "pending",
            RequestedTtlSeconds: 3600,
            SubmittedAt: "2026-06-04T12:00:00Z",
          },
        ],
        ContinuationToken: null,
      });

      const result = await service.listMyAccessRequests();

      expect(apiService.send).toHaveBeenCalledWith(
        "GET",
        "/leasing/requests/mine",
        null,
        true,
        true,
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("req-1");
      expect(result[0].status).toBe("pending");
    });
  });

  describe("listActiveLeases", () => {
    it("GETs /leasing/leases/mine/active and unwraps a ListResponse envelope", async () => {
      apiService.send.mockResolvedValue({
        Data: [
          {
            Id: "lease-1",
            RequestId: "req-1",
            CipherId: "cipher-1",
            CollectionId: "col-1",
            GranteeUserId: "user-1",
            NotBefore: "2026-06-04T12:00:00Z",
            NotAfter: "2026-06-04T13:00:00Z",
            Status: "active",
          },
        ],
        ContinuationToken: null,
      });

      const result = await service.listActiveLeases();

      expect(apiService.send).toHaveBeenCalledWith(
        "GET",
        "/leasing/leases/mine/active",
        null,
        true,
        true,
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("lease-1");
      expect(result[0].status).toBe("active");
    });
  });
});
