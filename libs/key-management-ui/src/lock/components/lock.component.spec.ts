import { ComponentFixture, TestBed, fakeAsync, tick } from "@angular/core/testing";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { mock } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";
import { ZXCVBNResult } from "zxcvbn";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { LogoutService } from "@bitwarden/auth/common";
import { InternalPolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { ClientType, DeviceType } from "@bitwarden/common/enums";
import { DeviceTrustServiceAbstraction } from "@bitwarden/common/key-management/device-trust/abstractions/device-trust.service.abstraction";
import { EncryptedMigrator } from "@bitwarden/common/key-management/encrypted-migrator/encrypted-migrator.abstraction";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { PinServiceAbstraction } from "@bitwarden/common/key-management/pin/pin.service.abstraction";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { SyncService } from "@bitwarden/common/platform/sync";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
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
  UserAsymmetricKeysRegenerationService,
} from "@bitwarden/key-management";

import {
  LockComponentService,
  UnlockOption,
  UnlockOptionValue,
  UnlockOptions,
} from "../services/lock-component.service";
import { WebAuthnPrfUnlockService } from "../services/webauthn-prf-unlock.service";

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
  const mockWebAuthnPrfUnlockService = mock<WebAuthnPrfUnlockService>();
  const mockEncryptedMigrator = mock<EncryptedMigrator>();
  const mockActivatedRoute = {
    snapshot: {
      paramMap: {
        get: jest.fn().mockReturnValue(null), // return null for 'disable-redirect' param
      },
    },
  };

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
        { provide: WebAuthnPrfUnlockService, useValue: mockWebAuthnPrfUnlockService },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        { provide: EncryptedMigrator, useValue: mockEncryptedMigrator },
      ],
    })
      .overrideProvider(DialogService, { useValue: mockDialogService })
      .compileComponents();

    fixture = TestBed.createComponent(LockComponent);
    component = fixture.componentInstance;
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

        jest.spyOn(component as any, "doContinue").mockImplementation(async () => {
          await mockBiometricStateService.resetUserPromptCancelled();
          mockMessagingService.send("unlocked");
          await mockSyncService.fullSync(false);
          await mockUserAsymmetricKeysRegenerationService.regenerateIfNeeded(userId);
          await mockRouter.navigate([navigateUrl]);
        });

        await component.successfulMasterPasswordUnlock({ userKey: mockUserKey, masterPassword });

        assertUnlocked();
        expect(mockRouter.navigate).toHaveBeenCalledWith([navigateUrl]);
      },
    );

    it("unlocks and close browser extension popout on firefox extension", async () => {
      component.shouldClosePopout = true;
      mockPlatformUtilsService.getDevice.mockReturnValue(DeviceType.FirefoxExtension);

      jest.spyOn(component as any, "doContinue").mockImplementation(async () => {
        await mockBiometricStateService.resetUserPromptCancelled();
        mockMessagingService.send("unlocked");
        await mockSyncService.fullSync(false);
        await mockUserAsymmetricKeysRegenerationService.regenerateIfNeeded(
          component.activeAccount!.id,
        );
        mockLockComponentService.closeBrowserExtensionPopout();
      });

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

  describe("setDefaultActiveUnlockOption", () => {
    it.each([
      [
        "biometrics enabled",
        {
          biometrics: { enabled: true, biometricsStatus: BiometricsStatus.Available },
          pin: { enabled: false },
          masterPassword: { enabled: false },
        } as UnlockOptions,
        UnlockOption.Biometrics,
      ],
      [
        "biometrics disabled, pin enabled",
        {
          biometrics: { enabled: false, biometricsStatus: BiometricsStatus.NotEnabledLocally },
          pin: { enabled: true },
          masterPassword: { enabled: false },
        } as UnlockOptions,
        UnlockOption.Pin,
      ],
      [
        "biometrics and pin disabled, masterPassword enabled",
        {
          biometrics: { enabled: false, biometricsStatus: BiometricsStatus.NotEnabledLocally },
          pin: { enabled: false },
          masterPassword: { enabled: true },
        } as UnlockOptions,
        UnlockOption.MasterPassword,
      ],
      [
        "hardware unavailable, no other options",
        {
          biometrics: { enabled: false, biometricsStatus: BiometricsStatus.HardwareUnavailable },
          pin: { enabled: false },
          masterPassword: { enabled: false },
        } as UnlockOptions,
        UnlockOption.Biometrics,
      ],
      [
        "desktop disconnected, no other options",
        {
          biometrics: { enabled: false, biometricsStatus: BiometricsStatus.DesktopDisconnected },
          pin: { enabled: false },
          masterPassword: { enabled: false },
        } as UnlockOptions,
        UnlockOption.Biometrics,
      ],
      [
        "not enabled in connected desktop app, no other options",
        {
          biometrics: {
            enabled: false,
            biometricsStatus: BiometricsStatus.NotEnabledInConnectedDesktopApp,
          },
          pin: { enabled: false },
          masterPassword: { enabled: false },
        } as UnlockOptions,
        UnlockOption.Biometrics,
      ],
      [
        "biometrics over pin priority",
        {
          biometrics: { enabled: true, biometricsStatus: BiometricsStatus.Available },
          pin: { enabled: true },
          masterPassword: { enabled: false },
        } as UnlockOptions,
        UnlockOption.Biometrics,
      ],
      [
        "biometrics over masterPassword priority",
        {
          biometrics: { enabled: true, biometricsStatus: BiometricsStatus.Available },
          pin: { enabled: false },
          masterPassword: { enabled: true },
        } as UnlockOptions,
        UnlockOption.Biometrics,
      ],
      [
        "pin over masterPassword priority",
        {
          biometrics: { enabled: false, biometricsStatus: BiometricsStatus.NotEnabledLocally },
          pin: { enabled: true },
          masterPassword: { enabled: true },
        } as UnlockOptions,
        UnlockOption.Pin,
      ],
      [
        "all options enabled",
        {
          biometrics: { enabled: true, biometricsStatus: BiometricsStatus.Available },
          pin: { enabled: true },
          masterPassword: { enabled: true },
        } as UnlockOptions,
        UnlockOption.Biometrics,
      ],
    ])(
      "should set active unlock option to $1 when %s",
      async (
        description: string,
        unlockOptions: UnlockOptions,
        expectedOption: UnlockOptionValue,
      ) => {
        await component["setDefaultActiveUnlockOption"](unlockOptions);

        expect(component.activeUnlockOption).toBe(expectedOption);
      },
    );
  });

  describe("handleActiveAccountChange", () => {
    const mockActiveAccount: Account = {
      id: userId,
      email: "test@example.com",
      name: "Test User",
    } as Account;

    beforeEach(async () => {
      component.activeAccount = mockActiveAccount;
    });

    it("should return early when account already has user key", async () => {
      mockKeyService.hasUserKey.mockResolvedValue(true);

      await component["handleActiveAccountChange"](mockActiveAccount);

      expect(mockKeyService.hasUserKey).toHaveBeenCalledWith(userId);
      expect(mockAnonLayoutWrapperDataService.setAnonLayoutWrapperData).not.toHaveBeenCalled();
    });

    it("should set email as page subtitle when account is unlocked", async () => {
      mockKeyService.hasUserKey.mockResolvedValue(false);
      mockLockComponentService.getAvailableUnlockOptions$.mockReturnValue(
        of({
          biometrics: { enabled: true, biometricsStatus: BiometricsStatus.Available },
          pin: { enabled: false },
          masterPassword: { enabled: false },
        } as UnlockOptions),
      );
      mockBiometricService.getBiometricsStatusForUser.mockResolvedValue(BiometricsStatus.Available);

      await component["handleActiveAccountChange"](mockActiveAccount);

      expect(mockAnonLayoutWrapperDataService.setAnonLayoutWrapperData).toHaveBeenCalledWith({
        pageSubtitle: mockActiveAccount.email,
      });
    });

    it("should logout user when no unlock options are available", async () => {
      mockKeyService.hasUserKey.mockResolvedValue(false);
      mockLockComponentService.getAvailableUnlockOptions$.mockReturnValue(
        of({
          biometrics: { enabled: false, biometricsStatus: BiometricsStatus.UnlockNeeded },
          pin: { enabled: false },
          masterPassword: { enabled: false },
        } as UnlockOptions),
      );
      mockBiometricService.getBiometricsStatusForUser.mockResolvedValue(
        BiometricsStatus.UnlockNeeded,
      );

      await component["handleActiveAccountChange"](mockActiveAccount);

      expect(mockLogService.warning).toHaveBeenCalledWith(
        "[LockComponent] User cannot unlock again. Logging out!",
      );
      expect(mockLogoutService.logout).toHaveBeenCalledWith(userId);
    });

    it("should not logout when master password is enabled", async () => {
      mockKeyService.hasUserKey.mockResolvedValue(false);
      mockLockComponentService.getAvailableUnlockOptions$.mockReturnValue(
        of({
          biometrics: { enabled: false, biometricsStatus: BiometricsStatus.UnlockNeeded },
          pin: { enabled: false },
          masterPassword: { enabled: true },
        } as UnlockOptions),
      );
      mockBiometricService.getBiometricsStatusForUser.mockResolvedValue(
        BiometricsStatus.UnlockNeeded,
      );

      await component["handleActiveAccountChange"](mockActiveAccount);

      expect(mockLogoutService.logout).not.toHaveBeenCalled();
      expect(component.activeUnlockOption).toBe(UnlockOption.MasterPassword);
    });

    it("should not logout when pin is enabled", async () => {
      mockKeyService.hasUserKey.mockResolvedValue(false);
      mockLockComponentService.getAvailableUnlockOptions$.mockReturnValue(
        of({
          biometrics: { enabled: false, biometricsStatus: BiometricsStatus.UnlockNeeded },
          pin: { enabled: true },
          masterPassword: { enabled: false },
        } as UnlockOptions),
      );
      mockBiometricService.getBiometricsStatusForUser.mockResolvedValue(
        BiometricsStatus.UnlockNeeded,
      );

      await component["handleActiveAccountChange"](mockActiveAccount);

      expect(mockLogoutService.logout).not.toHaveBeenCalled();
      expect(component.activeUnlockOption).toBe(UnlockOption.Pin);
    });

    it("should not logout when biometrics is available", async () => {
      mockKeyService.hasUserKey.mockResolvedValue(false);
      mockLockComponentService.getAvailableUnlockOptions$.mockReturnValue(
        of({
          biometrics: { enabled: true, biometricsStatus: BiometricsStatus.Available },
          pin: { enabled: false },
          masterPassword: { enabled: false },
        } as UnlockOptions),
      );
      mockBiometricService.getBiometricsStatusForUser.mockResolvedValue(BiometricsStatus.Available);

      await component["handleActiveAccountChange"](mockActiveAccount);

      expect(mockLogoutService.logout).not.toHaveBeenCalled();
      expect(component.activeUnlockOption).toBe(UnlockOption.Biometrics);
    });

    it("should not logout when biometrics is temporarily unavailable but no other options", async () => {
      mockKeyService.hasUserKey.mockResolvedValue(false);
      mockLockComponentService.getAvailableUnlockOptions$.mockReturnValue(
        of({
          biometrics: {
            enabled: false,
            biometricsStatus: BiometricsStatus.HardwareUnavailable,
          },
          pin: { enabled: false },
          masterPassword: { enabled: false },
        } as UnlockOptions),
      );
      mockBiometricService.getBiometricsStatusForUser.mockResolvedValue(
        BiometricsStatus.HardwareUnavailable,
      );

      await component["handleActiveAccountChange"](mockActiveAccount);

      expect(mockLogoutService.logout).not.toHaveBeenCalled();
      expect(component.activeUnlockOption).toBe(UnlockOption.Biometrics);
    });
  });

  describe("listenForUnlockOptionsChanges", () => {
    const mockActiveAccount: Account = {
      id: userId,
      email: "test@example.com",
      name: "Test User",
    } as Account;

    const mockUnlockOptions: UnlockOptions = {
      masterPassword: { enabled: true },
      pin: { enabled: false },
      biometrics: { enabled: false, biometricsStatus: BiometricsStatus.Available },
      prf: { enabled: false },
    };

    beforeEach(() => {
      (component as any).loading = false;
      component.activeAccount = mockActiveAccount;
      component.activeUnlockOption = null;
      component.unlockOptions = null;
      mockLockComponentService.getAvailableUnlockOptions$.mockReturnValue(of(mockUnlockOptions));
    });

    it("skips polling when loading is true", fakeAsync(() => {
      (component as any).loading = true;

      component["listenForUnlockOptionsChanges"]();
      tick(0);

      expect(mockLockComponentService.getAvailableUnlockOptions$).not.toHaveBeenCalled();
    }));

    it("skips polling when activeAccount is null", fakeAsync(() => {
      component.activeAccount = null;

      component["listenForUnlockOptionsChanges"]();
      tick(0);

      expect(mockLockComponentService.getAvailableUnlockOptions$).not.toHaveBeenCalled();
    }));

    it("fetches unlock options when loading is false and activeAccount exists", fakeAsync(() => {
      component["listenForUnlockOptionsChanges"]();
      tick(0);

      expect(mockLockComponentService.getAvailableUnlockOptions$).toHaveBeenCalledWith(userId);
      expect(component.unlockOptions).toEqual(mockUnlockOptions);
    }));

    it("calls getAvailableUnlockOptions$ at 1000ms intervals", fakeAsync(() => {
      component["listenForUnlockOptionsChanges"]();

      // Initial timer fire at 0ms
      tick(0);
      expect(mockLockComponentService.getAvailableUnlockOptions$).toHaveBeenCalledTimes(1);

      // First poll at 1000ms
      tick(1000);
      expect(mockLockComponentService.getAvailableUnlockOptions$).toHaveBeenCalledTimes(2);

      // Second poll at 2000ms
      tick(1000);
      expect(mockLockComponentService.getAvailableUnlockOptions$).toHaveBeenCalledTimes(3);
    }));

    it("calls setDefaultActiveUnlockOption when activeUnlockOption is null", fakeAsync(() => {
      component.activeUnlockOption = null;
      const setDefaultSpy = jest.spyOn(component as any, "setDefaultActiveUnlockOption");

      component["listenForUnlockOptionsChanges"]();
      tick(0);

      expect(setDefaultSpy).toHaveBeenCalledWith(mockUnlockOptions);
    }));

    it("does NOT call setDefaultActiveUnlockOption when activeUnlockOption is already set", fakeAsync(() => {
      component.activeUnlockOption = UnlockOption.MasterPassword;
      component.unlockOptions = mockUnlockOptions;

      const setDefaultSpy = jest.spyOn(component as any, "setDefaultActiveUnlockOption");

      component["listenForUnlockOptionsChanges"]();
      tick(0);

      expect(setDefaultSpy).not.toHaveBeenCalled();
    }));

    it("calls setDefaultActiveUnlockOption when biometrics becomes enabled", fakeAsync(() => {
      component.activeUnlockOption = UnlockOption.MasterPassword;

      // Start with biometrics disabled
      component.unlockOptions = {
        masterPassword: { enabled: true },
        pin: { enabled: false },
        biometrics: { enabled: false, biometricsStatus: BiometricsStatus.Available },
        prf: { enabled: false },
      };

      // Mock response with biometrics enabled
      const newUnlockOptions: UnlockOptions = {
        masterPassword: { enabled: true },
        pin: { enabled: false },
        biometrics: { enabled: true, biometricsStatus: BiometricsStatus.Available },
        prf: { enabled: false },
      };

      mockLockComponentService.getAvailableUnlockOptions$.mockReturnValue(of(newUnlockOptions));

      const setDefaultSpy = jest.spyOn(component as any, "setDefaultActiveUnlockOption");
      const handleBioSpy = jest.spyOn(component as any, "handleBiometricsUnlockEnabled");

      component["listenForUnlockOptionsChanges"]();
      tick(0);

      expect(setDefaultSpy).toHaveBeenCalledWith(newUnlockOptions);
      expect(handleBioSpy).toHaveBeenCalled();
    }));

    it("does NOT call setDefaultActiveUnlockOption when biometrics was already enabled", fakeAsync(() => {
      component.activeUnlockOption = UnlockOption.MasterPassword;

      // Start with biometrics already enabled
      component.unlockOptions = {
        masterPassword: { enabled: true },
        pin: { enabled: false },
        biometrics: { enabled: true, biometricsStatus: BiometricsStatus.Available },
        prf: { enabled: false },
      };

      // Mock response with biometrics still enabled
      const newUnlockOptions: UnlockOptions = {
        masterPassword: { enabled: true },
        pin: { enabled: false },
        biometrics: { enabled: true, biometricsStatus: BiometricsStatus.Available },
        prf: { enabled: false },
      };
      mockLockComponentService.getAvailableUnlockOptions$.mockReturnValue(of(newUnlockOptions));

      const setDefaultSpy = jest.spyOn(component as any, "setDefaultActiveUnlockOption");

      component["listenForUnlockOptionsChanges"]();
      tick(0);

      expect(setDefaultSpy).not.toHaveBeenCalled();
    }));
  });
});
