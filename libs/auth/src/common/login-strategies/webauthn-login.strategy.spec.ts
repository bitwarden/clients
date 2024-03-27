import { mock, MockProxy } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { TwoFactorService } from "@bitwarden/common/auth/abstractions/two-factor.service";
import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
import { IdentityTokenResponse } from "@bitwarden/common/auth/models/response/identity-token.response";
import { IUserDecryptionOptionsServerResponse } from "@bitwarden/common/auth/models/response/user-decryption-options/user-decryption-options.response";
import { FakeMasterPasswordService } from "@bitwarden/common/auth/services/master-password/fake-master-password.service";
import { WebAuthnLoginAssertionResponseRequest } from "@bitwarden/common/auth/services/webauthn-login/request/webauthn-login-assertion-response.request";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { FakeAccountService } from "@bitwarden/common/spec";
import { PrfKey, UserKey } from "@bitwarden/common/types/key";

import { InternalUserDecryptionOptionsServiceAbstraction } from "../abstractions/user-decryption-options.service.abstraction";
import { WebAuthnLoginCredentials } from "../models/domain/login-credentials";

import { identityTokenResponseFactory } from "./login.strategy.spec";
import { WebAuthnLoginStrategy, WebAuthnLoginStrategyData } from "./webauthn-login.strategy";

