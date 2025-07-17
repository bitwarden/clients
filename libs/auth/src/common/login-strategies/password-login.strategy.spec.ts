import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { TwoFactorService } from "@bitwarden/common/auth/abstractions/two-factor.service";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { IdentityTokenResponse } from "@bitwarden/common/auth/models/response/identity-token.response";
import { IdentityTwoFactorResponse } from "@bitwarden/common/auth/models/response/identity-two-factor.response";
import { MasterPasswordPolicyResponse } from "@bitwarden/common/auth/models/response/master-password-policy.response";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { FakeMasterPasswordService } from "@bitwarden/common/key-management/master-password/services/fake-master-password.service";
import {
  VaultTimeoutAction,
  VaultTimeoutSettingsService,
} from "@bitwarden/common/key-management/vault-timeout";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
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
import { KdfConfigService, KeyService } from "@bitwarden/key-management";

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
const masterPasswordPolicyResponse = new MasterPasswordPolicyResponse({
  EnforceOnLogin: true,
  MinLength: 8,
});

describe("PasswordLoginStrategy", () => {
  let cache: PasswordLoginStrategyData;
  let accountService: FakeAccountService;
  let masterPasswordService: FakeMasterPasswordService;

  let loginStrategyService: MockProxy<LoginStrategyServiceAbstraction>;
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
  let policyService: MockProxy<PolicyService>;
  let passwordStrengthService: MockProxy<PasswordStrengthServiceAbstraction>;
  let billingAccountProfileStateService: MockProxy<BillingAccountProfileStateService>;
  let vaultTimeoutSettingsService: MockProxy<VaultTimeoutSettingsService>;
  let kdfConfigService: MockProxy<KdfConfigService>;
  let environmentService: MockProxy<EnvironmentService>;
  let configService: MockProxy<ConfigService>;

  let passwordLoginStrategy: PasswordLoginStrategy;
  let credentials: PasswordLoginCredentials;
  let tokenResponse: IdentityTokenResponse;

  beforeEach(async () => {
    accountService = mockAccountServiceWith(userId);
    masterPasswordService = new FakeMasterPasswordService();

    loginStrategyService = mock<LoginStrategyServiceAbstraction>();
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
    policyService = mock<PolicyService>();
    passwordStrengthService = mock<PasswordStrengthService>();
    billingAccountProfileStateService = mock<BillingAccountProfileStateService>();
    vaultTimeoutSettingsService = mock<VaultTimeoutSettingsService>();
    kdfConfigService = mock<KdfConfigService>();
    environmentService = mock<EnvironmentService>();
    configService = mock<ConfigService>();

    appIdService.getAppId.mockResolvedValue(deviceId);
    tokenService.decodeAccessToken.mockResolvedValue({
      sub: userId,
    });

    loginStrategyService.makePreloginKey.mockResolvedValue(masterKey);

    keyService.hashMasterKey
      .calledWith(masterPassword, expect.anything(), undefined)
      .mockResolvedValue(hashedPassword);
    keyService.hashMasterKey
      .calledWith(masterPassword, expect.anything(), HashPurpose.LocalAuthorization)
      .mockResolvedValue(localHashedPassword);

    policyService.evaluateMasterPassword.mockReturnValue(true);

    passwordLoginStrategy = new PasswordLoginStrategy(
      cache,
      passwordStrengthService,
      policyService,
      loginStrategyService,
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
    credentials = new PasswordLoginCredentials(email, masterPassword);
    tokenResponse = identityTokenResponseFactory(masterPasswordPolicyResponse);

    apiService.postIdentityToken.mockResolvedValue(tokenResponse);

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
      }),
    );
  });

  it("sets keys after a successful authentication", async () => {
    const userKey = new SymmetricCryptoKey(new Uint8Array(64).buffer as CsprngArray) as UserKey;

    masterPasswordService.masterKeySubject.next(masterKey);
    masterPasswordService.mock.decryptUserKeyWithMasterKey.mockResolvedValue(userKey);
    tokenService.decodeAccessToken.mockResolvedValue({ sub: userId });

    await passwordLoginStrategy.logIn(credentials);

    expect(masterPasswordService.mock.setMasterKey).toHaveBeenCalledWith(masterKey, userId);
    expect(masterPasswordService.mock.setMasterKeyHash).toHaveBeenCalledWith(
      localHashedPassword,
      userId,
    );
    expect(masterPasswordService.mock.setMasterKeyEncryptedUserKey).toHaveBeenCalledWith(
      tokenResponse.key,
      userId,
    );
    expect(keyService.setUserKey).toHaveBeenCalledWith(userKey, userId);
    expect(keyService.setPrivateKey).toHaveBeenCalledWith(tokenResponse.privateKey, userId);
  });

  it("does not force the user to update their master password when there are no requirements", async () => {
    apiService.postIdentityToken.mockResolvedValueOnce(identityTokenResponseFactory());

    await passwordLoginStrategy.logIn(credentials);

    expect(policyService.evaluateMasterPassword).not.toHaveBeenCalled();
  });

  it("does not force the user to update their master password when it meets requirements", async () => {
    passwordStrengthService.getPasswordStrength.mockReturnValue({ score: 5 } as any);
    policyService.evaluateMasterPassword.mockReturnValue(true);

    await passwordLoginStrategy.logIn(credentials);

    expect(policyService.evaluateMasterPassword).toHaveBeenCalled();
  });

  it("when given master password policies as part of the login credentials from an org invite, it combines them with the token response policies to evaluate the user's password as weak", async () => {
    const passwordStrengthScore = 0;

    passwordStrengthService.getPasswordStrength.mockReturnValue({
      score: passwordStrengthScore,
    } as any);
    policyService.evaluateMasterPassword.mockReturnValue(false);
    tokenService.decodeAccessToken.mockResolvedValue({ sub: userId });

    jest
      .spyOn(configService, "getFeatureFlag")
      .mockImplementation((flag: FeatureFlag) =>
        Promise.resolve(flag === FeatureFlag.PM16117_ChangeExistingPasswordRefactor),
      );

    credentials.masterPasswordPoliciesFromOrgInvite = Object.assign(
      new MasterPasswordPolicyOptions(),
      {
        minLength: 10,
        minComplexity: 2,
        requireUpper: true,
        requireLower: true,
        requireNumbers: true,
        requireSpecial: true,
        enforceOnLogin: true,
      },
    );

    const combinedMasterPasswordPolicyOptions = Object.assign(new MasterPasswordPolicyOptions(), {
      minLength: 10,
      minComplexity: 2,
      requireUpper: true,
      requireLower: true,
      requireNumbers: true,
      requireSpecial: true,
      enforceOnLogin: false,
    });

    policyService.combineMasterPasswordPolicyOptions.mockReturnValue(
      combinedMasterPasswordPolicyOptions,
    );

    await passwordLoginStrategy.logIn(credentials);

    expect(policyService.combineMasterPasswordPolicyOptions).toHaveBeenCalledWith(
      credentials.masterPasswordPoliciesFromOrgInvite,
      MasterPasswordPolicyOptions.fromResponse(masterPasswordPolicyResponse),
    );

    expect(policyService.evaluateMasterPassword).toHaveBeenCalledWith(
      passwordStrengthScore,
      credentials.masterPassword,
      combinedMasterPasswordPolicyOptions,
    );

    expect(masterPasswordService.mock.setForceSetPasswordReason).toHaveBeenCalledWith(
      ForceSetPasswordReason.WeakMasterPassword,
      userId,
    );
  });

  it("forces the user to update their master password on successful login when it does not meet master password policy requirements", async () => {
    passwordStrengthService.getPasswordStrength.mockReturnValue({ score: 0 } as any);
    policyService.evaluateMasterPassword.mockReturnValue(false);
    tokenService.decodeAccessToken.mockResolvedValue({ sub: userId });

    await passwordLoginStrategy.logIn(credentials);

    expect(policyService.evaluateMasterPassword).toHaveBeenCalled();
    expect(masterPasswordService.mock.setForceSetPasswordReason).toHaveBeenCalledWith(
      ForceSetPasswordReason.WeakMasterPassword,
      userId,
    );
  });

  it("should not set a force set password reason if we get an IdentityTwoFactorResponse after entering a weak MP that does not meet policy requirements", async () => {
    passwordStrengthService.getPasswordStrength.mockReturnValue({ score: 0 } as any);
    policyService.evaluateMasterPassword.mockReturnValue(false);
    tokenService.decodeAccessToken.mockResolvedValue({ sub: userId });

    const token2FAResponse = new IdentityTwoFactorResponse({
      TwoFactorProviders: ["0"],
      TwoFactorProviders2: { 0: null },
      error: "invalid_grant",
      error_description: "Two factor required.",
      MasterPasswordPolicy: masterPasswordPolicyResponse,
    });

    // First login request fails requiring 2FA
    apiService.postIdentityToken.mockResolvedValueOnce(token2FAResponse);
    await passwordLoginStrategy.logIn(credentials);

    expect(masterPasswordService.mock.setForceSetPasswordReason).not.toHaveBeenCalled();
  });

  it("forces the user to update their master password on successful 2FA login when it does not meet master password policy requirements", async () => {
    passwordStrengthService.getPasswordStrength.mockReturnValue({ score: 0 } as any);
    policyService.evaluateMasterPassword.mockReturnValue(false);
    tokenService.decodeAccessToken.mockResolvedValue({ sub: userId });

    const token2FAResponse = new IdentityTwoFactorResponse({
      TwoFactorProviders: ["0"],
      TwoFactorProviders2: { 0: null },
      error: "invalid_grant",
      error_description: "Two factor required.",
      MasterPasswordPolicy: masterPasswordPolicyResponse,
    });

    // First login request fails requiring 2FA
    apiService.postIdentityToken.mockResolvedValueOnce(token2FAResponse);
    await passwordLoginStrategy.logIn(credentials);

    // Second login request succeeds
    apiService.postIdentityToken.mockResolvedValueOnce(
      identityTokenResponseFactory(masterPasswordPolicyResponse),
    );
    await passwordLoginStrategy.logInTwoFactor({
      provider: TwoFactorProviderType.Authenticator,
      token: "123456",
      remember: false,
    });

    // Second login attempt should save the force password reset options
    expect(masterPasswordService.mock.setForceSetPasswordReason).toHaveBeenCalledWith(
      ForceSetPasswordReason.WeakMasterPassword,
      userId,
    );
  });

  it("handles new device verification login with OTP", async () => {
    const deviceVerificationOtp = "123456";
    const tokenResponse = identityTokenResponseFactory();
    apiService.postIdentityToken.mockResolvedValueOnce(tokenResponse);
    tokenService.decodeAccessToken.mockResolvedValue({ sub: userId });

    await passwordLoginStrategy.logIn(credentials);

    const result = await passwordLoginStrategy.logInNewDeviceVerification(deviceVerificationOtp);

    expect(apiService.postIdentityToken).toHaveBeenCalledWith(
      expect.objectContaining({
        newDeviceOtp: deviceVerificationOtp,
      }),
    );
    expect(result.resetMasterPassword).toBe(false);
    expect(result.userId).toBe(userId);
  });
});
