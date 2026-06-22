import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { provideRouter } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, Subject, of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ServerNotificationsService } from "@bitwarden/common/platform/server-notifications";
import { DialogService, I18nMockService, ToastService } from "@bitwarden/components";
import { AccessDecisionVerdict, AccessRequestDetailsResponse, PamApiService } from "@bitwarden/pam";

import { AccessRequestNameResolver } from "../access-request-name-resolver.service";

import { ApprovalsTabComponent } from "./approvals-tab.component";
import { ApproverInboxRequestsService } from "./approver-inbox-requests.service";
import { ApproverInboxService } from "./approver-inbox.service";

const ME = "user-me";

function request(id: string, requesterId = "user-other"): AccessRequestDetailsResponse {
  return new AccessRequestDetailsResponse({
    Id: id,
    CipherId: "cipher-" + id,
    CollectionId: "col-1",
    RequesterId: requesterId,
    Status: "pending",
    RequestedTtlSeconds: 3600,
    SubmittedAt: "2026-06-10T10:00:00Z",
    Reason: "Need access",
    CipherName: "Prod DB",
    CollectionName: "Production",
    RequesterName: "Bob",
    RequesterEmail: "bob@example.com",
  });
}

// JSDOM has no ResizeObserver; some component-library primitives construct one.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(global as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;

const i18n = new I18nMockService({
  loading: "Loading…",
  actions: "Actions",
  search: "Search",
  resetSearch: "Clear search",
  removeItem: "Remove __$1__",
  backTo: "Back to __$1__",
  viewItemsIn: "View items in __$1__",
  pamInboxEmptyTitle: "Inbox zero",
  pamInboxEmptyDescription: "Nothing waiting",
  pamInboxNotApproverTitle: "Not an approver",
  pamInboxNotApproverDescription: "No collections",
  pamApprovalsSearchPlaceholder: "Search",
  pamApprovalsCollectionFilter: "Collection",
  pamApprovalsRequesterFilter: "Requester",
  pamApprovalsDensityLabel: "Density",
  pamApprovalsDensityComfortable: "Comfortable",
  pamApprovalsDensityCompact: "Compact",
  pamApprovalsPendingHeader: "Pending approval __$1__",
  pamColumnItem: "Item",
  pamInboxRequester: "Requester",
  pamColumnRequestedWindow: "Requested window",
  pamInboxReason: "Reason",
  pamColumnSubmitted: "Submitted",
  pamInboxInCollection: "in __$1__",
  pamInboxViewInVault: "View in vault",
  pamInboxReasonMissing: "No reason",
  pamInboxApprove: "Approve",
  pamInboxDeny: "Deny",
  pamInboxCannotApproveOwn: "You cannot approve your own request.",
  pamInboxDuration1Hour: "1 hour",
  pamInboxDurationHours: "__$1__ hours",
  pamInboxDurationMinutes: "__$1__ min",
  pamInboxStartAsap: "now",
  pamInboxStartToday: "today",
  pamInboxStartTomorrow: "tomorrow",
  pamInboxStartInDays: "in __$1__ days",
  pamInboxElapsedJustNow: "just now",
  pamInboxElapsedMinutes: "__$1__m ago",
  pamInboxElapsedHours: "__$1__h ago",
  pamInboxElapsedDays: "__$1__d ago",
  pamInboxApprovedToast: "Approved",
  pamInboxDeniedToast: "Denied",
  pamInboxDecisionFailed: "Decision failed",
});

/**
 * The route container wires page-scoped service state into the presentational ApprovalsComponent and
 * owns the decision network call + toasts. Rendering, the self-approval guard, filters, and decide
 * emission are covered by ApprovalsComponent's own spec; this spec covers the container wiring.
 */
describe("ApprovalsTabComponent", () => {
  let pamApiService: MockProxy<PamApiService>;
  let toastService: MockProxy<ToastService>;
  let dialogService: { open: jest.Mock };
  let inboxRequests$: BehaviorSubject<AccessRequestDetailsResponse[]>;

  beforeEach(async () => {
    pamApiService = mock<PamApiService>();
    toastService = mock<ToastService>();
    dialogService = {
      open: jest.fn().mockReturnValue({ closed: of({ confirmed: true, comment: undefined }) }),
    };

    pamApiService.listInboxHistory.mockResolvedValue([]);
    (pamApiService as unknown as { mutations$: Subject<void> }).mutations$ = new Subject<void>();
    inboxRequests$ = new BehaviorSubject<AccessRequestDetailsResponse[]>([]);

    const nameResolver = mock<AccessRequestNameResolver>();
    nameResolver.resolveDisplayNames.mockResolvedValue({
      cipherNameById: new Map(),
      collectionNameById: new Map(),
      cipherById: new Map(),
    });
    nameResolver.applyCollectionNames$.mockImplementation((rows$) => rows$);

    const accountService = mock<AccountService>();
    (accountService as unknown as { activeAccount$: BehaviorSubject<unknown> }).activeAccount$ =
      new BehaviorSubject<unknown>({
        id: ME,
        email: "me@example.com",
        emailVerified: true,
        name: "Me",
      });

    await TestBed.configureTestingModule({
      imports: [ApprovalsTabComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        ApproverInboxService,
        {
          provide: ApproverInboxRequestsService,
          useValue: { requests$: inboxRequests$, refresh: jest.fn() },
        },
        { provide: PamApiService, useValue: pamApiService },
        { provide: AccessRequestNameResolver, useValue: nameResolver },
        { provide: AccountService, useValue: accountService },
        { provide: ToastService, useValue: toastService },
        { provide: I18nService, useValue: i18n },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: DialogService, useValue: dialogService },
        { provide: ServerNotificationsService, useValue: { notifications$: new Subject() } },
      ],
    }).compileComponents();
  });

  /** Seed the shared inbox stream (as the root service would) before rendering the tab. */
  const render = async (
    requests: AccessRequestDetailsResponse[],
  ): Promise<ComponentFixture<ApprovalsTabComponent>> => {
    inboxRequests$.next(requests);
    const fixture = TestBed.createComponent(ApprovalsTabComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  };

  it("renders a row per request the inbox service holds", async () => {
    const fixture = await render([request("a"), request("b")]);
    expect(fixture.debugElement.queryAll(By.css('[data-testid="approvals-row"]')).length).toBe(2);
  });

  it("submits the decision once and toasts on a confirmed approval", async () => {
    pamApiService.decideAccessRequest.mockResolvedValue(
      new AccessRequestDetailsResponse({ Id: "target", Status: "approved" }),
    );
    const fixture = await render([request("target")]);

    fixture.debugElement
      .query(By.css('[data-testid="approver-inbox-approve"]'))
      .nativeElement.click();
    await fixture.whenStable();

    expect(dialogService.open).toHaveBeenCalledTimes(1);
    expect(pamApiService.decideAccessRequest).toHaveBeenCalledTimes(1);
    expect(pamApiService.decideAccessRequest).toHaveBeenCalledWith(
      "target",
      expect.objectContaining({ verdict: AccessDecisionVerdict.Approve }),
    );
    expect(toastService.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success", message: "Approved" }),
    );
  });
});
