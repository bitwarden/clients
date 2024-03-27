import { mock, MockProxy } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { TwoFactorService } from "@bitwarden/common/auth/abstractions/two-factor.service";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { IdentityTokenResponse } from "@bitwarden/common/auth/models/response/identity-token.response";
import { IdentityTwoFactorResponse } from "@bitwarden/common/auth/models/response/identity-two-factor.response";
import { MasterPasswordPolicyResponse } from "@bitwarden/common/auth/models/response/master-password-policy.response";
import { FakeMasterPasswordService } from "@bitwarden/common/auth/services/master-password/fake-master-password.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { HashPurpose } from "@bitwarden/common/platform/enums";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import {
  PasswordStrengthServiceAbstraction,
  PasswordStrengthService,
} from "@bitwarden/common/tools/password-strength";
import { CsprngArray } from "@bitwarden/common/types/csprng";
import { UserId } from "@bitwarden/common/types/guid";
import { MasterKey, UserKey } from "@bitwarden/common/types/key";

import { LoginStrategyServiceAbstraction } from "../abstractions";
import { InternalUserDecryptionOptionsServiceAbstraction } from "../abstractions/user-decryption-options.service.abstraction";
import { PasswordLoginCredentials } from "../models/domain/login-credentials";

import { identityTokenResponseFactory } from "./login.strategy.spec";
import { PasswordLoginStrategy, PasswordLoginStrategyData } from "./password-login.strategy";

const email = "hello@world.com";
const masterPassword = "password";
const hashedPassword = "HASHED_PASSWORD";
const localHashedPassword = "LOCAL_HASHED_PASSWORD";
const masterKey = new SymmetricCryptoKey(
  Utils.fromB64ToArray(
    "N2KWjlLpfi5uHjv+YcfUKIpZ1l+W+6HRensmIqD+BFYBf6N/dvFpJfWwYnVBdgFCK2tJTAIMLhqzIQQEUmGFgg==",
  ),
) as MasterKey;
const userId = Utils.newGuid() as UserId;
const deviceId = Utils.newGuid();
const masterPasswordPolicy = new MasterPasswordPolicyResponse({
  EnforceOnLogin: true,
  MinLength: 8,
});

