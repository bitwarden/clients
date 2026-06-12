import { ComponentFixture, TestBed, fakeAsync, flush, tick } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { provideRouter } from "@angular/router";
import { BehaviorSubject } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { I18nMockService, ToastService } from "@bitwarden/components";
import { AccessRequestDetailsResponse, AccessRequestStatus, PamApiService } from "@bitwarden/pam";

import {
  MyAccessRequestsComponent,
  RECENT_WINDOW_DAYS,
  resolveResolver,
  statusBadgeVariant,
  statusLabelKey,
} from "./my-access-requests.component";

type ResponseFixture = {
  id: string;
  cipherId?: string;
  status: AccessRequestStatus;
  submittedAt?: string;
  resolvedAt?: string | null;
  approverId?: string | null;
  approverComment?: string | null;
  requestedNotBefore?: string | null;
  requestedNotAfter?: string | null;
  requestedTtlSeconds?: number;
};

function makeResponse(fixture: ResponseFixture): AccessRequestDetailsResponse {
  return new AccessRequestDetailsResponse({
    Id: fixture.id,
    CipherId: fixture.cipherId ?? `cipher-${fixture.id}`,
    CollectionId: "col-1",
    RequesterUserId: "me",
    Status: fixture.status,
    RequestedNotBefore: fixture.requestedNotBefore ?? null,
    RequestedNotAfter: fixture.requestedNotAfter ?? null,
    RequestedTtlSeconds: fixture.requestedTtlSeconds ?? 3600,
    Reason: null,
    SubmittedAt: fixture.submittedAt ?? "2026-05-01T00:00:00Z",
    ResolvedAt: fixture.resolvedAt ?? null,
    ResolverUserId: fixture.approverId ?? null,
    ResolverComment: fixture.approverComment ?? null,
    LeaseId: null,
  });
}

