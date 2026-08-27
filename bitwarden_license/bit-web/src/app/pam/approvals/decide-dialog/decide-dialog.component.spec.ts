import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DIALOG_DATA, DialogRef } from "@bitwarden/components";

import type { AccessDecisionVerdict, AccessRequestView } from "../../abstractions/access-lease";
import { emptyResolvedNames } from "../../access-requests/access-name-resolver.service";
import { ApprovalRow, toApprovalRow } from "../approval-row";

import { DecideDialogComponent, DecideDialogParams } from "./decide-dialog.component";

const NOW = new Date("2026-08-17T12:00:00.000Z");

function approvalRow(overrides: Record<string, unknown> = {}): ApprovalRow {
  const request = {
    id: "req-1",
    cipherId: "cipher-1",
    collectionId: "col-1",
    organizationId: "org-1",
    requesterId: "user-1",
    status: "pending",
    leaseNotBefore: "2026-08-17T12:00:00.000Z",
    leaseNotAfter: "2026-08-17T13:00:00.000Z",
    reason: "prod incident",
    submittedAt: "2026-08-17T11:30:00.000Z",
    decisions: [],
    requesterName: "Grace",
    requesterEmail: "grace@example.com",
    ...overrides,
  } as unknown as AccessRequestView;
  return toApprovalRow(
    request,
    {
      ...emptyResolvedNames(),
      cipherNameById: new Map([["cipher-1", "Prod database"]]),
      collectionNameById: new Map([["col-1", "Production"]]),
      organizationNameById: new Map([["org-1", "Meridian Group"]]),
    },
    NOW,
    true,
  );
}

