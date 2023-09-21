import { mock, MockProxy } from "jest-mock-extended";

import { ApiService } from "../../abstractions/api.service";
import { AppIdService } from "../../platform/abstractions/app-id.service";
import { CryptoService } from "../../platform/abstractions/crypto.service";
import { I18nService } from "../../platform/abstractions/i18n.service";
import { LogService } from "../../platform/abstractions/log.service";
import { MessagingService } from "../../platform/abstractions/messaging.service";
import { PlatformUtilsService } from "../../platform/abstractions/platform-utils.service";
import { StateService } from "../../platform/abstractions/state.service";
import { Utils } from "../../platform/misc/utils";
import {
  DeviceKey,
  MasterKey,
  SymmetricCryptoKey,
  UserKey,
} from "../../platform/models/domain/symmetric-crypto-key";
import { CsprngArray } from "../../types/csprng";
import { AuthRequestCryptoServiceAbstraction } from "../abstractions/auth-request-crypto.service.abstraction";
import { DeviceTrustCryptoServiceAbstraction } from "../abstractions/device-trust-crypto.service.abstraction";
import { KeyConnectorService } from "../abstractions/key-connector.service";
import { TokenService } from "../abstractions/token.service";
import { TwoFactorService } from "../abstractions/two-factor.service";
import { SsoLogInCredentials } from "../models/domain/log-in-credentials";
import { IdentityTokenResponse } from "../models/response/identity-token.response";
import { IUserDecryptionOptionsServerResponse } from "../models/response/user-decryption-options/user-decryption-options.response";

import { identityTokenResponseFactory } from "./login.strategy.spec";
import { SsoLogInStrategy } from "./sso-login.strategy";

// TODO: Add tests for new trySetUserKeyWithApprovedAdminRequestIfExists logic
// https://bitwarden.atlassian.net/browse/PM-3339

