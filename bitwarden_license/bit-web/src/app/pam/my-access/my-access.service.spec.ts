import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";

import type {
  AccessLeaseId,
  AccessLeaseView,
  AccessRequestId,
  AccessRequestView,
} from "@bitwarden/sdk-internal";

import { AccessLeaseSdkService, AccessRequestSdkService } from "..";

import {
  AccessNameResolverService,
  ResolvedNames,
  emptyResolvedNames,
} from "./access-name-resolver.service";
import { MyAccessService } from "./my-access.service";

// Overrides are loosely typed (not `Partial<AccessRequestView>`/`Partial<AccessLeaseView>`): the
// SDK's id/cipherId/collectionId fields are opaque branded types, so tests stand in plain strings
// and rely on the final `as unknown as` cast, matching the convention in the sibling SDK specs.
function request(id: string, overrides: Record<string, unknown> = {}): AccessRequestView {
  return {
    id,
    cipherId: "cipher-1",
    collectionId: "col-1",
    organizationId: "org-1",
    requesterId: "user-1",
    ruleId: undefined,
    status: "pending",
    leaseNotBefore: "2024-01-01T00:00:00.000Z",
    leaseNotAfter: "2024-01-01T01:00:00.000Z",
    reason: undefined,
    submittedAt: "2024-01-01T00:00:00.000Z",
    resolvedAt: undefined,
    decisions: [],
    producedLeaseId: undefined,
    producedLeaseStatus: undefined,
    extensionOfLeaseId: undefined,
    ...overrides,
  } as unknown as AccessRequestView;
}

function lease(id: string, overrides: Record<string, unknown> = {}): AccessLeaseView {
  return {
    id,
    requestId: "req-1",
    cipherId: "cipher-1",
    collectionId: "col-1",
    organizationId: "org-1",
    requesterId: "user-1",
    status: "active",
    notBefore: "2024-01-01T00:00:00.000Z",
    notAfter: "2024-01-01T01:00:00.000Z",
    revokedAt: undefined,
    revokedByUserId: undefined,
    ...overrides,
  } as unknown as AccessLeaseView;
}