describe("DecideDialogComponent", () => {
  let fixture: ComponentFixture<DecideDialogComponent>;
  let component: DecideDialogComponent;
  const close = jest.fn();

  async function create(
    verdict: AccessDecisionVerdict = "approve",
    row = approvalRow(),
  ): Promise<void> {
    const params: DecideDialogParams = { verdict, row };
    await TestBed.configureTestingModule({
      imports: [DecideDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: DIALOG_DATA, useValue: params },
        { provide: DialogRef, useValue: { close } },
        {
          provide: I18nService,
          useValue: { t: (key: string, ...args: unknown[]) => [key, ...args].join(" ") },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DecideDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  /** Read-only fields render their value on the input, not as element text. */
  function fieldValue(id: string): string {
    return (fixture.nativeElement.querySelector(`#${id}`) as HTMLInputElement).value;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    TestBed.resetTestingModule();
  });

  it("titles itself by the verdict being confirmed", async () => {
    await create("approve");
    expect(fixture.nativeElement.textContent).toContain("pamDecideApproveTitle");

    TestBed.resetTestingModule();
    await create("deny");
    expect(fixture.nativeElement.textContent).toContain("pamDecideDenyTitle");
  });

  it("repeats what is being decided, so the approver is not relying on memory", async () => {
    await create();

    const summary = fixture.nativeElement.querySelector('[data-testid="decide-dialog-summary"]');
    expect(summary.textContent).toContain("Prod database");
    expect(summary.textContent).toContain("Meridian Group");
    expect(summary.textContent).toContain("Production");
    expect(summary.textContent).toContain("Grace");
    expect(summary.textContent).toContain("grace@example.com");
    expect(fieldValue("pam-request-summary_input_reason")).toContain("prod incident");
    expect(fieldValue("pam-request-summary_input_access-requested")).toContain(
      "pamInboxDuration1Hour",
    );
  });

  it("renders nothing for an organization that did not resolve", async () => {
    await create("approve", approvalRow({ organizationId: undefined }));

    const summary = fixture.nativeElement.querySelector('[data-testid="decide-dialog-summary"]');
    expect(summary.textContent).not.toContain("Meridian Group");
    expect(summary.textContent).not.toContain("org-1");
  });

  it("says so explicitly when the request carried no reason", async () => {
    await create("approve", approvalRow({ reason: undefined }));

    const reason = fixture.nativeElement.querySelector(
      "#pam-request-summary_input_reason",
    ) as HTMLInputElement;
    expect(reason.value).toBe("");
    expect(reason.placeholder).toContain("pamInboxReasonMissing");
  });

  it("closes with the trimmed comment and the verdict on confirm", async () => {
    await create();
    component["formGroup"].patchValue({ comment: "  looks fine  " });

    await component["confirm"]();

    expect(close).toHaveBeenCalledWith({
      confirmed: true,
      verdict: "approve",
      comment: "looks fine",
    });
  });

  it("treats a blank comment as absent rather than writing whitespace to the audit log", async () => {
    await create();
    component["formGroup"].patchValue({ comment: "   " });

    await component["confirm"]();

    expect(close).toHaveBeenCalledWith({
      confirmed: true,
      verdict: "approve",
      comment: undefined,
    });
  });

  it("confirms with no comment at all when approving — it stays optional", async () => {
    await create("approve");

    await component["confirm"]();

    expect(close).toHaveBeenCalledWith({
      confirmed: true,
      verdict: "approve",
      comment: undefined,
    });
  });

  it("never calls an API itself; the caller records the decision", async () => {
    // Keeps retry-and-toast in one place rather than split across the dialog and its opener.
    await create();

    await component["confirm"]();

    expect(close).toHaveBeenCalledTimes(1);
  });

  describe("denying", () => {
    it("will not confirm until a reason is given", async () => {
      await create("deny");
      expect(component["confirmDisabled"]()).toBe(true);

      await component["confirm"]();
      expect(close).not.toHaveBeenCalled();

      component["formGroup"].patchValue({ comment: "no longer needed" });
      expect(component["confirmDisabled"]()).toBe(false);

      await component["confirm"]();
      expect(close).toHaveBeenCalledWith({
        confirmed: true,
        verdict: "deny",
        comment: "no longer needed",
      });
    });

    it("shows the confirm button as disabled while no reason has been given", async () => {
      await create("deny");

      const confirm = fixture.nativeElement.querySelector("#pam-decide-dialog_button_confirm");
      expect(confirm.getAttribute("aria-disabled")).toBe("true");

      component["formGroup"].patchValue({ comment: "no longer needed" });
      fixture.detectChanges();

      expect(confirm.getAttribute("aria-disabled")).not.toBe("true");
    });

    it("treats a whitespace-only reason as no reason", async () => {
      // `Validators.required` accepts "   ", so the trimmed value is what actually gates the button.
      await create("deny");
      component["formGroup"].patchValue({ comment: "   " });

      expect(component["confirmDisabled"]()).toBe(true);

      await component["confirm"]();
      expect(close).not.toHaveBeenCalled();
    });
  });

  describe("switching the approve variant to deny", () => {
    it("re-titles and re-labels the dialog in place", async () => {
      await create("approve");

      component["switchToDeny"]();
      fixture.detectChanges();

      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain("pamDecideDenyTitle");
      expect(text).not.toContain("pamDecideApproveTitle");
      expect(text).toContain("pamDecideDenyReasonLabel");
      expect(text).toContain("pamDecideDenyReasonRequired");
      expect(text).not.toContain("pamInboxCommentLabel");
    });

    it("applies the deny variant's required reason", async () => {
      await create("approve");
      expect(component["confirmDisabled"]()).toBe(false);

      component["switchToDeny"]();

      expect(component["confirmDisabled"]()).toBe(true);
      expect(component["formGroup"].controls.comment.invalid).toBe(true);
    });

    it("moves focus onto the reason field, which the removed button would otherwise strand", async () => {
      await create("approve");

      const switchButton = fixture.nativeElement.querySelector(
        "#pam-decide-dialog_button_switch-to-deny",
      ) as HTMLButtonElement;
      switchButton.click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector("#pam-decide-dialog_button_switch-to-deny")).toBe(
        null,
      );
      expect(document.activeElement?.id).toBe("pam-decide-dialog_textarea_comment");
    });

    it("closes with deny, not the verdict it was opened on", async () => {
      await create("approve");

      component["switchToDeny"]();
      component["formGroup"].patchValue({ comment: "wrong window" });
      await component["confirm"]();

      expect(close).toHaveBeenCalledWith({
        confirmed: true,
        verdict: "deny",
        comment: "wrong window",
      });
    });
  });
});
