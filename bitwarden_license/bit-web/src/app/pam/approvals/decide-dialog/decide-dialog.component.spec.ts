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
    expect(summary.textContent).toContain("Grace");
    expect(summary.textContent).toContain("prod incident");
    expect(summary.textContent).toContain("Production");
  });

  it("says so explicitly when the request carried no reason", async () => {
    await create("approve", approvalRow({ reason: undefined }));

    expect(fixture.nativeElement.textContent).toContain("pamInboxReasonMissing");
  });

  it("closes with the trimmed comment on confirm", async () => {
    await create();
    component["formGroup"].patchValue({ comment: "  looks fine  " });

    await component["confirm"]();

    expect(close).toHaveBeenCalledWith({ confirmed: true, comment: "looks fine" });
  });

  it("treats a blank comment as absent rather than writing whitespace to the audit log", async () => {
    await create();
    component["formGroup"].patchValue({ comment: "   " });

    await component["confirm"]();

    expect(close).toHaveBeenCalledWith({ confirmed: true, comment: undefined });
  });

  it("confirms with no comment at all — it is optional on both verdicts", async () => {
    await create("deny");

    await component["confirm"]();

    expect(close).toHaveBeenCalledWith({ confirmed: true, comment: undefined });
  });

  it("never calls an API itself; the caller records the decision", async () => {
    // Keeps retry-and-toast in one place rather than split across the dialog and its opener.
    await create();

    await component["confirm"]();

    expect(close).toHaveBeenCalledTimes(1);
  });
});
