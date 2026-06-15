import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { provideRouter } from "@angular/router";
import { of } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService, I18nMockService } from "@bitwarden/components";
import { AccessRequestDetailsResponse } from "@bitwarden/pam";

import { ApprovalsComponent, DecideEvent } from "./approvals.component";

const ME = "user-me";

function request(
  overrides: Partial<{
    id: string;
    requesterId: string;
    cipherName: string;
    collectionName: string;
    requesterName: string;
    submittedAt: string;
  }> = {},
): AccessRequestDetailsResponse {
  return new AccessRequestDetailsResponse({
    Id: overrides.id ?? "req-1",
    CipherId: "cipher-" + (overrides.id ?? "req-1"),
    CollectionId: "col-1",
    RequesterId: overrides.requesterId ?? "user-other",
    Status: "pending",
    RequestedTtlSeconds: 3600,
    SubmittedAt: overrides.submittedAt ?? "2026-06-10T10:00:00Z",
    Reason: "Need access",
    CipherName: overrides.cipherName ?? "Prod DB",
    CollectionName: overrides.collectionName ?? "Production",
    RequesterName: overrides.requesterName ?? "Bob",
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
});

describe("ApprovalsComponent", () => {
  let dialogService: { open: jest.Mock };

  const create = (
    requests: AccessRequestDetailsResponse[],
    currentUserId: string | null = ME,
  ): ComponentFixture<ApprovalsComponent> => {
    const fixture = TestBed.createComponent(ApprovalsComponent);
    fixture.componentRef.setInput("requests", requests);
    fixture.componentRef.setInput("currentUserId", currentUserId);
    fixture.componentRef.setInput("now", new Date("2026-06-10T12:00:00Z"));
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(async () => {
    dialogService = { open: jest.fn().mockReturnValue({ closed: of(undefined) }) };
    await TestBed.configureTestingModule({
      imports: [ApprovalsComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: I18nService, useValue: i18n },
        { provide: DialogService, useValue: dialogService },
      ],
    }).compileComponents();
  });

  it("renders the empty state when there are no requests", () => {
    const fixture = create([]);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? "";
    expect(text).toContain("Inbox zero");
  });

  it("renders one row per request", () => {
    const fixture = create([request({ id: "a" }), request({ id: "b" })]);
    expect(fixture.debugElement.queryAll(By.css('[data-testid="approvals-row"]')).length).toBe(2);
  });

  it("does not act on the current user's own request (self-approval guard)", async () => {
    const fixture = create([request({ id: "self", requesterId: ME })]);
    fixture.debugElement
      .query(By.css('[data-testid="approver-inbox-approve"]'))
      .nativeElement.click();
    await fixture.whenStable();

    // The guard short-circuits before opening the confirm dialog.
    expect(dialogService.open).not.toHaveBeenCalled();
  });

  it("enables approve/deny for another user's request", () => {
    const fixture = create([request({ id: "other", requesterId: "user-other" })]);
    const approve = fixture.debugElement.query(By.css('[data-testid="approver-inbox-approve"]'));
    expect(approve.nativeElement.disabled).toBe(false);
  });

  it("opens the confirm dialog and emits the decision with the captured comment", async () => {
    dialogService.open.mockReturnValue({ closed: of({ confirmed: true, comment: "ok" }) });
    const fixture = create([request({ id: "other", requesterId: "user-other" })]);
    const events: DecideEvent[] = [];
    fixture.componentInstance.decide.subscribe((e) => events.push(e));

    fixture.debugElement
      .query(By.css('[data-testid="approver-inbox-approve"]'))
      .nativeElement.click();
    await fixture.whenStable();

    expect(dialogService.open).toHaveBeenCalledTimes(1);
    expect(events).toEqual([expect.objectContaining({ verdict: "approve", comment: "ok" })]);
    expect(events[0].request.id).toBe("other");
  });

  it("does not emit when the dialog is cancelled", async () => {
    dialogService.open.mockReturnValue({ closed: of(undefined) });
    const fixture = create([request({ id: "other", requesterId: "user-other" })]);
    const events: DecideEvent[] = [];
    fixture.componentInstance.decide.subscribe((e) => events.push(e));

    fixture.debugElement.query(By.css('[data-testid="approver-inbox-deny"]')).nativeElement.click();
    await fixture.whenStable();

    expect(events).toEqual([]);
  });

  it("filters rows by the search box", () => {
    const fixture = create([
      request({ id: "a", cipherName: "Prod DB" }),
      request({ id: "b", cipherName: "Staging key" }),
    ]);
    fixture.componentInstance["searchControl"].setValue("staging");
    fixture.detectChanges();
    fixture.detectChanges();

    const rows = fixture.debugElement.queryAll(By.css('[data-testid="approvals-row"]'));
    expect(rows.length).toBe(1);
    expect((rows[0].nativeElement as HTMLElement).textContent).toContain("Staging key");
  });
});
