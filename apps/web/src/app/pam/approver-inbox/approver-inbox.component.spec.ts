import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ToastService } from "@bitwarden/components";
import { InboxLeaseRequestResponse, LeaseRequestResponse, PamApiService } from "@bitwarden/pam";

import { ApproverInboxBadgeService } from "./approver-inbox-badge.service";
import { ApproverInboxComponent } from "./approver-inbox.component";

const CURRENT_USER = "user-current";

function row(
  overrides: Partial<{
    id: string;
    requesterUserId: string;
    submittedAt: string;
    collectionName: string;
  }> = {},
): InboxLeaseRequestResponse {
  return new InboxLeaseRequestResponse({
    Id: overrides.id ?? "req-1",
    CipherId: "cipher-1",
    CollectionId: "col-1",
    RequesterUserId: overrides.requesterUserId ?? "user-2",
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

  beforeEach(async () => {
    pamApiService = mock<PamApiService>();
    toastService = mock<ToastService>();
    badgeService = mock<ApproverInboxBadgeService>();

    pamApiService.listInboxRequests.mockResolvedValue([]);

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

    await TestBed.configureTestingModule({
      imports: [ApproverInboxComponent],
      providers: [
        { provide: PamApiService, useValue: pamApiService },
        { provide: AccountService, useValue: accountService },
        { provide: ToastService, useValue: toastService },
        { provide: I18nService, useValue: i18nService },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: ApproverInboxBadgeService, useValue: badgeService },
      ],
    }).compileComponents();

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

  it("calls submitDecision exactly once per approval click", async () => {
    const target = row({ id: "target", requesterUserId: "someone-else" });
    pamApiService.listInboxRequests.mockResolvedValue([target]);
    pamApiService.submitDecision.mockResolvedValue(
      new LeaseRequestResponse({ Id: "target", Status: "approved" }),
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

    expect(pamApiService.submitDecision).toHaveBeenCalledTimes(1);
    expect(pamApiService.submitDecision).toHaveBeenCalledWith(
      "target",
      expect.objectContaining({ decision: "approve" }),
    );
  });

  it("rolls back and toasts when the decision API fails", async () => {
    const target = row({ id: "target", requesterUserId: "someone-else" });
    pamApiService.listInboxRequests.mockResolvedValue([target]);
    pamApiService.submitDecision.mockRejectedValue(new Error("boom"));

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
    const self = row({ id: "self", requesterUserId: CURRENT_USER });
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
    const other = row({ id: "other", requesterUserId: "someone-else" });
    pamApiService.listInboxRequests.mockResolvedValue([other]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const approve = fixture.debugElement.query(By.css('[data-testid="approver-inbox-approve"]'));
    expect(approve.nativeElement.disabled).toBe(false);
  });
});