describe("SsoLogInStrategy", () => {
  let cryptoService: MockProxy<CryptoService>;
  let apiService: MockProxy<ApiService>;
  let tokenService: MockProxy<TokenService>;
  let appIdService: MockProxy<AppIdService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let messagingService: MockProxy<MessagingService>;
  let logService: MockProxy<LogService>;
  let stateService: MockProxy<StateService>;
  let twoFactorService: MockProxy<TwoFactorService>;
  let keyConnectorService: MockProxy<KeyConnectorService>;
  let deviceTrustCryptoService: MockProxy<DeviceTrustCryptoServiceAbstraction>;
  let authRequestCryptoService: MockProxy<AuthRequestCryptoServiceAbstraction>;
  let i18nService: MockProxy<I18nService>;

  let ssoLogInStrategy: SsoLogInStrategy;
  let credentials: SsoLogInCredentials;

  const deviceId = Utils.newGuid();
  const keyConnectorUrl = "KEY_CONNECTOR_URL";

  const ssoCode = "SSO_CODE";
  const ssoCodeVerifier = "SSO_CODE_VERIFIER";
  const ssoRedirectUrl = "SSO_REDIRECT_URL";
  const ssoOrgId = "SSO_ORG_ID";

  beforeEach(async () => {
    cryptoService = mock<CryptoService>();
    apiService = mock<ApiService>();
    tokenService = mock<TokenService>();
    appIdService = mock<AppIdService>();
    platformUtilsService = mock<PlatformUtilsService>();
    messagingService = mock<MessagingService>();
    logService = mock<LogService>();
    stateService = mock<StateService>();
    twoFactorService = mock<TwoFactorService>();
    keyConnectorService = mock<KeyConnectorService>();
    deviceTrustCryptoService = mock<DeviceTrustCryptoServiceAbstraction>();
    authRequestCryptoService = mock<AuthRequestCryptoServiceAbstraction>();
    i18nService = mock<I18nService>();

    tokenService.getTwoFactorToken.mockResolvedValue(null);
    appIdService.getAppId.mockResolvedValue(deviceId);
    tokenService.decodeToken.mockResolvedValue({});

    ssoLogInStrategy = new SsoLogInStrategy(
      cryptoService,
      apiService,
      tokenService,
      appIdService,
      platformUtilsService,
      messagingService,
      logService,
      stateService,
      twoFactorService,
      keyConnectorService,
      deviceTrustCryptoService,
      authRequestCryptoService,
      i18nService
    );
    credentials = new SsoLogInCredentials(ssoCode, ssoCodeVerifier, ssoRedirectUrl, ssoOrgId);
  });

  it("sends SSO information to server", async () => {
    apiService.postIdentityToken.mockResolvedValue(identityTokenResponseFactory());

    await ssoLogInStrategy.logIn(credentials);

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
      })
    );
  });

  it("does not set keys for new SSO user flow", async () => {
    const tokenResponse = identityTokenResponseFactory();
    tokenResponse.key = null;
    apiService.postIdentityToken.mockResolvedValue(tokenResponse);

    await ssoLogInStrategy.logIn(credentials);

    expect(cryptoService.setMasterKey).not.toHaveBeenCalled();
    expect(cryptoService.setUserKey).not.toHaveBeenCalled();
    expect(cryptoService.setPrivateKey).not.toHaveBeenCalled();
  });

  it("sets master key encrypted user key for existing SSO users", async () => {
    // Arrange
    const tokenResponse = identityTokenResponseFactory();
    apiService.postIdentityToken.mockResolvedValue(tokenResponse);

    // Act
    await ssoLogInStrategy.logIn(credentials);

    // Assert
    expect(cryptoService.setMasterKeyEncryptedUserKey).toHaveBeenCalledTimes(1);
    expect(cryptoService.setMasterKeyEncryptedUserKey).toHaveBeenCalledWith(tokenResponse.key);
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
        userDecryptionOptsServerResponseWithTdeOption
      );

      apiService.postIdentityToken.mockResolvedValue(idTokenResponse);
      deviceTrustCryptoService.getDeviceKey.mockResolvedValue(mockDeviceKey);
      deviceTrustCryptoService.decryptUserKeyWithDeviceKey.mockResolvedValue(mockUserKey);

      const cryptoSvcSetUserKeySpy = jest.spyOn(cryptoService, "setUserKey");

      // Act
      await ssoLogInStrategy.logIn(credentials);

      // Assert
      expect(deviceTrustCryptoService.getDeviceKey).toHaveBeenCalledTimes(1);
      expect(deviceTrustCryptoService.decryptUserKeyWithDeviceKey).toHaveBeenCalledTimes(1);
      expect(cryptoSvcSetUserKeySpy).toHaveBeenCalledTimes(1);
      expect(cryptoSvcSetUserKeySpy).toHaveBeenCalledWith(mockUserKey);
    });

    it("does not set the user key when deviceKey is missing", async () => {
      // Arrange
      const idTokenResponse: IdentityTokenResponse = identityTokenResponseFactory(
        null,
        userDecryptionOptsServerResponseWithTdeOption
      );
      apiService.postIdentityToken.mockResolvedValue(idTokenResponse);
      // Set deviceKey to be null
      deviceTrustCryptoService.getDeviceKey.mockResolvedValue(null);
      deviceTrustCryptoService.decryptUserKeyWithDeviceKey.mockResolvedValue(mockUserKey);

      // Act
      await ssoLogInStrategy.logIn(credentials);

      // Assert
      expect(cryptoService.setUserKey).not.toHaveBeenCalled();
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
        deviceTrustCryptoService.getDeviceKey.mockResolvedValue(mockDeviceKey);

        // Act
        await ssoLogInStrategy.logIn(credentials);

        // Assert
        expect(cryptoService.setUserKey).not.toHaveBeenCalled();
      });
    });

    it("does not set user key when decrypted user key is null", async () => {
      // Arrange
      const idTokenResponse: IdentityTokenResponse = identityTokenResponseFactory(
        null,
        userDecryptionOptsServerResponseWithTdeOption
      );
      apiService.postIdentityToken.mockResolvedValue(idTokenResponse);
      deviceTrustCryptoService.getDeviceKey.mockResolvedValue(mockDeviceKey);
      // Set userKey to be null
      deviceTrustCryptoService.decryptUserKeyWithDeviceKey.mockResolvedValue(null);

      // Act
      await ssoLogInStrategy.logIn(credentials);

      // Assert
      expect(cryptoService.setUserKey).not.toHaveBeenCalled();
    });
  });

  describe("Key Connector", () => {
    let tokenResponse: IdentityTokenResponse;
    beforeEach(() => {
      tokenResponse = identityTokenResponseFactory(null, {
        HasMasterPassword: false,
        KeyConnectorOption: { KeyConnectorUrl: keyConnectorUrl },
      });
      tokenResponse.keyConnectorUrl = keyConnectorUrl;
    });

    it("gets and sets the master key if Key Connector is enabled and the user doesn't have a master password", async () => {
      const masterKey = new SymmetricCryptoKey(
        new Uint8Array(64).buffer as CsprngArray
      ) as MasterKey;

      apiService.postIdentityToken.mockResolvedValue(tokenResponse);
      cryptoService.getMasterKey.mockResolvedValue(masterKey);

      await ssoLogInStrategy.logIn(credentials);

      expect(keyConnectorService.setMasterKeyFromUrl).toHaveBeenCalledWith(keyConnectorUrl);
    });

    it("converts new SSO user with no master password to Key Connector on first login", async () => {
      tokenResponse.key = null;

      apiService.postIdentityToken.mockResolvedValue(tokenResponse);

      await ssoLogInStrategy.logIn(credentials);

      expect(keyConnectorService.convertNewSsoUserToKeyConnector).toHaveBeenCalledWith(
        tokenResponse,
        ssoOrgId
      );
    });

    it("decrypts and sets the user key if Key Connector is enabled and the user doesn't have a master password", async () => {
      const userKey = new SymmetricCryptoKey(new Uint8Array(64).buffer as CsprngArray) as UserKey;
      const masterKey = new SymmetricCryptoKey(
        new Uint8Array(64).buffer as CsprngArray
      ) as MasterKey;

      apiService.postIdentityToken.mockResolvedValue(tokenResponse);
      cryptoService.getMasterKey.mockResolvedValue(masterKey);
      cryptoService.decryptUserKeyWithMasterKey.mockResolvedValue(userKey);

      await ssoLogInStrategy.logIn(credentials);

      expect(cryptoService.decryptUserKeyWithMasterKey).toHaveBeenCalledWith(masterKey);
      expect(cryptoService.setUserKey).toHaveBeenCalledWith(userKey);
    });
  });

  describe("Key Connector Pre-TDE", () => {
    let tokenResponse: IdentityTokenResponse;
    beforeEach(() => {
      tokenResponse = identityTokenResponseFactory();
      tokenResponse.userDecryptionOptions = null;
      tokenResponse.keyConnectorUrl = keyConnectorUrl;
    });

    it("gets and sets the master key if Key Connector is enabled and the user doesn't have a master password", async () => {
      const masterKey = new SymmetricCryptoKey(
        new Uint8Array(64).buffer as CsprngArray
      ) as MasterKey;

      apiService.postIdentityToken.mockResolvedValue(tokenResponse);
      cryptoService.getMasterKey.mockResolvedValue(masterKey);

      await ssoLogInStrategy.logIn(credentials);

      expect(keyConnectorService.setMasterKeyFromUrl).toHaveBeenCalledWith(keyConnectorUrl);
    });

    it("converts new SSO user with no master password to Key Connector on first login", async () => {
      tokenResponse.key = null;

      apiService.postIdentityToken.mockResolvedValue(tokenResponse);

      await ssoLogInStrategy.logIn(credentials);

      expect(keyConnectorService.convertNewSsoUserToKeyConnector).toHaveBeenCalledWith(
        tokenResponse,
        ssoOrgId
      );
    });

    it("decrypts and sets the user key if Key Connector is enabled and the user doesn't have a master password", async () => {
      const userKey = new SymmetricCryptoKey(new Uint8Array(64).buffer as CsprngArray) as UserKey;
      const masterKey = new SymmetricCryptoKey(
        new Uint8Array(64).buffer as CsprngArray
      ) as MasterKey;

      apiService.postIdentityToken.mockResolvedValue(tokenResponse);
      cryptoService.getMasterKey.mockResolvedValue(masterKey);
      cryptoService.decryptUserKeyWithMasterKey.mockResolvedValue(userKey);

      await ssoLogInStrategy.logIn(credentials);

      expect(cryptoService.decryptUserKeyWithMasterKey).toHaveBeenCalledWith(masterKey);
      expect(cryptoService.setUserKey).toHaveBeenCalledWith(userKey);
    });
  });
});
