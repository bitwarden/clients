import { MockProxy, mock } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { DeviceTrustCryptoServiceAbstraction } from "@bitwarden/common/auth/abstractions/device-trust-crypto.service.abstraction";
import { KeyConnectorService } from "@bitwarden/common/auth/abstractions/key-connector.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { TwoFactorService } from "@bitwarden/common/auth/abstractions/two-factor.service";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
import { TokenTwoFactorRequest } from "@bitwarden/common/auth/models/request/identity-token/token-two-factor.request";
import { IdentityTokenResponse } from "@bitwarden/common/auth/models/response/identity-token.response";
import { IdentityTwoFactorResponse } from "@bitwarden/common/auth/models/response/identity-two-factor.response";
import { FakeMasterPasswordService } from "@bitwarden/common/auth/services/master-password/fake-master-password.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { KdfType } from "@bitwarden/common/platform/enums";
import {
  FakeAccountService,
  FakeGlobalState,
  FakeGlobalStateProvider,
  mockAccountServiceWith,
} from "@bitwarden/common/spec";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
import { UserId } from "@bitwarden/common/types/guid";

import {
  AuthRequestServiceAbstraction,
  InternalUserDecryptionOptionsServiceAbstraction,
} from "../../abstractions";
import { PasswordLoginCredentials } from "../../models";
import { UserDecryptionOptionsService } from "../user-decryption-options/user-decryption-options.service";

import { LoginStrategyService } from "./login-strategy.service";
import { CACHE_EXPIRATION_KEY } from "./login-strategy.state";

