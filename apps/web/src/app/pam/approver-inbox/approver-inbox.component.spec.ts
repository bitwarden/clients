import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { provideRouter } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, Subject, of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { NotificationType } from "@bitwarden/common/enums/notification-type.enum";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ServerNotificationsService } from "@bitwarden/common/platform/server-notifications";
import { SyncService } from "@bitwarden/common/platform/sync";
import { DialogService, ToastService } from "@bitwarden/components";
import { AccessLeaseStatus, AccessRequestDetailsResponse, PamApiService } from "@bitwarden/pam";

import { HeaderModule } from "../../layouts/header/header.module";
import { AccessRequestNameResolver } from "../access-request-name-resolver.service";

import { ApproverInboxBadgeService } from "./approver-inbox-badge.service";
import { ApproverInboxComponent } from "./approver-inbox.component";

// JSDOM has no ResizeObserver; the tab group's overflow list constructs one.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(global as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;

const CURRENT_USER = "user-current";

function row(
  overrides: Partial<{
    id: string;
    requesterId: string;
    submittedAt: string;
    collectionName: string;
  }> = {},
): AccessRequestDetailsResponse {
  return new AccessRequestDetailsResponse({
    Id: overrides.id ?? "req-1",
    CipherId: "cipher-1",
    CollectionId: "col-1",
    RequesterId: overrides.requesterId ?? "user-2",
    Status: "pending",
    RequestedTtlSeconds: 3600,
    SubmittedAt: overrides.submittedAt ?? "2026-05-15T12:00:00Z",
    CipherName: "Prod DB",
    CollectionName: overrides.collectionName ?? "Production",
    RequesterName: "Bob",
    RequesterEmail: "bob@example.com",
  });
}

function leaseHistoryRow(producedLeaseStatus: AccessLeaseStatus): AccessRequestDetailsResponse {
  return new AccessRequestDetailsResponse({
    Id: "req-lease",
    CipherId: "cipher-1",
    CollectionId: "col-1",
    RequesterId: "someone-else",
    Status: "activated",
    RequestedNotBefore: "2000-01-01T00:00:00Z",
    RequestedNotAfter: "2999-01-01T00:00:00Z",
    RequestedTtlSeconds: 3600,
    SubmittedAt: "2026-06-10T10:00:00Z",
    ResolvedAt: "2026-06-10T10:30:00Z",
    ProducedLeaseId: "lease-1",
    ProducedLeaseStatus: producedLeaseStatus,
    CipherName: "Prod DB",
    CollectionName: "Production",
  });
}