describe("MyAccessRequestsComponent", () => {
  let pamApi: jest.Mocked<PamApiService>;
  let configFlag$: BehaviorSubject<boolean>;
  let toast: jest.Mocked<Pick<ToastService, "showToast">>;

  const i18n = new I18nMockService({
    loading: "Loading…",
    cancel: "Cancel",
    pamMyRequestsEmptyTitle: "No access requests yet",
    pamMyRequestsEmptyDescription: "When you request access…",
    pamMyRequestsPendingSection: "Pending",
    pamMyRequestsRecentSection: "Recent",
    pamMyRequestsPendingEmpty: "No pending requests.",
    pamMyRequestsRecentEmpty: "No recent requests.",
    pamMyRequestsLoadError: "Load error",
    pamMyRequestsCancelSuccess: "Cancelled",
    pamMyRequestsCancelError: "Cancel error",
    pamStatusPending: "Pending",
    pamStatusApproved: "Approved",
    pamStatusDenied: "Denied",
    pamStatusCancelled: "Cancelled",
    pamStatusExpired: "Expired",
    pamColumnItem: "Item",
    pamColumnRequestedWindow: "Requested window",
    pamColumnSubmitted: "Submitted",
    pamColumnApprovers: "Approvers",
    pamColumnStatus: "Status",
    pamColumnResolver: "Resolver",
    pamColumnComment: "Comment",
    pamColumnResolved: "Resolved",
    pamApproversTbd: "Awaiting approval",
    pamResolverAccessRule: "Access rule",
    pamWindowUntil: "Until __$1__",
    pamWindowTtlSeconds: "__$1__s",
    pamStartLeaseButton: "Start access",
    pamActivateWithin: "Activate within __$1__",
    actions: "Actions",
  });

  beforeEach(async () => {
    pamApi = {
      cancelAccessRequest: jest.fn(),
      requestLeaseExtension: jest.fn(),
      decideAccessRequest: jest.fn(),
      revokeAccessLease: jest.fn(),
      listMyAccessRequests: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<PamApiService>;

    configFlag$ = new BehaviorSubject<boolean>(true);
    toast = { showToast: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [MyAccessRequestsComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: PamApiService, useValue: pamApi },
        {
          provide: ConfigService,
          useValue: {
            getFeatureFlag$: (flag: FeatureFlag) =>
              flag === FeatureFlag.Pam ? configFlag$.asObservable() : new BehaviorSubject(false),
          },
        },
        { provide: I18nService, useValue: i18n },
        { provide: ToastService, useValue: toast },
        { provide: LogService, useValue: { error: jest.fn() } },
      ],
    }).compileComponents();
  });

  // The component ticks a 1s interval for the countdown labels, so the zone never stabilizes and
  // `fixture.whenStable()` would hang — create inside fakeAsync and flush the load with tick().
  const create = (
    responses: AccessRequestDetailsResponse[],
  ): ComponentFixture<MyAccessRequestsComponent> => {
    pamApi.listMyAccessRequests.mockResolvedValue(responses);
    const fixture = TestBed.createComponent(MyAccessRequestsComponent);
    fixture.detectChanges();
    tick();
    fixture.detectChanges();
    return fixture;
  };

  it("hides the entire page when the PAM flag is off", fakeAsync(() => {
    configFlag$.next(false);
    const fixture = create([]);
    expect(fixture.nativeElement.textContent.trim()).toBe("");
  }));

  it("shows the global empty state when there are no requests", fakeAsync(() => {
    const fixture = create([]);
    expect(fixture.nativeElement.querySelector('[data-testid="my-requests-empty"]')).not.toBeNull();
  }));

  it("places pending rows in the Pending section", fakeAsync(() => {
    const fixture = create([
      makeResponse({ id: "p1", status: "pending" }),
      makeResponse({ id: "p2", status: "pending" }),
    ]);
    expect(
      fixture.nativeElement.querySelector('[data-testid="my-requests-pending-row-p1"]'),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-testid="my-requests-pending-row-p2"]'),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-testid="my-requests-recent-empty"]'),
    ).not.toBeNull();
  }));

  it("places resolved-within-window rows in the Recent section", fakeAsync(() => {
    const within = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const fixture = create([
      makeResponse({
        id: "r1",
        status: "approved",
        resolvedAt: within,
        approverId: "user-7",
      }),
    ]);
    expect(
      fixture.nativeElement.querySelector('[data-testid="my-requests-recent-row-r1"]'),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-testid="my-requests-pending-empty"]'),
    ).not.toBeNull();
  }));

  it("offers Start for an approved request whose window can still produce access", fakeAsync(() => {
    const fixture = create([
      makeResponse({
        id: "a1",
        status: "approved",
        resolvedAt: new Date().toISOString(),
        approverId: "user-7",
        requestedNotAfter: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      }),
    ]);
    expect(
      fixture.nativeElement.querySelector('[data-testid="my-requests-start-a1"]'),
    ).not.toBeNull();
  }));

  it("hides Start for an approved request whose window has lapsed — the server would reject it", fakeAsync(() => {
    const fixture = create([
      makeResponse({
        id: "a2",
        status: "approved",
        resolvedAt: new Date().toISOString(),
        approverId: "user-7",
        requestedNotAfter: new Date(Date.now() - 60 * 1000).toISOString(),
      }),
    ]);
    expect(
      fixture.nativeElement.querySelector('[data-testid="my-requests-recent-row-a2"]'),
    ).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="my-requests-start-a2"]')).toBeNull();
  }));

  it("excludes resolved rows older than the recency window", fakeAsync(() => {
    const stale = new Date(
      Date.now() - (RECENT_WINDOW_DAYS + 1) * 24 * 60 * 60 * 1000,
    ).toISOString();
    const fixture = create([
      makeResponse({ id: "old", status: "approved", resolvedAt: stale, approverId: "x" }),
    ]);
    expect(
      fixture.nativeElement.querySelector('[data-testid="my-requests-recent-row-old"]'),
    ).toBeNull();
    // Both empties show, but the global empty also fires since nothing fits anywhere.
    expect(fixture.nativeElement.querySelector('[data-testid="my-requests-empty"]')).not.toBeNull();
  }));

  it("cancels a pending request optimistically and calls the API", fakeAsync(() => {
    pamApi.listMyAccessRequests.mockResolvedValue([makeResponse({ id: "p1", status: "pending" })]);
    pamApi.cancelAccessRequest.mockResolvedValue(undefined);

    const fixture = TestBed.createComponent(MyAccessRequestsComponent);
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector(
      '[data-testid="my-requests-cancel-p1"]',
    ) as HTMLButtonElement;
    expect(button).not.toBeNull();
    button.click();
    fixture.detectChanges();

    // Optimistically moved to Recent as cancelled.
    expect(
      fixture.nativeElement.querySelector('[data-testid="my-requests-recent-row-p1"]'),
    ).not.toBeNull();
    expect(pamApi.cancelAccessRequest).toHaveBeenCalledWith("p1");

    flush();
    fixture.detectChanges();
    expect(toast.showToast).toHaveBeenCalledWith(expect.objectContaining({ variant: "success" }));
  }));

  it("reverts the optimistic cancel when the API call fails", fakeAsync(() => {
    pamApi.listMyAccessRequests.mockResolvedValue([makeResponse({ id: "p1", status: "pending" })]);
    pamApi.cancelAccessRequest.mockRejectedValue(new Error("boom"));

    const fixture = TestBed.createComponent(MyAccessRequestsComponent);
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector(
      '[data-testid="my-requests-cancel-p1"]',
    ) as HTMLButtonElement;
    button.click();
    flush();
    fixture.detectChanges();

    // Row reverted to pending.
    expect(
      fixture.nativeElement.querySelector('[data-testid="my-requests-pending-row-p1"]'),
    ).not.toBeNull();
    expect(toast.showToast).toHaveBeenCalledWith(expect.objectContaining({ variant: "error" }));
  }));

  it("shows a toast and renders the empty state when load fails", fakeAsync(() => {
    pamApi.listMyAccessRequests.mockRejectedValue(new Error("boom"));

    const fixture = TestBed.createComponent(MyAccessRequestsComponent);
    fixture.detectChanges();
    flush();
    fixture.detectChanges();

    expect(toast.showToast).toHaveBeenCalledWith(expect.objectContaining({ variant: "error" }));
    expect(fixture.nativeElement.querySelector('[data-testid="my-requests-empty"]')).not.toBeNull();
  }));
});

