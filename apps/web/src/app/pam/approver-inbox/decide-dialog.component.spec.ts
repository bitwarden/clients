import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DIALOG_DATA, DialogRef, I18nMockService } from "@bitwarden/components";
import { AccessDecisionVerdict, AccessRequestDetailsResponse } from "@bitwarden/pam";

import { DecideDialogComponent } from "./decide-dialog.component";

function request(
  overrides: Partial<{
    cipherName: string;
    collectionName: string;
    requesterName: string;
    requesterEmail: string;
    reason: string;
  }> = {},
): AccessRequestDetailsResponse {
  return new AccessRequestDetailsResponse({
    Id: "req-1",
    CipherId: "cipher-1",
    CollectionId: "col-1",
    RequesterId: "user-2",
    Status: "pending",
    RequestedTtlSeconds: 3600,
    RequestedNotBefore: null,
    RequestedNotAfter: null,
    SubmittedAt: "2026-06-10T10:00:00Z",
    Reason: overrides.reason ?? "Migration testing window",
    CipherName: overrides.cipherName ?? "GCP Console",
    CollectionName: overrides.collectionName ?? "Infrastructure",
    RequesterName: overrides.requesterName ?? "Dani Goldberg",
    RequesterEmail: overrides.requesterEmail ?? "dani@example.com",
  });
}

const i18n = new I18nMockService({
  cancel: "Cancel",
  close: "Close",
  window: "Window",
  pamDecideApproveTitle: "Approve access request",
  pamDecideDenyTitle: "Deny access request",
  pamDecideCommentHint: "Optional · saved to the audit log",
  pamInboxApprove: "Approve",
  pamInboxDeny: "Deny",
  pamInboxRequester: "Requester",
  pamInboxReason: "Reason",
  pamInboxReasonMissing: "No reason",
  pamInboxInCollection: "in __$1__",
  pamInboxCommentLabel: "Comment",
  pamInboxCommentPlaceholder: "Add an optional comment",
  pamInboxDuration1Hour: "1 hour",
  pamInboxDurationHours: "__$1__ hours",
  pamInboxDurationMinutes: "__$1__ min",
  pamInboxStartAsap: "now",
  pamInboxStartToday: "today",
  pamInboxStartTomorrow: "tomorrow",
  pamInboxStartInDays: "in __$1__ days",
});

describe("DecideDialogComponent", () => {
  let dialogRef: { close: jest.Mock };

  const setup = (
    verdict: AccessDecisionVerdict,
    req: AccessRequestDetailsResponse = request(),
  ): ComponentFixture<DecideDialogComponent> => {
    dialogRef = { close: jest.fn() };
    TestBed.configureTestingModule({
      imports: [DecideDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: DIALOG_DATA, useValue: { verdict, request: req, now: new Date() } },
        { provide: DialogRef, useValue: dialogRef },
        { provide: I18nService, useValue: i18n },
      ],
    });
    const fixture = TestBed.createComponent(DecideDialogComponent);
    fixture.detectChanges();
    return fixture;
  };

  it("renders the request summary (item, requester, reason)", () => {
    const fixture = setup("approve");
    const text = (fixture.nativeElement as HTMLElement).textContent ?? "";
    expect(text).toContain("GCP Console");
    expect(text).toContain("in Infrastructure");
    expect(text).toContain("Dani Goldberg");
    expect(text).toContain("dani@example.com");
    expect(text).toContain("Migration testing window");
  });

  it("closes with a trimmed comment on confirm", () => {
    const fixture = setup("approve");
    const textarea = fixture.nativeElement.querySelector("textarea") as HTMLTextAreaElement;
    textarea.value = "  looks good  ";
    textarea.dispatchEvent(new Event("input"));
    fixture.detectChanges();

    (
      fixture.nativeElement.querySelector("#pam-decide-dialog_button_confirm") as HTMLButtonElement
    ).click();

    expect(dialogRef.close).toHaveBeenCalledWith({ confirmed: true, comment: "looks good" });
  });

  it("closes with an undefined comment when the textarea is blank", () => {
    const fixture = setup("approve");
    (
      fixture.nativeElement.querySelector("#pam-decide-dialog_button_confirm") as HTMLButtonElement
    ).click();

    expect(dialogRef.close).toHaveBeenCalledWith({ confirmed: true, comment: undefined });
  });

  it("closes with undefined (no result) on cancel", () => {
    const fixture = setup("deny");
    (
      fixture.nativeElement.querySelector("#pam-decide-dialog_button_cancel") as HTMLButtonElement
    ).click();

    expect(dialogRef.close).toHaveBeenCalledWith(undefined);
  });

  it("uses the deny title + button when denying", () => {
    const fixture = setup("deny");
    const text = (fixture.nativeElement as HTMLElement).textContent ?? "";
    expect(text).toContain("Deny access request");
    const confirm = fixture.nativeElement.querySelector(
      "#pam-decide-dialog_button_confirm",
    ) as HTMLButtonElement;
    expect(confirm.textContent).toContain("Deny");
  });
});