describe("WebAuthnLoginStrategy", () => {
  let cache: WebAuthnLoginStrategyData;
  let accountService: FakeAccountService;
  let masterPasswordService: FakeMasterPasswordService;

  let cryptoService!: MockProxy<CryptoService>;
  let apiService!: MockProxy<ApiService>;
  let tokenService!: MockProxy<TokenService>;
  let appIdService!: MockProxy<AppIdService>;
  let platformUtilsService!: MockProxy<PlatformUtilsService>;
  let messagingService!: MockProxy<MessagingService>;
  let logService!: MockProxy<LogService>;
  let stateService!: MockProxy<StateService>;
  let twoFactorService!: MockProxy<TwoFactorService>;
  let userDecryptionOptionsService: MockProxy<InternalUserDecryptionOptionsServiceAbstraction>;
  let billingAccountProfileStateService: MockProxy<BillingAccountProfileStateService>;

  let webAuthnLoginStrategy!: WebAuthnLoginStrategy;

  const token = "mockToken";
  const deviceId = Utils.newGuid();

  let webAuthnCredentials!: WebAuthnLoginCredentials;

  let originalPublicKeyCredential!: PublicKeyCredential | any;
  let originalAuthenticatorAssertionResponse!: AuthenticatorAssertionResponse | any;

  beforeAll(() => {
    // Save off the original classes so we can restore them after all tests are done if they exist
    originalPublicKeyCredential = global.PublicKeyCredential;
    originalAuthenticatorAssertionResponse = global.AuthenticatorAssertionResponse;

    // We must do this to make the mocked classes available for all the
    // assertCredential(...) tests.
    global.PublicKeyCredential = MockPublicKeyCredential;
    global.AuthenticatorAssertionResponse = MockAuthenticatorAssertionResponse;
  });

  beforeEach(() => {
    jest.clearAllMocks();

    accountService = new FakeAccountService(null);
    masterPasswordService = new FakeMasterPasswordService();

    cryptoService = mock<CryptoService>();
    apiService = mock<ApiService>();
    tokenService = mock<TokenService>();
    appIdService = mock<AppIdService>();
    platformUtilsService = mock<PlatformUtilsService>();
    messagingService = mock<MessagingService>();
    logService = mock<LogService>();
    stateService = mock<StateService>();
    twoFactorService = mock<TwoFactorService>();
    userDecryptionOptionsService = mock<InternalUserDecryptionOptionsServiceAbstraction>();
    billingAccountProfileStateService = mock<BillingAccountProfileStateService>();

    tokenService.getTwoFactorToken.mockResolvedValue(null);
    appIdService.getAppId.mockResolvedValue(deviceId);
    tokenService.decodeAccessToken.mockResolvedValue({});

    webAuthnLoginStrategy = new WebAuthnLoginStrategy(
      cache,
      accountService,
      masterPasswordService,
      cryptoService,
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
    );

    // Create credentials
    const publicKeyCredential = new MockPublicKeyCredential();
    const deviceResponse = new WebAuthnLoginAssertionResponseRequest(publicKeyCredential);
    const prfKey = new SymmetricCryptoKey(randomBytes(32)) as PrfKey;
    webAuthnCredentials = new WebAuthnLoginCredentials(token, deviceResponse, prfKey);
  });

  afterAll(() => {
    // Restore global after all tests are done
    global.PublicKeyCredential = originalPublicKeyCredential;
    global.AuthenticatorAssertionResponse = originalAuthenticatorAssertionResponse;
  });

  const mockEncPrfPrivateKey =
    "2.eh465OrUcluL9UpnCOUTAg==|2HXNXwrLwAjUfZ/U75c92rZEltt1eHxjMkp/ADAmx346oT1+GaQvaL1QIV/9Om0T72m8AnlO92iUfWdhbA/ifHZ+lhFoUVeyw1M88CMzktbVcq42rFoK7SGHSAGdTL3ccUWKI8yCCQJhpt2X6a/5+T7ey5k2CqvylKyOtkiCnVeLmYqETn5BM9Rl3tEgJW1yDLuSJ+L+Qh9xnk/Z3zJUV5HAs+YwjKwuSNrd00SXjDyx8rBEstD9MKI+lrk7to/q90vqKqCucAj/dzUpVtHe88al2AAlBVwQ13HUPdNFOyti6niUgCAWx+DzRqlhkFvl/z/rtxtQsyqq/3Eh/EL54ylxKzAya0ev9EaIOm/dD1aBmI58p4Bs0eMOCIKJjtw+Cmdql+RhCtKtumgFShqyXv+LfD/FgUsdTVNExk3YNhgwPR4jOaMa/j9LCrBMCLKxdAhQyBe7T3qoX1fBBirvY6t77ifMu1YEQ6DfmFphVSwDH5C9xGeTSh5IELSf0tGVtlWUe9RffDDzccD0L1lR8U+dqzoSTYCuXvhEhQptdIW6fpH/47u0M5MiI97/d35A7Et2I1gjHp7WF3qsY20ellBueu7ZL5P1BmqPXl58yaBBXJaCutYHDfIucspqdZmfBGEbdRT4wmuZRON0J8zLmUejM0VR/2MOmpfyYQXnJhTfrvnZ1bOg1aMhUxJ2vhDNPXUFm5b+vwsho4GEvcLAKq9WwbvOJ/sK7sEVfTfEO2IG+0X6wkWm7RpR6Wq9FGKSrv2PSjMAYnb+z3ETeWiaaiD+tVFxa2AaqsbOuX092/86GySpHES7cFWhQ/YMOgj6egUi8mEC0CqMXYsx0TTJDsn16oP+XB3a2WoRqzE0YBozp2aMXxhVf/jMZ03BmEmRQu5B+Sq1gMEZwtIfJ+srkZLMYlLjvVw92FRoFy+N6ytPiyf6RMHMUnJ3vEZSBogaElYoQAtFJ5kK811CUzb78zEHH8xWtPrCZn9zZfvf/zaWxo7fpV8VwAwUeHXHcQMraZum5QeO+5tLRUYrLm85JNelGfmUA3BjfNyFbfb32PhkWWd0CbDaPME48uIriVK32pNEtvtR/+I/f3YgA/jP9kSlDvbzG/OAg/AFBIpNwKUzsu4+va8mI+O5FDufw5D74WwdGJ9DeyEb2CHtWMR1VwtFKL0ZZsqltNf8EkBeJ5RtTNtAMM8ie4dDZaKC96ymQHKrdB4hjkAr0F1XFsU4XdOa9Nbkdcm/7KoNc6bE6oJtG9lqE8h+1CysfcbfJ7am+hvDFzT0IPmp3GDSMAk+e6xySgFQw0C/SZ7LQsxPa1s6hc+BOtTn0oClZnU7Mowxv+z+xURJj4Yp3Cy6tAoia1jEQSs6lSMNKPf9bi3xFKtPl4143hwhpvTAzJUcski9OVGd7Du+VyxwIrvLqp5Ct/oNrESVJpf1EDCs9xT1EW+PiSkRmHXoZ1t5MOLFEiMAZL2+bNe3A2661oJeMtps8zrfCVc251OUE1WvqWePlTOs5TDVqdwDH88J6rHLsbaf33Mxh5DP8gMfZQxE44Nsp6H0/Szfkss5UmFwBEpHjl1GJMWDnB3u2d+l1CSkLoB6C+diAUlY6wL/VwJBeMPHZTf6amQIS2B/lo/CnvV/E3k=|uuoY4b7xwMYBNIZi85KBsaHmNqtJl5FrKxZI9ugeNwc=";

  const mockEncUserKey =
    "4.Xht6K9GA9jKcSNy4TaIvdj7f9+WsgQycs/HdkrJi33aC//roKkjf3UTGpdzFLxVP3WhyOVGyo9f2Jymf1MFPdpg7AuMnpGJlcrWLDbnPjOJo4x5gUwwBUmy3nFw6+wamyS1LRmrBPcv56yKpf80k5Q3hUrum8q9YS9m2I10vklX/TaB1YML0yo+K1feWUxg8vIx+vloxhUdkkysvcV5xU3R+AgYLrwvJS8TLL7Ug/P5HxinCaIroRrNe8xcv84vyVnzPFdXe0cfZ0cpcrm586LwfEXP2seeldO/bC51Uk/mudeSALJURPC64f5ch2cOvk48GOTapGnssCqr6ky5yFw==";

  const userDecryptionOptsServerResponseWithWebAuthnPrfOption: IUserDecryptionOptionsServerResponse =
    {
      HasMasterPassword: true,
      WebAuthnPrfOption: {
        EncryptedPrivateKey: mockEncPrfPrivateKey,
        EncryptedUserKey: mockEncUserKey,
      },
    };

  const mockIdTokenResponseWithModifiedWebAuthnPrfOption = (key: string, value: any) => {
    const userDecryptionOpts: IUserDecryptionOptionsServerResponse = {
      ...userDecryptionOptsServerResponseWithWebAuthnPrfOption,
      WebAuthnPrfOption: {
        ...userDecryptionOptsServerResponseWithWebAuthnPrfOption.WebAuthnPrfOption,
        [key]: value,
      },
    };
    return identityTokenResponseFactory(null, userDecryptionOpts);
  };

  it("returns successful authResult when api service returns valid credentials", async () => {
    // Arrange
    const idTokenResponse: IdentityTokenResponse = identityTokenResponseFactory(
      null,
      userDecryptionOptsServerResponseWithWebAuthnPrfOption,
    );

    apiService.postIdentityToken.mockResolvedValue(idTokenResponse);

    // Act
    const authResult = await webAuthnLoginStrategy.logIn(webAuthnCredentials);

    // Assert
    expect(apiService.postIdentityToken).toHaveBeenCalledWith(
      expect.objectContaining({
        // webauthn specific info
        token: webAuthnCredentials.token,
        deviceResponse: webAuthnCredentials.deviceResponse,
        // standard info
        device: expect.objectContaining({
          identifier: deviceId,
        }),
      }),
    );

    expect(authResult).toBeInstanceOf(AuthResult);
    expect(authResult).toMatchObject({
      captchaSiteKey: "",
      forcePasswordReset: 0,
      resetMasterPassword: false,
      twoFactorProviders: null,
      requiresTwoFactor: false,
      requiresCaptcha: false,
    });
  });

  it("decrypts and sets user key when webAuthn PRF decryption option exists with valid PRF key and enc key data", async () => {
    // Arrange
    const idTokenResponse: IdentityTokenResponse = identityTokenResponseFactory(
      null,
      userDecryptionOptsServerResponseWithWebAuthnPrfOption,
    );

    apiService.postIdentityToken.mockResolvedValue(idTokenResponse);

    const mockPrfPrivateKey: Uint8Array = randomBytes(32);
    const mockUserKeyArray: Uint8Array = randomBytes(32);
    const mockUserKey = new SymmetricCryptoKey(mockUserKeyArray) as UserKey;

    cryptoService.decryptToBytes.mockResolvedValue(mockPrfPrivateKey);
    cryptoService.rsaDecrypt.mockResolvedValue(mockUserKeyArray);

    // Act
    await webAuthnLoginStrategy.logIn(webAuthnCredentials);

    // Assert
    // Master key encrypted user key should be set
    expect(cryptoService.setMasterKeyEncryptedUserKey).toHaveBeenCalledTimes(1);
    expect(cryptoService.setMasterKeyEncryptedUserKey).toHaveBeenCalledWith(idTokenResponse.key);

    expect(cryptoService.decryptToBytes).toHaveBeenCalledTimes(1);
    expect(cryptoService.decryptToBytes).toHaveBeenCalledWith(
      idTokenResponse.userDecryptionOptions.webAuthnPrfOption.encryptedPrivateKey,
      webAuthnCredentials.prfKey,
    );
    expect(cryptoService.rsaDecrypt).toHaveBeenCalledTimes(1);
    expect(cryptoService.rsaDecrypt).toHaveBeenCalledWith(
      idTokenResponse.userDecryptionOptions.webAuthnPrfOption.encryptedUserKey.encryptedString,
      mockPrfPrivateKey,
    );
    expect(cryptoService.setUserKey).toHaveBeenCalledWith(mockUserKey);
    expect(cryptoService.setPrivateKey).toHaveBeenCalledWith(idTokenResponse.privateKey);

    // Master key and private key should not be set
    expect(masterPasswordService.mock.setMasterKey).not.toHaveBeenCalled();
  });

  it("does not try to set the user key when prfKey is missing", async () => {
    // Arrange
    const idTokenResponse: IdentityTokenResponse = identityTokenResponseFactory(
      null,
      userDecryptionOptsServerResponseWithWebAuthnPrfOption,
    );

    apiService.postIdentityToken.mockResolvedValue(idTokenResponse);

    // Remove PRF key
    webAuthnCredentials.prfKey = null;

    // Act
    await webAuthnLoginStrategy.logIn(webAuthnCredentials);

    // Assert
    expect(cryptoService.decryptToBytes).not.toHaveBeenCalled();
    expect(cryptoService.rsaDecrypt).not.toHaveBeenCalled();
    expect(cryptoService.setUserKey).not.toHaveBeenCalled();
  });

  describe.each([
    {
      valueName: "encPrfPrivateKey",
    },
    {
      valueName: "encUserKey",
    },
  ])("given webAuthn PRF decryption option has missing encrypted key data", ({ valueName }) => {
    it(`does not set the user key when ${valueName} is missing`, async () => {
      // Arrange
      const idTokenResponse = mockIdTokenResponseWithModifiedWebAuthnPrfOption(valueName, null);
      apiService.postIdentityToken.mockResolvedValue(idTokenResponse);

      // Act
      await webAuthnLoginStrategy.logIn(webAuthnCredentials);

      // Assert
      expect(cryptoService.setUserKey).not.toHaveBeenCalled();
    });
  });

  it("does not set the user key when the PRF encrypted private key decryption fails", async () => {
    // Arrange
    const idTokenResponse: IdentityTokenResponse = identityTokenResponseFactory(
      null,
      userDecryptionOptsServerResponseWithWebAuthnPrfOption,
    );

    apiService.postIdentityToken.mockResolvedValue(idTokenResponse);

    cryptoService.decryptToBytes.mockResolvedValue(null);

    // Act
    await webAuthnLoginStrategy.logIn(webAuthnCredentials);

    // Assert
    expect(cryptoService.setUserKey).not.toHaveBeenCalled();
  });

  it("does not set the user key when the encrypted user key decryption fails", async () => {
    // Arrange
    const idTokenResponse: IdentityTokenResponse = identityTokenResponseFactory(
      null,
      userDecryptionOptsServerResponseWithWebAuthnPrfOption,
    );

    apiService.postIdentityToken.mockResolvedValue(idTokenResponse);

    cryptoService.rsaDecrypt.mockResolvedValue(null);

    // Act
    await webAuthnLoginStrategy.logIn(webAuthnCredentials);

    // Assert
    expect(cryptoService.setUserKey).not.toHaveBeenCalled();
  });
});