describe("LoginStrategyService", () => {
  let sut: LoginStrategyService;

  let accountService: FakeAccountService;
  let masterPasswordService: FakeMasterPasswordService;
  let cryptoService: MockProxy<CryptoService>;
  let apiService: MockProxy<ApiService>;
  let tokenService: MockProxy<TokenService>;
  let appIdService: MockProxy<AppIdService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let messagingService: MockProxy<MessagingService>;
  let logService: MockProxy<LogService>;
  let keyConnectorService: MockProxy<KeyConnectorService>;
  let environmentService: MockProxy<EnvironmentService>;
  let stateService: MockProxy<StateService>;
  let twoFactorService: MockProxy<TwoFactorService>;
  let i18nService: MockProxy<I18nService>;
  let encryptService: MockProxy<EncryptService>;
  let passwordStrengthService: MockProxy<PasswordStrengthServiceAbstraction>;
  let policyService: MockProxy<PolicyService>;
  let deviceTrustCryptoService: MockProxy<DeviceTrustCryptoServiceAbstraction>;
  let authRequestService: MockProxy<AuthRequestServiceAbstraction>;
  let userDecryptionOptionsService: MockProxy<InternalUserDecryptionOptionsServiceAbstraction>;
  let billingAccountProfileStateService: MockProxy<BillingAccountProfileStateService>;

  let stateProvider: FakeGlobalStateProvider;
  let loginStrategyCacheExpirationState: FakeGlobalState<Date | null>;

  const userId = "USER_ID" as UserId;

  beforeEach(() => {
    accountService = mockAccountServiceWith(userId);
    masterPasswordService = new FakeMasterPasswordService();
    cryptoService = mock<CryptoService>();
    apiService = mock<ApiService>();
    tokenService = mock<TokenService>();
    appIdService = mock<AppIdService>();
    platformUtilsService = mock<PlatformUtilsService>();
    messagingService = mock<MessagingService>();
    logService = mock<LogService>();
    keyConnectorService = mock<KeyConnectorService>();
    environmentService = mock<EnvironmentService>();
    stateService = mock<StateService>();
    twoFactorService = mock<TwoFactorService>();
    i18nService = mock<I18nService>();
    encryptService = mock<EncryptService>();
    passwordStrengthService = mock<PasswordStrengthServiceAbstraction>();
    policyService = mock<PolicyService>();
    deviceTrustCryptoService = mock<DeviceTrustCryptoServiceAbstraction>();
    authRequestService = mock<AuthRequestServiceAbstraction>();
    userDecryptionOptionsService = mock<UserDecryptionOptionsService>();
    billingAccountProfileStateService = mock<BillingAccountProfileStateService>();
    stateProvider = new FakeGlobalStateProvider();

    sut = new LoginStrategyService(
      accountService,
      masterPasswordService,
      cryptoService,
      apiService,
      tokenService,
      appIdService,
      platformUtilsService,
      messagingService,
      logService,
      keyConnectorService,
      environmentService,
      stateService,
      twoFactorService,
      i18nService,
      encryptService,
      passwordStrengthService,
      policyService,
      deviceTrustCryptoService,
      authRequestService,
      userDecryptionOptionsService,
      stateProvider,
      billingAccountProfileStateService,
    );

    loginStrategyCacheExpirationState = stateProvider.getFake(CACHE_EXPIRATION_KEY);
  });

  it("should return an AuthResult on successful login", async () => {
    const credentials = new PasswordLoginCredentials("EMAIL", "MASTER_PASSWORD");
    apiService.postIdentityToken.mockResolvedValue(
      new IdentityTokenResponse({
        ForcePasswordReset: false,
        Kdf: KdfType.Argon2id,
        Key: "KEY",
        PrivateKey: "PRIVATE_KEY",
        ResetMasterPassword: false,
        access_token: "ACCESS_TOKEN",
        expires_in: 3600,
        refresh_token: "REFRESH_TOKEN",
        scope: "api offline_access",
        token_type: "Bearer",
      }),
    );
    tokenService.decodeAccessToken.calledWith("ACCESS_TOKEN").mockResolvedValue({
      sub: "USER_ID",
      name: "NAME",
      email: "EMAIL",
      premium: false,
    });

    const result = await sut.logIn(credentials);

    expect(result).toBeInstanceOf(AuthResult);
  });

  it("should return an AuthResult on successful 2fa login", async () => {
    const credentials = new PasswordLoginCredentials("EMAIL", "MASTER_PASSWORD");
    apiService.postIdentityToken.mockResolvedValueOnce(
      new IdentityTwoFactorResponse({
        TwoFactorProviders: ["0"],
        TwoFactorProviders2: { 0: null },
        error: "invalid_grant",
        error_description: "Two factor required.",
        email: undefined,
        ssoEmail2faSessionToken: undefined,
      }),
    );

    await sut.logIn(credentials);

    const twoFactorToken = new TokenTwoFactorRequest(
      TwoFactorProviderType.Authenticator,
      "TWO_FACTOR_TOKEN",
      true,
    );
    apiService.postIdentityToken.mockResolvedValue(
      new IdentityTokenResponse({
        ForcePasswordReset: false,
        Kdf: KdfType.Argon2id,
        Key: "KEY",
        PrivateKey: "PRIVATE_KEY",
        ResetMasterPassword: false,
        access_token: "ACCESS_TOKEN",
        expires_in: 3600,
        refresh_token: "REFRESH_TOKEN",
        scope: "api offline_access",
        token_type: "Bearer",
      }),
    );

    tokenService.decodeAccessToken.calledWith("ACCESS_TOKEN").mockResolvedValue({
      sub: "USER_ID",
      name: "NAME",
      email: "EMAIL",
      premium: false,
    });

    const result = await sut.logInTwoFactor(twoFactorToken, "CAPTCHA");

    expect(result).toBeInstanceOf(AuthResult);
  });

  it("should clear the cache if more than 2 mins have passed since expiration date", async () => {
    const credentials = new PasswordLoginCredentials("EMAIL", "MASTER_PASSWORD");
    apiService.postIdentityToken.mockResolvedValue(
      new IdentityTwoFactorResponse({
        TwoFactorProviders: ["0"],
        TwoFactorProviders2: { 0: null },
        error: "invalid_grant",
        error_description: "Two factor required.",
        email: undefined,
        ssoEmail2faSessionToken: undefined,
      }),
    );

    await sut.logIn(credentials);

    loginStrategyCacheExpirationState.stateSubject.next(new Date(Date.now() - 1000 * 60 * 5));

    const twoFactorToken = new TokenTwoFactorRequest(
      TwoFactorProviderType.Authenticator,
      "TWO_FACTOR_TOKEN",
      true,
    );

    await expect(sut.logInTwoFactor(twoFactorToken, "CAPTCHA")).rejects.toThrow();
  });
});
