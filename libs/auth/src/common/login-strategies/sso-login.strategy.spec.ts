import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { AdminAuthRequestStorable } from "@bitwarden/common/auth/models/domain/admin-auth-req-storable";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { AuthRequestResponse } from "@bitwarden/common/auth/models/response/auth-request.response";
import { IdentityTokenResponse } from "@bitwarden/common/auth/models/response/identity-token.response";
import { IUserDecryptionOptionsServerResponse } from "@bitwarden/common/auth/models/response/user-decryption-options/user-decryption-options.response";
import { TwoFactorService } from "@bitwarden/common/auth/two-factor";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncryptedString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { DeviceTrustServiceAbstraction } from "@bitwarden/common/key-management/device-trust/abstractions/device-trust.service.abstraction";
import { KeyConnectorService } from "@bitwarden/common/key-management/key-connector/abstractions/key-connector.service";
import { FakeMasterPasswordService } from "@bitwarden/common/key-management/master-password/services/fake-master-password.service";
import {
  VaultTimeoutAction,
  VaultTimeoutSettingsService,
} from "@bitwarden/common/key-management/vault-timeout";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { CsprngArray } from "@bitwarden/common/types/csprng";
import { UserId } from "@bitwarden/common/types/guid";
import { DeviceKey, MasterKey, UserKey } from "@bitwarden/common/types/key";
import { Argon2KdfConfig, KdfConfigService, KeyService } from "@bitwarden/key-management";

import {
  AuthRequestServiceAbstraction,
  InternalUserDecryptionOptionsServiceAbstraction,
} from "../abstractions";
import { UserDecryptionOptions } from "../models";
import { SsoLoginCredentials } from "../models/domain/login-credentials";

import { identityTokenResponseFactory } from "./login.strategy.spec";
import { SsoLoginStrategy, SsoLoginStrategyData } from "./sso-login.strategy";

