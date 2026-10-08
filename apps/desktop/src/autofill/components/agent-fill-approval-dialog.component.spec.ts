import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { DIALOG_DATA, DialogRef } from "@bitwarden/components";

import { AgentFillDenyReason } from "../models/agent-fill-approval";
import {
  AgentFillUserVerificationService,
  AgentFillVerificationResult,
} from "../services/agent-fill-user-verification.service";

import {
  AgentFillApprovalDialogComponent,
  AgentFillApprovalDialogParams,
} from "./agent-fill-approval-dialog.component";

describe("AgentFillApprovalDialogComponent", () => {
  let fixture: ComponentFixture<AgentFillApprovalDialogComponent>;
  const dialogRef = mock<DialogRef>();
  const verificationService = mock<AgentFillUserVerificationService>();

  const params = (items: number, cipherType = CipherType.Login): AgentFillApprovalDialogParams => ({
    request: {
      requestId: "a1",
      connectionName: "Claude Desktop",
      domain: "www.delta.com",
      tabUrl: "https://www.delta.com/login",
      browser: "Chrome",
      cipherType: cipherType as any,
    },
    items: Array.from({ length: items }, (_, i) => ({
      id: `c${i + 1}`,
      name: `Item ${i + 1}`,
      subtitle: `user${i + 1}@example.com`,
    })),
  });

  async function create(data: AgentFillApprovalDialogParams) {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [AgentFillApprovalDialogComponent],
      providers: [
        { provide: DIALOG_DATA, useValue: data },
        { provide: DialogRef, useValue: dialogRef },
        { provide: AgentFillUserVerificationService, useValue: verificationService },
        {
          provide: I18nService,
          useValue: { t: (key: string, ...a: string[]) => [key, ...a].join("|") },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AgentFillApprovalDialogComponent);
    fixture.detectChanges();
  }

  const text = () => fixture.nativeElement.textContent as string;
  const click = async (id: string) => {
    fixture.debugElement.query(By.css(`#${id}`)).nativeElement.click();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeAll(() => {
    // bit-dialog observes its scroll area, which jsdom does not implement.
    global.IntersectionObserver = class {
      observe = jest.fn();
      unobserve = jest.fn();
      disconnect = jest.fn();
    } as unknown as typeof IntersectionObserver;
  });

  beforeEach(() => jest.resetAllMocks());

  it("names the connection, the real domain and the browser", async () => {
    await create(params(1));

    expect(text()).toContain("agentFillApprovalLoginMessage|Claude Desktop|www.delta.com|Chrome");
  });

  it("uses the card wording for a card request", async () => {
    await create(params(1, CipherType.Card));

    expect(text()).toContain("agentFillApprovalCardMessage");
  });

  it("selects a single match automatically and shows no picker", async () => {
    await create(params(1));

    expect(text()).toContain("Item 1");
    expect(text()).toContain("user1@example.com");
    expect(text()).not.toContain("agentFillChooseItem");
  });

  it("shows a picker when two or more items match", async () => {
    await create(params(2));

    expect(text()).toContain("agentFillChooseItem");
    expect(text()).toContain("Item 1");
    expect(text()).toContain("Item 2");
  });

  it("approves the chosen item once Touch ID verifies the user", async () => {
    verificationService.verify.mockResolvedValue(AgentFillVerificationResult.Verified);
    await create(params(2));

    await click("agent-fill-approval_button_approve");

    expect(verificationService.verify).toHaveBeenCalledWith(undefined);
    expect(dialogRef.close).toHaveBeenCalledWith({ decision: "approved", cipherId: "c1" });
  });

  it("stays open and asks for the master password when Touch ID does not verify", async () => {
    verificationService.verify.mockResolvedValue(AgentFillVerificationResult.NeedsMasterPassword);
    await create(params(1));

    await click("agent-fill-approval_button_approve");

    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(
      fixture.debugElement.query(By.css("#agent-fill-approval_input_master-password")),
    ).not.toBeNull();
  });

  it("approves after a correct master password and stays open after a wrong one", async () => {
    verificationService.verify.mockResolvedValueOnce(
      AgentFillVerificationResult.NeedsMasterPassword,
    );
    await create(params(1));
    await click("agent-fill-approval_button_approve");

    (fixture.componentInstance as any).form.patchValue({ masterPassword: "wrong" });
    verificationService.verify.mockResolvedValueOnce(AgentFillVerificationResult.Failed);
    await click("agent-fill-approval_button_approve");
    expect(verificationService.verify).toHaveBeenLastCalledWith("wrong");
    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(text()).toContain("invalidMasterPassword");

    (fixture.componentInstance as any).form.patchValue({ masterPassword: "right" });
    verificationService.verify.mockResolvedValueOnce(AgentFillVerificationResult.Verified);
    await click("agent-fill-approval_button_approve");
    expect(dialogRef.close).toHaveBeenCalledWith({ decision: "approved", cipherId: "c1" });
  });

  it("refuses Approve when neither Touch ID nor a master password can verify", async () => {
    verificationService.verify.mockResolvedValue(AgentFillVerificationResult.Unavailable);
    await create(params(1));
    await click("agent-fill-approval_button_approve");

    expect(text()).toContain("agentFillCannotVerify");
    expect(
      fixture.debugElement
        .query(By.css("#agent-fill-approval_button_approve"))
        .nativeElement.getAttribute("aria-disabled"),
    ).toBe("true");
    verificationService.verify.mockClear();
    await (fixture.componentInstance as any).approve();
    expect(verificationService.verify).not.toHaveBeenCalled();
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it("denies without a reason by default, without asking for verification", async () => {
    await create(params(1));

    await click("agent-fill-approval_button_deny");

    expect(verificationService.verify).not.toHaveBeenCalled();
    expect(dialogRef.close).toHaveBeenCalledWith({ decision: "denied", reason: undefined });
  });

  it.each([
    ["agent-fill-approval_radio_wrong-account", AgentFillDenyReason.WrongAccount],
    ["agent-fill-approval_radio_not-requested", AgentFillDenyReason.NotRequested],
  ])("denies with the reason chosen in %s", async (radioId, reason) => {
    await create(params(1));
    (fixture.componentInstance as any).form.patchValue({ denyReason: reason });

    await click("agent-fill-approval_button_deny");

    expect(dialogRef.close).toHaveBeenCalledWith({ decision: "denied", reason });
    expect(fixture.debugElement.query(By.css(`#${radioId}`))).not.toBeNull();
  });
});
