import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, Subject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ServerNotificationsService } from "@bitwarden/common/platform/server-notifications";
import { I18nMockService, ToastService } from "@bitwarden/components";
import { AccessRequestDetailsResponse, PamApiService } from "@bitwarden/pam";

import { AccessRequestNameResolver } from "../access-request-name-resolver.service";
import { MyAccessRequestsService } from "../my-access-requests/my-access-requests.service";

import { ApproverInboxRequestsService } from "./approver-inbox-requests.service";
import { ApproverInboxService } from "./approver-inbox.service";
import { AuditLogTabComponent } from "./audit-log-tab.component";

function activatedLease(id: string): AccessRequestDetailsResponse {
  return new AccessRequestDetailsResponse({
    Id: id,
    CipherId: "cipher-1",
    CollectionId: "col-1",
    RequesterId: "user-2",
    Status: "activated",
    RequestedNotBefore: "2000-01-01T00:00:00Z",
    RequestedNotAfter: "2999-01-01T00:00:00Z",
    RequestedTtlSeconds: 3600,
    SubmittedAt: "2026-06-10T10:00:00Z",
    ResolvedAt: "2026-06-10T10:30:00Z",
    ProducedLeaseId: "lease-" + id,
    ProducedLeaseStatus: "active",
    CipherName: "Prod DB",
    CollectionName: "Production",
    RequesterName: "Bob",
  });
}

const i18n = new I18nMockService({
  status: "Status",
  pamColumnItem: "Item",
  pamColumnResolved: "Resolved",
  pamColumnApprovedBy: "Approved by",
  pamResolverAccessRule: "Access rule",
  pamInboxRequester: "Requester",
  pamInboxInCollection: "in __$1__",
  pamInboxHistoryEmpty: "No history to display",
  pamInboxHistoryFilterEmpty: "No entries match this filter",
  pamInboxHistoryFilterLabel: "Filter",
  pamInboxFilterAll: "All",
  pamInboxFilterActive: "Active",
  pamInboxFilterUpcoming: "Upcoming",
  pamInboxFilterPast: "Past",
  pamInboxHistoryGroupActive: "Active",
  pamInboxHistoryTimeRemaining: "__$1__ remaining",
  pamInboxRevoke: "Revoke",
  pamInboxCancelApproval: "Cancel",
  pamInboxRevokedToast: "Revoked",
  pamInboxRevokeFailed: "Revoke failed",
});

/**
 * The route container merges managed-collection history with the viewer's own resolved requests and
 * owns the Revoke / Cancel-approval network calls + toasts. Rendering, bucket filters, and the
 * managed-only affordance gating are covered by AuditLogComponent's own spec; this spec covers the
 * container wiring (data in, action out).
 */
describe("AuditLogTabComponent", () => {
  let pamApiService: MockProxy<PamApiService>;
  let toastService: MockProxy<ToastService>;
  let inboxRequests$: BehaviorSubject<AccessRequestDetailsResponse[]>;

  beforeEach(async () => {
    pamApiService = mock<PamApiService>();
    toastService = mock<ToastService>();

    pamApiService.listInboxHistory.mockResolvedValue([]);
    pamApiService.listMyAccessRequests.mockResolvedValue([]);
    pamApiService.listActiveLeases.mockResolvedValue([]);
    (pamApiService as unknown as { mutations$: Subject<void> }).mutations$ = new Subject<void>();
    inboxRequests$ = new BehaviorSubject<AccessRequestDetailsResponse[]>([]);

    const nameResolver = mock<AccessRequestNameResolver>();
    nameResolver.resolveDisplayNames.mockResolvedValue({
      cipherNameById: new Map(),
      collectionNameById: new Map(),
      cipherById: new Map(),
    });
    nameResolver.namesFor.mockResolvedValue({
      cipherNameById: new Map(),
      collectionNameById: new Map(),
      cipherById: new Map(),
    });
    nameResolver.applyCollectionNames$.mockImplementation((rows$) => rows$);

    await TestBed.configureTestingModule({
      imports: [AuditLogTabComponent, NoopAnimationsModule],
      providers: [
        ApproverInboxService,
        MyAccessRequestsService,
        {
          provide: ApproverInboxRequestsService,
          useValue: { requests$: inboxRequests$, refresh: jest.fn() },
        },
        { provide: PamApiService, useValue: pamApiService },
        { provide: AccessRequestNameResolver, useValue: nameResolver },
        { provide: ToastService, useValue: toastService },
        { provide: I18nService, useValue: i18n },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: ServerNotificationsService, useValue: { notifications$: new Subject() } },
      ],
    }).compileComponents();
  });

  /** Seed the shared services (as the shell would) before rendering the tab. */
  const render = async (
    history: AccessRequestDetailsResponse[],
  ): Promise<ComponentFixture<AuditLogTabComponent>> => {
    pamApiService.listInboxHistory.mockResolvedValue(history);
    await Promise.all([
      TestBed.inject(ApproverInboxService).load(),
      TestBed.inject(MyAccessRequestsService).load(),
    ]);
    const fixture = TestBed.createComponent(AuditLogTabComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  };

  it("renders the managed history items the inbox service holds", async () => {
    const fixture = await render([activatedLease("a"), activatedLease("b")]);
    expect(fixture.debugElement.queryAll(By.css('[data-testid="audit-log-row"]')).length).toBe(2);
  });

  it("revokes via the service and toasts when the row's Revoke is clicked", async () => {
    pamApiService.revokeAccessLease.mockResolvedValue(undefined);
    const fixture = await render([activatedLease("a")]);

    const revoke = fixture.debugElement.query(By.css('[data-testid="approver-inbox-revoke"]'));
    expect(revoke).not.toBeNull();
    revoke.nativeElement.click();
    await fixture.whenStable();

    expect(pamApiService.revokeAccessLease).toHaveBeenCalledWith("lease-a", expect.anything());
    expect(toastService.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success", message: "Revoked" }),
    );
  });
});