describe("SsoLoginStrategy", () => {
  let accountService: FakeAccountService;
  let masterPasswordService: FakeMasterPasswordService;

  let keyService: MockProxy<KeyService>;
  let encryptService: MockProxy<EncryptService>;
  let apiService: MockProxy<ApiService>;
  let tokenService: MockProxy<TokenService>;
  let appIdService: MockProxy<AppIdService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let messagingService: MockProxy<MessagingService>;
  let logService: MockProxy<LogService>;
  let stateService: MockProxy<StateService>;
  let twoFactorService: MockProxy<TwoFactorService>;
  let userDecryptionOptionsService: MockProxy<InternalUserDecryptionOptionsServiceAbstraction>;
  let keyConnectorService: MockProxy<KeyConnectorService>;
  let deviceTrustService: MockProxy<DeviceTrustServiceAbstraction>;
  let authRequestService: MockProxy<AuthRequestServiceAbstraction>;
  let i18nService: MockProxy<I18nService>;
  let billingAccountProfileStateService: MockProxy<BillingAccountProfileStateService>;
  let vaultTimeoutSettingsService: MockProxy<VaultTimeoutSettingsService>;
  let kdfConfigService: MockProxy<KdfConfigService>;
  let environmentService: MockProxy<EnvironmentService>;
  let configService: MockProxy<ConfigService>;

  let ssoLoginStrategy: SsoLoginStrategy;
  let credentials: SsoLoginCredentials;

  const userId = Utils.newGuid() as UserId;
  const deviceId = Utils.newGuid();
  const keyConnectorUrl = "KEY_CONNECTOR_URL";

  const ssoCode = "SSO_CODE";
  const ssoCodeVerifier = "SSO_CODE_VERIFIER";
  const ssoRedirectUrl = "SSO_REDIRECT_URL";
  const ssoOrgId = "SSO_ORG_ID";
  const privateKey = "userKeyEncryptedPrivateKey";

  beforeEach(async () => {
    accountService = mockAccountServiceWith(userId);
    masterPasswordService = new FakeMasterPasswordService();

    keyService = mock<KeyService>();
    encryptService = mock<EncryptService>();
    apiService = mock<ApiService>();
    tokenService = mock<TokenService>();
    appIdService = mock<AppIdService>();
    platformUtilsService = mock<PlatformUtilsService>();
    messagingService = mock<MessagingService>();
    logService = mock<LogService>();
    stateService = mock<StateService>();
    twoFactorService = mock<TwoFactorService>();
    userDecryptionOptionsService = mock<InternalUserDecryptionOptionsServiceAbstraction>();
    keyConnectorService = mock<KeyConnectorService>();
    deviceTrustService = mock<DeviceTrustServiceAbstraction>();
    authRequestService = mock<AuthRequestServiceAbstraction>();
    i18nService = mock<I18nService>();
    billingAccountProfileStateService = mock<BillingAccountProfileStateService>();
    vaultTimeoutSettingsService = mock<VaultTimeoutSettingsService>();
    kdfConfigService = mock<KdfConfigService>();
    environmentService = mock<EnvironmentService>();
    configService = mock<ConfigService>();

    tokenService.getTwoFactorToken.mockResolvedValue(null);
    appIdService.getAppId.mockResolvedValue(deviceId);
    tokenService.decodeAccessToken.mockResolvedValue({
      sub: userId,
    });
    keyService.userEncryptedPrivateKey$
      .calledWith(userId)
      .mockReturnValue(of(privateKey as EncryptedString));

    const mockVaultTimeoutAction = VaultTimeoutAction.Lock;
    const mockVaultTimeoutActionBSub = new BehaviorSubject<VaultTimeoutAction>(
      mockVaultTimeoutAction,
    );
    vaultTimeoutSettingsService.getVaultTimeoutActionByUserId$.mockReturnValue(
      mockVaultTimeoutActionBSub.asObservable(),
    );

    const mockVaultTimeout = 1000;

    const mockVaultTimeoutBSub = new BehaviorSubject<number>(mockVaultTimeout);
    vaultTimeoutSettingsService.getVaultTimeoutByUserId$.mockReturnValue(
      mockVaultTimeoutBSub.asObservable(),
    );

    const userDecryptionOptions = new UserDecryptionOptions();
    userDecryptionOptionsService.userDecryptionOptions$ = of(userDecryptionOptions);

    ssoLoginStrategy = new SsoLoginStrategy(
      {} as SsoLoginStrategyData,
      keyConnectorService,
      deviceTrustService,
      authRequestService,
      i18nService,
      accountService,
      masterPasswordService,
      keyService,
      encryptService,
      apiService,
      tokenService,
      appIdService,
      platformUtilsService,
      messagingService,
      logService,
      stateService,
      twoFactorService,
      userDecryptionOptionsService,
      billingAccountProfileStateService,
      vaultTimeoutSettingsService,
      kdfConfigService,
      environmentService,
      configService,
    );
    credentials = new SsoLoginCredentials(ssoCode, ssoCodeVerifier, ssoRedirectUrl, ssoOrgId);
  });

  it("sends SSO information to server", async () => {
    apiService.postIdentityToken.mockResolvedValue(identityTokenResponseFactory());
    keyService.hasUserKey.mockResolvedValue(true);

    await ssoLoginStrategy.logIn(credentials);

    expect(apiService.postIdentityToken).toHaveBeenCalledWith(
      expect.objectContaining({
        code: ssoCode,
        codeVerifier: ssoCodeVerifier,
        redirectUri: ssoRedirectUrl,
        device: expect.objectContaining({
          identifier: deviceId,
        }),
        twoFactor: expect.objectContaining({
          provider: null,
          token: null,
        }),
      }),
    );
  });

  it("does not set keys for new SSO user flow", async () => {
    const tokenResponse = identityTokenResponseFactory();
    tokenResponse.key = null;
    tokenResponse.privateKey = null;
    apiService.postIdentityToken.mockResolvedValue(tokenResponse);

    await ssoLoginStrategy.logIn(credentials);

    expect(masterPasswordService.mock.setMasterKey).not.toHaveBeenCalled();
    expect(keyService.setUserKey).not.toHaveBeenCalled();
    expect(keyService.setPrivateKey).not.toHaveBeenCalled();
  });

  it("sets master key encrypted user key for existing SSO users", async () => {
    // Arrange
    const tokenResponse = identityTokenResponseFactory();
    apiService.postIdentityToken.mockResolvedValue(tokenResponse);

    // Act
    await ssoLoginStrategy.logIn(credentials);

    // Assert
    expect(masterPasswordService.mock.setMasterKeyEncryptedUserKey).toHaveBeenCalledTimes(1);
    expect(masterPasswordService.mock.setMasterKeyEncryptedUserKey).toHaveBeenCalledWith(
      tokenResponse.key,
      userId,
    );
  });

  describe("given the user does not have the `trustedDeviceOption`, does not have a master password, is not using key connector, does not have a user key, but they DO have a `userKeyEncryptedPrivateKey`", () => {
    it("should set the forceSetPasswordReason to TdeOffboardingUntrustedDevice", async () => {
      // Arrange
      const mockUserDecryptionOptions: IUserDecryptionOptionsServerResponse = {
        HasMasterPassword: false,
        TrustedDeviceOption: null,
        KeyConnectorOption: null,
      };
      const tokenResponse = identityTokenResponseFactory(null, mockUserDecryptionOptions);
      apiService.postIdentityToken.mockResolvedValue(tokenResponse);

      keyService.hasUserKey.mockResolvedValue(false);

      // Act
      await ssoLoginStrategy.logIn(credentials);

      // Assert
      expect(masterPasswordService.mock.setForceSetPasswordReason).toHaveBeenCalledTimes(1);
      expect(masterPasswordService.mock.setForceSetPasswordReason).toHaveBeenCalledWith(
        ForceSetPasswordReason.TdeOffboardingUntrustedDevice,
        userId,
      );
    });
  });

  describe("Trusted Device Decryption", () => {
    const deviceKeyBytesLength = 64;
    const mockDeviceKeyRandomBytes = new Uint8Array(deviceKeyBytesLength).buffer as CsprngArray;
    const mockDeviceKey: DeviceKey = new SymmetricCryptoKey(mockDeviceKeyRandomBytes) as DeviceKey;

    const userKeyBytesLength = 64;
    const mockUserKeyRandomBytes = new Uint8Array(userKeyBytesLength).buffer as CsprngArray;
    const mockUserKey: UserKey = new SymmetricCryptoKey(mockUserKeyRandomBytes) as UserKey;

    const mockEncDevicePrivateKey =
      "2.eh465OrUcluL9UpnCOUTAg==|2HXNXwrLwAjUfZ/U75c92rZEltt1eHxjMkp/ADAmx346oT1+GaQvaL1QIV/9Om0T72m8AnlO92iUfWdhbA/ifHZ+lhFoUVeyw1M88CMzktbVcq42rFoK7SGHSAGdTL3ccUWKI8yCCQJhpt2X6a/5+T7ey5k2CqvylKyOtkiCnVeLmYqETn5BM9Rl3tEgJW1yDLuSJ+L+Qh9xnk/Z3zJUV5HAs+YwjKwuSNrd00SXjDyx8rBEstD9MKI+lrk7to/q90vqKqCucAj/dzUpVtHe88al2AAlBVwQ13HUPdNFOyti6niUgCAWx+DzRqlhkFvl/z/rtxtQsyqq/3Eh/EL54ylxKzAya0ev9EaIOm/dD1aBmI58p4Bs0eMOCIKJjtw+Cmdql+RhCtKtumgFShqyXv+LfD/FgUsdTVNExk3YNhgwPR4jOaMa/j9LCrBMCLKxdAhQyBe7T3qoX1fBBirvY6t77ifMu1YEQ6DfmFphVSwDH5C9xGeTSh5IELSf0tGVtlWUe9RffDDzccD0L1lR8U+dqzoSTYCuXvhEhQptdIW6fpH/47u0M5MiI97/d35A7Et2I1gjHp7WF3qsY20ellBueu7ZL5P1BmqPXl58yaBBXJaCutYHDfIucspqdZmfBGEbdRT4wmuZRON0J8zLmUejM0VR/2MOmpfyYQXnJhTfrvnZ1bOg1aMhUxJ2vhDNPXUFm5b+vwsho4GEvcLAKq9WwbvOJ/sK7sEVfTfEO2IG+0X6wkWm7RpR6Wq9FGKSrv2PSjMAYnb+z3ETeWiaaiD+tVFxa2AaqsbOuX092/86GySpHES7cFWhQ/YMOgj6egUi8mEC0CqMXYsx0TTJDsn16oP+XB3a2WoRqzE0YBozp2aMXxhVf/jMZ03BmEmRQu5B+Sq1gMEZwtIfJ+srkZLMYlLjvVw92FRoFy+N6ytPiyf6RMHMUnJ3vEZSBogaElYoQAtFJ5kK811CUzb78zEHH8xWtPrCZn9zZfvf/zaWxo7fpV8VwAwUeHXHcQMraZum5QeO+5tLRUYrLm85JNelGfmUA3BjfNyFbfb32PhkWWd0CbDaPME48uIriVK32pNEtvtR/+I/f3YgA/jP9kSlDvbzG/OAg/AFBIpNwKUzsu4+va8mI+O5FDufw5D74WwdGJ9DeyEb2CHtWMR1VwtFKL0ZZsqltNf8EkBeJ5RtTNtAMM8ie4dDZaKC96ymQHKrdB4hjkAr0F1XFsU4XdOa9Nbkdcm/7KoNc6bE6oJtG9lqE8h+1CysfcbfJ7am+hvDFzT0IPmp3GDSMAk+e6xySgFQw0C/SZ7LQsxPa1s6hc+BOtTn0oClZnU7Mowxv+z+xURJj4Yp3Cy6tAoia1jEQSs6lSMNKPf9bi3xFKtPl4143hwhpvTAzJUcski9OVGd7Du+VyxwIrvLqp5Ct/oNrESVJpf1EDCs9xT1EW+PiSkRmHXoZ1t5MOLFEiMAZL2+bNe3A2661oJeMtps8zrfCVc251OUE1WvqWePlTOs5TDVqdwDH88J6rHLsbaf33Mxh5DP8gMfZQxE44Nsp6H0/Szfkss5UmFwBEpHjl1GJMWDnB3u2d+l1CSkLoB6C+diAUlY6wL/VwJBeMPHZTf6amQIS2B/lo/CnvV/E3k=|uuoY4b7xwMYBNIZi85KBsaHmNqtJl5FrKxZI9ugeNwc=";

    const mockEncUserKey =
      "4.Xht6K9GA9jKcSNy4TaIvdj7f9+WsgQycs/HdkrJi33aC//roKkjf3UTGpdzFLxVP3WhyOVGyo9f2Jymf1MFPdpg7AuMnpGJlcrWLDbnPjOJo4x5gUwwBUmy3nFw6+wamyS1LRmrBPcv56yKpf80k5Q3hUrum8q9YS9m2I10vklX/TaB1YML0yo+K1feWUxg8vIx+vloxhUdkkysvcV5xU3R+AgYLrwvJS8TLL7Ug/P5HxinCaIroRrNe8xcv84vyVnzPFdXe0cfZ0cpcrm586LwfEXP2seeldO/bC51Uk/mudeSALJURPC64f5ch2cOvk48GOTapGnssCqr6ky5yFw==";

    const userDecryptionOptsServerResponseWithTdeOption: IUserDecryptionOptionsServerResponse = {
      HasMasterPassword: true,
      TrustedDeviceOption: {
        HasAdminApproval: true,
        HasLoginApprovingDevice: true,
        HasManageResetPasswordPermission: false,
        IsTdeOffboarding: false,
        EncryptedPrivateKey: mockEncDevicePrivateKey,
        EncryptedUserKey: mockEncUserKey,
      },
    };

    const mockIdTokenResponseWithModifiedTrustedDeviceOption = (key: string, value: any) => {
      const userDecryptionOpts: IUserDecryptionOptionsServerResponse = {
        ...userDecryptionOptsServerResponseWithTdeOption,
        TrustedDeviceOption: {
          ...userDecryptionOptsServerResponseWithTdeOption.TrustedDeviceOption,
          [key]: value,
        },
      };
      return identityTokenResponseFactory(null, userDecryptionOpts);
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("decrypts and sets user key when trusted device decryption option exists with valid device key and enc key data", async () => {
      // Arrange
      const idTokenResponse: IdentityTokenResponse = identityTokenResponseFactory(
        null,
        userDecryptionOptsServerResponseWithTdeOption,
      );

      apiService.postIdentityToken.mockResolvedValue(idTokenResponse);
      deviceTrustService.getDeviceKey.mockResolvedValue(mockDeviceKey);
      deviceTrustService.decryptUserKeyWithDeviceKey.mockResolvedValue(mockUserKey);

      const cryptoSvcSetUserKeySpy = jest.spyOn(keyService, "setUserKey");

      // Act
      await ssoLoginStrategy.logIn(credentials);

      // Assert
      expect(deviceTrustService.getDeviceKey).toHaveBeenCalledTimes(1);
      expect(deviceTrustService.decryptUserKeyWithDeviceKey).toHaveBeenCalledTimes(1);
      expect(cryptoSvcSetUserKeySpy).toHaveBeenCalledTimes(1);
      expect(cryptoSvcSetUserKeySpy).toHaveBeenCalledWith(mockUserKey, userId);
    });

    it("does not set the user key when deviceKey is missing", async () => {
      // Arrange
      const idTokenResponse: IdentityTokenResponse = identityTokenResponseFactory(
        null,
        userDecryptionOptsServerResponseWithTdeOption,
      );
      apiService.postIdentityToken.mockResolvedValue(idTokenResponse);
      // Set deviceKey to be null
      deviceTrustService.getDeviceKey.mockResolvedValue(null);
      deviceTrustService.decryptUserKeyWithDeviceKey.mockResolvedValue(mockUserKey);

      // Act
      await ssoLoginStrategy.logIn(credentials);

      // Assert
      expect(keyService.setUserKey).not.toHaveBeenCalled();
    });

    describe.each([
      {
        valueName: "encDevicePrivateKey",
      },
      {
        valueName: "encUserKey",
      },
    ])("given trusted device decryption option has missing encrypted key data", ({ valueName }) => {
      it(`does not set the user key when ${valueName} is missing`, async () => {
        // Arrange
        const idTokenResponse = mockIdTokenResponseWithModifiedTrustedDeviceOption(valueName, null);
        apiService.postIdentityToken.mockResolvedValue(idTokenResponse);
        deviceTrustService.getDeviceKey.mockResolvedValue(mockDeviceKey);

        // Act
        await ssoLoginStrategy.logIn(credentials);

        // Assert
        expect(keyService.setUserKey).not.toHaveBeenCalled();
      });
    });

    it("does not set user key when decrypted user key is null", async () => {
      // Arrange
      const idTokenResponse: IdentityTokenResponse = identityTokenResponseFactory(
        null,
        userDecryptionOptsServerResponseWithTdeOption,
      );
      apiService.postIdentityToken.mockResolvedValue(idTokenResponse);
      deviceTrustService.getDeviceKey.mockResolvedValue(mockDeviceKey);
      // Set userKey to be null
      deviceTrustService.decryptUserKeyWithDeviceKey.mockResolvedValue(null);

      // Act
      await ssoLoginStrategy.logIn(credentials);

      // Assert
      expect(keyService.setUserKey).not.toHaveBeenCalled();
    });

    it("logs when a device key is found but no decryption keys were recieved in token response", async () => {
      // Arrange
      const userDecryptionOpts = userDecryptionOptsServerResponseWithTdeOption;
      userDecryptionOpts.TrustedDeviceOption.EncryptedPrivateKey = null;
      userDecryptionOpts.TrustedDeviceOption.EncryptedUserKey = null;

      const idTokenResponse: IdentityTokenResponse = identityTokenResponseFactory(
        null,
        userDecryptionOpts,
      );

      apiService.postIdentityToken.mockResolvedValue(idTokenResponse);
      deviceTrustService.getDeviceKey.mockResolvedValue(mockDeviceKey);

      // Act
      await ssoLoginStrategy.logIn(credentials);

      // Assert
      expect(deviceTrustService.recordDeviceTrustLoss).toHaveBeenCalledTimes(1);
    });

    describe("AdminAuthRequest", () => {
      let tokenResponse: IdentityTokenResponse;

      beforeEach(() => {
        tokenResponse = identityTokenResponseFactory(null, {
          HasMasterPassword: true,
          TrustedDeviceOption: {
            HasAdminApproval: true,
            HasLoginApprovingDevice: false,
            HasManageResetPasswordPermission: false,
            IsTdeOffboarding: false,
            EncryptedPrivateKey: mockEncDevicePrivateKey,
            EncryptedUserKey: mockEncUserKey,
          },
        });

        const adminAuthRequest = {
          id: "1",
          privateKey: "PRIVATE" as any,
        } as AdminAuthRequestStorable;
        authRequestService.getAdminAuthRequest.mockResolvedValue(
          new AdminAuthRequestStorable(adminAuthRequest),
        );
      });

      it("sets the user key using master key and hash from approved admin request if exists", async () => {
        apiService.postIdentityToken.mockResolvedValue(tokenResponse);
        keyService.hasUserKey.mockResolvedValue(true);
        const adminAuthResponse = {
          id: "1",
          publicKey: "PRIVATE" as any,
          key: "KEY" as any,
          masterPasswordHash: "HASH" as any,
          requestApproved: true,
        };
        apiService.getAuthRequest.mockResolvedValue(adminAuthResponse as AuthRequestResponse);

        await ssoLoginStrategy.logIn(credentials);

        expect(authRequestService.setKeysAfterDecryptingSharedMasterKeyAndHash).toHaveBeenCalled();
        expect(deviceTrustService.decryptUserKeyWithDeviceKey).not.toHaveBeenCalled();
      });

      it("sets the user key from approved admin request if exists", async () => {
        apiService.postIdentityToken.mockResolvedValue(tokenResponse);
        keyService.hasUserKey.mockResolvedValue(true);
        const adminAuthResponse = {
          id: "1",
          publicKey: "PRIVATE" as any,
          key: "KEY" as any,
          requestApproved: true,
        };
        apiService.getAuthRequest.mockResolvedValue(adminAuthResponse as AuthRequestResponse);

        await ssoLoginStrategy.logIn(credentials);

        expect(authRequestService.setUserKeyAfterDecryptingSharedUserKey).toHaveBeenCalled();
        expect(deviceTrustService.decryptUserKeyWithDeviceKey).not.toHaveBeenCalled();
      });

      it("attempts to establish a trusted device if successful", async () => {
        apiService.postIdentityToken.mockResolvedValue(tokenResponse);
        keyService.hasUserKey.mockResolvedValue(true);
        const adminAuthResponse = {
          id: "1",
          publicKey: "PRIVATE" as any,
          key: "KEY" as any,
          requestApproved: true,
        };
        apiService.getAuthRequest.mockResolvedValue(adminAuthResponse as AuthRequestResponse);

        await ssoLoginStrategy.logIn(credentials);

        expect(authRequestService.setUserKeyAfterDecryptingSharedUserKey).toHaveBeenCalled();
        expect(deviceTrustService.trustDeviceIfRequired).toHaveBeenCalled();
      });

      it("clears the admin auth request if server returns a 404, meaning it was deleted", async () => {
        apiService.postIdentityToken.mockResolvedValue(tokenResponse);
        apiService.getAuthRequest.mockRejectedValue(new ErrorResponse(null, 404));

        await ssoLoginStrategy.logIn(credentials);

        expect(authRequestService.clearAdminAuthRequest).toHaveBeenCalled();
        expect(
          authRequestService.setKeysAfterDecryptingSharedMasterKeyAndHash,
        ).not.toHaveBeenCalled();
        expect(authRequestService.setUserKeyAfterDecryptingSharedUserKey).not.toHaveBeenCalled();
        expect(deviceTrustService.trustDeviceIfRequired).not.toHaveBeenCalled();
      });

      it("attempts to login with a trusted device if admin auth request isn't successful", async () => {
        apiService.postIdentityToken.mockResolvedValue(tokenResponse);
        const adminAuthResponse = {
          id: "1",
          publicKey: "PRIVATE" as any,
          key: "KEY" as any,
          requestApproved: true,
        };
        apiService.getAuthRequest.mockResolvedValue(adminAuthResponse as AuthRequestResponse);
        keyService.hasUserKey.mockResolvedValue(false);
        deviceTrustService.getDeviceKey.mockResolvedValue("DEVICE_KEY" as any);

        await ssoLoginStrategy.logIn(credentials);

        expect(deviceTrustService.decryptUserKeyWithDeviceKey).toHaveBeenCalled();
      });
    });
  });

  describe("Key Connector", () => {
    let tokenResponse: IdentityTokenResponse;
    beforeEach(() => {
      tokenResponse = identityTokenResponseFactory(null, {
        HasMasterPassword: false,
        KeyConnectorOption: { KeyConnectorUrl: keyConnectorUrl },
      });
    });

    it("gets and sets the master key if Key Connector is enabled and the user doesn't have a master password", async () => {
      const masterKey = new SymmetricCryptoKey(
        new Uint8Array(64).buffer as CsprngArray,
      ) as MasterKey;

      apiService.postIdentityToken.mockResolvedValue(tokenResponse);
      masterPasswordService.masterKeySubject.next(masterKey);

      await ssoLoginStrategy.logIn(credentials);

      expect(keyConnectorService.setMasterKeyFromUrl).toHaveBeenCalledWith(keyConnectorUrl, userId);
    });

    it("converts new SSO user with no master password to Key Connector on first login", async () => {
      tokenResponse.key = undefined;
      tokenResponse.kdfConfig = new Argon2KdfConfig(10, 64, 4);

      apiService.postIdentityToken.mockResolvedValue(tokenResponse);

      await ssoLoginStrategy.logIn(credentials);

      expect(keyConnectorService.setNewSsoUserKeyConnectorConversionData).toHaveBeenCalledWith(
        {
          kdfConfig: new Argon2KdfConfig(10, 64, 4),
          keyConnectorUrl: keyConnectorUrl,
          organizationId: ssoOrgId,
        },
        userId,
      );
    });

    it("decrypts and sets the user key if Key Connector is enabled and the user doesn't have a master password", async () => {
      const userKey = new SymmetricCryptoKey(new Uint8Array(64).buffer as CsprngArray) as UserKey;
      const masterKey = new SymmetricCryptoKey(
        new Uint8Array(64).buffer as CsprngArray,
      ) as MasterKey;

      apiService.postIdentityToken.mockResolvedValue(tokenResponse);
      masterPasswordService.masterKeySubject.next(masterKey);
      masterPasswordService.mock.decryptUserKeyWithMasterKey.mockResolvedValue(userKey);

      await ssoLoginStrategy.logIn(credentials);

      expect(masterPasswordService.mock.decryptUserKeyWithMasterKey).toHaveBeenCalledWith(
        masterKey,
        userId,
        undefined,
      );
      expect(keyService.setUserKey).toHaveBeenCalledWith(userKey, userId);
    });
  });
});
