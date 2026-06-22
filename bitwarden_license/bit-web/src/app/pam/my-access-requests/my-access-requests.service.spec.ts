import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { Subject, firstValueFrom } from "rxjs";

import { ServerNotificationsService } from "@bitwarden/common/platform/server-notifications";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  AccessLeaseResponse,
  AccessRequestDetailsResponse,
  AccessRequestStatus,
  PamApiService,
} from "@bitwarden/pam";

import { AccessRequestNameResolver, ResolvedNames } from "../access-request-name-resolver.service";

import { MyAccessRequestsService } from "./my-access-requests.service";

const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

function response(id: string, status: AccessRequestStatus): AccessRequestDetailsResponse {
  return new AccessRequestDetailsResponse({
    Id: id,
    CipherId: `cipher-${id}`,
    CollectionId: "col-1",
    RequesterUserId: "me",
    Status: status,
    RequestedTtlSeconds: 3600,
    SubmittedAt: "2026-05-01T00:00:00Z",
  });
}

function emptyResolvedNames(): ResolvedNames {
  return { cipherNameById: new Map(), collectionNameById: new Map(), cipherById: new Map() };
}

function cipher(id: string): CipherView {
  return Object.assign(new CipherView(), { id, name: id });
}

describe("MyAccessRequestsService", () => {
  let pamApi: MockProxy<PamApiService>;
  let nameResolver: MockProxy<AccessRequestNameResolver>;
  let service: MyAccessRequestsService;

  beforeEach(async () => {
    pamApi = mock<PamApiService>();
    pamApi.listMyAccessRequests.mockResolvedValue([]);
    pamApi.listActiveLeases.mockResolvedValue([]);
    // mutations$ is a stream the service merges into its live-refresh; give it a real Subject.
    (pamApi as unknown as { mutations$: Subject<void> }).mutations$ = new Subject<void>();
    nameResolver = mock<AccessRequestNameResolver>();
    nameResolver.resolveDisplayNames.mockResolvedValue(emptyResolvedNames());
    nameResolver.namesFor.mockResolvedValue(emptyResolvedNames());
    // Collection-name application is the resolver's job (covered in its own spec); pass rows through.
    nameResolver.applyCollectionNames$.mockImplementation((rows$) => rows$);
    TestBed.configureTestingModule({
      providers: [
        MyAccessRequestsService,
        { provide: PamApiService, useValue: pamApi },
        { provide: AccessRequestNameResolver, useValue: nameResolver },
        { provide: ServerNotificationsService, useValue: { notifications$: new Subject() } },
      ],
    });
    service = TestBed.inject(MyAccessRequestsService);
    // Let the constructor's initial (empty) fetch settle so per-test data isn't raced by it.
    await flushMicrotasks();
  });

  it("loads requests + leases on construction and exposes a pending count", async () => {
    // Re-run the load now that data is staged.
    pamApi.listMyAccessRequests.mockResolvedValue([
      response("p1", "pending"),
      response("p2", "pending"),
      response("r1", "approved"),
    ]);
    await service.load();

    expect(await firstValueFrom(service.pendingCount$)).toBe(2);
    expect((await firstValueFrom(service.rows$)).length).toBe(3);
  });

  it("resolves lease display names via the resolver maps", async () => {
    const lease = new AccessLeaseResponse({
      Id: "lease-1",
      RequestId: "req-1",
      CipherId: "cipher-1",
      CollectionId: "col-1",
      GranteeUserId: "me",
      NotBefore: "2026-06-10T10:00:00Z",
      NotAfter: "2026-06-10T12:00:00Z",
      Status: "active",
    });
    pamApi.listActiveLeases.mockResolvedValue([lease]);
    nameResolver.namesFor.mockResolvedValue({
      cipherNameById: new Map([["cipher-1", "Prod DB"]]),
      collectionNameById: new Map([["col-1", "Production"]]),
      cipherById: new Map(),
    });

    await service.load();

    const leases = await firstValueFrom(service.leases$);
    expect(leases[0].cipherName).toBe("Prod DB");
    expect(leases[0].collectionName).toBe("Production");
  });

  it("merges request and lease cipher views into cipherById$ for favicon rendering", async () => {
    pamApi.listMyAccessRequests.mockResolvedValue([response("p1", "pending")]);
    pamApi.listActiveLeases.mockResolvedValue([
      new AccessLeaseResponse({
        Id: "lease-1",
        RequestId: "req-1",
        CipherId: "cipher-lease",
        CollectionId: "col-1",
        GranteeUserId: "me",
        NotBefore: "2026-06-10T10:00:00Z",
        NotAfter: "2026-06-10T12:00:00Z",
        Status: "active",
      }),
    ]);
    nameResolver.resolveDisplayNames.mockResolvedValue({
      ...emptyResolvedNames(),
      cipherById: new Map([["cipher-p1", cipher("cipher-p1")]]),
    });
    nameResolver.namesFor.mockResolvedValue({
      ...emptyResolvedNames(),
      cipherById: new Map([["cipher-lease", cipher("cipher-lease")]]),
    });

    await service.load();

    const cipherById = await firstValueFrom(service.cipherById$);
    expect(cipherById.get("cipher-p1")?.id).toBe("cipher-p1");
    expect(cipherById.get("cipher-lease")?.id).toBe("cipher-lease");
  });

  it("cancels optimistically and calls the API", async () => {
    pamApi.listMyAccessRequests.mockResolvedValue([response("p1", "pending")]);
    pamApi.cancelAccessRequest.mockResolvedValue(undefined);
    await service.load();

    await service.cancel("p1");

    expect(pamApi.cancelAccessRequest).toHaveBeenCalledWith("p1");
    const rows = await firstValueFrom(service.rows$);
    expect(rows[0].status).toBe(AccessRequestStatus.Cancelled);
  });

  it("restores the row when cancel fails", async () => {
    pamApi.listMyAccessRequests.mockResolvedValue([response("p1", "pending")]);
    pamApi.cancelAccessRequest.mockRejectedValue(new Error("boom"));
    await service.load();

    await expect(service.cancel("p1")).rejects.toThrow("boom");

    const rows = await firstValueFrom(service.rows$);
    expect(rows[0].status).toBe(AccessRequestStatus.Pending);
  });

  it("activates a request and reloads", async () => {
    pamApi.listMyAccessRequests.mockResolvedValue([response("a1", "approved")]);
    pamApi.activateLease.mockResolvedValue(
      new AccessLeaseResponse({
        Id: "lease-1",
        RequestId: "a1",
        CipherId: "cipher-a1",
        CollectionId: "col-1",
        GranteeUserId: "me",
        NotBefore: "2026-06-10T10:00:00Z",
        NotAfter: "2026-06-10T12:00:00Z",
        Status: "active",
      }),
    );
    await service.load();
    pamApi.listMyAccessRequests.mockClear();

    await service.activate("a1");

    expect(pamApi.activateLease).toHaveBeenCalledWith("a1");
    // activate() reloads exactly once on success.
    expect(pamApi.listMyAccessRequests).toHaveBeenCalledTimes(1);
  });
});
