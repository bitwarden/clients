import { DatePipe } from "@angular/common";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { EventCollectionService } from "@bitwarden/common/dirt/event-logs";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { PassportView } from "@bitwarden/common/vault/models/view/passport.view";
import { ToastService } from "@bitwarden/components";

import { PasswordRepromptService } from "../../services/password-reprompt.service";

import { PassportViewComponent } from "./passport-view.component";

describe("PassportViewComponent", () => {
  let fixture: ComponentFixture<PassportViewComponent>;
  const mockI18nService = mock<I18nService>();
  const mockPlatformUtilsService = mock<PlatformUtilsService>();
  const collect = jest.fn();

  beforeEach(async () => {
    collect.mockClear();
    await TestBed.configureTestingModule({
      imports: [PassportViewComponent],
      providers: [
        DatePipe,
        { provide: I18nService, useValue: mockI18nService },
        { provide: PlatformUtilsService, useValue: mockPlatformUtilsService },
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

    fixture = TestBed.createComponent(PassportViewComponent);
  });

  describe("display", () => {
    it("displays passport fields when values are present", () => {
      const passportView = new PassportView();
      passportView.surname = "Doe";
      passportView.givenName = "John";
      passportView.passportNumber = "123456";
      passportView.nationality = "USA";

      const cipher = new CipherView();
      cipher.type = CipherType.Passport;

      fixture.componentRef.setInput("passport", passportView);
      fixture.componentRef.setInput("cipher", cipher);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const fields = compiled.querySelectorAll("bit-form-field");

      expect(fields.length).toBeGreaterThan(0);
    });

    it("does not display empty fields", () => {
      const passportView = new PassportView();
      const cipher = new CipherView();
      cipher.type = CipherType.Passport;

      fixture.componentRef.setInput("passport", passportView);
      fixture.componentRef.setInput("cipher", cipher);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const inputs = compiled.querySelectorAll("input[readonly]");

      expect(inputs.length).toBe(0);
    });

    it("renders copy button for passport number when present", () => {
      const passportView = new PassportView();
      passportView.passportNumber = "P123456";

      const cipher = new CipherView();
      cipher.type = CipherType.Passport;
      cipher.id = "test-id";

      fixture.componentRef.setInput("passport", passportView);
      fixture.componentRef.setInput("cipher", cipher);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const copyButton = compiled.querySelector('[appCopyField="passportNumber"]');

      expect(copyButton).toBeTruthy();
    });
  });
});
