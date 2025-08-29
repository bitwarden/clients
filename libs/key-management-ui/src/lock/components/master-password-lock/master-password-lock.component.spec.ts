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

import { UnlockOption, UnlockOptions } from "../../services/lock-component.service";

import { MasterPasswordLockComponent } from "./master-password-lock.component";

describe("MasterPasswordLockComponent", () => {
  let component: MasterPasswordLockComponent;
  let fixture: ComponentFixture<MasterPasswordLockComponent>;

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

  const setupComponent = (
    unlockOptions: Partial<UnlockOptions> = {},
    biometricUnlockBtnText: string = "default",
    account: Account | null = activeAccount,
  ) => {
    const defaultOptions: UnlockOptions = {
      masterPassword: { enabled: true },
      pin: { enabled: false },
      biometrics: {
        enabled: false,
        biometricsStatus: BiometricsStatus.NotEnabledLocally,
      },
    };

    accountService.activeAccount$ = of(account);
    fixture.componentRef.setInput("unlockOptions", { ...defaultOptions, ...unlockOptions });
    fixture.componentRef.setInput("biometricUnlockBtnText", biometricUnlockBtnText);
    fixture.detectChanges();

    return {
      form: fixture.debugElement.query(By.css("form")),
      component,
      ...getFormElements(fixture.debugElement.query(By.css("form"))),
    };
  };

  const getFormElements = (form: DebugElement) => ({
    masterPasswordInput: form.query(By.css('input[formControlName="masterPassword"]')),
    toggleButton: form.query(By.css("button[bitPasswordInputToggle]")),
    submitButton: form.query(By.css('button[type="submit"]')),
    logoutButton: form.query(By.css('button[type="button"]:not([bitPasswordInputToggle])')),
    secondaryButton: form.query(By.css('button[buttonType="secondary"]')),
  });

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

  describe("form rendering", () => {
    let elements: ReturnType<typeof setupComponent>;

    beforeEach(() => {
      elements = setupComponent();
    });

    it("creates form with proper structure", () => {
      expect(component.formGroup).toBeDefined();
      expect(component.formGroup.controls.masterPassword).toBeDefined();
    });

    const formElementTests = [
      {
        name: "master password input",
        selector: "masterPasswordInput",
        expectations: (el: HTMLInputElement) => {
          expect(el).toMatchObject({
            type: "password",
            name: "masterPassword",
            required: true,
          });
          expect(el.attributes).toHaveProperty("bitInput");
        },
      },
      {
        name: "password toggle button",
        selector: "toggleButton",
        expectations: (el: HTMLButtonElement) => {
          expect(el.type).toBe("button");
          expect(el.attributes).toHaveProperty("bitIconButton");
        },
      },
      {
        name: "unlock submit button",
        selector: "submitButton",
        expectations: (el: HTMLButtonElement) => {
          expect(el).toMatchObject({
            type: "submit",
            textContent: expect.stringContaining("unlock"),
          });
          expect(el.attributes).toHaveProperty("bitButton");
        },
      },
      {
        name: "logout button",
        selector: "logoutButton",
        expectations: (el: HTMLButtonElement) => {
          expect(el).toMatchObject({
            type: "button",
            textContent: expect.stringContaining("logOut"),
          });
          expect(el.attributes).toHaveProperty("bitButton");
        },
      },
    ];

    test.each(formElementTests)("renders $name correctly", ({ selector, expectations }) => {
      const element = elements[selector as keyof typeof elements] as DebugElement;
      expect(element).toBeTruthy();
      expectations(element.nativeElement);
    });

    const hiddenButtonTests = [
      {
        case: "biometrics swap button when biometrics is undefined",
        setup: () =>
          setupComponent(
            {
              pin: { enabled: false },
              biometrics: {
                enabled: undefined as unknown as boolean,
                biometricsStatus: BiometricsStatus.PlatformUnsupported,
              },
            },
            "swapBiometrics",
          ),
        expectHidden: true,
      },
      {
        case: "biometrics swap button when biometrics is disabled",
        setup: () => setupComponent({}, "swapBiometrics"),
        expectHidden: true,
      },
      {
        case: "PIN swap button when PIN is disabled",
        setup: () => setupComponent({}),
        expectHidden: true,
      },
      {
        case: "PIN swap button when PIN is undefined",
        setup: () =>
          setupComponent({
            pin: { enabled: undefined as unknown as boolean },
            biometrics: {
              enabled: undefined as unknown as boolean,
              biometricsStatus: BiometricsStatus.PlatformUnsupported,
            },
          }),
        expectHidden: true,
      },
    ];

    test.each(hiddenButtonTests)("doesn't render $case", ({ setup, expectHidden }) => {
      const { secondaryButton } = setup();
      expect(!!secondaryButton).toBe(!expectHidden);
    });
  });

  describe("password input", () => {
    let setup: ReturnType<typeof setupComponent>;
    beforeEach(() => {
      setup = setupComponent();
    });

    it("should bind form input to masterPassword form control", async () => {
      const input = setup.masterPasswordInput;
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
      const toggleButton = setup.toggleButton;
      expect(toggleButton).toBeTruthy();
      expect(toggleButton.nativeElement).toBeInstanceOf(HTMLButtonElement);
      const toggleButtonElement = toggleButton.nativeElement as HTMLButtonElement;
      const input = setup.masterPasswordInput;
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
      const setup = setupComponent();
      let logoutEmitted = false;
      component.logOut.subscribe(() => {
        logoutEmitted = true;
      });

      expect(setup.logoutButton).toBeTruthy();
      expect(setup.logoutButton.nativeElement).toBeInstanceOf(HTMLButtonElement);
      const logoutButtonElement = setup.logoutButton.nativeElement as HTMLButtonElement;

      // Click logout button
      logoutButtonElement.click();

      expect(logoutEmitted).toBe(true);
    });
  });

  describe("swap buttons", () => {
    const swapButtonScenarios = [
      {
        name: "PIN swap button when PIN is enabled",
        unlockOptions: {
          pin: { enabled: true },
          biometrics: {
            enabled: false,
            biometricsStatus: BiometricsStatus.PlatformUnsupported,
          },
        },
        expectedText: "unlockWithPin",
        expectedUnlockOption: UnlockOption.Pin,
        shouldShow: true,
        shouldEnable: true,
      },
      {
        name: "PIN swap button when PIN is disabled",
        unlockOptions: {
          pin: { enabled: false },
          biometrics: {
            enabled: false,
            biometricsStatus: BiometricsStatus.PlatformUnsupported,
          },
        },
        expectedText: "unlockWithPin",
        expectedUnlockOption: null,
        shouldShow: false,
        shouldEnable: false,
      },
      {
        name: "biometrics swap button when biometrics status is available and enabled",
        unlockOptions: {
          pin: { enabled: false },
          biometrics: { enabled: true, biometricsStatus: BiometricsStatus.Available },
        },
        expectedText: "swapBiometrics",
        expectedUnlockOption: UnlockOption.Biometrics,
        shouldShow: true,
        shouldEnable: true,
      },
      {
        name: "biometrics swap button when biometrics status is available and disabled",
        unlockOptions: {
          pin: { enabled: false },
          biometrics: { enabled: false, biometricsStatus: BiometricsStatus.Available },
        },
        expectedText: "swapBiometrics",
        expectedUnlockOption: UnlockOption.Biometrics,
        shouldShow: true,
        shouldEnable: false,
      },
      {
        name: "biometrics swap button when biometrics biometrics status is unsupported and enabled",
        unlockOptions: {
          pin: { enabled: false },
          biometrics: { enabled: true, biometricsStatus: BiometricsStatus.PlatformUnsupported },
        },
        expectedText: "swapBiometrics",
        expectedUnlockOption: UnlockOption.Biometrics,
        shouldShow: false,
        shouldEnable: false,
      },
      {
        name: "biometrics swap button when biometrics status is unsupported and disabled",
        unlockOptions: {
          pin: { enabled: false },
          biometrics: { enabled: false, biometricsStatus: BiometricsStatus.PlatformUnsupported },
        },
        expectedText: "swapBiometrics",
        expectedUnlockOption: UnlockOption.Biometrics,
        shouldShow: false,
        shouldEnable: false,
      },
    ];

    test.each(swapButtonScenarios)(
      "renders and handles $name",
      ({ unlockOptions, expectedText, expectedUnlockOption, shouldShow, shouldEnable }) => {
        const { secondaryButton, component } = setupComponent(unlockOptions, expectedText);

        if (shouldShow) {
          expect(secondaryButton).toBeTruthy();
          expect(secondaryButton.nativeElement.textContent?.trim()).toBe(expectedText);
          expect(secondaryButton.nativeElement.disabled).toBe(!shouldEnable);

          if (shouldEnable) {
            secondaryButton.nativeElement.click();
            expect(component.activeUnlockOption()).toBe(expectedUnlockOption);
          }
        } else {
          expect(secondaryButton).toBeFalsy();
        }
      },
    );
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