describe("ApproverInboxComponent", () => {
  let fixture: ComponentFixture<ApproverInboxComponent>;
  let pamApiService: MockProxy<PamApiService>;
  let toastService: MockProxy<ToastService>;
  let badgeService: MockProxy<ApproverInboxBadgeService>;
  let dialogService: { open: jest.Mock };
  let notifications$: Subject<readonly [{ type: NotificationType }, string]>;
  let mutations$: Subject<void>;

  beforeEach(async () => {
    pamApiService = mock<PamApiService>();
    toastService = mock<ToastService>();
    badgeService = mock<ApproverInboxBadgeService>();
    dialogService = {
      open: jest.fn().mockReturnValue({ closed: of({ confirmed: true, comment: undefined }) }),
    };

    pamApiService.listInboxRequests.mockResolvedValue([]);
    pamApiService.listInboxHistory.mockResolvedValue([]);
    pamApiService.listMyAccessRequests.mockResolvedValue([]);
    pamApiService.listActiveLeases.mockResolvedValue([]);

    notifications$ = new Subject();
    mutations$ = new Subject();
    (pamApiService as unknown as { mutations$: Subject<void> }).mutations$ = mutations$;
    const notificationsService = mock<ServerNotificationsService>();
    (notificationsService as unknown as { notifications$: typeof notifications$ }).notifications$ =
      notifications$;

    const accountService = mock<AccountService>();
    (accountService as unknown as { activeAccount$: BehaviorSubject<unknown> }).activeAccount$ =
      new BehaviorSubject({
        id: CURRENT_USER,
        email: "me@example.com",
        emailVerified: true,
        name: "Me",
      });

    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => key);

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
    nameResolver.collectionNames$.mockReturnValue(of(new Map()));

    await TestBed.configureTestingModule({
      imports: [ApproverInboxComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: PamApiService, useValue: pamApiService },
        { provide: AccessRequestNameResolver, useValue: nameResolver },
        { provide: AccountService, useValue: accountService },
        { provide: ToastService, useValue: toastService },
        { provide: I18nService, useValue: i18nService },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: ApproverInboxBadgeService, useValue: badgeService },
        { provide: ServerNotificationsService, useValue: notificationsService },
        { provide: DialogService, useValue: dialogService },
        { provide: SyncService, useValue: { fullSync: () => Promise.resolve(true) } },
      ],
    })
      .overrideComponent(ApproverInboxComponent, {
        remove: { imports: [HeaderModule] },
        add: { schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ApproverInboxComponent);
  });

  const init = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  it("renders the three tab labels", async () => {
    await init();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? "";
    expect(text).toContain("pamTabApprovals");
    expect(text).toContain("pamTabMyRequests");
    expect(text).toContain("pamTabAuditLog");
  });

  it("shows pending requests in the Approvals tab", async () => {
    pamApiService.listInboxRequests.mockResolvedValue([row({ id: "a", requesterId: "other" })]);
    await init();
    expect(fixture.debugElement.queryAll(By.css('[data-testid="approvals-row"]')).length).toBe(1);
  });

  it("decides exactly once when the approval dialog confirms", async () => {
    pamApiService.listInboxRequests.mockResolvedValue([
      row({ id: "target", requesterId: "someone-else" }),
    ]);
    pamApiService.decideAccessRequest.mockResolvedValue(
      new AccessRequestDetailsResponse({ Id: "target", Status: "approved" }),
    );
    await init();

    fixture.debugElement
      .query(By.css('[data-testid="approver-inbox-approve"]'))
      .nativeElement.click();
    await fixture.whenStable();

    expect(dialogService.open).toHaveBeenCalledTimes(1);
    expect(pamApiService.decideAccessRequest).toHaveBeenCalledTimes(1);
    expect(pamApiService.decideAccessRequest).toHaveBeenCalledWith(
      "target",
      expect.objectContaining({ verdict: "approve" }),
    );
  });

  it("disables approve/deny for the current user's own requests", async () => {
    pamApiService.listInboxRequests.mockResolvedValue([
      row({ id: "self", requesterId: CURRENT_USER }),
    ]);
    await init();

    const approve = fixture.debugElement.query(By.css('[data-testid="approver-inbox-approve"]'));
    expect(approve.nativeElement.getAttribute("aria-disabled")).toBe("true");
  });

  it("renders the alternate empty state when hasManagerCollections is false", async () => {
    pamApiService.listInboxRequests.mockResolvedValue([]);
    fixture.componentRef.setInput("hasManagerCollections", false);
    await init();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? "";
    expect(text).toContain("pamInboxNotApproverTitle");
  });

  it("reloads when a RefreshApproverInbox push arrives", async () => {
    await init();
    pamApiService.listInboxHistory.mockClear();

    notifications$.next([{ type: NotificationType.RefreshApproverInbox }, CURRENT_USER]);
    await new Promise((resolve) => setTimeout(resolve, 350));
    await fixture.whenStable();

    expect(pamApiService.listInboxHistory).toHaveBeenCalled();
  });

  it("revokes an active managed lease from the Audit log tab", async () => {
    pamApiService.listInboxHistory.mockResolvedValue([leaseHistoryRow("active")]);
    pamApiService.revokeAccessLease.mockResolvedValue(undefined);
    await init();

    // Activate the Audit log tab so its (lazily-rendered) content mounts.
    const auditTabButton = fixture.debugElement
      .queryAll(By.css('[role="tab"]'))
      .find((el) => (el.nativeElement.textContent ?? "").includes("pamTabAuditLog"));
    auditTabButton?.nativeElement.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const revoke = fixture.debugElement.query(By.css('[data-testid="approver-inbox-revoke"]'));
    expect(revoke).not.toBeNull();
    revoke.nativeElement.click();
    await fixture.whenStable();

    expect(pamApiService.revokeAccessLease).toHaveBeenCalledWith("lease-1", expect.anything());
  });
});
