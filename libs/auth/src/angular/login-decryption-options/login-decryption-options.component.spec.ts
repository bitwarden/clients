import { DestroyRef } from "@angular/core";
import { FormBuilder } from "@angular/forms";
import { Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import {
  LoginEmailServiceAbstraction,
  LogoutService,
  UserDecryptionOptionsServiceAbstraction,
} from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { PasswordResetEnrollmentServiceAbstraction } from "@bitwarden/common/auth/abstractions/password-reset-enrollment.service.abstraction";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { ClientType } from "@bitwarden/common/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { DeviceTrustServiceAbstraction } from "@bitwarden/common/key-management/device-trust/abstractions/device-trust.service.abstraction";
import { SecurityStateService } from "@bitwarden/common/key-management/security-state/abstractions/security-state.service";
import { SignedSecurityState } from "@bitwarden/common/key-management/types";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { RegisterSdkService } from "@bitwarden/common/platform/abstractions/sdk/register-sdk.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { UserId } from "@bitwarden/common/types/guid";
// eslint-disable-next-line no-restricted-imports
import { AnonLayoutWrapperDataService, DialogService, ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

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
  let loginDecryptionOptionsService: MockProxy<LoginDecryptionOptionsService>;
  let loginEmailService: MockProxy<LoginEmailServiceAbstraction>;
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
  let securityStateService: MockProxy<SecurityStateService>;
  let appIdService: MockProxy<AppIdService>;
  let configService: MockProxy<ConfigService>;

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
    loginDecryptionOptionsService = mock<LoginDecryptionOptionsService>();
    loginEmailService = mock<LoginEmailServiceAbstraction>();
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
    securityStateService = mock<SecurityStateService>();
    appIdService = mock<AppIdService>();
    configService = mock<ConfigService>();

    // Setup default mocks
    accountService.activeAccount$ = new BehaviorSubject({
      id: mockUserId,
      email: mockEmail,
      name: "Test User",
      emailVerified: true,
    });
    platformUtilsService.getClientType.mockReturnValue(ClientType.Browser);
    deviceTrustService.getShouldTrustDevice.mockResolvedValue(true);
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
      loginDecryptionOptionsService,
      loginEmailService,
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
      securityStateService,
      appIdService,
      configService,
    );
  });

  describe("createUser with feature flag enabled", () => {
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
      (Symbol as any).dispose = Symbol("dispose");

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
      await component["createUser"]();

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
      expect(mockPostKeysForTdeRegistration).toHaveBeenCalledWith(
        mockOrgId,
        "mock-org-public-key",
        mockUserId,
        "mock-app-id",
        true,
      );

      const expectedDeviceKey = mockDeviceKeyObj;
      const expectedUserKey = new SymmetricCryptoKey(new Uint8Array(mockUserKeyBytes));

      // Verify keys were set
      expect(keyService.setPrivateKey).toHaveBeenCalledWith(mockPrivateKey, mockUserId);
      expect(keyService.setSignedPublicKey).toHaveBeenCalledWith(mockSignedPublicKey, mockUserId);
      expect(keyService.setUserSigningKey).toHaveBeenCalledWith(mockSigningKey, mockUserId);
      expect(securityStateService.setAccountSecurityState).toHaveBeenCalledWith(
        mockSecurityState,
        mockUserId,
      );

      expect(validationService.showError).not.toHaveBeenCalled();

      // Verify device and user keys were persisted
      expect(deviceTrustService.setDeviceKey).toHaveBeenCalledWith(
        mockUserId,
        expect.any(SymmetricCryptoKey),
      );
      expect(keyService.setUserKey).toHaveBeenCalledWith(
        expect.any(SymmetricCryptoKey),
        mockUserId,
      );

      const [, deviceKeyArg] = deviceTrustService.setDeviceKey.mock.calls[0];
      const [userKeyArg] = keyService.setUserKey.mock.calls[0];

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
    });

    it("should use legacy registration when feature flag is disabled", async () => {
      // Arrange
      configService.getFeatureFlag.mockResolvedValue(false);

      const mockPublicKey = "mock-public-key";
      const mockPrivateKey = {
        encryptedString: "mock-encrypted-private-key",
      } as any;

      keyService.initAccount.mockResolvedValue({
        publicKey: mockPublicKey,
        privateKey: mockPrivateKey,
      } as any);

      apiService.postAccountKeys.mockResolvedValue(undefined);
      passwordResetEnrollmentService.enroll.mockResolvedValue(undefined);
      deviceTrustService.trustDevice.mockResolvedValue(undefined);
      loginDecryptionOptionsService.handleCreateUserSuccess.mockResolvedValue(undefined);
      router.navigate.mockResolvedValue(true);

      // Act
      await component["createUser"]();

      // Assert
      expect(configService.getFeatureFlag).toHaveBeenCalledWith(
        FeatureFlag.PM27279_V2RegistrationTdeJit,
      );
      expect(keyService.initAccount).toHaveBeenCalledWith(mockUserId);
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
  });
});
