import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { EventCollectionService, EventType } from "@bitwarden/common/dirt/event-logs";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { BankAccountView } from "@bitwarden/common/vault/models/view/bank-account.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { ToastService } from "@bitwarden/components";

import { PasswordRepromptService } from "../../services/password-reprompt.service";

import { BankAccountViewComponent } from "./bank-account-view.component";

describe("BankAccountViewComponent", () => {
  let fixture: ComponentFixture<BankAccountViewComponent>;
  const collect = jest.fn();

  beforeEach(async () => {
    collect.mockClear();
    await TestBed.configureTestingModule({
      imports: [BankAccountViewComponent],
      providers: [
        { provide: I18nService, useValue: mock<I18nService>() },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: EventCollectionService, useValue: mock<EventCollectionService>({ collect }) },
        { provide: PasswordRepromptService, useValue: mock<PasswordRepromptService>() },
        { provide: TotpService, useValue: mock<TotpService>() },
        {
          provide: BillingAccountProfileStateService,
          useValue: mock<BillingAccountProfileStateService>(),
        },
        { provide: AccountService, useValue: mock<AccountService>() },
        { provide: CipherService, useValue: mock<CipherService>() },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BankAccountViewComponent);
  });

  function buildBankAccount(): BankAccountView {
    const view = new BankAccountView();
    view.nameOnAccount = "Jane Doe";
    view.accountNumber = "123";
    view.branchNumber = "001";
    view.iban = "GB29NWBK60161331926819";
    view.swiftCode = "BOFAUS3N";
    return view;
  }

  function buildCipher(): CipherView {
    const cipher = new CipherView();
    cipher.type = CipherType.BankAccount;
    cipher.id = "test-id";
    cipher.organizationId = "org-id";
    return cipher;
  }

  describe("templates", () => {
    it("renders copy buttons for nameOnAccount, branchNumber, and swiftCode", () => {
      fixture.componentRef.setInput("bankAccount", buildBankAccount());
      fixture.componentRef.setInput("cipher", buildCipher());
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('[appCopyField="nameOnAccount"]')).toBeTruthy();
      expect(compiled.querySelector('[appCopyField="branchNumber"]')).toBeTruthy();
      expect(compiled.querySelector('[appCopyField="swiftCode"]')).toBeTruthy();
    });
  });

  describe("toggleSwiftCodeVisible", () => {
    it("collects an event when the value becomes visible", async () => {
      fixture.componentRef.setInput("bankAccount", buildBankAccount());
      fixture.componentRef.setInput("cipher", buildCipher());
      fixture.detectChanges();

      await fixture.componentInstance.toggleSwiftCodeVisible(true);

      expect(collect).toHaveBeenCalledWith(
        EventType.Cipher_ClientToggledSwiftCodeVisible,
        "test-id",
        false,
        "org-id",
      );
    });

    it("does not collect an event when the value is hidden", async () => {
      fixture.componentRef.setInput("bankAccount", buildBankAccount());
      fixture.componentRef.setInput("cipher", buildCipher());
      fixture.detectChanges();

      await fixture.componentInstance.toggleSwiftCodeVisible(false);

      expect(collect).not.toHaveBeenCalled();
    });
  });

  describe("toggleIbanVisible", () => {
    it("collects an event when the value becomes visible", async () => {
      fixture.componentRef.setInput("bankAccount", buildBankAccount());
      fixture.componentRef.setInput("cipher", buildCipher());
      fixture.detectChanges();

      await fixture.componentInstance.toggleIbanVisible(true);

      expect(collect).toHaveBeenCalledWith(
        EventType.Cipher_ClientToggledIbanVisible,
        "test-id",
        false,
        "org-id",
      );
    });

    it("does not collect an event when the value is hidden", async () => {
      fixture.componentRef.setInput("bankAccount", buildBankAccount());
      fixture.componentRef.setInput("cipher", buildCipher());
      fixture.detectChanges();

      await fixture.componentInstance.toggleIbanVisible(false);

      expect(collect).not.toHaveBeenCalled();
    });
  });
});