describe("MyAccessService", () => {
  let service: MyAccessService;
  let requestsApi: MockProxy<AccessRequestSdkService>;
  let leasesApi: MockProxy<AccessLeaseSdkService>;
  let nameResolver: MockProxy<AccessNameResolverService>;

  beforeEach(() => {
    requestsApi = mock<AccessRequestSdkService>();
    leasesApi = mock<AccessLeaseSdkService>();
    nameResolver = mock<AccessNameResolverService>();

    requestsApi.listMyAccessRequests.mockResolvedValue([]);
    leasesApi.listMyLeases.mockResolvedValue([]);
    nameResolver.resolveNames.mockResolvedValue(emptyResolvedNames() as ResolvedNames);

    TestBed.configureTestingModule({
      providers: [
        MyAccessService,
        { provide: AccessRequestSdkService, useValue: requestsApi },
        { provide: AccessLeaseSdkService, useValue: leasesApi },
        { provide: AccessNameResolverService, useValue: nameResolver },
      ],
    });

    service = TestBed.inject(MyAccessService);
  });

  describe("load", () => {
    it("resolves names from the union of the requests' and leases' cipher/collection refs, and clears loading", async () => {
      requestsApi.listMyAccessRequests.mockResolvedValue([
        request("req-1", { cipherId: "cipher-a", collectionId: "col-a" }),
      ]);
      leasesApi.listMyLeases.mockResolvedValue([
        lease("lease-1", { cipherId: "cipher-b", collectionId: "col-b" }),
      ]);

      await service.load();

      expect(nameResolver.resolveNames).toHaveBeenCalledWith([
        { cipherId: "cipher-a", collectionId: "col-a" },
        { cipherId: "cipher-b", collectionId: "col-b" },
      ]);
      expect(await firstValueFrom(service.loading$)).toBe(false);
      expect(await firstValueFrom(service.loadError$)).toBeNull();
    });

    it("records the error and clears loading when a fetch fails", async () => {
      const error = new Error("boom");
      requestsApi.listMyAccessRequests.mockRejectedValue(error);

      await service.load();

      expect(await firstValueFrom(service.loadError$)).toBe(error);
      expect(await firstValueFrom(service.loading$)).toBe(false);
    });

    describe("partitioning", () => {
      it("puts pending and approved requests in pendingRows$", async () => {
        requestsApi.listMyAccessRequests.mockResolvedValue([
          request("req-1", { status: "pending" }),
          request("req-2", { status: "approved" }),
          request("req-3", { status: "denied" }),
        ]);

        await service.load();

        const rows = await firstValueFrom(service.pendingRows$);
        expect(rows.map((r) => r.id)).toEqual(["req-1", "req-2"]);
      });

      it("includes only active leases in leases$", async () => {
        leasesApi.listMyLeases.mockResolvedValue([
          lease("lease-1", { status: "active" }),
          lease("lease-2", { status: "expired" }),
          lease("lease-3", { status: "revoked" }),
        ]);

        await service.load();

        const rows = await firstValueFrom(service.leases$);
        expect(rows.map((r) => r.id)).toEqual(["lease-1"]);
      });

      it("excludes pending/approved requests and one whose lease is still active from historyRows$", async () => {
        requestsApi.listMyAccessRequests.mockResolvedValue([
          request("req-1", { status: "denied" }), // terminal, no lease -> included
          request("req-2", { status: "approved" }), // still actionable -> excluded (in Pending)
          request("req-3", { status: "pending" }), // still actionable -> excluded (in Pending)
          request("req-4", {
            status: "activated",
            producedLeaseId: "lease-1",
            producedLeaseStatus: "active",
          }), // lease still active -> excluded (in Active leases)
          request("req-5", {
            status: "activated",
            producedLeaseId: "lease-2",
            producedLeaseStatus: "expired",
          }), // lease no longer active -> included
        ]);
        leasesApi.listMyLeases.mockResolvedValue([lease("lease-1", { status: "active" })]);

        await service.load();

        const rows = await firstValueFrom(service.historyRows$);
        expect(rows.map((r) => r.id).sort()).toEqual(["req-1", "req-5"]);
      });
    });
  });

  describe("cancel", () => {
    it("optimistically flips the row to canceled before the SDK call resolves, without a reload", async () => {
      requestsApi.listMyAccessRequests.mockResolvedValue([request("req-1", { status: "pending" })]);
      await service.load();

      await service.cancel("req-1" as unknown as AccessRequestId);

      expect(requestsApi.cancelAccessRequest).toHaveBeenCalledWith("req-1");
      expect(requestsApi.listMyAccessRequests).toHaveBeenCalledTimes(1); // no reload
      const pending = await firstValueFrom(service.pendingRows$);
      expect(pending).toEqual([]);
      const history = await firstValueFrom(service.historyRows$);
      expect(history.map((r) => r.id)).toEqual(["req-1"]);
      expect(history[0].status).toBe("canceled");
    });

    it("rolls back the optimistic patch and rethrows when the SDK call fails", async () => {
      requestsApi.listMyAccessRequests.mockResolvedValue([request("req-1", { status: "pending" })]);
      await service.load();
      const error = new Error("nope");
      requestsApi.cancelAccessRequest.mockRejectedValue(error);

      await expect(service.cancel("req-1" as unknown as AccessRequestId)).rejects.toThrow(error);

      const pending = await firstValueFrom(service.pendingRows$);
      expect(pending.map((r) => r.id)).toEqual(["req-1"]);
      expect(pending[0].status).toBe("pending");
    });
  });

  describe("endLease", () => {
    it("optimistically removes the lease and marks its request revoked, without a reload", async () => {
      requestsApi.listMyAccessRequests.mockResolvedValue([
        request("req-1", {
          status: "activated",
          producedLeaseId: "lease-1",
          producedLeaseStatus: "active",
        }),
      ]);
      leasesApi.listMyLeases.mockResolvedValue([lease("lease-1", { status: "active" })]);
      await service.load();

      await service.endLease("lease-1" as unknown as AccessLeaseId);

      expect(leasesApi.endLease).toHaveBeenCalledWith("lease-1", { reason: undefined });
      expect(leasesApi.listMyLeases).toHaveBeenCalledTimes(1); // no reload

      const leases = await firstValueFrom(service.leases$);
      expect(leases).toEqual([]);
      const history = await firstValueFrom(service.historyRows$);
      expect(history.map((r) => r.id)).toEqual(["req-1"]);
      expect(history[0].statusLabelKey).toBe("pamStatusRevoked");
    });

    it("rolls back the optimistic patch and rethrows when the SDK call fails", async () => {
      requestsApi.listMyAccessRequests.mockResolvedValue([
        request("req-1", {
          status: "activated",
          producedLeaseId: "lease-1",
          producedLeaseStatus: "active",
        }),
      ]);
      leasesApi.listMyLeases.mockResolvedValue([lease("lease-1", { status: "active" })]);
      await service.load();
      const error = new Error("nope");
      leasesApi.endLease.mockRejectedValue(error);

      await expect(service.endLease("lease-1" as unknown as AccessLeaseId)).rejects.toThrow(error);

      const leases = await firstValueFrom(service.leases$);
      expect(leases.map((l) => l.id)).toEqual(["lease-1"]);
      const history = await firstValueFrom(service.historyRows$);
      expect(history).toEqual([]);
    });
  });

  describe("activate", () => {
    it("calls through then reloads (non-optimistic)", async () => {
      requestsApi.activateAccessRequest.mockResolvedValue(lease("lease-1"));

      await service.activate("req-1" as unknown as AccessRequestId);

      expect(requestsApi.activateAccessRequest).toHaveBeenCalledWith("req-1");
      expect(requestsApi.listMyAccessRequests).toHaveBeenCalledTimes(1);
      expect(leasesApi.listMyLeases).toHaveBeenCalledTimes(1);
    });
  });
});
