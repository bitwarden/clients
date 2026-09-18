import { TestBed } from "@angular/core/testing";
import { ActivatedRoute, convertToParamMap } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, Subject, firstValueFrom, of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

import {
  AccessEventService,
  AccessLeaseSdkService,
  AccessRequestSdkService,
  LeasingErrorService,
} from "../..";
import type {
  AccessLeaseId,
  AccessRequestId,
  AccessRequestView,
} from "../../abstractions/access-lease";
import { ApprovalRow } from "../../approvals/approval-row";
import { ApproverInboxService } from "../../approvals/approver-inbox.service";
import {
  AccessNameResolverService,
  ResolvedNames,
  emptyResolvedNames,
} from "../access-name-resolver.service";

import { AccessRequestDetailService } from "./access-request-detail.service";

const REQUEST_ID = "req-1" as unknown as AccessRequestId;

function request(overrides: Record<string, unknown> = {}): AccessRequestView {
  return {
    id: REQUEST_ID,
    cipherId: "cipher-1",
    collectionId: "col-1",
    requesterId: "user-1",
    status: "pending",
    leaseNotBefore: "2026-08-17T12:00:00.000Z",
    leaseNotAfter: "2026-08-17T13:00:00.000Z",
    submittedAt: "2026-08-17T11:00:00.000Z",
    decisions: [],
    ...overrides,
  } as unknown as AccessRequestView;
}

/** A leasing error as the SDK throws it, with the server's message on `.message`. */
function leasingError(message: string): Error {
  return Object.assign(new Error(message), { name: "AccessRequestError", variant: "Api" });
}

