import { DebugElement } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { MasterPasswordUnlockService } from "@bitwarden/common/key-management/master-password/abstractions/master-password-unlock.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { UserKey } from "@bitwarden/common/types/key";
import {
  AsyncActionsModule,
  ButtonModule,
  FormFieldModule,
  IconButtonModule,
  ToastService,
} from "@bitwarden/components";
import { BiometricsStatus } from "@bitwarden/key-management";
import { UserId } from "@bitwarden/user-core";

import { UnlockOptions } from "../../services/lock-component.service";

import { MasterPasswordLockComponent } from "./master-password-lock.component";

describe("MasterPasswordLockComponent", () => {
  let component: MasterPasswordLockComponent;
  let fixture: ComponentFixture<MasterPasswordLockComponent>;

  // Mock services
  const accountService = mock<AccountService>();
  const masterPasswordUnlockService = mock<MasterPasswordUnlockService>();
  const i18nService = mock<I18nService>();
  const toastService = mock<ToastService>();
  const logService = mock<LogService>();

  const mockMasterPassword = "testExample";
  const activeAccount: Account = {
    id: "user-id" as UserId,
    email: "user@example.com",
    emailVerified: true,
    name: "User",
  };
  const mockUserKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;

  beforeEach(async () => {
    jest.clearAllMocks();

    i18nService.t.mockImplementation((key: string) => key);

    await TestBed.configureTestingModule({
      imports: [
        MasterPasswordLockComponent,
        JslibModule,
        ReactiveFormsModule,
        ButtonModule,
        FormFieldModule,
        AsyncActionsModule,
        IconButtonModule,
      ],
      providers: [
        FormBuilder,
        { provide: AccountService, useValue: accountService },
        { provide: MasterPasswordUnlockService, useValue: masterPasswordUnlockService },
        { provide: I18nService, useValue: i18nService },
        { provide: ToastService, useValue: toastService },
        { provide: LogService, useValue: logService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MasterPasswordLockComponent);
    component = fixture.componentInstance;
  });

  describe("form", () => {
    let form: DebugElement;

    beforeEach(async () => {
      accountService.activeAccount$ = of(activeAccount);
      const unlockOptions: UnlockOptions = {
        masterPassword: { enabled: true },
        pin: { enabled: false },
        biometrics: {
          enabled: false,
          biometricsStatus: BiometricsStatus.NotEnabledLocally,
        },
      };

      fixture.componentRef.setInput("unlockOptions", unlockOptions);
      fixture.detectChanges();
      form = fixture.debugElement.query(By.css("form"));
    });

    describe("form rendering", () => {
      it("creates a form group with a master password control", () => {
        expect(component.formGroup).toBeDefined();
        expect(component.formGroup.controls.masterPassword).toBeDefined();
      });

      it("renders master password input field", () => {
        const input = form.query(By.css('input[formControlName="masterPassword"]'));

        expect(input).toBeTruthy();
        expect(input.nativeElement).toBeInstanceOf(HTMLInputElement);
        const inputElement = input.nativeElement as HTMLInputElement;
        expect(inputElement.type).toEqual("password");
        expect(inputElement.name).toEqual("masterPassword");
        expect(inputElement.required).toEqual(true);
        expect(inputElement.attributes).toHaveProperty("bitInput");
      });

      it("renders password toggle button", () => {
        const toggleButton = form.query(By.css("button[bitPasswordInputToggle]"));

        expect(toggleButton).toBeTruthy();
        expect(toggleButton.nativeElement).toBeInstanceOf(HTMLButtonElement);
        const toggleButtonElement = toggleButton.nativeElement as HTMLButtonElement;
        expect(toggleButtonElement.type).toEqual("button");
        expect(toggleButtonElement.attributes).toHaveProperty("bitIconButton");
      });

      it("renders unlock submit button", () => {
        const submitButton = form.query(By.css('button[type="submit"]'));

        expect(submitButton).toBeTruthy();
        expect(submitButton.nativeElement).toBeInstanceOf(HTMLButtonElement);
        const submitButtonElement = submitButton.nativeElement as HTMLButtonElement;
        expect(submitButtonElement.type).toEqual("submit");
        expect(submitButtonElement.attributes).toHaveProperty("bitButton");
        expect(submitButtonElement.attributes).toHaveProperty("bitFormButton");
        expect(submitButtonElement.textContent?.trim()).toEqual("unlock");
      });

      it("renders logout button", () => {
        const logoutButton = form.query(
          By.css('button[type="button"]:not([bitPasswordInputToggle])'),
        );

        expect(logoutButton).toBeTruthy();
        expect(logoutButton.nativeElement).toBeInstanceOf(HTMLButtonElement);
        const logoutButtonElement = logoutButton.nativeElement as HTMLButtonElement;
        expect(logoutButtonElement.type).toEqual("button");
        expect(logoutButtonElement.textContent?.trim()).toEqual("logOut");
      });

      it("doesn't render biometrics swap button when biometrics isn't enabled", () => {
        fixture.componentRef.setInput("biometricUnlockBtnText", "swapBiometrics");
        fixture.detectChanges();

        const biometricsSwapButton = form.query(By.css('button[buttonType="secondary"]'));

        expect(biometricsSwapButton).not.toBeTruthy();
      });

      it("doesn't render PIN swap button when PIN isn't enabled", () => {
        fixture.componentRef.setInput("biometricUnlockBtnText", "swapBiometrics");
        fixture.detectChanges();

        const biometricsSwapButton = form.query(By.css('button[buttonType="secondary"]'));

        expect(biometricsSwapButton).not.toBeTruthy();
      });

      it("renders PIN swap button when PIN is enabled", () => {
        fixture.componentRef.setInput("unlockOptions", {
          masterPassword: { enabled: true },
          pin: { enabled: true },
          biometrics: {
            enabled: false,
            biometricsStatus: BiometricsStatus.PlatformUnsupported,
          },
        });
        fixture.detectChanges();

        form = fixture.debugElement.query(By.css("form"));
        const pinSwapButton = form.query(By.css('button[buttonType="secondary"]'));

        expect(pinSwapButton).toBeTruthy();
        expect(pinSwapButton.nativeElement).toBeInstanceOf(HTMLButtonElement);
        const pinSwapButtonElement = pinSwapButton.nativeElement as HTMLButtonElement;
        expect(pinSwapButtonElement.type).toEqual("button");
        expect(pinSwapButtonElement.attributes).toHaveProperty("bitButton");
        expect(pinSwapButtonElement.attributes).toHaveProperty("bitFormButton");
        expect(pinSwapButtonElement.textContent?.trim()).toEqual("unlockWithPin");
      });

      it("renders biometrics swap button when biometrics is enabled", () => {
        fixture.componentRef.setInput("unlockOptions", {
          masterPassword: { enabled: true },
          pin: { enabled: false },
          biometrics: {
            enabled: true,
            biometricsStatus: BiometricsStatus.Available,
          },
        });
        fixture.componentRef.setInput("biometricUnlockBtnText", "swapBiometrics");
        fixture.detectChanges();

        form = fixture.debugElement.query(By.css("form"));
        const biometricsSwapButton = form.query(By.css('button[buttonType="secondary"]'));

        expect(biometricsSwapButton).toBeTruthy();
        expect(biometricsSwapButton.nativeElement).toBeInstanceOf(HTMLButtonElement);
        const biometricsSwapButtonElement = biometricsSwapButton.nativeElement as HTMLButtonElement;
        expect(biometricsSwapButtonElement.type).toEqual("button");
        expect(biometricsSwapButtonElement.attributes).toHaveProperty("bitButton");
        expect(biometricsSwapButtonElement.attributes).toHaveProperty("bitFormButton");
        expect(biometricsSwapButtonElement.textContent?.trim()).toEqual("swapBiometrics");
      });
    });

    describe("password input", () => {
      it("should bind form input to masterPassword form control", async () => {
        const input = form.query(By.css('input[formControlName="masterPassword"]'));
        expect(input).toBeTruthy();
        expect(input.nativeElement).toBeInstanceOf(HTMLInputElement);
        expect(component.formGroup).toBeTruthy();
        const masterPasswordControl = component.formGroup!.get("masterPassword");
        expect(masterPasswordControl).toBeTruthy();

        masterPasswordControl!.setValue("test-password");
        fixture.detectChanges();

        const inputElement = input.nativeElement as HTMLInputElement;
        expect(inputElement.value).toEqual("test-password");
      });

      it("should validate required master password field", async () => {
        const formGroup = component.formGroup;

        // Initially form should be invalid (empty required field)
        expect(formGroup?.invalid).toEqual(true);
        expect(formGroup?.get("masterPassword")?.hasError("required")).toBe(true);

        // Set a value
        formGroup?.get("masterPassword")?.setValue("test-password");

        expect(formGroup?.invalid).toEqual(false);
        expect(formGroup?.get("masterPassword")?.hasError("required")).toBe(false);
      });

      it("should toggle password visibility when toggle button is clicked", async () => {
        const toggleButton = form.query(By.css("button[bitPasswordInputToggle]"));
        expect(toggleButton).toBeTruthy();
        expect(toggleButton.nativeElement).toBeInstanceOf(HTMLButtonElement);
        const toggleButtonElement = toggleButton.nativeElement as HTMLButtonElement;
        const input = form.query(By.css('input[formControlName="masterPassword"]'));
        expect(input).toBeTruthy();
        expect(input.nativeElement).toBeInstanceOf(HTMLInputElement);
        const inputElement = input.nativeElement as HTMLInputElement;

        // Initially password should be hidden
        expect(inputElement.type).toEqual("password");

        // Click toggle button
        toggleButtonElement.click();
        fixture.detectChanges();

        expect(inputElement.type).toEqual("text");

        // Click toggle button again
        toggleButtonElement.click();
        fixture.detectChanges();

        expect(inputElement.type).toEqual("password");
      });
    });

    describe("logout", () => {
      it("emits logOut event when logout button is clicked", () => {
        let logoutEmitted = false;
        component.logOut.subscribe(() => {
          logoutEmitted = true;
        });

        const logoutButton = form.query(
          By.css('button[type="button"]:not([bitPasswordInputToggle])'),
        );
        expect(logoutButton).toBeTruthy();
        expect(logoutButton.nativeElement).toBeInstanceOf(HTMLButtonElement);
        const logoutButtonElement = logoutButton.nativeElement as HTMLButtonElement;

        // Click logout button
        logoutButtonElement.click();
        expect(logoutEmitted).toBe(true);
      });
    });
  });

  describe("submit", () => {
    test.each([null, undefined as unknown as string, ""])(
      "won't unlock and show password invalid toast when master password is %s",
      async (value) => {
        component.formGroup.controls.masterPassword.setValue(value);

        await component.submit();

        expect(toastService.showToast).toHaveBeenCalledWith({
          variant: "error",
          title: i18nService.t("errorOccurred"),
          message: i18nService.t("masterPasswordRequired"),
        });
        expect(masterPasswordUnlockService.unlockWithMasterPassword).not.toHaveBeenCalled();
      },
    );

    test.each([null as unknown as Account, undefined as unknown as Account])(
      "throws error when active account is %s",
      async (value) => {
        accountService.activeAccount$ = of(value);
        component.formGroup.controls.masterPassword.setValue(mockMasterPassword);

        await expect(component.submit()).rejects.toThrow("No active account found");

        expect(masterPasswordUnlockService.unlockWithMasterPassword).not.toHaveBeenCalled();
      },
    );

    it("shows an error toast and logs the error when unlock with master password fails", async () => {
      const customError = new Error("Specialized error message");
      masterPasswordUnlockService.unlockWithMasterPassword.mockRejectedValue(customError);
      accountService.activeAccount$ = of(activeAccount);
      component.formGroup.controls.masterPassword.setValue(mockMasterPassword);

      await component.submit();

      expect(masterPasswordUnlockService.unlockWithMasterPassword).toHaveBeenCalledWith(
        mockMasterPassword,
        activeAccount,
      );
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        title: i18nService.t("errorOccurred"),
        message: i18nService.t("invalidMasterPassword"),
      });
      expect(logService.error).toHaveBeenCalledWith(
        "[MasterPasswordLockComponent] Failed to unlock via master password",
        customError,
      );
    });

    it("emits userKey when unlock is successful", async () => {
      masterPasswordUnlockService.unlockWithMasterPassword.mockResolvedValue(mockUserKey);
      accountService.activeAccount$ = of(activeAccount);
      component.formGroup.controls.masterPassword.setValue(mockMasterPassword);
      let emittedUserKey: UserKey | undefined;
      component.successfulUnlock.subscribe((userKey: UserKey) => {
        emittedUserKey = userKey;
      });

      await component.submit();

      expect(emittedUserKey).toEqual(mockUserKey);
      expect(masterPasswordUnlockService.unlockWithMasterPassword).toHaveBeenCalledWith(
        mockMasterPassword,
        activeAccount,
      );
    });
  });
});
