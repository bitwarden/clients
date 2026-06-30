import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed, fakeAsync, tick } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { provideRouter } from "@angular/router";
import { BehaviorSubject, of } from "rxjs";

import { AccessRequestDetailsResponse } from "@bitwarden/bit-pam";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { DialogService, I18nMockService, ToastService } from "@bitwarden/components";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";

import { ResolvedNames, emptyResolvedNames } from "../access-request-name-resolver.service";

import { AccessRequestDetailService } from "./access-request-detail.service";
import { AccessRequestRouteComponent } from "./access-request-route.component";

function pendingResponse(requesterId = "other"): AccessRequestDetailsResponse {
  return new AccessRequestDetailsResponse({
    Id: "req-1",
    CipherId: "cipher-1",
    CollectionId: "col-1",
    RequesterId: requesterId,
    Status: "pending",
    SubmittedAt: "2026-05-01T00:00:00Z",
  });
}

describe("AccessRequestRouteComponent", () => {
  let toast: ReturnType<typeof mockToast>;
  let detail: ReturnType<typeof mockDetail>;

  function mockToast() {
    return { showToast: jest.fn() };
  }

  function mockDetail() {
    return {
      request$: new BehaviorSubject<AccessRequestDetailsResponse | null>(null),
      loading$: new BehaviorSubject<boolean>(false),
      notFound$: new BehaviorSubject<boolean>(false),
      loadError$: new BehaviorSubject<unknown | null>(null),
      canApprove$: new BehaviorSubject<boolean>(false),
      currentUserId$: new BehaviorSubject<string | null>("me"),
      cipherById$: new BehaviorSubject<Map<string, unknown>>(new Map()),
      names$: new BehaviorSubject<ResolvedNames>(emptyResolvedNames()),
      decide: jest.fn().mockResolvedValue(undefined),
      cancel: jest.fn().mockResolvedValue(undefined),
      activate: jest.fn().mockResolvedValue(null),
      endLease: jest.fn().mockResolvedValue(undefined),
    };
  }

  const i18n = new I18nMockService({
    loading: "Loading…",
    cancel: "Cancel",
    pamAccessRequestTitle: "Access request",
    pamAccessRequestDetailsTitle: "Request details",
    pamAccessRequestLeaseTitle: "Access",
    pamAccessRequestDecisionLogTitle: "Decision log",
    pamAccessRequestNotFound: "Access request not available",
    pamAccessRequestNotFoundDescription: "This access request isn't available to you.",
    pamAccessRequestLoadError: "Couldn't load this access request.",
    pamColumnItem: "Item",
    pamColumnStatus: "Status",
    pamColumnRequestedWindow: "Requested window",
    pamColumnSubmitted: "Submitted",
    pamColumnResolved: "Resolved",
    pamColumnRemaining: "Remaining",
    pamInboxRequester: "Requester",
    pamInboxReason: "Reason",
    pamInboxReasonMissing: "No reason provided",
    pamInboxInCollection: "in __$1__",
    pamInboxTitle: "Access requests",
    pamInboxApprove: "Approve",
    pamInboxDeny: "Deny",
    pamStartLeaseButton: "Start access",
    pamActivateWithin: "Activate within __$1__",
    pamEndLeaseButton: "End access",
    pamMyRequestsCancelSuccess: "Request cancelled",
    pamMyRequestsCancelError: "Couldn't cancel the request",
    pamStatusPending: "Pending",
    pamStatusApproved: "Approved",
    pamStatusActivated: "Activated",
    pamStatusDenied: "Denied",
    pamStatusCancelled: "Cancelled",
    pamStatusExpired: "Expired",
    pamStatusRevoked: "Revoked",
    pamResolverAccessRule: "Access rule",
    pamInboxDuration1Hour: "1 hour",
    pamInboxStartAsap: "ASAP",
  });

  beforeEach(async () => {
    toast = mockToast();
    detail = mockDetail();

    await TestBed.configureTestingModule({
      imports: [AccessRequestRouteComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: I18nService, useValue: i18n },
        { provide: ToastService, useValue: toast },
        {
          provide: DialogService,
          useValue: { openSimpleDialog: jest.fn().mockResolvedValue(true) },
        },
        { provide: LogService, useValue: { error: jest.fn() } },
        // `app-vault-icon` dependencies — only exercised when a row resolves a cipher.
        {
          provide: EnvironmentService,
          useValue: { environment$: of({ getIconsUrl: () => "https://icons.bitwarden.net" }) },
        },
        { provide: DomainSettingsService, useValue: { showFavicons$: of(true) } },
        { provide: ConfigService, useValue: { getFeatureFlag$: () => of(false) } },
      ],
    })
      // Drop the heavy `app-header` (pulls in the product switcher / org services) and swap in a mock
      // data service so the test drives its streams directly.
      .overrideComponent(AccessRequestRouteComponent, {
        remove: { imports: [HeaderModule], providers: [AccessRequestDetailService] },
        add: {
          schemas: [NO_ERRORS_SCHEMA],
          providers: [{ provide: AccessRequestDetailService, useValue: detail }],
        },
      })
      .compileComponents();
  });

  // The component ticks a 1s countdown interval, so the zone never stabilizes; create inside
  // fakeAsync and flush with tick() rather than whenStable().
  const create = (): ComponentFixture<AccessRequestRouteComponent> => {
    const fixture = TestBed.createComponent(AccessRequestRouteComponent);
    fixture.detectChanges();
    tick();
    fixture.detectChanges();
    return fixture;
  };

  it("renders the not-found state when the request isn't available", fakeAsync(() => {
    detail.notFound$.next(true);

    const fixture = create();

    expect(fixture.nativeElement.querySelector("bit-no-items")).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain("Access request not available");
  }));

  it("renders the request details once loaded", fakeAsync(() => {
    detail.request$.next(pendingResponse());

    const fixture = create();

    expect(fixture.nativeElement.textContent).toContain("cipher-1");
    expect(fixture.nativeElement.textContent).toContain("Pending");
  }));

  it("shows Approve/Deny only when the viewer may decide", fakeAsync(() => {
    detail.request$.next(pendingResponse());
    detail.canApprove$.next(false);

    const fixture = create();
    expect(fixture.nativeElement.querySelector("#access-request_button_approve")).toBeNull();

    detail.canApprove$.next(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector("#access-request_button_approve")).not.toBeNull();
    expect(fixture.nativeElement.querySelector("#access-request_button_deny")).not.toBeNull();
  }));

  it("lets the requester cancel their own pending request", fakeAsync(() => {
    detail.request$.next(pendingResponse("me"));
    detail.currentUserId$.next("me");

    const fixture = create();
    const cancelButton: HTMLButtonElement = fixture.nativeElement.querySelector(
      "#access-request_button_cancel",
    );
    expect(cancelButton).not.toBeNull();

    cancelButton.click();
    tick();

    expect(detail.cancel).toHaveBeenCalled();
    expect(toast.showToast).toHaveBeenCalledWith(expect.objectContaining({ variant: "success" }));
  }));
});