/** Lets the route-driven fetch in the constructor settle before assertions. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("AccessRequestDetailService", () => {
  let service: AccessRequestDetailService;
  let requestsApi: MockProxy<AccessRequestSdkService>;
  let leasesApi: MockProxy<AccessLeaseSdkService>;
  let nameResolver: MockProxy<AccessNameResolverService>;
  let leasingErrors: MockProxy<LeasingErrorService>;
  let push$: Subject<void>;
  let paramMap$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let activeUserId: string;
  let inboxRows$: BehaviorSubject<ApprovalRow[]>;
  let managedIds$: BehaviorSubject<Set<string>>;
  let inbox: {
    inboxRows$: BehaviorSubject<ApprovalRow[]>;
    managedIds$: BehaviorSubject<Set<string>>;
    load: jest.Mock;
    decide: jest.Mock;
    cancelApproval: jest.Mock;
    revokeLease: jest.Mock;
  };

  async function setup(): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        AccessRequestDetailService,
        { provide: AccessRequestSdkService, useValue: requestsApi },
        { provide: AccessLeaseSdkService, useValue: leasesApi },
        { provide: AccessNameResolverService, useValue: nameResolver },
        { provide: LeasingErrorService, useValue: leasingErrors },
        { provide: AccessEventService, useValue: { accessChanged$: () => push$.asObservable() } },
        { provide: ActivatedRoute, useValue: { paramMap: paramMap$.asObservable() } },
        {
          provide: AccountService,
          useValue: { activeAccount$: of({ id: activeUserId }) },
        },
        { provide: ApproverInboxService, useValue: inbox },
      ],
    });
    service = TestBed.inject(AccessRequestDetailService);
    await settle();
  }

  beforeEach(() => {
    requestsApi = mock<AccessRequestSdkService>();
    leasesApi = mock<AccessLeaseSdkService>();
    nameResolver = mock<AccessNameResolverService>();
    leasingErrors = mock<LeasingErrorService>();
    push$ = new Subject<void>();
    paramMap$ = new BehaviorSubject(convertToParamMap({ id: "req-1" }));
    activeUserId = "user-1";
    inboxRows$ = new BehaviorSubject<ApprovalRow[]>([]);
    managedIds$ = new BehaviorSubject<Set<string>>(new Set());
    inbox = {
      inboxRows$,
      managedIds$,
      load: jest.fn().mockResolvedValue(undefined),
      decide: jest.fn().mockResolvedValue(undefined),
      cancelApproval: jest.fn().mockResolvedValue(undefined),
      revokeLease: jest.fn().mockResolvedValue(undefined),
    };

    requestsApi.getAccessRequest.mockResolvedValue(request());
    // Name resolution is the resolver's own concern (and its own spec); this service only reads its maps.
    nameResolver.resolveNames.mockResolvedValue(emptyResolvedNames() as ResolvedNames);
    leasingErrors.isLeasingError.mockReturnValue(false);
  });

  describe("loading", () => {
    it("fetches the request named by the route id", async () => {
      await setup();

      expect(requestsApi.getAccessRequest).toHaveBeenCalledWith("req-1");
      expect((await firstValueFrom(service.request$))?.id).toBe(REQUEST_ID);
      expect(await firstValueFrom(service.notFound$)).toBe(false);
      expect(await firstValueFrom(service.loading$)).toBe(false);
    });

    it("resolves the request's cipher and collection names", async () => {
      await setup();

      expect(nameResolver.resolveNames).toHaveBeenCalledWith([
        { cipherId: "cipher-1", collectionId: "col-1" },
      ]);
    });

    it("re-fetches when the route id changes", async () => {
      await setup();
      requestsApi.getAccessRequest.mockClear();

      paramMap$.next(convertToParamMap({ id: "req-2" }));
      await settle();

      expect(requestsApi.getAccessRequest).toHaveBeenCalledWith("req-2");
    });

    it("does not re-fetch when the route re-emits the same id", async () => {
      await setup();
      requestsApi.getAccessRequest.mockClear();

      paramMap$.next(convertToParamMap({ id: "req-1" }));
      await settle();

      expect(requestsApi.getAccessRequest).not.toHaveBeenCalled();
    });
  });

  describe("failures", () => {
    it("treats a 404 as not-found rather than an error", async () => {
      // The server 404s both a missing request and one the caller cannot see; neither is a fault.
      leasingErrors.isLeasingError.mockReturnValue(true);
      requestsApi.getAccessRequest.mockRejectedValue(leasingError("[404] not found"));

      await setup();

      expect(await firstValueFrom(service.notFound$)).toBe(true);
      expect(await firstValueFrom(service.request$)).toBeNull();
      expect(await firstValueFrom(service.loadError$)).toBeNull();
    });

    it("records any other failure as a load error", async () => {
      requestsApi.getAccessRequest.mockRejectedValue(new Error("boom"));

      await setup();

      expect(await firstValueFrom(service.loadError$)).toBeTruthy();
      expect(await firstValueFrom(service.notFound$)).toBe(false);
    });

    it("keeps loading further ids after a failure — the stream must not tear down", async () => {
      requestsApi.getAccessRequest.mockRejectedValue(new Error("boom"));
      await setup();

      requestsApi.getAccessRequest.mockResolvedValue(request({ id: "req-2" }));
      paramMap$.next(convertToParamMap({ id: "req-2" }));
      await settle();

      expect(await firstValueFrom(service.loadError$)).toBeNull();
      expect((await firstValueFrom(service.request$))?.id).toBe("req-2");
    });
  });

  describe("mutations re-fetch to reconcile", () => {
    it("cancels then re-fetches", async () => {
      await setup();
      requestsApi.getAccessRequest.mockClear();

      await service.cancel();

      expect(requestsApi.cancelAccessRequest).toHaveBeenCalledWith(REQUEST_ID);
      expect(requestsApi.getAccessRequest).toHaveBeenCalledTimes(1);
    });

    it("activates then re-fetches", async () => {
      await setup();
      requestsApi.getAccessRequest.mockClear();

      await service.activate();

      expect(requestsApi.activateAccessRequest).toHaveBeenCalledWith(REQUEST_ID);
      expect(requestsApi.getAccessRequest).toHaveBeenCalledTimes(1);
    });

    it("ends the produced lease then re-fetches", async () => {
      await setup();
      requestsApi.getAccessRequest.mockClear();

      await service.endLease("lease-1" as unknown as AccessLeaseId);

      expect(leasesApi.endLease).toHaveBeenCalledWith("lease-1", { reason: undefined });
      expect(requestsApi.getAccessRequest).toHaveBeenCalledTimes(1);
    });

    it("does nothing when there is no loaded request to act on", async () => {
      requestsApi.getAccessRequest.mockRejectedValue(new Error("boom"));
      await setup();

      await service.cancel();
      await service.activate();

      expect(requestsApi.cancelAccessRequest).not.toHaveBeenCalled();
      expect(requestsApi.activateAccessRequest).not.toHaveBeenCalled();
    });
  });

  describe("live refresh", () => {
    it("re-fetches on a server-pushed access event", async () => {
      await setup();
      requestsApi.getAccessRequest.mockClear();

      push$.next();
      await settle();

      expect(requestsApi.getAccessRequest).toHaveBeenCalledWith("req-1");
    });

    it("surfaces an approver's decision without the page reloading", async () => {
      await setup();
      expect((await firstValueFrom(service.request$))?.status).toBe("pending");

      requestsApi.getAccessRequest.mockResolvedValue(request({ status: "approved" }));
      push$.next();
      await settle();

      expect((await firstValueFrom(service.request$))?.status).toBe("approved");
    });
  });

  it("exposes the decrypted ciphers by id for the item's favicon", async () => {
    const cipherById = new Map([["cipher-1", { id: "cipher-1" }]]);
    nameResolver.resolveNames.mockResolvedValue({
      ...emptyResolvedNames(),
      cipherById,
    } as unknown as ResolvedNames);

    await setup();

    expect(await firstValueFrom(service.cipherById$)).toBe(cipherById);
  });
  describe("who is viewing", () => {
    it("is the requester when the active user raised the request", async () => {
      await setup();

      expect(await firstValueFrom(service.viewer$)).toBe("requester");
    });

    it("is an approver when someone else raised it — the emailed link reaches both", async () => {
      activeUserId = "approver-1";

      await setup();

      expect(await firstValueFrom(service.viewer$)).toBe("approver");
    });

    it("is unknown until the request has loaded", async () => {
      requestsApi.getAccessRequest.mockRejectedValue(new Error("boom"));

      await setup();

      expect(await firstValueFrom(service.viewer$)).toBeNull();
    });

    it("finds the request's decidable row in the viewer's inbox", async () => {
      activeUserId = "approver-1";
      const row = { id: REQUEST_ID, canDecide: true } as unknown as ApprovalRow;
      inboxRows$.next([{ id: "req-other", canDecide: true } as unknown as ApprovalRow, row]);

      await setup();

      expect(await firstValueFrom(service.approvalRow$)).toBe(row);
    });

    it("finds no row for a request the viewer can't decide", async () => {
      inboxRows$.next([{ id: REQUEST_ID, canDecide: false } as unknown as ApprovalRow]);

      await setup();

      expect(await firstValueFrom(service.approvalRow$)).toBeNull();
    });

    it("knows whether the request is on a collection the viewer manages", async () => {
      await setup();
      expect(await firstValueFrom(service.managed$)).toBe(false);

      managedIds$.next(new Set(["req-1"]));
      expect(await firstValueFrom(service.managed$)).toBe(true);
    });
  });

  describe("keeping the approver's inbox current", () => {
    it("reloads the inbox when an approver opens a request, since it may predate the load", async () => {
      activeUserId = "approver-1";

      await setup();

      expect(inbox.load).toHaveBeenCalledTimes(1);
    });

    it("reloads once per request, not on every re-fetch", async () => {
      activeUserId = "approver-1";
      await setup();

      push$.next();
      await settle();

      expect(inbox.load).toHaveBeenCalledTimes(1);
    });

    it("leaves the inbox alone when the requester opens their own request", async () => {
      await setup();

      expect(inbox.load).not.toHaveBeenCalled();
    });
  });

  describe("approver mutations go through the shared inbox, then re-fetch", () => {
    it("decides", async () => {
      await setup();
      requestsApi.getAccessRequest.mockClear();

      await service.decide("approve", "ok");

      expect(inbox.decide).toHaveBeenCalledWith(REQUEST_ID, "approve", "ok");
      expect(requestsApi.getAccessRequest).toHaveBeenCalledTimes(1);
    });

    it("withdraws an approval", async () => {
      await setup();
      requestsApi.getAccessRequest.mockClear();

      await service.withdrawApproval();

      expect(inbox.cancelApproval).toHaveBeenCalledWith(REQUEST_ID);
      expect(requestsApi.getAccessRequest).toHaveBeenCalledTimes(1);
    });

    it("revokes the lease", async () => {
      await setup();
      requestsApi.getAccessRequest.mockClear();

      await service.revokeLease("lease-1" as unknown as AccessLeaseId);

      expect(inbox.revokeLease).toHaveBeenCalledWith(REQUEST_ID, "lease-1");
      expect(requestsApi.getAccessRequest).toHaveBeenCalledTimes(1);
    });
  });
});
