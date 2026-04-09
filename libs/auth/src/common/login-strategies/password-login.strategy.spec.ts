import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { IdentitySsoRequiredResponse } from "@bitwarden/common/auth/models/response/identity-sso-required.response";
import { IdentityTokenResponse } from "@bitwarden/common/auth/models/response/identity-token.response";
import { IdentityTwoFactorResponse } from "@bitwarden/common/auth/models/response/identity-two-factor.response";
import { MasterPasswordPolicyResponse } from "@bitwarden/common/auth/models/response/master-password-policy.response";
import {
  PasswordPreloginData,
  PasswordPreloginService,
} from "@bitwarden/common/auth/password-prelogin";
import { TwoFactorService } from "@bitwarden/common/auth/two-factor";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { AccountCryptographicStateService } from "@bitwarden/common/key-management/account-cryptography/account-cryptographic-state.service";
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
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { FakeAccountService, makeEncString, mockAccountServiceWith } from "@bitwarden/common/spec";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
import { UserId } from "@bitwarden/common/types/guid";
import { MasterKey, UserKey } from "@bitwarden/common/types/key";
import { KdfConfigService, KeyService, PBKDF2KdfConfig } from "@bitwarden/key-management";
import { UnlockService } from "@bitwarden/unlock";

import { InternalUserDecryptionOptionsServiceAbstraction } from "../abstractions/user-decryption-options.service.abstraction";
import { PasswordLoginCredentials } from "../models/domain/login-credentials";

import { identityTokenResponseFactory } from "./login.strategy.spec";
import { PasswordLoginStrategy, PasswordLoginStrategyData } from "./password-login.strategy";

