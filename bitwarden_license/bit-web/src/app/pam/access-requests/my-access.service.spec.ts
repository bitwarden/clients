import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, NEVER, Subject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { DialogService, ToastService } from "@bitwarden/components";
import type {
  AccessLeaseId,
  AccessLeaseView,
  AccessRequestId,
  AccessRequestView,
} from "@bitwarden/sdk-internal";

import { AccessLeaseSdkService, AccessRefreshService, AccessRequestSdkService } from "..";
import { AccessRequestCancelService } from "../services/access-request-cancel.service";
import { DefaultAccessRefreshService } from "../services/default-access-refresh.service";

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
    termination: undefined,
    ...overrides,
  } as unknown as AccessLeaseView;
}

/** Lets the reload triggered by an announcement settle before the assertions read state. */
async function flushMicrotasks(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("MyAccessService", () => {
  let service: MyAccessService;
  let requestsApi: MockProxy<AccessRequestSdkService>;
  let leasesApi: MockProxy<AccessLeaseSdkService>;
  let nameResolver: MockProxy<AccessNameResolverService>;
  let push$: Subject<void>;
  let accessRefresh: DefaultAccessRefreshService;

  beforeEach(() => {
    push$ = new Subject<void>();
    requestsApi = mock<AccessRequestSdkService>();
    leasesApi = mock<AccessLeaseSdkService>();
    nameResolver = mock<AccessNameResolverService>();
    // The real fan-out, not a mock: the point of these tests is that the page reacts to what the
    // shared signal actually merges — the server push and this client's own mutations alike.
    accessRefresh = new DefaultAccessRefreshService({
      accessChanged$: () => push$.asObservable(),
      approverInboxChanged$: () => NEVER,
    });

    requestsApi.listMyAccessRequests.mockResolvedValue([]);
    leasesApi.listMyLeases.mockResolvedValue([]);
    nameResolver.resolveNames.mockResolvedValue(emptyResolvedNames() as ResolvedNames);

    TestBed.configureTestingModule({
      providers: [
        MyAccessService,
        { provide: AccessRefreshService, useValue: accessRefresh },
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
            status: "approved",
            producedLeaseId: "lease-1",
            producedLeaseStatus: "active",
          }), // lease still active -> excluded (in Active leases)
          request("req-5", {
            status: "approved",
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
    it("optimistically removes the lease and marks its request cancelled, without a reload", async () => {
      requestsApi.listMyAccessRequests.mockResolvedValue([
        request("req-1", {
          status: "approved",
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
      expect(history[0].statusBadge?.labelKey).toBe("pamStatusCanceled");
    });

    it("rolls back the optimistic patch and rethrows when the SDK call fails", async () => {
      requestsApi.listMyAccessRequests.mockResolvedValue([
        request("req-1", {
          status: "approved",
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

  describe("live refresh", () => {
    it("reloads on a server-pushed access event", async () => {
      await service.load();
      requestsApi.listMyAccessRequests.mockClear();
      leasesApi.listMyLeases.mockClear();

      push$.next();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(requestsApi.listMyAccessRequests).toHaveBeenCalledTimes(1);
      expect(leasesApi.listMyLeases).toHaveBeenCalledTimes(1);
    });

    it("surfaces an approver's decision without the page reloading", async () => {
      requestsApi.listMyAccessRequests.mockResolvedValue([request("req-1", { status: "pending" })]);
      await service.load();
      expect(await firstValueFrom(service.pendingRows$)).toHaveLength(1);

      // The approver approved it; the server pushes, and the page re-reads.
      requestsApi.listMyAccessRequests.mockResolvedValue([
        request("req-1", { status: "approved", leaseNotAfter: "2999-01-01T00:00:00.000Z" }),
      ]);
      push$.next();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const rows = await firstValueFrom(service.pendingRows$);
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe("approved");
    });

    it("reloads when another surface announces a change to one of the caller's items", async () => {
      await service.load();
      requestsApi.listMyAccessRequests.mockClear();
      leasesApi.listMyLeases.mockClear();

      accessRefresh.notifyAccessChanged("cipher-1");
      await flushMicrotasks();

      expect(requestsApi.listMyAccessRequests).toHaveBeenCalledTimes(1);
      expect(leasesApi.listMyLeases).toHaveBeenCalledTimes(1);
    });

    it("reloads when the announcement names no cipher", async () => {
      await service.load();
      requestsApi.listMyAccessRequests.mockClear();

      // What a failed re-read announces: no id to scope to, so every surface re-reads.
      accessRefresh.notifyAccessChanged(undefined);
      await flushMicrotasks();

      expect(requestsApi.listMyAccessRequests).toHaveBeenCalledTimes(1);
    });

    it("reconciles the list when the shared cancel flow withdraws a request from another surface", async () => {
      requestsApi.listMyAccessRequests.mockResolvedValue([request("req-1", { status: "pending" })]);
      await service.load();
      expect(await firstValueFrom(service.pendingRows$)).toHaveLength(1);

      // The request drawer's withdrawal: a different surface, sharing only the refresh signal.
      const dialogService = mock<DialogService>();
      dialogService.openSimpleDialog.mockResolvedValue(true);
      const i18nService = mock<I18nService>();
      i18nService.t.mockImplementation((key) => key);
      const cancelService = new AccessRequestCancelService(
        requestsApi,
        accessRefresh,
        dialogService,
        mock<ToastService>(),
        i18nService,
        mock<LogService>(),
      );
      requestsApi.getAccessRequest.mockResolvedValue(request("req-1", { status: "pending" }));
      requestsApi.listMyAccessRequests.mockResolvedValue([
        request("req-1", { status: "canceled", resolvedAt: "2024-01-01T00:30:00.000Z" }),
      ]);

      await cancelService.cancelRequestById("req-1" as unknown as AccessRequestId);
      await flushMicrotasks();

      expect(await firstValueFrom(service.pendingRows$)).toEqual([]);
      const history = await firstValueFrom(service.historyRows$);
      expect(history.map((r) => r.id)).toEqual(["req-1"]);
    });

    it("does not reload after its own optimistic mutation", async () => {
      requestsApi.listMyAccessRequests.mockResolvedValue([request("req-1", { status: "pending" })]);
      await service.load();
      requestsApi.listMyAccessRequests.mockClear();

      await service.cancel("req-1" as unknown as AccessRequestId);
      await flushMicrotasks();

      // Announcing its own patch would only replace it with a load, and each load would announce
      // again; the page reconciles locally and stays quiet.
      expect(requestsApi.listMyAccessRequests).not.toHaveBeenCalled();
    });

    it("serialises overlapping pushes so state never mixes two loads", async () => {
      await service.load();
      requestsApi.listMyAccessRequests.mockClear();

      push$.next();
      push$.next();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(requestsApi.listMyAccessRequests).toHaveBeenCalledTimes(2);
      expect(await firstValueFrom(service.loading$)).toBe(false);
    });
  });
});