// Helpers and mocks
function randomBytes(length: number): Uint8Array {
  return new Uint8Array(Array.from({ length }, (_, k) => k % 255));
}

// AuthenticatorAssertionResponse && PublicKeyCredential are only available in secure contexts
// so we need to mock them and assign them to the global object to make them available
// for the tests
export class MockAuthenticatorAssertionResponse implements AuthenticatorAssertionResponse {
  clientDataJSON: ArrayBuffer = randomBytes(32).buffer;
  authenticatorData: ArrayBuffer = randomBytes(196).buffer;
  signature: ArrayBuffer = randomBytes(72).buffer;
  userHandle: ArrayBuffer = randomBytes(16).buffer;

  clientDataJSONB64Str = Utils.fromBufferToUrlB64(this.clientDataJSON);
  authenticatorDataB64Str = Utils.fromBufferToUrlB64(this.authenticatorData);
  signatureB64Str = Utils.fromBufferToUrlB64(this.signature);
  userHandleB64Str = Utils.fromBufferToUrlB64(this.userHandle);
}

export class MockPublicKeyCredential implements PublicKeyCredential {
  authenticatorAttachment = "cross-platform";
  id = "mockCredentialId";
  type = "public-key";
  rawId: ArrayBuffer = randomBytes(32).buffer;
  rawIdB64Str = Utils.fromBufferToB64(this.rawId);

  response: MockAuthenticatorAssertionResponse = new MockAuthenticatorAssertionResponse();

  // Use random 64 character hex string (32 bytes - matters for symmetric key creation)
  // to represent the prf key binary data and convert to ArrayBuffer
  // Creating the array buffer from a known hex value allows us to
  // assert on the value in tests
  private prfKeyArrayBuffer: ArrayBuffer = Utils.hexStringToArrayBuffer(
    "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  );

  getClientExtensionResults(): any {
    return {
      prf: {
        results: {
          first: this.prfKeyArrayBuffer,
        },
      },
    };
  }

  static isConditionalMediationAvailable(): Promise<boolean> {
    return Promise.resolve(false);
  }

  static isUserVerifyingPlatformAuthenticatorAvailable(): Promise<boolean> {
    return Promise.resolve(false);
  }
}