describe("statusBadgeVariant", () => {
  it("maps each status to a distinct visual variant", () => {
    expect(statusBadgeVariant("approved")).toBe("success");
    expect(statusBadgeVariant("activated")).toBe("success");
    expect(statusBadgeVariant("denied")).toBe("danger");
    expect(statusBadgeVariant("cancelled")).toBe("subtle");
    expect(statusBadgeVariant("expired")).toBe("warning");
    expect(statusBadgeVariant("pending")).toBe("primary");
  });
});

describe("statusLabelKey", () => {
  it("returns a pamStatus* i18n key for each status", () => {
    expect(statusLabelKey("approved")).toBe("pamStatusApproved");
    expect(statusLabelKey("activated")).toBe("pamStatusActivated");
    expect(statusLabelKey("denied")).toBe("pamStatusDenied");
    expect(statusLabelKey("cancelled")).toBe("pamStatusCancelled");
    expect(statusLabelKey("expired")).toBe("pamStatusExpired");
    expect(statusLabelKey("pending")).toBe("pamStatusPending");
  });
});

describe("resolveResolver", () => {
  it("returns no resolver for pending requests", () => {
    expect(resolveResolver({ status: "pending", approverId: null })).toEqual({
      resolverLabelKey: null,
      resolverName: null,
    });
  });

  it("returns the access-rule label key when there is no resolver user", () => {
    expect(resolveResolver({ status: "expired", approverId: null })).toEqual({
      resolverLabelKey: "pamResolverAccessRule",
      resolverName: null,
    });
  });

  it("falls back to the raw user id when a human resolved the request", () => {
    expect(resolveResolver({ status: "approved", approverId: "user-7" })).toEqual({
      resolverLabelKey: null,
      resolverName: "user-7",
    });
  });
});
