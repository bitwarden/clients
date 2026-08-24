// Polyfill for Symbol.dispose required by the service's use of `using` keyword
import "core-js/proposals/explicit-resource-management";

// Mock asUuid to return the input value for test consistency
jest.mock("@bitwarden/common/platform/abstractions/sdk/sdk.service", () => ({
  asUuid: (x: any) => x,
}));

import { DestroyRef } from "@angular/core";
import { FormBuilder } from "@angular/forms";
import { Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { LogoutService, UserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { PasswordResetEnrollmentServiceAbstraction } from "@bitwarden/common/auth/abstractions/password-reset-enrollment.service.abstraction";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { ClientType } from "@bitwarden/common/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { DeviceTrustServiceAbstraction } from "@bitwarden/common/key-management/device-trust/abstractions/device-trust.service.abstraction";
import { SharedUnlockSettingsService } from "@bitwarden/common/key-management/shared-unlock";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { RegisterSdkService } from "@bitwarden/common/platform/abstractions/sdk/register-sdk.service";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { makeSymmetricCryptoKey } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
// eslint-disable-next-line no-restricted-imports
import { AnonLayoutWrapperDataService, DialogService, ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import {
  LegacyCompatKeyService,
  SignedSecurityState,
  SymmetricCryptoKey,
} from "@bitwarden/legacy-crypto";
import { PureCrypto } from "@bitwarden/sdk-internal";
import { UnlockService } from "@bitwarden/unlock";

import { LoginDecryptionOptionsComponent } from "./login-decryption-options.component";
import { LoginDecryptionOptionsService } from "./login-decryption-options.service";

describe("LoginDecryptionOptionsComponent", () => {
  let component: LoginDecryptionOptionsComponent;
  let accountService: MockProxy<AccountService>;
  let anonLayoutWrapperDataService: MockProxy<AnonLayoutWrapperDataService>;
  let apiService: MockProxy<ApiService>;
  let destroyRef: MockProxy<DestroyRef>;
  let deviceTrustService: MockProxy<DeviceTrustServiceAbstraction>;
  let dialogService: MockProxy<DialogService>;
  let formBuilder: FormBuilder;
  let i18nService: MockProxy<I18nService>;
  let keyService: MockProxy<KeyService>;
  let legacyCompatKeyService: MockProxy<LegacyCompatKeyService>;
  let logService: MockProxy<LogService>;
  let loginDecryptionOptionsService: MockProxy<LoginDecryptionOptionsService>;
  let messagingService: MockProxy<MessagingService>;
  let organizationApiService: MockProxy<OrganizationApiServiceAbstraction>;
  let passwordResetEnrollmentService: MockProxy<PasswordResetEnrollmentServiceAbstraction>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let router: MockProxy<Router>;
  let ssoLoginService: MockProxy<SsoLoginServiceAbstraction>;
  let toastService: MockProxy<ToastService>;
  let userDecryptionOptionsService: MockProxy<UserDecryptionOptionsServiceAbstraction>;
  let validationService: MockProxy<ValidationService>;
  let logoutService: MockProxy<LogoutService>;
  let registerSdkService: MockProxy<RegisterSdkService>;
  let appIdService: MockProxy<AppIdService>;
  let configService: MockProxy<ConfigService>;
  let accountCryptographicStateService: MockProxy<any>;
  let authService: MockProxy<AuthService>;
  let sharedUnlockSettingsService: MockProxy<SharedUnlockSettingsService>;
  let unlockService: MockProxy<UnlockService>;

  const mockUserId = "user-id-123" as UserId;
  const mockEmail = "test@example.com";
  const mockOrgId = "org-id-456";

  beforeEach(() => {
    accountService = mock<AccountService>();
    anonLayoutWrapperDataService = mock<AnonLayoutWrapperDataService>();
    apiService = mock<ApiService>();
    destroyRef = mock<DestroyRef>();
    deviceTrustService = mock<DeviceTrustServiceAbstraction>();
    dialogService = mock<DialogService>();
    formBuilder = new FormBuilder();
    i18nService = mock<I18nService>();
    keyService = mock<KeyService>();
    legacyCompatKeyService = mock<LegacyCompatKeyService>();
    logService = mock<LogService>();
    loginDecryptionOptionsService = mock<LoginDecryptionOptionsService>();
    messagingService = mock<MessagingService>();
    organizationApiService = mock<OrganizationApiServiceAbstraction>();
    passwordResetEnrollmentService = mock<PasswordResetEnrollmentServiceAbstraction>();
    platformUtilsService = mock<PlatformUtilsService>();
    router = mock<Router>();
    ssoLoginService = mock<SsoLoginServiceAbstraction>();
    toastService = mock<ToastService>();
    userDecryptionOptionsService = mock<UserDecryptionOptionsServiceAbstraction>();
    validationService = mock<ValidationService>();
    logoutService = mock<LogoutService>();
    registerSdkService = mock<RegisterSdkService>();
    appIdService = mock<AppIdService>();
    configService = mock<ConfigService>();
    accountCryptographicStateService = mock();
    authService = mock<AuthService>();
    sharedUnlockSettingsService = mock<SharedUnlockSettingsService>();
    unlockService = mock<UnlockService>();

    // The component's inlined initAccount awaits SdkLoadService.Ready, which never resolves under test.
    Object.defineProperty(SdkLoadService, "Ready", {
      value: Promise.resolve(),
      configurable: true,
    });

    // Setup default mocks
    authService.authStatusFor$.mockReturnValue(of(AuthenticationStatus.Locked));
    // takeUntilDestroyed short-circuits when destroyRef.destroyed is truthy; the auto-mock returns a
    // truthy stub for it, so force it false to keep those streams alive during the test.
    (destroyRef as { destroyed: boolean }).destroyed = false;
    accountService.activeAccount$ = new BehaviorSubject({
      id: mockUserId,
      email: mockEmail,
      name: "Test User",
      emailVerified: true,
      creationDate: new Date(),
    });
    platformUtilsService.getClientType.mockReturnValue(ClientType.Browser);
    deviceTrustService.getShouldTrustDevice.mockResolvedValue(true);
    deviceTrustService.setShouldTrustDevice.mockResolvedValue(undefined);
    sharedUnlockSettingsService.setUnlockSharingDisabled.mockResolvedValue(undefined);
    i18nService.t.mockImplementation((key: string) => key);

    component = new LoginDecryptionOptionsComponent(
      accountService,
      anonLayoutWrapperDataService,
      apiService,
      destroyRef,
      deviceTrustService,
      dialogService,
      formBuilder,
      i18nService,
      keyService,
      legacyCompatKeyService,
      logService,
      loginDecryptionOptionsService,
      messagingService,
      organizationApiService,
      passwordResetEnrollmentService,
      platformUtilsService,
      router,
      ssoLoginService,
      toastService,
      userDecryptionOptionsService,
      validationService,
      logoutService,
      registerSdkService,
      appIdService,
      configService,
      accountCryptographicStateService,
      authService,
      sharedUnlockSettingsService,
      unlockService,
    );
  });

  describe("initializeUserCryptoForJitProvisionedAccount with feature flag enabled", () => {
    let mockPostKeysForTdeRegistration: jest.Mock;
    let mockRegistration: any;
    let mockAuth: any;
    let mockSdkValue: any;
    let mockSdkRef: any;
    let mockSdk: any;
    let mockDeviceKey: string;
    let mockDeviceKeyObj: SymmetricCryptoKey;
    let mockUserKeyBytes: Uint8Array;
    let mockPrivateKey: string;
    let mockSignedPublicKey: string;
    let mockSigningKey: string;
    let mockSecurityState: SignedSecurityState;

    beforeEach(async () => {
      // Mock asUuid to return the input value for test consistency
      jest.mock("@bitwarden/common/platform/abstractions/sdk/sdk.service", () => ({
        asUuid: (x: any) => x,
      }));

      mockPrivateKey = "mock-private-key";
      mockSignedPublicKey = "mock-signed-public-key";
      mockSigningKey = "mock-signing-key";
      mockSecurityState = {
        signature: "mock-signature",
        payload: {
          version: 2,
          timestamp: Date.now(),
          privateKeyHash: "mock-hash",
        },
      } as any;
      const deviceKeyBytes = new Uint8Array(32).fill(5);
      mockDeviceKey = Buffer.from(deviceKeyBytes).toString("base64");
      mockDeviceKeyObj = SymmetricCryptoKey.fromString(mockDeviceKey);
      mockUserKeyBytes = new Uint8Array(64);

      mockPostKeysForTdeRegistration = jest.fn().mockResolvedValue({
        account_cryptographic_state: {
          V2: {
            private_key: mockPrivateKey,
            signed_public_key: mockSignedPublicKey,
            signing_key: mockSigningKey,
            security_state: mockSecurityState,
          },
        },
        device_key: mockDeviceKey,
        user_key: mockUserKeyBytes,
      });

      mockRegistration = {
        post_keys_for_tde_registration: mockPostKeysForTdeRegistration,
      };

      mockAuth = {
        registration: jest.fn().mockReturnValue(mockRegistration),
      };

      mockSdkValue = {
        auth: jest.fn().mockReturnValue(mockAuth),
      };

      mockSdkRef = {
        value: mockSdkValue,
        [Symbol.dispose]: jest.fn(),
      };

      mockSdk = {
        take: jest.fn().mockReturnValue(mockSdkRef),
      };

      registerSdkService.registerClient$ = jest.fn((userId: UserId) => of(mockSdk)) as any;

      // Setup for new user state
      userDecryptionOptionsService.userDecryptionOptionsById$.mockReturnValue(
        of({
          trustedDeviceOption: {
            hasAdminApproval: false,
            hasLoginApprovingDevice: false,
            hasManageResetPasswordPermission: false,
            isTdeOffboarding: false,
          },
          hasMasterPassword: false,
          keyConnectorOption: undefined,
        }),
      );

      ssoLoginService.getActiveUserOrganizationSsoIdentifier.mockResolvedValue("org-identifier");
      organizationApiService.getAutoEnrollStatus.mockResolvedValue({
        id: mockOrgId,
        resetPasswordEnabled: true,
      } as any);

      // Initialize component to set up new user state
      await component.ngOnInit();
    });

    it("should use SDK v2 registration when feature flag is enabled", async () => {
      // Arrange
      configService.getFeatureFlag.mockResolvedValue(true);
      loginDecryptionOptionsService.handleCreateUserSuccess.mockResolvedValue(undefined);
      router.navigate.mockResolvedValue(true);
      appIdService.getAppId.mockResolvedValue("mock-app-id");
      organizationApiService.getKeys.mockResolvedValue({
        publicKey: "mock-org-public-key",
        privateKey: "mock-org-private-key",
      } as any);

      // Act
      await component["initializeUserCryptoForJitProvisionedAccount"]();

      // Assert
      expect(configService.getFeatureFlag).toHaveBeenCalledWith(
        FeatureFlag.PM27279_V2RegistrationTdeJit,
      );
      expect(appIdService.getAppId).toHaveBeenCalled();
      expect(organizationApiService.getKeys).toHaveBeenCalledWith(mockOrgId);
      expect(registerSdkService.registerClient$).toHaveBeenCalledWith(mockUserId);

      // Verify SDK registration was called with correct parameters
      expect(mockSdkValue.auth).toHaveBeenCalled();
      expect(mockAuth.registration).toHaveBeenCalled();
      expect(mockPostKeysForTdeRegistration).toHaveBeenCalledWith({
        org_id: mockOrgId,
        org_public_key: "mock-org-public-key",
        user_id: mockUserId,
        device_identifier: "mock-app-id",
        trust_device: true,
      });

      const expectedDeviceKey = mockDeviceKeyObj;
      const expectedUserKey = new SymmetricCryptoKey(new Uint8Array(mockUserKeyBytes));

      // Verify keys were set
      expect(accountCryptographicStateService.setAccountCryptographicState).toHaveBeenCalledWith(
        expect.objectContaining({
          V2: {
            private_key: mockPrivateKey,
            signed_public_key: mockSignedPublicKey,
            signing_key: mockSigningKey,
            security_state: mockSecurityState,
          },
        }),
        mockUserId,
      );

      expect(validationService.showError).not.toHaveBeenCalled();

      // Verify device and user keys were persisted
      expect(deviceTrustService.setDeviceKey).toHaveBeenCalledWith(
        mockUserId,
        expect.any(SymmetricCryptoKey),
      );
      expect(unlockService.unlockWithDecryptedUserKey).toHaveBeenCalledWith(
        mockUserId,
        expect.any(SymmetricCryptoKey),
      );

      const [, deviceKeyArg] = deviceTrustService.setDeviceKey.mock.calls[0];
      const [, userKeyArg] = unlockService.unlockWithDecryptedUserKey.mock.calls[0];

      expect((deviceKeyArg as SymmetricCryptoKey).keyB64).toBe(expectedDeviceKey.keyB64);
      expect((userKeyArg as SymmetricCryptoKey).keyB64).toBe(expectedUserKey.keyB64);

      // Verify success toast and navigation
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        title: null,
        message: "accountSuccessfullyCreated",
      });
      expect(loginDecryptionOptionsService.handleCreateUserSuccess).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(["/tabs/vault"]);
      // Remember device defaults to true, so shared unlock is not disabled.
      expect(sharedUnlockSettingsService.setUnlockSharingDisabled).toHaveBeenCalledWith(
        mockUserId,
        false,
      );
    });

    it("persists the unlock sharing choice before unlocking when feature flag is enabled", async () => {
      configService.getFeatureFlag.mockResolvedValue(true);
      loginDecryptionOptionsService.handleCreateUserSuccess.mockResolvedValue(undefined);
      router.navigate.mockResolvedValue(true);
      appIdService.getAppId.mockResolvedValue("mock-app-id");
      organizationApiService.getKeys.mockResolvedValue({
        publicKey: "mock-org-public-key",
        privateKey: "mock-org-private-key",
      } as any);

      await component["initializeUserCryptoForJitProvisionedAccount"]();

      const setUnlockSharingDisabledOrder =
        sharedUnlockSettingsService.setUnlockSharingDisabled.mock.invocationCallOrder[0];
      const unlockOrder = unlockService.unlockWithDecryptedUserKey.mock.invocationCallOrder[0];

      expect(setUnlockSharingDisabledOrder).toBeLessThan(unlockOrder);
    });

    it("persists the unlock sharing choice before unlocking when feature flag is disabled", async () => {
      configService.getFeatureFlag.mockResolvedValue(false);

      const mockPrivateKey = {
        encryptedString: "mock-encrypted-private-key",
      } as any;
      const mockUserKey = makeSymmetricCryptoKey<UserKey>(64);

      jest.spyOn(PureCrypto, "make_aes256_cbc_hmac_key").mockReturnValue({} as any);
      jest.spyOn(SymmetricCryptoKey, "fromSdk").mockReturnValue(mockUserKey);
      keyService.userKey$.mockReturnValue(of(null));
      legacyCompatKeyService.makeKeyPair.mockResolvedValue(["mock-public-key", mockPrivateKey]);

      apiService.postAccountKeys.mockResolvedValue(undefined);
      passwordResetEnrollmentService.enroll.mockResolvedValue(undefined);
      deviceTrustService.trustDevice.mockResolvedValue(undefined);
      loginDecryptionOptionsService.handleCreateUserSuccess.mockResolvedValue(undefined);
      router.navigate.mockResolvedValue(true);

      await component["initializeUserCryptoForJitProvisionedAccount"]();

      const setUnlockSharingDisabledOrder =
        sharedUnlockSettingsService.setUnlockSharingDisabled.mock.invocationCallOrder[0];
      const unlockOrder = unlockService.unlockWithDecryptedUserKey.mock.invocationCallOrder[0];

      expect(setUnlockSharingDisabledOrder).toBeLessThan(unlockOrder);
    });

    it("should disable shared unlock when the user proceeds without trusting the device", async () => {
      configService.getFeatureFlag.mockResolvedValue(true);
      loginDecryptionOptionsService.handleCreateUserSuccess.mockResolvedValue(undefined);
      router.navigate.mockResolvedValue(true);
      appIdService.getAppId.mockResolvedValue("mock-app-id");
      organizationApiService.getKeys.mockResolvedValue({
        publicKey: "mock-org-public-key",
        privateKey: "mock-org-private-key",
      } as any);

      component["formGroup"].controls.rememberDevice.setValue(false);

      await component["initializeUserCryptoForJitProvisionedAccount"]();

      expect(sharedUnlockSettingsService.setUnlockSharingDisabled).toHaveBeenCalledWith(
        mockUserId,
        true,
      );
      expect(
        sharedUnlockSettingsService.setAllowSharingUnlockStateWithDesktop,
      ).toHaveBeenCalledWith(false, mockUserId);
      expect(sharedUnlockSettingsService.setAllowSharingUnlockStateWithWeb).toHaveBeenCalledWith(
        false,
        mockUserId,
      );
    });

    it("does not clear the allow-sharing settings when the user trusts the device", async () => {
      configService.getFeatureFlag.mockResolvedValue(true);
      loginDecryptionOptionsService.handleCreateUserSuccess.mockResolvedValue(undefined);
      router.navigate.mockResolvedValue(true);
      appIdService.getAppId.mockResolvedValue("mock-app-id");
      organizationApiService.getKeys.mockResolvedValue({
        publicKey: "mock-org-public-key",
        privateKey: "mock-org-private-key",
      } as any);

      // Remember device defaults to true.
      await component["initializeUserCryptoForJitProvisionedAccount"]();

      expect(
        sharedUnlockSettingsService.setAllowSharingUnlockStateWithDesktop,
      ).not.toHaveBeenCalled();
      expect(sharedUnlockSettingsService.setAllowSharingUnlockStateWithWeb).not.toHaveBeenCalled();
    });

    it("should use legacy registration when feature flag is disabled", async () => {
      // Arrange
      configService.getFeatureFlag.mockResolvedValue(false);

      const mockPublicKey = "mock-public-key";
      const mockPrivateKey = {
        encryptedString: "mock-encrypted-private-key",
      } as any;
      const mockUserKey = makeSymmetricCryptoKey<UserKey>(64);

      jest.spyOn(PureCrypto, "make_aes256_cbc_hmac_key").mockReturnValue({} as any);
      jest.spyOn(SymmetricCryptoKey, "fromSdk").mockReturnValue(mockUserKey);
      keyService.userKey$.mockReturnValue(of(null));
      legacyCompatKeyService.makeKeyPair.mockResolvedValue([mockPublicKey, mockPrivateKey]);

      apiService.postAccountKeys.mockResolvedValue(undefined);
      passwordResetEnrollmentService.enroll.mockResolvedValue(undefined);
      deviceTrustService.trustDevice.mockResolvedValue(undefined);
      loginDecryptionOptionsService.handleCreateUserSuccess.mockResolvedValue(undefined);
      router.navigate.mockResolvedValue(true);

      // Act
      await component["initializeUserCryptoForJitProvisionedAccount"]();

      // Assert
      expect(configService.getFeatureFlag).toHaveBeenCalledWith(
        FeatureFlag.PM27279_V2RegistrationTdeJit,
      );
      expect(legacyCompatKeyService.makeKeyPair).toHaveBeenCalledWith(mockUserKey);
      expect(unlockService.unlockWithDecryptedUserKey).toHaveBeenCalledWith(
        mockUserId,
        mockUserKey,
      );
      expect(accountCryptographicStateService.setAccountCryptographicState).toHaveBeenCalledWith(
        { V1: { private_key: mockPrivateKey.encryptedString } },
        mockUserId,
      );
      expect(apiService.postAccountKeys).toHaveBeenCalledWith(
        expect.objectContaining({
          publicKey: mockPublicKey,
          encryptedPrivateKey: mockPrivateKey.encryptedString,
        }),
      );
      expect(passwordResetEnrollmentService.enroll).toHaveBeenCalledWith(mockOrgId);
      expect(deviceTrustService.trustDevice).toHaveBeenCalledWith(mockUserId);

      // Verify success toast
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        title: null,
        message: "accountSuccessfullyCreated",
      });

      // Verify navigation
      expect(loginDecryptionOptionsService.handleCreateUserSuccess).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(["/tabs/vault"]);
    });

    // These two cover the account-init guards in the component's private `initAccount`, which was
    // inlined from KeyService and is removed with the v2 rollout along with the legacy branch.
    it("does not initialize the account when the user already has a user key", async () => {
      configService.getFeatureFlag.mockResolvedValue(false);
      keyService.userKey$.mockReturnValue(of(makeSymmetricCryptoKey<UserKey>(64)));

      await component["initializeUserCryptoForJitProvisionedAccount"]();

      expect(logService.error).toHaveBeenCalledWith(
        "Tried to initialize account with existing user key.",
      );
      expect(unlockService.unlockWithDecryptedUserKey).not.toHaveBeenCalled();
      expect(apiService.postAccountKeys).not.toHaveBeenCalled();
      expect(validationService.showError).toHaveBeenCalledWith(
        new Error("Cannot initialize account, keys already exist."),
      );
    });

    it("does not set the user key when the generated private key is invalid", async () => {
      configService.getFeatureFlag.mockResolvedValue(false);
      keyService.userKey$.mockReturnValue(of(null));
      jest.spyOn(PureCrypto, "make_aes256_cbc_hmac_key").mockReturnValue({} as any);
      jest
        .spyOn(SymmetricCryptoKey, "fromSdk")
        .mockReturnValue(makeSymmetricCryptoKey<UserKey>(64));
      legacyCompatKeyService.makeKeyPair.mockResolvedValue([
        "mock-public-key",
        { encryptedString: null } as any,
      ]);

      await component["initializeUserCryptoForJitProvisionedAccount"]();

      expect(unlockService.unlockWithDecryptedUserKey).not.toHaveBeenCalled();
      expect(apiService.postAccountKeys).not.toHaveBeenCalled();
      expect(validationService.showError).toHaveBeenCalledWith(
        new Error("Failed to create valid private key."),
      );
    });
  });

  describe("shared unlock bootstrap on existing untrusted device", () => {
    beforeEach(() => {
      userDecryptionOptionsService.userDecryptionOptionsById$.mockReturnValue(
        of({
          trustedDeviceOption: {
            hasAdminApproval: true,
            hasLoginApprovingDevice: false,
            hasManageResetPasswordPermission: false,
            isTdeOffboarding: false,
          },
          hasMasterPassword: true,
          keyConnectorOption: undefined,
        }),
      );
      deviceTrustService.trustDevice.mockResolvedValue(undefined);
      router.navigate.mockResolvedValue(true);
    });

    it("trusts the device and navigates to the vault when the account is unlocked externally", async () => {
      authService.authStatusFor$.mockReturnValue(of(AuthenticationStatus.Unlocked));

      await component.ngOnInit();
      // Allow the switchMap/defer async work to run.
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(deviceTrustService.trustDevice).toHaveBeenCalledWith(mockUserId);
      expect(sharedUnlockSettingsService.setUnlockSharingDisabled).toHaveBeenCalledWith(
        mockUserId,
        false,
      );
      expect(router.navigate).toHaveBeenCalledWith(["/tabs/vault"]);
    });

    it("does not trust the device while the account remains locked", async () => {
      authService.authStatusFor$.mockReturnValue(of(AuthenticationStatus.Locked));

      await component.ngOnInit();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(deviceTrustService.trustDevice).not.toHaveBeenCalled();
    });
  });
});
