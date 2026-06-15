import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { provideRouter } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, Subject } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { NotificationType } from "@bitwarden/common/enums/notification-type.enum";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ServerNotificationsService } from "@bitwarden/common/platform/server-notifications";
import { ToastService } from "@bitwarden/components";
import { AccessLeaseStatus, AccessRequestDetailsResponse, PamApiService } from "@bitwarden/pam";

import { HeaderModule } from "../../layouts/header/header.module";
import { AccessRequestNameResolver } from "../access-request-name-resolver.service";

import { ApproverInboxBadgeService } from "./approver-inbox-badge.service";
import {
  ApproverInboxComponent,
  groupHistory,
  historyRelTimeFor,
  historyStatusLabelFor,
} from "./approver-inbox.component";

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

describe("ApproverInboxComponent", () => {
  let fixture: ComponentFixture<ApproverInboxComponent>;
  let pamApiService: MockProxy<PamApiService>;
  let toastService: MockProxy<ToastService>;
  let badgeService: MockProxy<ApproverInboxBadgeService>;
  let notifications$: Subject<readonly [{ type: NotificationType }, string]>;
  let mutations$: Subject<void>;

  beforeEach(async () => {
    pamApiService = mock<PamApiService>();
    toastService = mock<ToastService>();
    badgeService = mock<ApproverInboxBadgeService>();

    pamApiService.listInboxRequests.mockResolvedValue([]);
    pamApiService.listInboxHistory.mockResolvedValue([]);
    // The embedded "My requests" list loads independently; keep it empty so it doesn't error.
    pamApiService.listMyAccessRequests.mockResolvedValue([]);

    // Live-refresh triggers: a server push (RefreshApproverInbox) and this client's own mutations.
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

    // The inbox + embedded "My requests" list resolve cipher/collection names from local vault state.
    const nameResolver = mock<AccessRequestNameResolver>();
    nameResolver.resolveDisplayNames.mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [ApproverInboxComponent],
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
      ],
    })
      .overrideComponent(ApproverInboxComponent, {
        remove: { imports: [HeaderModule] },
        add: { schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ApproverInboxComponent);
  });

  it("renders the empty 'no requests' state by default", async () => {
    pamApiService.listInboxRequests.mockResolvedValue([]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const list = fixture.debugElement.query(By.css('[data-testid="approver-inbox-list"]'));
    expect(list).toBeNull();
  });

  it("calls decideAccessRequest exactly once per approval click", async () => {
    const target = row({ id: "target", requesterId: "someone-else" });
    pamApiService.listInboxRequests.mockResolvedValue([target]);
    pamApiService.decideAccessRequest.mockResolvedValue(
      new AccessRequestDetailsResponse({ Id: "target", Status: "approved" }),
    );

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const approveButtons = fixture.debugElement.queryAll(
      By.css('[data-testid="approver-inbox-approve"]'),
    );
    expect(approveButtons.length).toBe(1);
    approveButtons[0].nativeElement.click();
    fixture.detectChanges();

    const confirm = fixture.debugElement.query(By.css('[data-testid="approver-inbox-confirm"]'));
    confirm.nativeElement.click();
    confirm.nativeElement.click(); // second click should be ignored by submitting() guard
    await fixture.whenStable();

    expect(pamApiService.decideAccessRequest).toHaveBeenCalledTimes(1);
    expect(pamApiService.decideAccessRequest).toHaveBeenCalledWith(
      "target",
      expect.objectContaining({ verdict: "approve" }),
    );
  });

  it("rolls back and toasts when the decision API fails", async () => {
    const target = row({ id: "target", requesterId: "someone-else" });
    pamApiService.listInboxRequests.mockResolvedValue([target]);
    pamApiService.decideAccessRequest.mockRejectedValue(new Error("boom"));

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    fixture.debugElement.query(By.css('[data-testid="approver-inbox-deny"]')).nativeElement.click();
    fixture.detectChanges();

    fixture.debugElement
      .query(By.css('[data-testid="approver-inbox-confirm"]'))
      .nativeElement.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(toastService.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "error" }),
    );
    const row1 = fixture.debugElement.query(By.css('[data-testid="approver-inbox-row"]'));
    expect(row1).not.toBeNull();
  });

  it("disables approve/deny for the current user's own requests", async () => {
    const self = row({ id: "self", requesterId: CURRENT_USER });
    pamApiService.listInboxRequests.mockResolvedValue([self]);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const approve = fixture.debugElement.query(By.css('[data-testid="approver-inbox-approve"]'));
    const deny = fixture.debugElement.query(By.css('[data-testid="approver-inbox-deny"]'));
    expect(approve.nativeElement.getAttribute("aria-disabled")).toBe("true");
    expect(deny.nativeElement.getAttribute("aria-disabled")).toBe("true");
  });

  it("renders the alternate empty state when hasManagerCollections is false", async () => {
    pamApiService.listInboxRequests.mockResolvedValue([]);
    fixture.componentRef.setInput("hasManagerCollections", false);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // Both copies live in the template; assert the not-approver title is
    // present by checking the rendered text.
    const text = (fixture.nativeElement as HTMLElement).textContent ?? "";
    expect(text).toContain("pamInboxNotApproverTitle");
  });

  it("uses canApprove() — different requester id, current user can decide", async () => {
    const other = row({ id: "other", requesterId: "someone-else" });
    pamApiService.listInboxRequests.mockResolvedValue([other]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const approve = fixture.debugElement.query(By.css('[data-testid="approver-inbox-approve"]'));
    expect(approve.nativeElement.disabled).toBe(false);
  });

  // A produced lease whose window is still open but whose status is no longer "active" (e.g. the
  // requester ended it from the cipher banner). The Revoke button must not appear, since revoking it
  // would 409 server-side.
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
      ProducedLeaseId: "lease-1",
      ProducedLeaseStatus: producedLeaseStatus,
    });
  }

  it("shows the Revoke button for an active lease", async () => {
    pamApiService.listInboxHistory.mockResolvedValue([leaseHistoryRow("active")]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const revoke = fixture.debugElement.query(By.css('[data-testid="approver-inbox-revoke"]'));
    expect(revoke).not.toBeNull();
  });

  it("hides the Revoke button for a revoked lease still inside its window", async () => {
    pamApiService.listInboxHistory.mockResolvedValue([leaseHistoryRow("revoked")]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const revoke = fixture.debugElement.query(By.css('[data-testid="approver-inbox-revoke"]'));
    expect(revoke).toBeNull();
  });

  it("reloads the inbox when a RefreshApproverInbox push arrives", async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    pamApiService.listInboxHistory.mockClear();

    notifications$.next([{ type: NotificationType.RefreshApproverInbox }, CURRENT_USER]);
    // Clear the debounceTime(300) window, then let the async reload settle.
    await new Promise((resolve) => setTimeout(resolve, 350));
    await fixture.whenStable();

    expect(pamApiService.listInboxHistory).toHaveBeenCalled();
  });
});

