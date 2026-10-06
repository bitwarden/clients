import { DIALOG_DATA } from "@angular/cdk/dialog";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { mock, MockProxy } from "jest-mock-extended";
import { ReplaySubject } from "rxjs";

import { CipherHealthView } from "@bitwarden/bit-common/dirt/access-intelligence/models/view/cipher-health.view";
import { RiskCategory } from "@bitwarden/bit-common/dirt/vault-health/models";
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

    toastService = mock<ToastService>();

    dialogRef = mock<DialogRef>();
    dialogRef.close.mockResolvedValue({ closed: true });
  });

  describe("static copy", () => {
    it("renders the title, description and actions", async () => {
      await initComponent();

      expect(text()).toContain("deleteItem");
      expect(text()).toContain("deleteAtRiskItemDesc");
      expect(text()).toContain("delete");
      expect(text()).toContain("cancel");
    });
  });

  describe("additional risks", () => {
    it("shows the additional risks for the item and category it was opened with", async () => {
      await initComponent({
        currentCategory: RiskCategory.Exposed,
        item: buildHealthView({ hasExposedPassword: true, hasWeakPassword: true }),
      });

      expect(text()).toContain("passwordHasAdditionalRisks");
      expect(host().querySelector("bit-card")?.textContent).toContain("weak");
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
