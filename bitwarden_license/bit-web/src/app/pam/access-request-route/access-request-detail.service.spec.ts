import { TestBed } from "@angular/core/testing";
import { ActivatedRoute, convertToParamMap } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, Subject, firstValueFrom, of } from "rxjs";

import {
  AccessDecisionRequest,
  AccessDecisionVerdict,
  AccessLeaseResponse,
  AccessLeaseRevokeRequest,
  AccessRequestDetailsResponse,
  AccessRequestStatus,
  PamApiService,
} from "@bitwarden/bit-pam";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ServerNotificationsService } from "@bitwarden/common/platform/server-notifications";
import { SyncService } from "@bitwarden/common/platform/sync";

import { AccessRequestNameResolver, ResolvedNames } from "../access-request-name-resolver.service";

import { AccessRequestDetailService } from "./access-request-detail.service";

const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

function emptyResolvedNames(): ResolvedNames {
  return { cipherNameById: new Map(), collectionNameById: new Map(), cipherById: new Map() };
}

function buildResponse(opts: {
  id?: string;
  status?: AccessRequestStatus;
  requesterId?: string;
  producedLeaseId?: string | null;
  producedLeaseStatus?: string | null;
}): AccessRequestDetailsResponse {
  return new AccessRequestDetailsResponse({
    Id: opts.id ?? "req-1",
    CipherId: "cipher-1",
    CollectionId: "col-1",
    RequesterId: opts.requesterId ?? "other",
    Status: opts.status ?? "pending",
    RequestedTtlSeconds: 3600,
    SubmittedAt: "2026-05-01T00:00:00Z",
    ProducedLeaseId: opts.producedLeaseId ?? null,
    ProducedLeaseStatus: opts.producedLeaseStatus ?? null,
  });
}

function buildLease(): AccessLeaseResponse {
  return new AccessLeaseResponse({
    Id: "lease-1",
    RequestId: "req-1",
    CipherId: "cipher-1",
    CollectionId: "col-1",
    GranteeUserId: "me",
    NotBefore: "2026-06-10T10:00:00Z",
    NotAfter: "2026-06-10T12:00:00Z",
    Status: "active",
  });
}

interface SetupOptions {
  request?: AccessRequestDetailsResponse;
  rejectWith?: unknown;
  privileged?: boolean;
  userId?: string;
}

async function setup(options: SetupOptions = {}) {
  const pamApi = mock<PamApiService>();
  (pamApi as unknown as { mutations$: Subject<void> }).mutations$ = new Subject<void>();
  if (options.rejectWith != null) {
    pamApi.getAccessRequest.mockRejectedValue(options.rejectWith);
  } else {
    pamApi.getAccessRequest.mockResolvedValue(options.request ?? buildResponse({}));
  }

  const nameResolver = mock<AccessRequestNameResolver>();
  nameResolver.resolveDisplayNames.mockResolvedValue(emptyResolvedNames());
  // Collection-name application is the resolver's job (covered in its own spec); pass rows through.
  nameResolver.applyCollectionNames$.mockImplementation((rows$) => rows$);

  const accountService = {
    activeAccount$: new BehaviorSubject<{ id: string } | null>({ id: options.userId ?? "me" }),
  };
  const organizationService = mock<OrganizationService>();
  organizationService.organizations$.mockReturnValue(
    of([{ canManageAccessRules: options.privileged ?? false } as unknown as Organization]),
  );
  const syncService = mock<SyncService>();
  syncService.fullSync.mockResolvedValue(true);

  TestBed.configureTestingModule({
    providers: [
      AccessRequestDetailService,
      { provide: PamApiService, useValue: pamApi },
      { provide: AccessRequestNameResolver, useValue: nameResolver },
      { provide: ServerNotificationsService, useValue: { notifications$: new Subject() } },
      { provide: AccountService, useValue: accountService },
      { provide: OrganizationService, useValue: organizationService },
      { provide: SyncService, useValue: syncService },
      { provide: LogService, useValue: mock<LogService>() },
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: "req-1" })) } },
    ],
  });
  const service = TestBed.inject(AccessRequestDetailService);
  // Let the constructor's route-driven fetch settle before asserting.
  await flushMicrotasks();
  return { service, pamApi, nameResolver };
}

