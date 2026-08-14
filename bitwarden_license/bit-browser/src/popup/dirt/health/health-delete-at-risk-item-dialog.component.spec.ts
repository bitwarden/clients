import { DIALOG_DATA } from "@angular/cdk/dialog";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { mock, MockProxy } from "jest-mock-extended";
import { ReplaySubject } from "rxjs";

import { CipherHealthView } from "@bitwarden/bit-common/dirt/access-intelligence/models/view/cipher-health.view";
import { RiskCategory } from "@bitwarden/bit-common/dirt/vault-health/models";
import { VaultHealthReportService } from "@bitwarden/bit-common/dirt/vault-health/services";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { DialogRef, ToastService } from "@bitwarden/components";

import {
  HealthDeleteAtRiskItemDialogComponent,
  HealthDeleteAtRiskItemDialogData,
} from "./health-delete-at-risk-item-dialog.component";

describe("HealthDeleteAtRiskItemDialogComponent", () => {
  const userId = Utils.newGuid() as UserId;

  let fixture: ComponentFixture<HealthDeleteAtRiskItemDialogComponent>;
  let activeAccount$: ReplaySubject<Account | null>;
  let cipherService: MockProxy<CipherService>;
  let vaultHealthReportService: MockProxy<VaultHealthReportService>;
  let toastService: MockProxy<ToastService>;
  let dialogRef: MockProxy<DialogRef>;

  function buildHealthView(args: Partial<CipherHealthView> = {}): CipherHealthView {
    return new CipherHealthView({
      cipherId: "cipher-1",
      hasWeakPassword: false,
      hasReusedPassword: false,
      hasExposedPassword: false,
      exposedCount: 0,
      reuseCount: 0,
      ...args,
    });
  }

  /**
   * Creates the dialog. The component reads its inputs off `DIALOG_DATA` at construction, so the
   * testing module is rebuilt per case rather than mutating a shared fixture.
   */
  async function initComponent(data: Partial<HealthDeleteAtRiskItemDialogData> = {}) {
    const dialogData: HealthDeleteAtRiskItemDialogData = {
      currentCategory: RiskCategory.Exposed,
      item: buildHealthView(),
      ...data,
    };

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [HealthDeleteAtRiskItemDialogComponent],
      providers: [
        provideNoopAnimations(),
        { provide: DIALOG_DATA, useValue: dialogData },
        { provide: DialogRef, useValue: dialogRef },
        { provide: AccountService, useValue: { activeAccount$ } },
        { provide: CipherService, useValue: cipherService },
        { provide: VaultHealthReportService, useValue: vaultHealthReportService },
        { provide: ToastService, useValue: toastService },
        { provide: I18nService, useValue: { t: (key: string) => key } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HealthDeleteAtRiskItemDialogComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  /** `fixture.nativeElement` is untyped, so narrow it once for the query helpers below. */
  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  /** All rendered text. The i18n mock echoes keys, so keys are matched directly. */
  function text(): string {
    return host().textContent ?? "";
  }

  /** The additional risks card, or null when the dialog renders no additional risks. */
  function riskCard(): HTMLElement | null {
    return host().querySelector("bit-card");
  }

  /** Whether the "This password has additional risks" section is on screen at all. */
  function showsRiskSection(): boolean {
    return text().includes("passwordHasAdditionalRisks") && riskCard() != null;
  }

  /**
   * Risk rows are matched inside the card rather than against the whole dialog — the surrounding
   * copy also contains the words "weak" and "reused", which would defeat negative assertions.
   */
  function showsWeakRisk(): boolean {
    return riskCard()?.textContent?.includes("weak") ?? false;
  }

  function showsReusedRisk(): boolean {
    return riskCard()?.textContent?.includes("reused") ?? false;
  }

  function deleteButton(): HTMLButtonElement {
    return Array.from(host().querySelectorAll<HTMLButtonElement>("button")).find((button) =>
      button.textContent?.includes("delete"),
    )!;
  }

  beforeEach(() => {
    activeAccount$ = new ReplaySubject<Account | null>(1);
    activeAccount$.next({ id: userId } as Account);

    cipherService = mock<CipherService>();
    cipherService.softDeleteWithServer.mockResolvedValue(undefined);

    vaultHealthReportService = mock<VaultHealthReportService>();
    vaultHealthReportService.deleteItemFromReport.mockReturnValue(undefined);

    toastService = mock<ToastService>();

    dialogRef = mock<DialogRef>();
    dialogRef.close.mockResolvedValue({ closed: true });
  });

  describe("static copy", () => {
    it("renders the title, description and actions", async () => {
      await initComponent();

      expect(text()).toContain("deleteItem");
      expect(text()).toContain("deleteAtRiskItemDescription");
      expect(text()).toContain("delete");
      expect(text()).toContain("cancel");
    });
  });

  /**
   * The at-risk hierarchy is exposed > weak > reused. The dialog only surfaces risks strictly
   * below the category the user came from, so it never repeats the category they are already
   * looking at back to them.
   */
  describe("additional risks", () => {
    describe("exposed passwords", () => {
      /** Exposed sits at the top of the hierarchy, so both lower risks can appear. */
      async function initExposed(flags: { weak: boolean; reused: boolean }) {
        await initComponent({
          currentCategory: RiskCategory.Exposed,
          item: buildHealthView({
            hasExposedPassword: true,
            hasWeakPassword: flags.weak,
            hasReusedPassword: flags.reused,
          }),
        });
      }

      it("shows both weak and reused when the item is also weak and reused", async () => {
        await initExposed({ weak: true, reused: true });

        expect(showsRiskSection()).toBe(true);
        expect(showsWeakRisk()).toBe(true);
        expect(showsReusedRisk()).toBe(true);
      });

      it("shows only weak when the item is also weak", async () => {
        await initExposed({ weak: true, reused: false });

        expect(showsRiskSection()).toBe(true);
        expect(showsWeakRisk()).toBe(true);
        expect(showsReusedRisk()).toBe(false);
      });

      it("shows only reused when the item is also reused", async () => {
        await initExposed({ weak: false, reused: true });

        expect(showsRiskSection()).toBe(true);
        expect(showsWeakRisk()).toBe(false);
        expect(showsReusedRisk()).toBe(true);
      });

      it("shows no risk section when the item has no lower risks", async () => {
        await initExposed({ weak: false, reused: false });

        expect(showsRiskSection()).toBe(false);
        expect(riskCard()).toBeNull();
      });
    });

    describe("weak passwords", () => {
      /** Weak sits in the middle, so only reused can appear — never weak itself. */
      async function initWeak(flags: { reused: boolean }) {
        await initComponent({
          currentCategory: RiskCategory.Weak,
          item: buildHealthView({
            hasWeakPassword: true,
            hasReusedPassword: flags.reused,
          }),
        });
      }

      it("shows only reused when the item is also reused", async () => {
        await initWeak({ reused: true });

        expect(showsRiskSection()).toBe(true);
        expect(showsWeakRisk()).toBe(false);
        expect(showsReusedRisk()).toBe(true);
      });

      it("shows no risk section when the item is not reused", async () => {
        await initWeak({ reused: false });

        expect(showsRiskSection()).toBe(false);
        expect(riskCard()).toBeNull();
      });

      it("never repeats weak, the category being viewed", async () => {
        await initWeak({ reused: true });

        expect(showsWeakRisk()).toBe(false);
      });
    });

    describe("reused passwords", () => {
      /** Reused sits at the bottom, so there is never a lower risk to surface. */
      it("shows no risk section even when the item is exposed and weak", async () => {
        await initComponent({
          currentCategory: RiskCategory.Reused,
          item: buildHealthView({
            hasExposedPassword: true,
            hasWeakPassword: true,
            hasReusedPassword: true,
          }),
        });

        expect(showsRiskSection()).toBe(false);
        expect(riskCard()).toBeNull();
      });

      it("shows no risk section when the item has no other risks", async () => {
        await initComponent({
          currentCategory: RiskCategory.Reused,
          item: buildHealthView({ hasReusedPassword: true }),
        });

        expect(showsRiskSection()).toBe(false);
        expect(riskCard()).toBeNull();
      });
    });
  });

  describe("deleting the item", () => {
    it("soft deletes the item for the active account", async () => {
      await initComponent({ item: buildHealthView({ cipherId: "cipher-42" }) });

      deleteButton().click();
      await fixture.whenStable();

      expect(cipherService.softDeleteWithServer).toHaveBeenCalledTimes(1);
      expect(cipherService.softDeleteWithServer).toHaveBeenCalledWith("cipher-42", userId);
    });

    it("deletes the item from the health report for active account", async () => {
      await initComponent({ item: buildHealthView({ cipherId: "cipher-42" }) });

      deleteButton().click();
      await fixture.whenStable();

      expect(vaultHealthReportService.deleteItemFromReport).toHaveBeenCalledTimes(1);
      expect(vaultHealthReportService.deleteItemFromReport).toHaveBeenCalledWith(
        "cipher-42",
        RiskCategory.Exposed,
        userId,
      );
    });

    it("shows a success toast", async () => {
      await initComponent();

      deleteButton().click();
      await fixture.whenStable();

      expect(toastService.showToast).toHaveBeenCalledWith({
        message: "deletedItem",
        variant: "success",
      });
    });

    it("closes the dialog", async () => {
      await initComponent();

      deleteButton().click();
      await fixture.whenStable();

      expect(dialogRef.close).toHaveBeenCalledTimes(1);
    });

    it("does not show the success toast until the delete resolves", async () => {
      let resolveDelete: () => void;
      cipherService.softDeleteWithServer.mockReturnValue(
        new Promise<void>((resolve) => {
          resolveDelete = resolve;
        }),
      );
      await initComponent();

      deleteButton().click();
      await fixture.whenStable();

      expect(cipherService.softDeleteWithServer).toHaveBeenCalled();
      expect(toastService.showToast).not.toHaveBeenCalled();
      expect(dialogRef.close).not.toHaveBeenCalled();

      resolveDelete!();
      await fixture.whenStable();

      expect(toastService.showToast).toHaveBeenCalled();
      expect(dialogRef.close).toHaveBeenCalled();
    });
  });
});
