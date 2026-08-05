import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import mock, { MockProxy } from "jest-mock-extended/lib/Mock";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { ChangeEmailService } from "@bitwarden/common/auth/services/change-email/change-email.service";
import { TwoFactorService } from "@bitwarden/common/auth/two-factor";
import { TwoFactorProviderResponse } from "@bitwarden/common/auth/two-factor/response/two-factor-provider.response";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { ToastService } from "@bitwarden/components";
import { ChangeEmailComponent } from "@bitwarden/web-vault/app/auth/settings/account/change-email.component";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

describe("ChangeEmailComponent", () => {
  let component: ChangeEmailComponent;
  let fixture: ComponentFixture<ChangeEmailComponent>;

  let changeEmailService: MockProxy<ChangeEmailService>;
  let twoFactorService: MockProxy<TwoFactorService>;
  let accountService: FakeAccountService;
  let configService: MockProxy<ConfigService>;

  beforeEach(async () => {
    changeEmailService = mock<ChangeEmailService>();
    twoFactorService = mock<TwoFactorService>();
    accountService = mockAccountServiceWith("UserId" as UserId);
    configService = mock<ConfigService>();
    configService.getFeatureFlag.mockResolvedValue(false);

    await TestBed.configureTestingModule({
      imports: [ReactiveFormsModule, SharedModule, ChangeEmailComponent],
      providers: [
        { provide: AccountService, useValue: accountService },
        { provide: TwoFactorService, useValue: twoFactorService },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: MessagingService, useValue: mock<MessagingService>() },
        { provide: FormBuilder, useClass: FormBuilder },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: ChangeEmailService, useValue: changeEmailService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChangeEmailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("creates component", () => {
    expect(component).toBeTruthy();
  });

  describe("ngOnInit", () => {
    beforeEach(() => {
      twoFactorService.getEnabledTwoFactorProviders.mockResolvedValue({
        data: [{ type: TwoFactorProviderType.Email, enabled: true } as TwoFactorProviderResponse],
      } as ListResponse<TwoFactorProviderResponse>);
    });

    it("initializes userId", async () => {
      await component.ngOnInit();
      expect(component["userId"]()).toBe("UserId");
    });

    it("errors if there is no active user", async () => {
      // clear active account
      await firstValueFrom(accountService.activeAccount$);
      accountService.activeAccountSubject.next(null);

      await expect(() => component.ngOnInit()).rejects.toThrow("Null or undefined account");
    });

    it("initializes showTwoFactorEmailWarning", async () => {
      await component.ngOnInit();
      expect(component["showTwoFactorEmailWarning"]()).toBe(true);
    });
  });

  describe("submit", () => {
    beforeEach(() => {
      component["userId"].set("UserId" as UserId);
      component.formGroup.controls.userVerificationAndNewEmail.setValue({
        masterPassword: "password",
        newEmail: "test@example.com",
      });
    });

    it("throws if userId is null on submit", async () => {
      component["userId"].set(undefined);

      await expect(component.submit()).rejects.toThrow("Can't find user");
    });

    describe("user verification and new email", () => {
      it("does not submit if user verification and new email are invalid", async () => {
        component.formGroup.controls.userVerificationAndNewEmail.setValue({
          masterPassword: "",
          newEmail: "",
        });

        await component.submit();

        expect(changeEmailService.requestEmailToken).not.toHaveBeenCalled();
      });

      it("requests an email token when user verification has not succeeded yet", async () => {
        await component.submit();

        expect(changeEmailService.requestEmailToken).toHaveBeenCalledWith(
          "password",
          "test@example.com",
          "UserId" as UserId,
        );
        // should advance to email ownership verification
        expect(component["userVerificationSuccessful"]()).toBe(true);
        expect(component.formGroup.controls.userVerificationAndNewEmail.disabled).toBe(true);
        expect(component.formGroup.controls.emailOwnershipVerification.enabled).toBe(true);
      });
    });

    describe("email ownership verification", () => {
      beforeEach(() => {
        component["userVerificationSuccessful"].set(true);
        component.formGroup.controls.userVerificationAndNewEmail.disable();
        component.formGroup.controls.emailOwnershipVerification.enable();
        component.formGroup.controls.emailOwnershipVerification.setValue("token");
      });

      it("does not post email if token is missing on submit", async () => {
        component.formGroup.controls.emailOwnershipVerification.setValue("");

        await component.submit();

        expect(changeEmailService.confirmEmailChange).not.toHaveBeenCalled();
      });

      it("confirms the email change when email ownership verification is valid", async () => {
        await component.submit();

        expect(changeEmailService.confirmEmailChange).toHaveBeenCalledWith(
          "password",
          "test@example.com",
          "token",
          "UserId" as UserId,
        );
      });
    });
  });
});