describe("PasswordLoginStrategy", () => {
  let cache: PasswordLoginStrategyData;
  let accountService: FakeAccountService;
  let masterPasswordService: FakeMasterPasswordService;

  let loginStrategyService: MockProxy<LoginStrategyServiceAbstraction>;
  let cryptoService: MockProxy<CryptoService>;
  let apiService: MockProxy<ApiService>;
  let tokenService: MockProxy<TokenService>;
  let appIdService: MockProxy<AppIdService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let messagingService: MockProxy<MessagingService>;
  let logService: MockProxy<LogService>;
  let stateService: MockProxy<StateService>;
  let twoFactorService: MockProxy<TwoFactorService>;
  let userDecryptionOptionsService: MockProxy<InternalUserDecryptionOptionsServiceAbstraction>;
  let policyService: MockProxy<PolicyService>;
  let passwordStrengthService: MockProxy<PasswordStrengthServiceAbstraction>;
  let billingAccountProfileStateService: MockProxy<BillingAccountProfileStateService>;

  let passwordLoginStrategy: PasswordLoginStrategy;
  let credentials: PasswordLoginCredentials;
  let tokenResponse: IdentityTokenResponse;

  beforeEach(async () => {
    accountService = mockAccountServiceWith(userId);
    masterPasswordService = new FakeMasterPasswordService();

    loginStrategyService = mock<LoginStrategyServiceAbstraction>();
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
    policyService = mock<PolicyService>();
    passwordStrengthService = mock<PasswordStrengthService>();
    billingAccountProfileStateService = mock<BillingAccountProfileStateService>();

    appIdService.getAppId.mockResolvedValue(deviceId);
    tokenService.decodeAccessToken.mockResolvedValue({});

    loginStrategyService.makePreloginKey.mockResolvedValue(masterKey);

    cryptoService.hashMasterKey
      .calledWith(masterPassword, expect.anything(), undefined)
      .mockResolvedValue(hashedPassword);
    cryptoService.hashMasterKey
      .calledWith(masterPassword, expect.anything(), HashPurpose.LocalAuthorization)
      .mockResolvedValue(localHashedPassword);

    policyService.evaluateMasterPassword.mockReturnValue(true);

    passwordLoginStrategy = new PasswordLoginStrategy(
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
      passwordStrengthService,
      policyService,
      loginStrategyService,
      billingAccountProfileStateService,
    );
    credentials = new PasswordLoginCredentials(email, masterPassword);
    tokenResponse = identityTokenResponseFactory(masterPasswordPolicy);

    apiService.postIdentityToken.mockResolvedValue(tokenResponse);
  });

  it("sends master password credentials to the server", async () => {
    await passwordLoginStrategy.logIn(credentials);

    expect(apiService.postIdentityToken).toHaveBeenCalledWith(
      expect.objectContaining({
        email: email,
        masterPasswordHash: hashedPassword,
        device: expect.objectContaining({
          identifier: deviceId,
        }),
        twoFactor: expect.objectContaining({
          provider: null,
          token: null,
        }),
        captchaResponse: undefined,
      }),
    );
  });

  it("sets keys after a successful authentication", async () => {
    const userKey = new SymmetricCryptoKey(new Uint8Array(64).buffer as CsprngArray) as UserKey;

    masterPasswordService.masterKeySubject.next(masterKey);
    cryptoService.decryptUserKeyWithMasterKey.mockResolvedValue(userKey);

    await passwordLoginStrategy.logIn(credentials);

    expect(masterPasswordService.mock.setMasterKey).toHaveBeenCalledWith(masterKey, userId);
    expect(masterPasswordService.mock.setMasterKeyHash).toHaveBeenCalledWith(
      localHashedPassword,
      userId,
    );
    expect(cryptoService.setMasterKeyEncryptedUserKey).toHaveBeenCalledWith(tokenResponse.key);
    expect(cryptoService.setUserKey).toHaveBeenCalledWith(userKey);
    expect(cryptoService.setPrivateKey).toHaveBeenCalledWith(tokenResponse.privateKey);
  });

  it("does not force the user to update their master password when there are no requirements", async () => {
    apiService.postIdentityToken.mockResolvedValueOnce(identityTokenResponseFactory());

    const result = await passwordLoginStrategy.logIn(credentials);

    expect(policyService.evaluateMasterPassword).not.toHaveBeenCalled();
    expect(result.forcePasswordReset).toEqual(ForceSetPasswordReason.None);
  });

  it("does not force the user to update their master password when it meets requirements", async () => {
    passwordStrengthService.getPasswordStrength.mockReturnValue({ score: 5 } as any);
    policyService.evaluateMasterPassword.mockReturnValue(true);

    const result = await passwordLoginStrategy.logIn(credentials);

    expect(policyService.evaluateMasterPassword).toHaveBeenCalled();
    expect(result.forcePasswordReset).toEqual(ForceSetPasswordReason.None);
  });

  it("forces the user to update their master password on successful login when it does not meet master password policy requirements", async () => {
    passwordStrengthService.getPasswordStrength.mockReturnValue({ score: 0 } as any);
    policyService.evaluateMasterPassword.mockReturnValue(false);

    const result = await passwordLoginStrategy.logIn(credentials);

    expect(policyService.evaluateMasterPassword).toHaveBeenCalled();
    expect(masterPasswordService.mock.setForceSetPasswordReason).toHaveBeenCalledWith(
      ForceSetPasswordReason.WeakMasterPassword,
      userId,
    );
    expect(result.forcePasswordReset).toEqual(ForceSetPasswordReason.WeakMasterPassword);
  });

  it("forces the user to update their master password on successful 2FA login when it does not meet master password policy requirements", async () => {
    passwordStrengthService.getPasswordStrength.mockReturnValue({ score: 0 } as any);
    policyService.evaluateMasterPassword.mockReturnValue(false);

    const token2FAResponse = new IdentityTwoFactorResponse({
      TwoFactorProviders: ["0"],
      TwoFactorProviders2: { 0: null },
      error: "invalid_grant",
      error_description: "Two factor required.",
      MasterPasswordPolicy: masterPasswordPolicy,
    });

    // First login request fails requiring 2FA
    apiService.postIdentityToken.mockResolvedValueOnce(token2FAResponse);
    const firstResult = await passwordLoginStrategy.logIn(credentials);

    // Second login request succeeds
    apiService.postIdentityToken.mockResolvedValueOnce(
      identityTokenResponseFactory(masterPasswordPolicy),
    );
    const secondResult = await passwordLoginStrategy.logInTwoFactor(
      {
        provider: TwoFactorProviderType.Authenticator,
        token: "123456",
        remember: false,
      },
      "",
    );

    // First login attempt should not save the force password reset options
    expect(firstResult.forcePasswordReset).toEqual(ForceSetPasswordReason.None);

    // Second login attempt should save the force password reset options and return in result
    expect(masterPasswordService.mock.setForceSetPasswordReason).toHaveBeenCalledWith(
      ForceSetPasswordReason.WeakMasterPassword,
      userId,
    );
    expect(secondResult.forcePasswordReset).toEqual(ForceSetPasswordReason.WeakMasterPassword);
  });
});