describe("history bucketing and labels (deferred lease minting)", () => {
  const now = new Date("2026-06-10T12:00:00Z");
  const earlier = "2026-06-10T11:00:00Z";
  const later = "2026-06-10T13:00:00Z";
  const muchLater = "2026-06-10T14:00:00Z";

  function historyRow(
    overrides: Partial<{
      status: string;
      producedLeaseId: string | null;
      producedLeaseStatus: AccessLeaseStatus | null;
      requestedNotBefore: string | null;
      requestedNotAfter: string | null;
    }> = {},
  ): AccessRequestDetailsResponse {
    const producedLeaseId = overrides.producedLeaseId ?? null;
    return new AccessRequestDetailsResponse({
      Id: "req-1",
      CipherId: "cipher-1",
      CollectionId: "col-1",
      RequesterId: "user-2",
      Status: overrides.status ?? "approved",
      RequestedNotBefore: overrides.requestedNotBefore ?? earlier,
      RequestedNotAfter: overrides.requestedNotAfter ?? later,
      RequestedTtlSeconds: 3600,
      SubmittedAt: "2026-06-10T10:00:00Z",
      ProducedLeaseId: producedLeaseId,
      // A minted lease defaults to "active"; tests that exercise an ended lease override this.
      ProducedLeaseStatus:
        overrides.producedLeaseStatus ?? (producedLeaseId != null ? "active" : null),
    });
  }

  const bucketOf = (item: AccessRequestDetailsResponse) => {
    const groups = groupHistory([item], now);
    return groups.length > 0 ? groups[0].bucket : null;
  };

  it("buckets an activated request with a live window as Active", () => {
    const item = historyRow({ status: "activated", producedLeaseId: "lease-1" });
    expect(bucketOf(item)).toBe("active");
  });

  it("buckets an activated request with a lapsed window as Past (no Revoke on unusable access)", () => {
    const item = historyRow({
      status: "activated",
      producedLeaseId: "lease-1",
      requestedNotBefore: "2026-06-10T09:00:00Z",
      requestedNotAfter: "2026-06-10T10:00:00Z",
    });
    expect(bucketOf(item)).toBe("past");
  });

  it("buckets a revoked lease with a live window as Past, never Active", () => {
    // The request stays "activated" forever, but the lease has ended — it must not look active.
    const item = historyRow({
      status: "activated",
      producedLeaseId: "lease-1",
      producedLeaseStatus: "revoked",
    });
    expect(bucketOf(item)).toBe("past");
  });

  it("buckets an expired lease as Past", () => {
    const item = historyRow({
      status: "activated",
      producedLeaseId: "lease-1",
      producedLeaseStatus: "expired",
    });
    expect(bucketOf(item)).toBe("past");
  });

  it("never buckets an approved-but-not-started request as Active, even with a live window", () => {
    // No lease exists, so the grant is not access yet — it belongs with Upcoming.
    const item = historyRow({ status: "approved", producedLeaseId: null });
    expect(bucketOf(item)).toBe("future");
  });

  it("buckets an approved-but-not-started request with a future window as Upcoming", () => {
    const item = historyRow({
      status: "approved",
      producedLeaseId: null,
      requestedNotBefore: later,
      requestedNotAfter: muchLater,
    });
    expect(bucketOf(item)).toBe("future");
  });

  it("buckets an approved request whose window lapsed unstarted as Past", () => {
    const item = historyRow({
      status: "approved",
      producedLeaseId: null,
      requestedNotBefore: "2026-06-10T09:00:00Z",
      requestedNotAfter: "2026-06-10T10:00:00Z",
    });
    expect(bucketOf(item)).toBe("past");
  });

  it("buckets denied requests as Past regardless of window", () => {
    const item = historyRow({ status: "denied" });
    expect(bucketOf(item)).toBe("past");
  });

  it("labels an awaiting-start row 'Approved · not started', not 'Upcoming'", () => {
    const item = historyRow({ status: "approved", producedLeaseId: null });
    expect(historyStatusLabelFor("future", item)).toBe("pamInboxHistoryStatusAwaitingStart");
  });

  it("labels a revoked lease 'Revoked', not by the request status", () => {
    const item = historyRow({
      status: "activated",
      producedLeaseId: "lease-1",
      producedLeaseStatus: "revoked",
    });
    expect(historyStatusLabelFor("past", item)).toBe("pamInboxHistoryStatusRevoked");
  });

  it("labels a scheduled minted lease 'Upcoming'", () => {
    const item = historyRow({
      status: "activated",
      producedLeaseId: "lease-1",
      requestedNotBefore: later,
      requestedNotAfter: muchLater,
    });
    expect(historyStatusLabelFor("future", item)).toBe("pamInboxHistoryGroupFuture");
  });

  it("shows how long an open-window approval stays startable", () => {
    const item = historyRow({ status: "approved", producedLeaseId: null });
    expect(historyRelTimeFor(item, "future", now)).toEqual({
      key: "pamInboxHistoryStartableFor",
      value: "1h",
    });
  });

  it("shows when a future-window approval becomes startable", () => {
    const item = historyRow({
      status: "approved",
      producedLeaseId: null,
      requestedNotBefore: later,
      requestedNotAfter: muchLater,
    });
    expect(historyRelTimeFor(item, "future", now)).toEqual({
      key: "pamInboxHistoryStartsIn",
      value: "1h",
    });
  });
});
