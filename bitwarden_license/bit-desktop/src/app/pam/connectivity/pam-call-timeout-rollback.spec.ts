import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, NEVER } from "rxjs";

import {
  AccessEventService,
  AccessLeaseSdkService,
  AccessRefreshService,
  AccessRequestSdkService,
  DefaultAccessRefreshService,
  PamUnreachableError,
} from "@bitwarden/bit-pam";
import type {
  AccessLeaseId,
  AccessLeaseView,
  AccessRequestId,
  AccessRequestView,
} from "@bitwarden/bit-pam";
import {
  AccessNameResolverService,
  emptyResolvedNames,
  MyAccessService,
  ResolvedNames,
} from "@bitwarden/bit-pam-components";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";

import { PamCallOutcomeReporter } from "./desktop-pam-connectivity.service";
import { PAM_CALL_TIMEOUT_MS, guardPamCalls } from "./pam-call-guard";

/**
 * End and Cancel patch My requests before the server answers. Through the desktop's guarded SDK
 * services a call that never answers must end at the timeout and put the row back.
 */
describe("a PAM call that times out under My requests", () => {
  let service: MyAccessService;
  let requestsApi: MockProxy<AccessRequestSdkService>;
  let leasesApi: MockProxy<AccessLeaseSdkService>;
  let reporter: PamCallOutcomeReporter;

  const request = (overrides: Record<string, unknown> = {}) =>
    ({
      id: "req-1",
      cipherId: "cipher-1",
      collectionId: "col-1",
      organizationId: "org-1",
      requesterId: "user-1",
      status: "pending",
      leaseNotBefore: new Date(Date.now() - 60_000).toISOString(),
      leaseNotAfter: new Date(Date.now() + 3_600_000).toISOString(),
      submittedAt: new Date(Date.now() - 60_000).toISOString(),
      decisions: [],
      ...overrides,
    }) as unknown as AccessRequestView;

  const lease = () =>
    ({
      id: "lease-1",
      requestId: "req-2",
      cipherId: "cipher-1",
      collectionId: "col-1",
      status: "active",
      notBefore: new Date(Date.now() - 60_000).toISOString(),
      notAfter: new Date(Date.now() + 3_600_000).toISOString(),
    }) as unknown as AccessLeaseView;

  beforeEach(async () => {
    jest.useFakeTimers();
    requestsApi = mock<AccessRequestSdkService>();
    leasesApi = mock<AccessLeaseSdkService>();
    requestsApi.listMyAccessRequests.mockResolvedValue([request()]);
    leasesApi.listMyLeases.mockResolvedValue([lease()]);
    // Never answers, as with a server that went away mid-call.
    requestsApi.cancelAccessRequest.mockReturnValue(new Promise(() => undefined));
    leasesApi.endLease.mockReturnValue(new Promise(() => undefined));
    // The real one, which the service now listens on for pushes and local announcements alike.
    const accessRefresh = new DefaultAccessRefreshService({
      accessChanged$: () => NEVER,
      approverInboxChanged$: () => NEVER,
    } as unknown as AccessEventService);
    const nameResolver = mock<AccessNameResolverService>();
    nameResolver.resolveNames.mockResolvedValue(emptyResolvedNames() as ResolvedNames);
    reporter = { reportReachable: jest.fn(), reportUnreachable: jest.fn(), browserOffline: false };

    TestBed.configureTestingModule({
      providers: [
        MyAccessService,
        { provide: AccessRequestSdkService, useValue: guardPamCalls(requestsApi, reporter) },
        { provide: AccessLeaseSdkService, useValue: guardPamCalls(leasesApi, reporter) },
        { provide: AccessNameResolverService, useValue: nameResolver },
        { provide: AccessRefreshService, useValue: accessRefresh },
        {
          provide: AccountService,
          useValue: { activeAccount$: new BehaviorSubject({ id: "user-1" } as Account) },
        },
      ],
    });
    service = TestBed.inject(MyAccessService);
    await service.load();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("puts an ended lease back once End times out", async () => {
    const ending = service.endLease("lease-1" as unknown as AccessLeaseId);
    const failed = expect(ending).rejects.toBeInstanceOf(PamUnreachableError);
    expect(await firstValueFrom(service.leases$)).toEqual([]);

    jest.advanceTimersByTime(PAM_CALL_TIMEOUT_MS);
    await failed;

    expect((await firstValueFrom(service.leases$)).map((l) => String(l.id))).toEqual(["lease-1"]);
    expect(leasesApi.endLease).toHaveBeenCalledTimes(1);
  });

  it("puts a canceled request back once Cancel times out", async () => {
    const canceling = service.cancel("req-1" as unknown as AccessRequestId);
    const failed = expect(canceling).rejects.toBeInstanceOf(PamUnreachableError);
    expect(await firstValueFrom(service.pendingRows$)).toEqual([]);

    jest.advanceTimersByTime(PAM_CALL_TIMEOUT_MS);
    await failed;

    expect((await firstValueFrom(service.pendingRows$)).map((r) => r.id)).toEqual(["req-1"]);
    expect(requestsApi.cancelAccessRequest).toHaveBeenCalledTimes(1);
  });
});