describe("AccessRequestDetailService", () => {
  it("loads the request named by the route id and exposes it", async () => {
    const { service, pamApi } = await setup({ request: buildResponse({ id: "req-1" }) });

    expect(pamApi.getAccessRequest).toHaveBeenCalledWith("req-1");
    expect((await firstValueFrom(service.request$))?.id).toBe("req-1");
    expect(await firstValueFrom(service.notFound$)).toBe(false);
  });

  it("surfaces a 404 as a not-found state, not an error", async () => {
    const { service } = await setup({ rejectWith: new ErrorResponse({}, 404) });

    expect(await firstValueFrom(service.request$)).toBeNull();
    expect(await firstValueFrom(service.notFound$)).toBe(true);
    expect(await firstValueFrom(service.loadError$)).toBeNull();
  });

  it("records a non-404 failure as a load error", async () => {
    const { service } = await setup({ rejectWith: new Error("boom") });

    expect(await firstValueFrom(service.loadError$)).toBeTruthy();
    expect(await firstValueFrom(service.notFound$)).toBe(false);
  });

  it("submits a decision then re-fetches to reconcile the partial record", async () => {
    const { service, pamApi } = await setup({ request: buildResponse({}) });
    pamApi.decideAccessRequest.mockResolvedValue(buildResponse({ status: "approved" }));
    pamApi.getAccessRequest.mockClear();

    await service.decide(AccessDecisionVerdict.Approve, "ok");

    expect(pamApi.decideAccessRequest).toHaveBeenCalledWith(
      "req-1",
      expect.any(AccessDecisionRequest),
    );
    expect(pamApi.getAccessRequest).toHaveBeenCalledTimes(1);
  });

  it("cancels then re-fetches", async () => {
    const { service, pamApi } = await setup({ request: buildResponse({}) });
    pamApi.cancelAccessRequest.mockResolvedValue(undefined);
    pamApi.getAccessRequest.mockClear();

    await service.cancel();

    expect(pamApi.cancelAccessRequest).toHaveBeenCalledWith("req-1");
    expect(pamApi.getAccessRequest).toHaveBeenCalledTimes(1);
  });

  it("activates then re-fetches", async () => {
    const { service, pamApi } = await setup({
      request: buildResponse({ status: "approved" }),
    });
    pamApi.activateLease.mockResolvedValue(buildLease());
    pamApi.getAccessRequest.mockClear();

    await service.activate();

    expect(pamApi.activateLease).toHaveBeenCalledWith("req-1");
    expect(pamApi.getAccessRequest).toHaveBeenCalledTimes(1);
  });

  it("ends the produced lease then re-fetches", async () => {
    const { service, pamApi } = await setup({
      request: buildResponse({
        status: "activated",
        producedLeaseId: "lease-1",
        producedLeaseStatus: "active",
      }),
    });
    pamApi.revokeAccessLease.mockResolvedValue(undefined);
    pamApi.getAccessRequest.mockClear();

    await service.endLease("lease-1");

    expect(pamApi.revokeAccessLease).toHaveBeenCalledWith(
      "lease-1",
      expect.any(AccessLeaseRevokeRequest),
    );
    expect(pamApi.getAccessRequest).toHaveBeenCalledTimes(1);
  });

  describe("canApprove$", () => {
    it("is true for a privileged viewer on a pending request they did not raise", async () => {
      const { service } = await setup({
        request: buildResponse({ status: "pending", requesterId: "other" }),
        privileged: true,
        userId: "me",
      });

      expect(await firstValueFrom(service.canApprove$)).toBe(true);
    });

    it("is false on the viewer's own request (no self-approval)", async () => {
      const { service } = await setup({
        request: buildResponse({ status: "pending", requesterId: "me" }),
        privileged: true,
        userId: "me",
      });

      expect(await firstValueFrom(service.canApprove$)).toBe(false);
    });

    it("is false without approval privileges", async () => {
      const { service } = await setup({
        request: buildResponse({ status: "pending", requesterId: "other" }),
        privileged: false,
        userId: "me",
      });

      expect(await firstValueFrom(service.canApprove$)).toBe(false);
    });

    it("is false once the request is no longer pending", async () => {
      const { service } = await setup({
        request: buildResponse({ status: "approved", requesterId: "other" }),
        privileged: true,
        userId: "me",
      });

      expect(await firstValueFrom(service.canApprove$)).toBe(false);
    });
  });
});
