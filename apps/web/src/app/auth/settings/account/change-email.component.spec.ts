import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import mock, { MockProxy } from "jest-mock-extended/lib/Mock";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { TwoFactorProviderResponse } from "@bitwarden/common/auth/models/response/two-factor-provider.response";
import { ChangeEmailService } from "@bitwarden/common/auth/services/change-email/change-email.service";
import { TwoFactorService } from "@bitwarden/common/auth/two-factor";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
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

  beforeEach(async () => {
    changeEmailService = mock<ChangeEmailService>();
    twoFactorService = mock<TwoFactorService>();
    accountService = mockAccountServiceWith("UserId" as UserId);

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
      expect(component.userId).toBe("UserId");
    });

    it("errors if there is no active user", async () => {
      // clear active account
      await firstValueFrom(accountService.activeAccount$);
      accountService.activeAccountSubject.next(null);

      await expect(() => component.ngOnInit()).rejects.toThrow("Null or undefined account");
    });

    it("initializes showTwoFactorEmailWarning", async () => {
      await component.ngOnInit();
      expect(component.showTwoFactorEmailWarning).toBe(true);
    });
  });

  describe("submit", () => {
    beforeEach(() => {
      component.userId = "UserId" as UserId;
      component.formGroup.controls.step1.setValue({
        masterPassword: "password",
        newEmail: "test@example.com",
      });
    });

    it("throws if userId is null on submit", async () => {
      component.userId = undefined;

      await expect(component.submit()).rejects.toThrow("Can't find user");
    });

    describe("step 1", () => {
      it("does not submit if step 1 is invalid", async () => {
        component.formGroup.controls.step1.setValue({
          masterPassword: "",
          newEmail: "",
        });

        await component.submit();

        expect(changeEmailService.requestEmailToken).not.toHaveBeenCalled();
      });

      it("sends email token in step 1 if tokenSent is false", async () => {
        await component.submit();

        expect(changeEmailService.requestEmailToken).toHaveBeenCalledWith(
          "password",
          "test@example.com",
          "UserId" as UserId,
        );
        // should activate step 2
        expect(component.tokenSent).toBe(true);
        expect(component.formGroup.controls.step1.disabled).toBe(true);
        expect(component.formGroup.controls.token.enabled).toBe(true);
      });
    });

    describe("step 2", () => {
      beforeEach(() => {
        component.tokenSent = true;
        component.formGroup.controls.step1.disable();
        component.formGroup.controls.token.enable();
        component.formGroup.controls.token.setValue("token");
      });

      it("does not post email if token is missing on submit", async () => {
        component.formGroup.controls.token.setValue("");

        await component.submit();

        expect(changeEmailService.confirmEmailChange).not.toHaveBeenCalled();
      });

      it("submits if step 2 is valid", async () => {
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
