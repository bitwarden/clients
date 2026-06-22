import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nMockService } from "@bitwarden/components";
import { AccessRequestDetailsResponse } from "@bitwarden/pam";

import { AuditLogComponent } from "./audit-log.component";

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
});

describe("AuditLogComponent", () => {
  const create = (
    items: AccessRequestDetailsResponse[],
    managedIds: Set<string>,
  ): ComponentFixture<AuditLogComponent> => {
    const fixture = TestBed.createComponent(AuditLogComponent);
    fixture.componentRef.setInput("items", items);
    fixture.componentRef.setInput("managedIds", managedIds);
    fixture.componentRef.setInput("now", new Date("2026-06-10T12:00:00Z"));
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuditLogComponent, NoopAnimationsModule],
      providers: [{ provide: I18nService, useValue: i18n }],
    }).compileComponents();
  });

  it("renders the empty state when there are no items", () => {
    const fixture = create([], new Set());
    expect(fixture.debugElement.query(By.css('[data-testid="audit-log-empty"]'))).not.toBeNull();
  });

  it("renders a row per item", () => {
    const fixture = create([activatedLease("a"), activatedLease("b")], new Set(["a", "b"]));
    expect(fixture.debugElement.queryAll(By.css('[data-testid="audit-log-row"]')).length).toBe(2);
  });

  it("offers Revoke on an active lease the viewer manages", () => {
    const fixture = create([activatedLease("a")], new Set(["a"]));
    expect(
      fixture.debugElement.query(By.css('[data-testid="approver-inbox-revoke"]')),
    ).not.toBeNull();
  });

  it("hides Revoke on a row the viewer can only see (not managed)", () => {
    const fixture = create([activatedLease("a")], new Set());
    expect(fixture.debugElement.query(By.css('[data-testid="approver-inbox-revoke"]'))).toBeNull();
  });

  it("emits revoke with the item when the button is clicked", () => {
    const fixture = create([activatedLease("a")], new Set(["a"]));
    const emitted: AccessRequestDetailsResponse[] = [];
    fixture.componentInstance.revoke.subscribe((i) => emitted.push(i));

    fixture.debugElement
      .query(By.css('[data-testid="approver-inbox-revoke"]'))
      .nativeElement.click();

    expect(emitted.map((i) => i.id)).toEqual(["a"]);
  });

  it("filters to the Past bucket (hiding an active row)", () => {
    const fixture = create([activatedLease("a")], new Set(["a"]));
    fixture.componentInstance["filter"].set("past");
    fixture.detectChanges();

    expect(fixture.debugElement.queryAll(By.css('[data-testid="audit-log-row"]')).length).toBe(0);
  });
});
