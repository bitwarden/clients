import { DebugElement } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { By } from "@angular/platform-browser";
import { Router } from "@angular/router";
import { mock } from "jest-mock-extended";
import { firstValueFrom, interval, map, of, takeWhile, timeout } from "rxjs";
import { ZXCVBNResult } from "zxcvbn";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { LogoutService } from "@bitwarden/auth/common";
import { InternalPolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { VerificationType } from "@bitwarden/common/auth/enums/verification-type";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { MasterPasswordPolicyResponse } from "@bitwarden/common/auth/models/response/master-password-policy.response";
import {
  MasterPasswordVerification,
  MasterPasswordVerificationResponse,
} from "@bitwarden/common/auth/types/verification";
import { ClientType, DeviceType } from "@bitwarden/common/enums";
import { DeviceTrustServiceAbstraction } from "@bitwarden/common/key-management/device-trust/abstractions/device-trust.service.abstraction";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { PinServiceAbstraction } from "@bitwarden/common/key-management/pin/pin.service.abstraction";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { SyncService } from "@bitwarden/common/platform/sync";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
import { UserId } from "@bitwarden/common/types/guid";
import { MasterKey, UserKey } from "@bitwarden/common/types/key";
import {
  AnonLayoutWrapperDataService,
  AsyncActionsModule,
  ButtonModule,
  DialogService,
  FormFieldModule,
  IconButtonModule,
  ToastService,
} from "@bitwarden/components";
import {
  BiometricsService,
  BiometricsStatus,
  BiometricStateService,
  KeyService,
  PBKDF2KdfConfig,
  UserAsymmetricKeysRegenerationService,
} from "@bitwarden/key-management";

import {
  LockComponentService,
  UnlockOption,
  UnlockOptions,
} from "../services/lock-component.service";

import { LockComponent } from "./lock.component";

describe("LockComponent", () => {
  let component: LockComponent;
  let fixture: ComponentFixture<LockComponent>;

  const userId = "test-user-id" as UserId;

  // Mock services
  const mockAccountService = mockAccountServiceWith(userId);
  const mockPinService = mock<PinServiceAbstraction>();
  const mockUserVerificationService = mock<UserVerificationService>();
  const mockKeyService = mock<KeyService>();
  const mockPlatformUtilsService = mock<PlatformUtilsService>();
  const mockRouter = mock<Router>();
  const mockDialogService = mock<DialogService>();
  const mockMessagingService = mock<MessagingService>();
  const mockBiometricStateService = mock<BiometricStateService>();
  const mockI18nService = mock<I18nService>();
  const mockMasterPasswordService = mock<InternalMasterPasswordServiceAbstraction>();
  const mockLogService = mock<LogService>();
  const mockDeviceTrustService = mock<DeviceTrustServiceAbstraction>();
  const mockSyncService = mock<SyncService>();
  const mockPolicyService = mock<InternalPolicyService>();
  const mockPasswordStrengthService = mock<PasswordStrengthServiceAbstraction>();
  const mockToastService = mock<ToastService>();
  const mockUserAsymmetricKeysRegenerationService = mock<UserAsymmetricKeysRegenerationService>();
  const mockBiometricService = mock<BiometricsService>();
  const mockLogoutService = mock<LogoutService>();
  const mockLockComponentService = mock<LockComponentService>();
  const mockAnonLayoutWrapperDataService = mock<AnonLayoutWrapperDataService>();
  const mockBroadcasterService = mock<BroadcasterService>();
  const mockConfigService = mock<ConfigService>();

  beforeEach(async () => {
    jest.resetAllMocks();

    // Setup default mock returns
    mockPlatformUtilsService.getClientType.mockReturnValue(ClientType.Web);
    mockKeyService.hasUserKey.mockResolvedValue(false);
    mockI18nService.t.mockImplementation((key: string) => key);

    // Mock observables that cause timeouts
    mockBiometricStateService.promptAutomatically$ = of(false);
    mockBiometricStateService.promptCancelled$ = of(false);
    mockBiometricStateService.resetUserPromptCancelled.mockResolvedValue();
    mockLockComponentService.getAvailableUnlockOptions$.mockReturnValue(of(null));
    mockSyncService.fullSync.mockResolvedValue(true);
    mockDeviceTrustService.trustDeviceIfRequired.mockResolvedValue();
    mockUserAsymmetricKeysRegenerationService.regenerateIfNeeded.mockResolvedValue();
    mockAnonLayoutWrapperDataService.setAnonLayoutWrapperData.mockImplementation(() => {});

    await TestBed.configureTestingModule({
      imports: [
        LockComponent,
        ReactiveFormsModule,
        JslibModule,
        ButtonModule,
        FormFieldModule,
        AsyncActionsModule,
        IconButtonModule,
      ],
      providers: [
        FormBuilder,
        { provide: AccountService, useValue: mockAccountService },
        { provide: PinServiceAbstraction, useValue: mockPinService },
        { provide: UserVerificationService, useValue: mockUserVerificationService },
        { provide: KeyService, useValue: mockKeyService },
        { provide: PlatformUtilsService, useValue: mockPlatformUtilsService },
        { provide: Router, useValue: mockRouter },
        { provide: DialogService, useValue: mockDialogService },
        { provide: MessagingService, useValue: mockMessagingService },
        { provide: BiometricStateService, useValue: mockBiometricStateService },
        { provide: I18nService, useValue: mockI18nService },
        { provide: InternalMasterPasswordServiceAbstraction, useValue: mockMasterPasswordService },
        { provide: LogService, useValue: mockLogService },
        { provide: DeviceTrustServiceAbstraction, useValue: mockDeviceTrustService },
        { provide: SyncService, useValue: mockSyncService },
        { provide: InternalPolicyService, useValue: mockPolicyService },
        { provide: PasswordStrengthServiceAbstraction, useValue: mockPasswordStrengthService },
        { provide: ToastService, useValue: mockToastService },
        {
          provide: UserAsymmetricKeysRegenerationService,
          useValue: mockUserAsymmetricKeysRegenerationService,
        },
        { provide: BiometricsService, useValue: mockBiometricService },
        { provide: LogoutService, useValue: mockLogoutService },
        { provide: LockComponentService, useValue: mockLockComponentService },
        { provide: AnonLayoutWrapperDataService, useValue: mockAnonLayoutWrapperDataService },
        { provide: BroadcasterService, useValue: mockBroadcasterService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    })
      .overrideProvider(DialogService, { useValue: mockDialogService })
      .compileComponents();

    fixture = TestBed.createComponent(LockComponent);
    component = fixture.componentInstance;
  });

  describe("when master password unlock is active", () => {
    let form: DebugElement;

    beforeEach(async () => {
      const unlockOptions: UnlockOptions = {
        masterPassword: { enabled: true },
        pin: { enabled: false },
        biometrics: {
          enabled: false,
          biometricsStatus: BiometricsStatus.NotEnabledLocally,
        },
      };

      component.activeUnlockOption = UnlockOption.MasterPassword;
      mockLockComponentService.getAvailableUnlockOptions$.mockReturnValue(of(unlockOptions));
      await mockAccountService.switchAccount(userId);
      mockPlatformUtilsService.getClientType.mockReturnValue(ClientType.Web);

      mockI18nService.t.mockImplementation((key: string) => {
        switch (key) {
          case "unlock":
            return "Unlock";
          case "logOut":
            return "Log Out";
          case "logOutConfirmation":
            return "Confirm Log Out";
          case "masterPass":
            return "Master Password";
        }
        return "";
      });

      // Trigger ngOnInit
      fixture.detectChanges();

      // Wait for html loading to complete
      await firstValueFrom(
        interval(10).pipe(
          map(() => component["loading"]),
          takeWhile((loading) => loading, true),
          timeout(5000),
        ),
      );

      // Wait for html to render
      fixture.detectChanges();

      form = fixture.debugElement.query(By.css("form"));
    });

    describe("form rendering", () => {
      it("should render form with label", () => {
        expect(form).toBeTruthy();
        expect(form.nativeElement).toBeInstanceOf(HTMLFormElement);

        const bitLabel = form.query(By.css("bit-label"));
        expect(bitLabel).toBeTruthy();
        expect(bitLabel.nativeElement).toBeInstanceOf(HTMLElement);
        expect((bitLabel.nativeElement as HTMLElement).textContent?.trim()).toBe("Master Password");
      });

      it("should render master password input field", () => {
        const input = form.query(By.css('input[formControlName="masterPassword"]'));

        expect(input).toBeTruthy();
        expect(input.nativeElement).toBeInstanceOf(HTMLInputElement);
        const inputElement = input.nativeElement as HTMLInputElement;
        expect(inputElement.type).toEqual("password");
        expect(inputElement.name).toEqual("masterPassword");
        expect(inputElement.required).toEqual(true);
        expect(inputElement.attributes).toHaveProperty("bitInput");
      });

      it("should render password toggle button", () => {
        const toggleButton = form.query(By.css("button[bitPasswordInputToggle]"));

        expect(toggleButton).toBeTruthy();
        expect(toggleButton.nativeElement).toBeInstanceOf(HTMLButtonElement);
        const toggleButtonElement = toggleButton.nativeElement as HTMLButtonElement;
        expect(toggleButtonElement.type).toEqual("button");
        expect(toggleButtonElement.attributes).toHaveProperty("bitIconButton");
      });

      it("should render unlock submit button", () => {
        const submitButton = form.query(By.css('button[type="submit"]'));

        expect(submitButton).toBeTruthy();
        expect(submitButton.nativeElement).toBeInstanceOf(HTMLButtonElement);
        const submitButtonElement = submitButton.nativeElement as HTMLButtonElement;
        expect(submitButtonElement.type).toEqual("submit");
        expect(submitButtonElement.attributes).toHaveProperty("bitButton");
        expect(submitButtonElement.attributes).toHaveProperty("bitFormButton");
        expect(submitButtonElement.textContent?.trim()).toEqual("Unlock");
      });

      it("should render logout button", () => {
        const logoutButton = form.query(
          By.css('button[type="button"]:not([bitPasswordInputToggle])'),
        );

        expect(logoutButton).toBeTruthy();
        expect(logoutButton.nativeElement).toBeInstanceOf(HTMLButtonElement);
        const logoutButtonElement = logoutButton.nativeElement as HTMLButtonElement;
        expect(logoutButtonElement.type).toEqual("button");
        expect(logoutButtonElement.textContent?.trim()).toEqual("Log Out");
      });
    });

    describe("unlock", () => {
      it("should unlock with master password when unlock button is clicked", async () => {
        const unlockViaMasterPasswordFunction = jest
          .spyOn(component, "unlockViaMasterPassword")
          .mockImplementation();
        const submitButton = form.query(By.css('button[type="submit"]'));
        expect(submitButton).toBeTruthy();
        expect(submitButton.nativeElement).toBeInstanceOf(HTMLButtonElement);
        const submitButtonElement = submitButton.nativeElement as HTMLButtonElement;
        submitButtonElement.click();

        expect(unlockViaMasterPasswordFunction).toHaveBeenCalled();
      });
    });

    describe("logout", () => {
      it("should logout when logout button is clicked", async () => {
        const logOut = jest.spyOn(component, "logOut").mockImplementation();
        const logoutButton = form.query(
          By.css('button[type="button"]:not([bitPasswordInputToggle])'),
        );

        expect(logoutButton).toBeTruthy();
        expect(logoutButton.nativeElement).toBeInstanceOf(HTMLButtonElement);
        const logoutButtonElement = logoutButton.nativeElement as HTMLButtonElement;

        logoutButtonElement.click();

        expect(logOut).toHaveBeenCalled();
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
        expect(component.showPassword).toEqual(false);
        expect(inputElement.type).toEqual("password");

        // Click toggle button
        toggleButtonElement.click();
        fixture.detectChanges();

        expect(component.showPassword).toEqual(true);
        expect(inputElement.type).toEqual("text");

        // Click toggle button again
        toggleButtonElement.click();
        fixture.detectChanges();

        expect(component.showPassword).toEqual(false);
        expect(inputElement.type).toEqual("password");
      });
    });
  });

  describe("successfulMasterPasswordUnlock", () => {
    const mockUserKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;
    const masterPassword = "test-password";

    beforeEach(async () => {
      component.activeAccount = await firstValueFrom(mockAccountService.activeAccount$);
    });

    it.each([
      [undefined as unknown as UserKey, undefined as unknown as string],
      [null as unknown as UserKey, null as unknown as string],
      [mockUserKey, undefined as unknown as string],
      [mockUserKey, null as unknown as string],
      [mockUserKey, ""],
      [undefined as unknown as UserKey, masterPassword],
      [null as unknown as UserKey, masterPassword],
    ])(
      "logs an error and doesn't unlock when called with invalid data",
      async (userKey, masterPassword) => {
        await component.successfulMasterPasswordUnlock({ userKey, masterPassword });

        expect(mockLogService.error).toHaveBeenCalledWith(
          "[LockComponent] successfulMasterPasswordUnlock called with invalid data.",
        );
        expect(mockKeyService.setUserKey).not.toHaveBeenCalled();
      },
    );

    it.each([
      [false, undefined, false],
      [false, { enforceOnLogin: false } as MasterPasswordPolicyOptions, false],
      [false, { enforceOnLogin: false } as MasterPasswordPolicyOptions, true],
      [true, { enforceOnLogin: true } as MasterPasswordPolicyOptions, false],
      [false, { enforceOnLogin: true } as MasterPasswordPolicyOptions, true],
    ])(
      "unlocks and force set password change = %o when master password on login = %o and evaluated password against policy = %o and policy loaded from policy service",
      async (forceSetPassword, masterPasswordPolicyOptions, evaluatedMasterPassword) => {
        mockPolicyService.masterPasswordPolicyOptions$.mockReturnValue(
          of(masterPasswordPolicyOptions),
        );
        const passwordStrengthResult = { score: 1 } as ZXCVBNResult;
        mockPasswordStrengthService.getPasswordStrength.mockReturnValue(passwordStrengthResult);
        mockPolicyService.evaluateMasterPassword.mockReturnValue(evaluatedMasterPassword);

        await component.successfulMasterPasswordUnlock({ userKey: mockUserKey, masterPassword });

        assertUnlocked();
        expect(mockPolicyService.masterPasswordPolicyOptions$).toHaveBeenCalledWith(userId);
        if (masterPasswordPolicyOptions?.enforceOnLogin) {
          expect(mockPasswordStrengthService.getPasswordStrength).toHaveBeenCalledWith(
            masterPassword,
            component.activeAccount!.email,
          );
          expect(mockPolicyService.evaluateMasterPassword).toHaveBeenCalledWith(
            passwordStrengthResult.score,
            masterPassword,
            masterPasswordPolicyOptions,
          );
        }
        if (forceSetPassword) {
          expect(mockMasterPasswordService.setForceSetPasswordReason).toHaveBeenCalledWith(
            ForceSetPasswordReason.WeakMasterPassword,
            userId,
          );
        } else {
          expect(mockMasterPasswordService.setForceSetPasswordReason).not.toHaveBeenCalled();
        }
      },
    );

    it.each([
      [true, ClientType.Browser],
      [false, ClientType.Cli],
      [false, ClientType.Desktop],
      [false, ClientType.Web],
    ])(
      "unlocks and navigate by url to previous url = %o when client type = %o and previous url was set",
      async (shouldNavigate, clientType) => {
        const previousUrl = "/test-url";
        component.clientType = clientType;
        mockLockComponentService.getPreviousUrl.mockReturnValue(previousUrl);

        await component.successfulMasterPasswordUnlock({ userKey: mockUserKey, masterPassword });

        assertUnlocked();
        if (shouldNavigate) {
          expect(mockRouter.navigateByUrl).toHaveBeenCalledWith(previousUrl);
        } else {
          expect(mockRouter.navigateByUrl).not.toHaveBeenCalled();
        }
      },
    );

    it.each([
      ["/tabs/current", ClientType.Browser],
      [undefined, ClientType.Cli],
      ["vault", ClientType.Desktop],
      ["vault", ClientType.Web],
    ])(
      "unlocks and navigate to success url = %o when client type = %o",
      async (navigateUrl, clientType) => {
        component.clientType = clientType;
        mockLockComponentService.getPreviousUrl.mockReturnValue(null);

        await component.successfulMasterPasswordUnlock({ userKey: mockUserKey, masterPassword });

        assertUnlocked();
        expect(mockRouter.navigate).toHaveBeenCalledWith([navigateUrl]);
      },
    );

    it("unlocks and close browser extension popout on firefox extension", async () => {
      component.shouldClosePopout = true;
      mockPlatformUtilsService.getDevice.mockReturnValue(DeviceType.FirefoxExtension);

      await component.successfulMasterPasswordUnlock({ userKey: mockUserKey, masterPassword });

      assertUnlocked();
      expect(mockLockComponentService.closeBrowserExtensionPopout).toHaveBeenCalled();
    });

    function assertUnlocked(): void {
      expect(mockKeyService.setUserKey).toHaveBeenCalledWith(
        mockUserKey,
        component.activeAccount!.id,
      );
    }
  });

  describe("unlockViaMasterPassword", () => {
    const mockMasterKey = new SymmetricCryptoKey(new Uint8Array(64)) as MasterKey;
    const masterPasswordVerificationResponse: MasterPasswordVerificationResponse = {
      masterKey: mockMasterKey,
      kdfConfig: new PBKDF2KdfConfig(600_001),
      email: "test-email@example.com",
      policyOptions: null,
    };
    const mockUserKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;
    const masterPassword = "test-password";

    beforeEach(async () => {
      mockI18nService.t.mockImplementation((key: string) => {
        switch (key) {
          case "errorOccurred":
            return "Error Occurred";
          case "masterPasswordRequired":
            return "Master Password is required";
          case "invalidMasterPassword":
            return "Invalid Master Password";
        }
        return "";
      });

      component.buildMasterPasswordForm();
      component.formGroup!.controls.masterPassword.setValue(masterPassword);
      component.activeAccount = await firstValueFrom(mockAccountService.activeAccount$);
      mockUserVerificationService.verifyUserByMasterPassword.mockResolvedValue(
        masterPasswordVerificationResponse,
      );
      mockMasterPasswordService.decryptUserKeyWithMasterKey.mockResolvedValue(mockUserKey);
    });

    it("should not unlock and show password invalid toast when master password is empty", async () => {
      component.formGroup!.controls.masterPassword.setValue("");

      await component.unlockViaMasterPassword();

      expect(mockToastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        title: "Error Occurred",
        message: "Master Password is required",
      });
      expect(mockKeyService.setUserKey).not.toHaveBeenCalled();
    });

    it("should not unlock when no active account", async () => {
      component.activeAccount = null;

      await component.unlockViaMasterPassword();

      expect(mockToastService.showToast).not.toHaveBeenCalled();
      expect(mockKeyService.setUserKey).not.toHaveBeenCalled();
    });

    it("should not unlock when no form group", async () => {
      component.formGroup = null;

      await component.unlockViaMasterPassword();

      expect(mockToastService.showToast).not.toHaveBeenCalled();
      expect(mockKeyService.setUserKey).not.toHaveBeenCalled();
    });

    it("should not unlock when input password verification failed due to invalid password", async () => {
      mockUserVerificationService.verifyUserByMasterPassword.mockRejectedValueOnce(
        new Error("invalid password"),
      );

      await component.unlockViaMasterPassword();

      expect(mockToastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        title: "Error Occurred",
        message: "Invalid Master Password",
      });
      expect(mockUserVerificationService.verifyUserByMasterPassword).toHaveBeenCalledWith(
        {
          type: VerificationType.MasterPassword,
          secret: masterPassword,
        } as MasterPasswordVerification,
        userId,
        component.activeAccount!.email,
      );
      expect(mockKeyService.setUserKey).not.toHaveBeenCalled();
    });

    it("should not unlock when valid password but user have no user key", async () => {
      mockMasterPasswordService.decryptUserKeyWithMasterKey.mockResolvedValue(null);

      await component.unlockViaMasterPassword();

      expect(mockToastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        title: "Error Occurred",
        message: "Invalid Master Password",
      });
      expect(mockMasterPasswordService.decryptUserKeyWithMasterKey).toHaveBeenCalledWith(
        mockMasterKey,
        userId,
      );
      expect(mockKeyService.setUserKey).not.toHaveBeenCalled();
    });

    it("should unlock and set user key and sync when valid password", async () => {
      await component.unlockViaMasterPassword();

      assertUnlocked();
      expect(mockRouter.navigateByUrl).not.toHaveBeenCalled();
    });

    it.each([
      [false, undefined, false],
      [false, { enforceOnLogin: false } as MasterPasswordPolicyOptions, false],
      [false, { enforceOnLogin: false } as MasterPasswordPolicyOptions, true],
      [true, { enforceOnLogin: true } as MasterPasswordPolicyOptions, false],
      [false, { enforceOnLogin: true } as MasterPasswordPolicyOptions, true],
    ])(
      "should unlock and force set password change = %o when master password on login = %o and evaluated password against policy = %o and policy set during user verification by master password",
      async (forceSetPassword, masterPasswordPolicyOptions, evaluatedMasterPassword) => {
        mockUserVerificationService.verifyUserByMasterPassword.mockResolvedValue({
          ...masterPasswordVerificationResponse,
          policyOptions:
            masterPasswordPolicyOptions != null
              ? new MasterPasswordPolicyResponse({
                  EnforceOnLogin: masterPasswordPolicyOptions.enforceOnLogin,
                })
              : null,
        } as MasterPasswordVerificationResponse);
        const passwordStrengthResult = { score: 1 } as ZXCVBNResult;
        mockPasswordStrengthService.getPasswordStrength.mockReturnValue(passwordStrengthResult);
        mockPolicyService.evaluateMasterPassword.mockReturnValue(evaluatedMasterPassword);

        await component.unlockViaMasterPassword();

        assertUnlocked();
        if (masterPasswordPolicyOptions?.enforceOnLogin) {
          expect(mockPasswordStrengthService.getPasswordStrength).toHaveBeenCalledWith(
            masterPassword,
            component.activeAccount!.email,
          );
          expect(mockPolicyService.evaluateMasterPassword).toHaveBeenCalledWith(
            passwordStrengthResult.score,
            masterPassword,
            masterPasswordPolicyOptions,
          );
        }
        if (forceSetPassword) {
          expect(mockMasterPasswordService.setForceSetPasswordReason).toHaveBeenCalledWith(
            ForceSetPasswordReason.WeakMasterPassword,
            userId,
          );
        } else {
          expect(mockMasterPasswordService.setForceSetPasswordReason).not.toHaveBeenCalled();
        }
      },
    );

    it.each([
      [false, undefined, false],
      [false, { enforceOnLogin: false } as MasterPasswordPolicyOptions, false],
      [false, { enforceOnLogin: false } as MasterPasswordPolicyOptions, true],
      [true, { enforceOnLogin: true } as MasterPasswordPolicyOptions, false],
      [false, { enforceOnLogin: true } as MasterPasswordPolicyOptions, true],
    ])(
      "should unlock and force set password change = %o when master password on login = %o and evaluated password against policy = %o and policy loaded from policy service",
      async (forceSetPassword, masterPasswordPolicyOptions, evaluatedMasterPassword) => {
        mockPolicyService.masterPasswordPolicyOptions$.mockReturnValue(
          of(masterPasswordPolicyOptions),
        );
        const passwordStrengthResult = { score: 1 } as ZXCVBNResult;
        mockPasswordStrengthService.getPasswordStrength.mockReturnValue(passwordStrengthResult);
        mockPolicyService.evaluateMasterPassword.mockReturnValue(evaluatedMasterPassword);

        await component.unlockViaMasterPassword();

        assertUnlocked();
        expect(mockPolicyService.masterPasswordPolicyOptions$).toHaveBeenCalledWith(userId);
        if (masterPasswordPolicyOptions?.enforceOnLogin) {
          expect(mockPasswordStrengthService.getPasswordStrength).toHaveBeenCalledWith(
            masterPassword,
            component.activeAccount!.email,
          );
          expect(mockPolicyService.evaluateMasterPassword).toHaveBeenCalledWith(
            passwordStrengthResult.score,
            masterPassword,
            masterPasswordPolicyOptions,
          );
        }
        if (forceSetPassword) {
          expect(mockMasterPasswordService.setForceSetPasswordReason).toHaveBeenCalledWith(
            ForceSetPasswordReason.WeakMasterPassword,
            userId,
          );
        } else {
          expect(mockMasterPasswordService.setForceSetPasswordReason).not.toHaveBeenCalled();
        }
      },
    );

    it.each([
      [true, ClientType.Browser],
      [false, ClientType.Cli],
      [false, ClientType.Desktop],
      [false, ClientType.Web],
    ])(
      "should unlock and navigate by url to previous url = %o when client type = %o and previous url was set",
      async (shouldNavigate, clientType) => {
        const previousUrl = "/test-url";
        component.clientType = clientType;
        mockLockComponentService.getPreviousUrl.mockReturnValue(previousUrl);

        await component.unlockViaMasterPassword();

        assertUnlocked();
        if (shouldNavigate) {
          expect(mockRouter.navigateByUrl).toHaveBeenCalledWith(previousUrl);
        } else {
          expect(mockRouter.navigateByUrl).not.toHaveBeenCalled();
        }
      },
    );

    it.each([
      ["/tabs/current", ClientType.Browser],
      [undefined, ClientType.Cli],
      ["vault", ClientType.Desktop],
      ["vault", ClientType.Web],
    ])(
      "should unlock and navigate to success url = %o when client type = %o",
      async (navigateUrl, clientType) => {
        component.clientType = clientType;
        mockLockComponentService.getPreviousUrl.mockReturnValue(null);

        await component.unlockViaMasterPassword();

        assertUnlocked();
        expect(mockRouter.navigate).toHaveBeenCalledWith([navigateUrl]);
      },
    );

    it("should unlock and close browser extension popout on firefox extension", async () => {
      component.shouldClosePopout = true;
      mockPlatformUtilsService.getDevice.mockReturnValue(DeviceType.FirefoxExtension);

      await component.unlockViaMasterPassword();

      assertUnlocked();
      expect(mockLockComponentService.closeBrowserExtensionPopout).toHaveBeenCalled();
    });

    function assertUnlocked() {
      expect(mockToastService.showToast).not.toHaveBeenCalled();
      expect(mockMasterPasswordService.decryptUserKeyWithMasterKey).toHaveBeenCalledWith(
        mockMasterKey,
        userId,
      );
      expect(mockKeyService.setUserKey).toHaveBeenCalledWith(mockUserKey, userId);
      expect(mockDeviceTrustService.trustDeviceIfRequired).toHaveBeenCalledWith(userId);
      expect(mockBiometricStateService.resetUserPromptCancelled).toHaveBeenCalled();
      expect(mockMessagingService.send).toHaveBeenCalledWith("unlocked");
      expect(mockSyncService.fullSync).toHaveBeenCalledWith(false);
      expect(mockUserAsymmetricKeysRegenerationService.regenerateIfNeeded).toHaveBeenCalledWith(
        userId,
      );
    }
  });

  describe("logOut", () => {
    it("should log out user and redirect to login page when dialog confirmed", async () => {
      mockDialogService.openSimpleDialog.mockResolvedValue(true);
      component.activeAccount = await firstValueFrom(mockAccountService.activeAccount$);

      await component.logOut();

      expect(mockDialogService.openSimpleDialog).toHaveBeenCalledWith({
        title: { key: "logOut" },
        content: { key: "logOutConfirmation" },
        acceptButtonText: { key: "logOut" },
        type: "warning",
      });
      expect(mockLogoutService.logout).toHaveBeenCalledWith(userId);
      expect(mockRouter.navigate).toHaveBeenCalledWith(["/"]);
    });

    it("should not log out user when dialog cancelled", async () => {
      mockDialogService.openSimpleDialog.mockResolvedValue(false);
      component.activeAccount = await firstValueFrom(mockAccountService.activeAccount$);

      await component.logOut();

      expect(mockDialogService.openSimpleDialog).toHaveBeenCalledWith({
        title: { key: "logOut" },
        content: { key: "logOutConfirmation" },
        acceptButtonText: { key: "logOut" },
        type: "warning",
      });
      expect(mockLogoutService.logout).not.toHaveBeenCalled();
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });

    it("should not log out user when user already logged out", async () => {
      mockDialogService.openSimpleDialog.mockResolvedValue(true);
      component.activeAccount = null;

      await component.logOut();

      expect(mockDialogService.openSimpleDialog).toHaveBeenCalledWith({
        title: { key: "logOut" },
        content: { key: "logOutConfirmation" },
        acceptButtonText: { key: "logOut" },
        type: "warning",
      });
      expect(mockLogoutService.logout).not.toHaveBeenCalled();
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });
  });
});