const email = "hello@world.com";
const masterPassword = "password";
const hashedPassword = "HASHED_PASSWORD";
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
  let accountService: FakeAccountService;
  let masterPasswordService: FakeMasterPasswordService;
  let unlockService: MockProxy<UnlockService>;

  let passwordPreloginService: MockProxy<PasswordPreloginService>;
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
  let accountCryptographicStateService: MockProxy<AccountCryptographicStateService>;

  let passwordLoginStrategy: PasswordLoginStrategy;
  let credentials: PasswordLoginCredentials;
  let tokenResponse: IdentityTokenResponse;

  beforeEach(async () => {
    accountService = mockAccountServiceWith(userId);
    masterPasswordService = new FakeMasterPasswordService();
    unlockService = mock<UnlockService>();

    passwordPreloginService = mock<PasswordPreloginService>();
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
    passwordStrengthService = mock<PasswordStrengthServiceAbstraction>();
    billingAccountProfileStateService = mock<BillingAccountProfileStateService>();
    vaultTimeoutSettingsService = mock<VaultTimeoutSettingsService>();
    kdfConfigService = mock<KdfConfigService>();
    environmentService = mock<EnvironmentService>();
    configService = mock<ConfigService>();
    accountCryptographicStateService = mock<AccountCryptographicStateService>();
    configService.getFeatureFlag.mockResolvedValue(false);

    appIdService.getAppId.mockResolvedValue(deviceId);
    tokenService.decodeAccessToken.mockResolvedValue({
      sub: userId,
    });

    passwordPreloginService.getPreloginData$.mockReturnValue(
      of(new PasswordPreloginData(new PBKDF2KdfConfig())),
    );
    keyService.makeMasterKey.mockResolvedValue(masterKey);

    keyService.hashMasterKey
      .calledWith(masterPassword, expect.anything())
      .mockResolvedValue(hashedPassword);

    policyService.evaluateMasterPassword.mockReturnValue(true);

    passwordLoginStrategy = new PasswordLoginStrategy(
      new PasswordLoginStrategyData(),
      passwordStrengthService,
      policyService,
      passwordPreloginService,
      unlockService,
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
      accountCryptographicStateService,
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
    const userKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;

    masterPasswordService.masterKeySubject.next(masterKey);
    masterPasswordService.mock.decryptUserKeyWithMasterKey.mockResolvedValue(userKey);
    tokenService.decodeAccessToken.mockResolvedValue({ sub: userId });

    await passwordLoginStrategy.logIn(credentials);

    expect(masterPasswordService.mock.setMasterKey).toHaveBeenCalledWith(masterKey, userId);
    expect(masterPasswordService.mock.setMasterKeyEncryptedUserKey).toHaveBeenCalledWith(
      tokenResponse.key,
      userId,
    );
    expect(keyService.setUserKey).toHaveBeenCalledWith(userKey, userId);
    expect(accountCryptographicStateService.setAccountCryptographicState).toHaveBeenCalledWith(
      { V1: { private_key: tokenResponse.privateKey } },
      userId,
    );
  });

  it("uses master password unlock service when feature flag is enabled", async () => {
    configService.getFeatureFlag.mockImplementation(async (flag: FeatureFlag) => {
      if (flag === FeatureFlag.UseUnlockServiceForPasswordLogin) {
        return true;
      }
      return false;
    });

    // Re-create he strategy and wait a bit to settle the feature flag
    passwordLoginStrategy = new PasswordLoginStrategy(
      new PasswordLoginStrategyData(),
      passwordStrengthService,
      policyService,
      passwordPreloginService,
      unlockService,
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
      accountCryptographicStateService,
    );

    unlockService.unlockWithMasterPassword.mockResolvedValue(undefined);
    tokenService.decodeAccessToken.mockResolvedValue({ sub: userId });

    await passwordLoginStrategy.logIn(credentials);

    expect(configService.getFeatureFlag).toHaveBeenCalledWith(
      FeatureFlag.UseUnlockServiceForPasswordLogin,
    );
    expect(masterPasswordService.mock.setMasterKey).not.toHaveBeenCalled();
    expect(unlockService.unlockWithMasterPassword).toHaveBeenCalledWith(userId, masterPassword);
    expect(masterPasswordService.mock.decryptUserKeyWithMasterKey).not.toHaveBeenCalled();
    expect(keyService.setUserKey).not.toHaveBeenCalled();
    expect(passwordLoginStrategy.exportCache().password.unlockServiceForPasswordLogin).toBe(true);
  });

  describe("makePasswordPreloginMasterKey", () => {
    it("calls getPreloginData$ when no preFetchedPreloginData is provided", async () => {
      // credentials from beforeEach has no preFetchedPreloginData
      await passwordLoginStrategy.logIn(credentials);

      expect(passwordPreloginService.getPreloginData$).toHaveBeenCalledWith(email);
    });

    it("does not call getPreloginData$ when preFetchedPreloginData is provided", async () => {
      const preloginData = new PasswordPreloginData(new PBKDF2KdfConfig());
      const credentialsWithPrefetch = new PasswordLoginCredentials(
        email,
        masterPassword,
        undefined,
        undefined,
        preloginData,
      );

      await passwordLoginStrategy.logIn(credentialsWithPrefetch);

      expect(passwordPreloginService.getPreloginData$).not.toHaveBeenCalled();
    });

    it("throws when getPreloginData$ returns null", async () => {
      // The server can theoretically return a null/empty prelogin response even if
      // we don't do that today so test that case is handled gracefully.
      passwordPreloginService.getPreloginData$.mockReturnValue(of(null as any));

      await expect(passwordLoginStrategy.logIn(credentials)).rejects.toThrow(
        "KDF config is required",
      );
    });

    it("clears the prelogin cache after the master key is derived", async () => {
      await passwordLoginStrategy.logIn(credentials);

      expect(passwordPreloginService.clearCache).toHaveBeenCalledTimes(1);
    });
  });

  describe("evaluateMasterPasswordIfRequired", () => {
    it("does not force the user to update their master password when there are no requirements", async () => {
      apiService.postIdentityToken.mockResolvedValueOnce(identityTokenResponseFactory());

      await passwordLoginStrategy.logIn(credentials);

      expect(masterPasswordService.mock.setForceSetPasswordReason).not.toHaveBeenCalled();
    });

    it("does not force the user to update their master password when it meets requirements", async () => {
      passwordStrengthService.getPasswordStrength.mockReturnValue({ score: 5 } as any);
      policyService.evaluateMasterPassword.mockReturnValue(true);

      await passwordLoginStrategy.logIn(credentials);

      expect(masterPasswordService.mock.setForceSetPasswordReason).not.toHaveBeenCalled();
    });

    it("when given master password policies as part of the login credentials from an org invite, it combines them with the token response policies to evaluate the user's password as weak", async () => {
      const passwordStrengthScore = 0;

      passwordStrengthService.getPasswordStrength.mockReturnValue({
        score: passwordStrengthScore,
      } as any);
      policyService.evaluateMasterPassword.mockReturnValue(false);
      tokenService.decodeAccessToken.mockResolvedValue({ sub: userId });

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
      tokenService.decodeAccessToken.mockResolvedValue({ sub: userId });

      const combinedMasterPasswordPolicyOptions = Object.assign(new MasterPasswordPolicyOptions(), {
        enforceOnLogin: true,
      });
      policyService.combineMasterPasswordPolicyOptions.mockReturnValue(
        combinedMasterPasswordPolicyOptions,
      );
      policyService.evaluateMasterPassword.mockReturnValue(false);

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
      tokenService.decodeAccessToken.mockResolvedValue({ sub: userId });

      const combinedMasterPasswordPolicyOptions = Object.assign(new MasterPasswordPolicyOptions(), {
        enforceOnLogin: true,
      });
      policyService.combineMasterPasswordPolicyOptions.mockReturnValue(
        combinedMasterPasswordPolicyOptions,
      );
      policyService.evaluateMasterPassword.mockReturnValue(false);

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

    it("skips master password evaluation when SSO is required", async () => {
      // When the server redirects the user to SSO (e.g. the org enforces SSO-only login),
      // the identity response carries no master password policy. Master password strength must
      // not be evaluated at this point — the user will authenticate through their IdP first,
      // and policy enforcement happens after that flow completes.
      // We use org-invite credentials (which carry enforceOnLogin policies) to prove the
      // SSO guard is what prevents evaluation, not the absence of a policy.
      const ssoResponse = new IdentitySsoRequiredResponse({ SsoOrganizationIdentifier: "org-id" });
      apiService.postIdentityToken.mockResolvedValueOnce(ssoResponse);
      passwordStrengthService.getPasswordStrength.mockReturnValue({ score: 0 } as any);
      policyService.evaluateMasterPassword.mockReturnValue(false);

      const credentialsWithOrgInvite = new PasswordLoginCredentials(
        email,
        masterPassword,
        undefined,
        Object.assign(new MasterPasswordPolicyOptions(), { enforceOnLogin: true }),
      );

      await passwordLoginStrategy.logIn(credentialsWithOrgInvite);

      expect(policyService.evaluateMasterPassword).not.toHaveBeenCalled();
      expect(masterPasswordService.mock.setForceSetPasswordReason).not.toHaveBeenCalled();
    });
  });

  describe("processForceSetPasswordReason", () => {
    it("does not apply cached WeakMasterPassword when admin force password reset is active", async () => {
      // Background: when a user with a weak password completes login via 2FA, the strategy
      // cannot set ForceSetPasswordReason immediately (the master password is about to leave
      // scope). Instead it caches WeakMasterPassword on itself, then applies it later in
      // processForceSetPasswordReason when the full token response arrives.
      //
      // However, if the server also sets adminForcePasswordReset=true on that same token
      // response, AdminForcePasswordReset must win — the admin's explicit directive takes
      // priority and must not be silently overwritten by the client-side cached reason.
      //
      // Test setup: do the first leg of a 2FA login so the weak-password reason is cached,
      // then call processForceSetPasswordReason directly with adminForcePasswordReset=true.
      passwordStrengthService.getPasswordStrength.mockReturnValue({ score: 0 } as any);
      const combinedOptions = Object.assign(new MasterPasswordPolicyOptions(), {
        enforceOnLogin: true,
      });
      policyService.combineMasterPasswordPolicyOptions.mockReturnValue(combinedOptions);
      policyService.evaluateMasterPassword.mockReturnValue(false);

      const token2FAResponse = new IdentityTwoFactorResponse({
        TwoFactorProviders: ["0"],
        TwoFactorProviders2: { 0: null },
        error: "invalid_grant",
        error_description: "Two factor required.",
        MasterPasswordPolicy: masterPasswordPolicyResponse,
      });
      apiService.postIdentityToken.mockResolvedValueOnce(token2FAResponse);
      await passwordLoginStrategy.logIn(credentials); // caches WeakMasterPassword

      await passwordLoginStrategy.processForceSetPasswordReason(true, userId);

      // Only AdminForcePasswordReset should be written; the cached WeakMasterPassword must be
      // discarded so the admin reset flow is not interrupted.
      expect(masterPasswordService.mock.setForceSetPasswordReason).toHaveBeenCalledTimes(1);
      expect(masterPasswordService.mock.setForceSetPasswordReason).toHaveBeenCalledWith(
        ForceSetPasswordReason.AdminForcePasswordReset,
        userId,
      );
    });
  });

  describe("encryptionKeyMigrationRequired", () => {
    it("returns requiresEncryptionKeyMigration and skips setUserKey when response has no key", async () => {
      // Very old accounts were encrypted with the master key directly (no user key). These
      // accounts have no `key` field on the token response. PasswordLoginStrategy overrides
      // encryptionKeyMigrationRequired to return true when key is absent, which causes the base
      // class to surface requiresEncryptionKeyMigration=true and bail out before attempting to
      // derive or store any keys — avoiding a cryptographic error on an unmigrated account.
      const migrationResponse = identityTokenResponseFactory();
      (migrationResponse as any).key = null;
      apiService.postIdentityToken.mockResolvedValueOnce(migrationResponse);

      const result = await passwordLoginStrategy.logIn(credentials);

      expect(result.requiresEncryptionKeyMigration).toBe(true);
      expect(keyService.setUserKey).not.toHaveBeenCalled();
    });
  });

  describe("logInNewDeviceVerification", () => {
    it("handles new device verification login with OTP", async () => {
      const deviceVerificationOtp = "123456";
      const otpTokenResponse = identityTokenResponseFactory();
      apiService.postIdentityToken.mockResolvedValueOnce(otpTokenResponse);
      tokenService.decodeAccessToken.mockResolvedValue({ sub: userId });

      await passwordLoginStrategy.logIn(credentials);

      const result = await passwordLoginStrategy.logInNewDeviceVerification(deviceVerificationOtp);

      expect(apiService.postIdentityToken).toHaveBeenCalledWith(
        expect.objectContaining({
          newDeviceOtp: deviceVerificationOtp,
        }),
      );
      expect(result.userId).toBe(userId);
    });

    it("sets authResult.masterPassword from cache", async () => {
      // New device verification is a two-request flow:
      //   1. logIn()                        — user submits email + master password; server
      //                                       responds requiring an OTP to verify the device.
      //   2. logInNewDeviceVerification()   — user submits the OTP; server returns the full
      //                                       token response and login completes.
      //
      // The master password is only available in memory during step 1. logIn() stores it in
      // the strategy's cache so that logInNewDeviceVerification() can attach it to the
      // AuthResult. NewDeviceVerificationComponent reads it off the result and passes it to
      // LoginSuccessHandlerService, which forwards it to EncryptedMigrator.runMigrations() —
      // post-login migrations that may need the master password to re-encrypt vault data.
      //
      // Note: in this test logIn() uses the default mock token response (a full success), which
      // is structurally different from the real IdentityDeviceVerificationResponse the server
      // would return in step 1. That difference does not affect what we are testing here — we
      // only care that the master password written to the cache during logIn() is correctly
      // read back and placed on the AuthResult by logInNewDeviceVerification().
      tokenService.decodeAccessToken.mockResolvedValue({ sub: userId });
      await passwordLoginStrategy.logIn(credentials);

      const result = await passwordLoginStrategy.logInNewDeviceVerification("123456");

      expect(result.masterPassword).toBe(masterPassword);
    });
  });

  it("sets account cryptographic state when accountKeysResponseModel is present", async () => {
    const accountKeysData = {
      publicKeyEncryptionKeyPair: {
        publicKey: "testPublicKey",
        wrappedPrivateKey: "testPrivateKey",
      },
    };

    const accountKeysTokenResponse = identityTokenResponseFactory();
    accountKeysTokenResponse.key = makeEncString("mockEncryptedUserKey");
    // Add accountKeysResponseModel to the response
    (accountKeysTokenResponse as any).accountKeysResponseModel = {
      publicKeyEncryptionKeyPair: accountKeysData.publicKeyEncryptionKeyPair,
      toWrappedAccountCryptographicState: jest.fn().mockReturnValue({
        V1: {
          private_key: "testPrivateKey",
        },
      }),
    };

    apiService.postIdentityToken.mockResolvedValue(accountKeysTokenResponse);
    masterPasswordService.masterKeySubject.next(masterKey);
    masterPasswordService.mock.decryptUserKeyWithMasterKey.mockResolvedValue(
      new SymmetricCryptoKey(new Uint8Array(64)) as UserKey,
    );

    await passwordLoginStrategy.logIn(credentials);

    expect(accountCryptographicStateService.setAccountCryptographicState).toHaveBeenCalledTimes(1);
    expect(accountCryptographicStateService.setAccountCryptographicState).toHaveBeenCalledWith(
      {
        V1: {
          private_key: "testPrivateKey",
        },
      },
      userId,
    );
  });
});
