import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { BehaviorSubject, of } from "rxjs";

import { PamConnectivityService } from "@bitwarden/bit-pam";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DIALOG_DATA, DialogRef, TooltipDirective } from "@bitwarden/components";

import {
  WithdrawApprovalDialogComponent,
  WithdrawApprovalDialogParams,
} from "./withdraw-approval-dialog.component";

describe("WithdrawApprovalDialogComponent", () => {
  let fixture: ComponentFixture<WithdrawApprovalDialogComponent>;
  let component: WithdrawApprovalDialogComponent;
  const close = jest.fn();

  const params: WithdrawApprovalDialogParams = {
    itemName: "Prod database",
    organizationName: "Meridian Group",
    collectionName: "Production",
    requesterName: "Grace Hopper",
  };

  async function create(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [WithdrawApprovalDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: DIALOG_DATA, useValue: params },
        { provide: DialogRef, useValue: { close } },
        { provide: ConfigService, useValue: { getFeatureFlag$: () => of(false) } },
        {
          provide: I18nService,
          useValue: { t: (key: string, ...args: unknown[]) => [key, ...args].join(" ") },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WithdrawApprovalDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function query(selector: string): HTMLElement {
    return fixture.nativeElement.querySelector(selector);
  }

  function typeReason(value: string): void {
    component["formGroup"].controls.reason.setValue(value);
    fixture.detectChanges();
  }

  beforeEach(() => {
    jest.clearAllMocks();
    TestBed.resetTestingModule();
  });

  it("shows the item card alone, without restating the request details", async () => {
    await create();

    const item = query('[data-testid="withdraw-approval-dialog-item"]');
    expect(item.textContent).toContain("Prod database");
    expect(item.textContent).toContain("Meridian Group");
    expect(item.textContent).toContain("Production");
    expect(query('[data-testid="request-summary-details"]')).toBeNull();
  });

  it("warns which item and which requester lose the approval, both in bold", async () => {
    await create();

    const warning = query('[data-testid="withdraw-approval-dialog-warning"]');
    const bold = Array.from(warning.querySelectorAll("strong")).map((el) => el.textContent);
    expect(bold).toEqual(["Prod database", "Grace Hopper"]);
    // No space before part two, which opens with the sentence's full stop.
    expect(warning.textContent!.replace(/\s+/g, " ")).toContain(
      "pamWithdrawApprovalWarningOne Prod databasepamWithdrawApprovalWarningTwo Grace Hopper pamWithdrawApprovalWarningThree",
    );
  });

  it("keeps confirm disabled until a reason is typed", async () => {
    await create();
    const confirm = query("#pam-withdraw-approval-dialog_button_confirm");
    expect(confirm.getAttribute("aria-disabled")).toBe("true");

    typeReason("   ");
    expect(confirm.getAttribute("aria-disabled")).toBe("true");

    typeReason("Approved by mistake");
    expect(confirm.getAttribute("aria-disabled")).not.toBe("true");
  });

  it("closes with the trimmed reason on confirm", async () => {
    await create();
    typeReason("  Approved by mistake  ");

    await component["confirm"]();

    expect(close).toHaveBeenCalledWith({ confirmed: true, reason: "Approved by mistake" });
  });

  it("does not close on confirm with a blank reason", async () => {
    await create();
    typeReason("   ");

    await component["confirm"]();

    expect(close).not.toHaveBeenCalled();
  });

  describe("offline", () => {
    function provideConnectivity(offline: boolean): void {
      TestBed.configureTestingModule({
        providers: [
          {
            provide: PamConnectivityService,
            useValue: { offline$: new BehaviorSubject(offline), reconnected$: of() },
          },
        ],
      });
    }

    function confirmTooltip(): string {
      return fixture.debugElement
        .query(By.css("#pam-withdraw-approval-dialog_button_confirm"))
        .injector.get(TooltipDirective)
        .tooltipContent()
        .trim();
    }

    it("disables the confirm offline, saying why, and closes with nothing", async () => {
      provideConnectivity(true);
      await create();
      typeReason("requester left");

      expect(
        fixture.nativeElement
          .querySelector("#pam-withdraw-approval-dialog_button_confirm")
          .getAttribute("aria-disabled"),
      ).toBe("true");
      expect(confirmTooltip()).toBe("pamOfflineTooltip");
      await component["confirm"]();
      expect(close).not.toHaveBeenCalled();
    });

    it("enables the confirm online, with no offline reason", async () => {
      provideConnectivity(false);
      await create();
      typeReason("requester left");

      expect(
        fixture.nativeElement
          .querySelector("#pam-withdraw-approval-dialog_button_confirm")
          .getAttribute("aria-disabled"),
      ).toBeNull();
      expect(confirmTooltip()).toBe("");
    });
  });
});
