import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { KdfConfigService, KeyService } from "@bitwarden/key-management";

import { FakeAccountService, mockAccountServiceWith } from "../../../spec";
import { ApiService } from "../../abstractions/api.service";
import { PolicyService } from "../../admin-console/abstractions/policy/policy.service.abstraction";
import { BillingAccountProfileStateService } from "../../billing/abstractions";
import { EncryptService } from "../../key-management/crypto/abstractions/encrypt.service";
import { FakeMasterPasswordService } from "../../key-management/master-password/services/fake-master-password.service";
import {
  VaultTimeoutAction,
  VaultTimeoutSettingsService,
} from "../../key-management/vault-timeout";
import { AppIdService } from "../../platform/abstractions/app-id.service";
import { EnvironmentService } from "../../platform/abstractions/environment.service";
import { LogService } from "../../platform/abstractions/log.service";
import { MessagingService } from "../../platform/abstractions/messaging.service";
import { PlatformUtilsService } from "../../platform/abstractions/platform-utils.service";
import { StateService } from "../../platform/abstractions/state.service";
import { HashPurpose } from "../../platform/enums";
import { Utils } from "../../platform/misc/utils";
import { SymmetricCryptoKey } from "../../platform/models/domain/symmetric-crypto-key";
import {
  PasswordStrengthService,
  PasswordStrengthServiceAbstraction,
} from "../../tools/password-strength";
import { CsprngArray } from "../../types/csprng";
import { UserId } from "../../types/guid";
import { MasterKey, UserKey } from "../../types/key";
import { LoginStrategyServiceAbstraction } from "../abstractions/login-strategy.service";
import { TokenService } from "../abstractions/token.service";
import { TwoFactorService } from "../abstractions/two-factor.service";
import { InternalUserDecryptionOptionsServiceAbstraction } from "../abstractions/user-decryption-options.service.abstraction";
import { TwoFactorProviderType } from "../enums/two-factor-provider-type";
import { ForceSetPasswordReason } from "../models/domain/force-set-password-reason";
import { PasswordLoginCredentials } from "../models/domain/login-credentials";
import { IdentityTokenResponse } from "../models/response/identity-token.response";
import { IdentityTwoFactorResponse } from "../models/response/identity-two-factor.response";
import { MasterPasswordPolicyResponse } from "../models/response/master-password-policy.response";

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
    );
    credentials = new PasswordLoginCredentials(email, masterPassword);
    tokenResponse = identityTokenResponseFactory(masterPasswordPolicy);

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
    expect(keyService.setMasterKeyEncryptedUserKey).toHaveBeenCalledWith(tokenResponse.key, userId);
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

  it("forces the user to update their master password on successful 2FA login when it does not meet master password policy requirements", async () => {
    passwordStrengthService.getPasswordStrength.mockReturnValue({ score: 0 } as any);
    policyService.evaluateMasterPassword.mockReturnValue(false);
    tokenService.decodeAccessToken.mockResolvedValue({ sub: userId });

    const token2FAResponse = new IdentityTwoFactorResponse({
      TwoFactorProviders: ["0"],
      TwoFactorProviders2: { 0: null },
      error: "invalid_grant",
      error_description: "Two factor required.",
      MasterPasswordPolicy: masterPasswordPolicy,
    });

    // First login request fails requiring 2FA
    apiService.postIdentityToken.mockResolvedValueOnce(token2FAResponse);
    await passwordLoginStrategy.logIn(credentials);

    // Second login request succeeds
    apiService.postIdentityToken.mockResolvedValueOnce(
      identityTokenResponseFactory(masterPasswordPolicy),
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
