import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { Router } from "@angular/router";
import { RouterTestingModule } from "@angular/router/testing";
import { mock, MockProxy } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ToastService } from "@bitwarden/components";
import { InboxLeaseRequestResponse, LeaseRequestResponse, PamApiService } from "@bitwarden/pam";

import { EmailApprovalComponent } from "./email-approval.component";

const CURRENT_USER = "user-approver";
const REQUESTER_USER = "user-requester";

function makeRequest(
  overrides: Partial<{ requesterUserId: string; reason: string | null }> = {},
): InboxLeaseRequestResponse {
  return new InboxLeaseRequestResponse({
    Id: "req-1",
    CipherId: "cipher-1",
    CollectionId: "col-1",
    RequesterUserId: overrides.requesterUserId ?? REQUESTER_USER,
    Status: "pending",
    RequestedTtlSeconds: 3600,
    SubmittedAt: "2026-05-15T12:00:00Z",
    RequestedNotBefore: null,
    RequestedNotAfter: null,
    Reason: overrides.reason ?? "Need access for incident response",
    CipherName: "Prod DB admin",
    CollectionName: "Production",
    RequesterName: "Bob Engineer",
    RequesterEmail: "bob@example.com",
  });
}

describe("EmailApprovalComponent", () => {
  let fixture: ComponentFixture<EmailApprovalComponent>;
  let pamApiService: MockProxy<PamApiService>;
  let toastService: MockProxy<ToastService>;
  let i18nService: MockProxy<I18nService>;
  let router: Router;

  beforeEach(async () => {
    pamApiService = mock<PamApiService>();
    toastService = mock<ToastService>();
    i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => key);

    await TestBed.configureTestingModule({
      imports: [EmailApprovalComponent, RouterTestingModule],
      providers: [
        { provide: PamApiService, useValue: pamApiService },
        { provide: ToastService, useValue: toastService },
        { provide: I18nService, useValue: i18nService },
        { provide: LogService, useValue: mock<LogService>() },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    jest.spyOn(router, "navigate").mockResolvedValue(true);

    fixture = TestBed.createComponent(EmailApprovalComponent);
    fixture.componentRef.setInput("request", makeRequest());
    fixture.componentRef.setInput("currentUserId", CURRENT_USER);
  });

  it("renders the locked-vault banner", () => {
    fixture.detectChanges();

    const banner = fixture.debugElement.query(By.css('[data-testid="email-approval-locked-banner"]'));
    expect(banner).not.toBeNull();
  });

  it("renders the cipher name, collection, requester and reason from the request", () => {
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? "";
    expect(text).toContain("Prod DB admin");
    expect(text).toContain("Production");
    expect(text).toContain("Bob Engineer");
    expect(text).toContain("Need access for incident response");
  });

  it("shows Approve and Deny buttons in idle state", () => {
    fixture.detectChanges();

    expect(
      fixture.debugElement.query(By.css('[data-testid="email-approval-approve"]')),
    ).not.toBeNull();
    expect(
      fixture.debugElement.query(By.css('[data-testid="email-approval-deny"]')),
    ).not.toBeNull();
  });

  it("disables both buttons when the current user is the requester", () => {
    fixture.componentRef.setInput("request", makeRequest({ requesterUserId: CURRENT_USER }));
    fixture.detectChanges();

    const approve = fixture.debugElement.query(By.css('[data-testid="email-approval-approve"]'));
    const deny = fixture.debugElement.query(By.css('[data-testid="email-approval-deny"]'));
    expect((approve.nativeElement as HTMLButtonElement).disabled).toBe(true);
    expect((deny.nativeElement as HTMLButtonElement).disabled).toBe(true);
  });

  it("transitions to the confirm prompt when Approve is clicked", () => {
    fixture.detectChanges();

    fixture.debugElement
      .query(By.css('[data-testid="email-approval-approve"]'))
      .nativeElement.click();
    fixture.detectChanges();

    expect(
      fixture.debugElement.query(By.css('[data-testid="email-approval-confirm"]')),
    ).not.toBeNull();
    expect(
      fixture.debugElement.query(By.css('[data-testid="email-approval-cancel"]')),
    ).not.toBeNull();
  });

  it("returns to idle state when Cancel is clicked", () => {
    fixture.detectChanges();

    fixture.debugElement
      .query(By.css('[data-testid="email-approval-approve"]'))
      .nativeElement.click();
    fixture.detectChanges();

    fixture.debugElement
      .query(By.css('[data-testid="email-approval-cancel"]'))
      .nativeElement.click();
    fixture.detectChanges();

    expect(
      fixture.debugElement.query(By.css('[data-testid="email-approval-approve"]')),
    ).not.toBeNull();
    expect(
      fixture.debugElement.query(By.css('[data-testid="email-approval-confirm"]')),
    ).toBeNull();
  });

  it("calls submitDecision exactly once on approve confirm", async () => {
    pamApiService.submitDecision.mockResolvedValue(
      new LeaseRequestResponse({ Id: "req-1", Status: "approved" }),
    );
    fixture.detectChanges();

    fixture.debugElement
      .query(By.css('[data-testid="email-approval-approve"]'))
      .nativeElement.click();
    fixture.detectChanges();

    fixture.debugElement
      .query(By.css('[data-testid="email-approval-confirm"]'))
      .nativeElement.click();
    fixture.detectChanges();

    // Second click should be ignored by the submitting() guard
    fixture.debugElement
      .query(By.css('[data-testid="email-approval-confirm"]'))
      ?.nativeElement.click();

    await fixture.whenStable();

    expect(pamApiService.submitDecision).toHaveBeenCalledTimes(1);
    expect(pamApiService.submitDecision).toHaveBeenCalledWith(
      "req-1",
      expect.objectContaining({ decision: "approve" }),
    );
  });

  it("shows the confirmation screen after a successful approval", async () => {
    pamApiService.submitDecision.mockResolvedValue(
      new LeaseRequestResponse({ Id: "req-1", Status: "approved" }),
    );
    fixture.detectChanges();

    fixture.debugElement
      .query(By.css('[data-testid="email-approval-approve"]'))
      .nativeElement.click();
    fixture.detectChanges();

    fixture.debugElement
      .query(By.css('[data-testid="email-approval-confirm"]'))
      .nativeElement.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(
      fixture.debugElement.query(By.css('[data-testid="email-approval-confirmation"]')),
    ).not.toBeNull();
    expect(
      fixture.debugElement.query(By.css('[data-testid="email-approval-locked-banner"]')),
    ).not.toBeNull();
  });

  it("shows the confirmation screen after a successful deny", async () => {
    pamApiService.submitDecision.mockResolvedValue(
      new LeaseRequestResponse({ Id: "req-1", Status: "denied" }),
    );
    fixture.detectChanges();

    fixture.debugElement
      .query(By.css('[data-testid="email-approval-deny"]'))
      .nativeElement.click();
    fixture.detectChanges();

    fixture.debugElement
      .query(By.css('[data-testid="email-approval-confirm"]'))
      .nativeElement.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(
      fixture.debugElement.query(By.css('[data-testid="email-approval-confirmation"]')),
    ).not.toBeNull();
  });

  it("shows error toast and resets when the decision API fails", async () => {
    pamApiService.submitDecision.mockRejectedValue(new Error("network error"));
    fixture.detectChanges();

    fixture.debugElement
      .query(By.css('[data-testid="email-approval-approve"]'))
      .nativeElement.click();
    fixture.detectChanges();

    fixture.debugElement
      .query(By.css('[data-testid="email-approval-confirm"]'))
      .nativeElement.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(toastService.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "error" }),
    );
    expect(
      fixture.debugElement.query(By.css('[data-testid="email-approval-approve"]')),
    ).not.toBeNull();
  });

  it("navigateToInbox routes to /pam/approver-inbox", async () => {
    pamApiService.submitDecision.mockResolvedValue(
      new LeaseRequestResponse({ Id: "req-1", Status: "approved" }),
    );
    fixture.detectChanges();

    fixture.debugElement
      .query(By.css('[data-testid="email-approval-approve"]'))
      .nativeElement.click();
    fixture.detectChanges();

    fixture.debugElement
      .query(By.css('[data-testid="email-approval-confirm"]'))
      .nativeElement.click();
    await fixture.whenStable();
    fixture.detectChanges();

    fixture.debugElement
      .query(By.css('[data-testid="email-approval-inbox-link"]'))
      .nativeElement.click();

    expect(router.navigate).toHaveBeenCalledWith(["/pam/approver-inbox"]);
  });
});
