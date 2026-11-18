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

import { UserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { LogoutService } from "@bitwarden/common/auth/logout";
import { ClientType } from "@bitwarden/common/enums";
import { DeviceTrustServiceAbstraction } from "@bitwarden/common/key-management/device-trust/abstractions/device-trust.service.abstraction";
import { SharedUnlockSettingsService } from "@bitwarden/common/key-management/shared-unlock";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { RegisterSdkService } from "@bitwarden/common/platform/abstractions/sdk/register-sdk.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { UserId } from "@bitwarden/common/types/guid";
// eslint-disable-next-line no-restricted-imports
import { AnonLayoutWrapperDataService, DialogService, ToastService } from "@bitwarden/components";
// eslint-disable-next-line no-restricted-imports
import { SignedSecurityState, SymmetricCryptoKey } from "@bitwarden/legacy-crypto";
import { UnlockService } from "@bitwarden/unlock";

import { LoginDecryptionOptionsComponent } from "./login-decryption-options.component";
import { LoginDecryptionOptionsService } from "./login-decryption-options.service";

describe("LoginDecryptionOptionsComponent", () => {
  let component: LoginDecryptionOptionsComponent;
  let accountService: MockProxy<AccountService>;
  let anonLayoutWrapperDataService: MockProxy<AnonLayoutWrapperDataService>;
  let destroyRef: MockProxy<DestroyRef>;
  let deviceTrustService: MockProxy<DeviceTrustServiceAbstraction>;
  let dialogService: MockProxy<DialogService>;
  let formBuilder: FormBuilder;
  let i18nService: MockProxy<I18nService>;
  let loginDecryptionOptionsService: MockProxy<LoginDecryptionOptionsService>;
  let messagingService: MockProxy<MessagingService>;
  let organizationApiService: MockProxy<OrganizationApiServiceAbstraction>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let router: MockProxy<Router>;
  let ssoLoginService: MockProxy<SsoLoginServiceAbstraction>;
  let toastService: MockProxy<ToastService>;
  let userDecryptionOptionsService: MockProxy<UserDecryptionOptionsServiceAbstraction>;
  let validationService: MockProxy<ValidationService>;
  let logoutService: MockProxy<LogoutService>;
  let registerSdkService: MockProxy<RegisterSdkService>;
  let appIdService: MockProxy<AppIdService>;
  let accountCryptographicStateService: MockProxy<any>;
  let authService: MockProxy<AuthService>;
  let sharedUnlockSettingsService: MockProxy<SharedUnlockSettingsService>;
  let unlockService: MockProxy<UnlockService>;
  let destroyCallbacks: (() => void)[];

  const mockUserId = "user-id-123" as UserId;
  const mockEmail = "test@example.com";
  const mockOrgId = "org-id-456";

  beforeEach(() => {
    accountService = mock<AccountService>();
    anonLayoutWrapperDataService = mock<AnonLayoutWrapperDataService>();
    destroyRef = mock<DestroyRef>();
    deviceTrustService = mock<DeviceTrustServiceAbstraction>();
    dialogService = mock<DialogService>();
    formBuilder = new FormBuilder();
    i18nService = mock<I18nService>();
    loginDecryptionOptionsService = mock<LoginDecryptionOptionsService>();
    messagingService = mock<MessagingService>();
    organizationApiService = mock<OrganizationApiServiceAbstraction>();
    platformUtilsService = mock<PlatformUtilsService>();
    router = mock<Router>();
    ssoLoginService = mock<SsoLoginServiceAbstraction>();
    toastService = mock<ToastService>();
    userDecryptionOptionsService = mock<UserDecryptionOptionsServiceAbstraction>();
    validationService = mock<ValidationService>();
    logoutService = mock<LogoutService>();
    registerSdkService = mock<RegisterSdkService>();
    appIdService = mock<AppIdService>();
    accountCryptographicStateService = mock();
    authService = mock<AuthService>();
    sharedUnlockSettingsService = mock<SharedUnlockSettingsService>();
    unlockService = mock<UnlockService>();

    // Setup default mocks
    authService.authStatusFor$.mockReturnValue(of(AuthenticationStatus.Locked));
    // takeUntilDestroyed short-circuits when destroyRef.destroyed is truthy; the auto-mock returns a
    // truthy stub for it, so force it false to keep those streams alive during the test.
    (destroyRef as { destroyed: boolean }).destroyed = false;
    // Capture the teardown callbacks takeUntilDestroyed registers so afterEach can fire them.
    // The auto-mock drops them, which would leave every test's subscriptions alive for the whole file.
    destroyCallbacks = [];
    destroyRef.onDestroy.mockImplementation((onDestroy: () => void) => {
      destroyCallbacks.push(onDestroy);
      return () => {
        destroyCallbacks = destroyCallbacks.filter((registered) => registered !== onDestroy);
      };
    });
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
      destroyRef,
      deviceTrustService,
      dialogService,
      formBuilder,
      i18nService,
      loginDecryptionOptionsService,
      messagingService,
      organizationApiService,
      platformUtilsService,
      router,
      ssoLoginService,
      toastService,
      userDecryptionOptionsService,
      validationService,
      logoutService,
      registerSdkService,
      appIdService,
      accountCryptographicStateService,
      authService,
      sharedUnlockSettingsService,
      unlockService,
    );
  });

  afterEach(() => {
    // Simulate component destruction so takeUntilDestroyed tears down the fire-and-forget
    // subscriptions started in ngOnInit. Without this the component from every test stays
    // subscribed for the whole file, and its async work surfaces during a later test.
    destroyCallbacks.forEach((onDestroy) => onDestroy());
    // Restores the jest.spyOn stubs this file installs on the PureCrypto and SymmetricCryptoKey
    // module statics; restoreMocks is not enabled anywhere in the jest config chain.
    jest.restoreAllMocks();
  });

  describe("initializeUserCryptoForJitProvisionedAccount", () => {
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

    it("should use SDK v2 registration", async () => {
      // Arrange
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

    it("persists the unlock sharing choice before unlocking", async () => {
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

    it("should disable shared unlock when the user proceeds without trusting the device", async () => {
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
    });

    it("does not clear the allow-sharing settings when the user trusts the device", async () => {
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
    });
  });

  describe("persisting the remember-device choice", () => {
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
    });

    it("reports a failed write and keeps persisting later toggles", async () => {
      // ngOnInit wires the valueChanges subscription and then calls setValue, so the first write
      // happens during init. Reject it to exercise the catchError.
      deviceTrustService.setShouldTrustDevice.mockRejectedValueOnce(new Error("persist failed"));
      const reported = new Promise<unknown>((resolve) => {
        validationService.showError.mockImplementation((err: unknown) => {
          resolve(err);
          return [];
        });
      });

      await component.ngOnInit();

      await expect(reported).resolves.toEqual(new Error("persist failed"));

      // The subscription has to survive the failure, otherwise no later toggle is ever persisted.
      const persisted = new Promise<void>((resolve) => {
        deviceTrustService.setShouldTrustDevice.mockImplementation(async () => {
          resolve();
        });
      });

      component["formGroup"].controls.rememberDevice.setValue(false);
      await persisted;

      expect(deviceTrustService.setShouldTrustDevice).toHaveBeenLastCalledWith(mockUserId, false);
    });
  });

  describe("shared unlock bootstrap on existing untrusted device", () => {
    // Driven by the test rather than a fixed `of(...)`, so the auth status can be moved after
    // ngOnInit has subscribed and each assertion sits at a known point in the timeline.
    let authStatus$: BehaviorSubject<AuthenticationStatus>;

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

      authStatus$ = new BehaviorSubject<AuthenticationStatus>(AuthenticationStatus.Locked);
      authService.authStatusFor$.mockReturnValue(authStatus$);
    });

    it("trusts the device and navigates to the vault when the account is unlocked externally", async () => {
      // Resolves once the bootstrap chain reaches its final step, so the assertions do not depend
      // on how many microtask turns the chain happens to take.
      const bootstrapped = new Promise<void>((resolve) => {
        router.navigate.mockImplementation(async () => {
          resolve();
          return true;
        });
      });

      await component.ngOnInit();
      authStatus$.next(AuthenticationStatus.Unlocked);
      await bootstrapped;

      expect(deviceTrustService.trustDevice).toHaveBeenCalledWith(mockUserId);
      expect(sharedUnlockSettingsService.setUnlockSharingDisabled).toHaveBeenCalledWith(
        mockUserId,
        false,
      );
      expect(router.navigate).toHaveBeenCalledWith(["/tabs/vault"]);
    });

    it("does not trust the device while the account remains locked", async () => {
      await component.ngOnInit();

      // The status stays Locked for as long as the component observes it.
      authStatus$.next(AuthenticationStatus.Locked);

      // Asserting the subscription exists keeps the negative below meaningful: without it the
      // expectation would also pass if nothing ever subscribed to the auth status.
      expect(authService.authStatusFor$).toHaveBeenCalledWith(mockUserId);
      expect(deviceTrustService.trustDevice).not.toHaveBeenCalled();
    });
  });

  describe("logout paths", () => {
    it("logs out with missingEmailError when ngOnInit finds no email on the active account", async () => {
      accountService.activeAccount$ = new BehaviorSubject({
        id: mockUserId,
        email: "",
        name: "Test User",
        emailVerified: false,
        creationDate: new Date(),
      });

      await component.ngOnInit();

      expect(logoutService.logout).toHaveBeenCalledWith(mockUserId, "missingEmailError");
    });

    it("logs out with userInitiated when the user confirms the logout dialog", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(true);

      await component.logOut();

      expect(logoutService.logout).toHaveBeenCalledWith(mockUserId, "userInitiated");
    });

    it("does not log out when the user cancels the logout dialog", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(false);

      await component.logOut();

      expect(logoutService.logout).not.toHaveBeenCalled();
    });
  });
});
