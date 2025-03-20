// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { BehaviorSubject, firstValueFrom, map, Observable } from "rxjs";
import { Jsonify } from "type-fest";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { PasswordTokenRequest } from "@bitwarden/common/auth/models/request/identity-token/password-token.request";
import { TokenTwoFactorRequest } from "@bitwarden/common/auth/models/request/identity-token/token-two-factor.request";
import { IdentityCaptchaResponse } from "@bitwarden/common/auth/models/response/identity-captcha.response";
import { IdentityDeviceVerificationResponse } from "@bitwarden/common/auth/models/response/identity-device-verification.response";
import { IdentityTokenResponse } from "@bitwarden/common/auth/models/response/identity-token.response";
import { IdentityTwoFactorResponse } from "@bitwarden/common/auth/models/response/identity-two-factor.response";
import { OpaqueCipherConfiguration } from "@bitwarden/common/auth/opaque/models/opaque-cipher-configuration";
import { OpaqueKeyExchangeService } from "@bitwarden/common/auth/opaque/opaque-key-exchange.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { HashPurpose } from "@bitwarden/common/platform/enums";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
import { UserId } from "@bitwarden/common/types/guid";
import { MasterKey } from "@bitwarden/common/types/key";
import { DEFAULT_OPAQUE_KDF_CONFIG, KdfType } from "@bitwarden/key-management";

import { PasswordHashLoginCredentials } from "../models/domain/login-credentials";
import { CacheData } from "../services/login-strategies/login-strategy.state";

import { BaseLoginStrategy, LoginStrategyData } from "./base-login.strategy";

// TODO: consider renaming LegacyPasswordLoginStrategy?  Or PasswordHashLoginStrategy?
export class PasswordLoginStrategyData implements LoginStrategyData {
  tokenRequest: PasswordTokenRequest;

  /** User's entered email obtained pre-login. Always present in MP login. */
  userEnteredEmail: string;
  /** If 2fa is required, token is returned to bypass captcha */
  captchaBypassToken?: string;

  // TODO: we need to get a security audit as to whether or not this is safe to do. It is only used in memory
  // for the duration of the login process, but it is still a security risk - especially in 2FA and new device verification
  /** The user's master password */
  masterPassword: string;

  /** The local version of the user's master key hash */
  localMasterKeyHash: string;
  /** The user's master key */
  masterKey: MasterKey;
  /**
   * Tracks if the user needs to update their password due to
   * a password that does not meet an organization's master password policy.
   */
  forcePasswordResetReason: ForceSetPasswordReason = ForceSetPasswordReason.None;

  static fromJSON(obj: Jsonify<PasswordLoginStrategyData>): PasswordLoginStrategyData {
    const data = Object.assign(new PasswordLoginStrategyData(), obj, {
      tokenRequest: PasswordTokenRequest.fromJSON(obj.tokenRequest),
      masterKey: SymmetricCryptoKey.fromJSON(obj.masterKey),
    });
    return data;
  }
}

export class PasswordLoginStrategy extends BaseLoginStrategy {
  /** The email address of the user attempting to log in. */
  email$: Observable<string>;
  /** The master key hash used for authentication */
  serverMasterKeyHash$: Observable<string>;
  /** The local master key hash we store client side */
  localMasterKeyHash$: Observable<string | null>;

  protected cache: BehaviorSubject<PasswordLoginStrategyData>;

  constructor(
    data: PasswordLoginStrategyData,
    private passwordStrengthService: PasswordStrengthServiceAbstraction,
    private policyService: PolicyService,
    private configService: ConfigService,
    private opaqueKeyExchangeService: OpaqueKeyExchangeService,
    ...sharedDeps: ConstructorParameters<typeof BaseLoginStrategy>
  ) {
    super(...sharedDeps);

    this.cache = new BehaviorSubject(data);
    this.email$ = this.cache.pipe(map((state) => state.tokenRequest.email));
    this.serverMasterKeyHash$ = this.cache.pipe(
      map((state) => state.tokenRequest.masterPasswordHash),
    );
    this.localMasterKeyHash$ = this.cache.pipe(map((state) => state.localMasterKeyHash));
  }

  override async logIn(credentials: PasswordHashLoginCredentials) {
    const { email, masterPassword, captchaToken, twoFactor, kdfConfig } = credentials;

    const data = new PasswordLoginStrategyData();

    data.masterPassword = masterPassword;
    data.masterKey = await this.makePrePasswordLoginMasterKey(masterPassword, email, kdfConfig);
    data.userEnteredEmail = email;

    // Hash the password early (before authentication) so we don't persist it in memory in plaintext
    data.localMasterKeyHash = await this.keyService.hashMasterKey(
      masterPassword,
      data.masterKey,
      HashPurpose.LocalAuthorization,
    );
    const serverMasterKeyHash = await this.keyService.hashMasterKey(masterPassword, data.masterKey);

    data.tokenRequest = new PasswordTokenRequest(
      email,
      serverMasterKeyHash,
      captchaToken,
      await this.buildTwoFactor(twoFactor, email),
      await this.buildDeviceRequest(),
    );

    this.cache.next(data);

    const [authResult, identityResponse] = await this.startLogIn();

    if (identityResponse instanceof IdentityCaptchaResponse) {
      return authResult;
    }

    const masterPasswordPolicyOptions =
      this.getMasterPasswordPolicyOptionsFromResponse(identityResponse);

    // The identity result can contain master password policies for the user's organizations
    if (masterPasswordPolicyOptions?.enforceOnLogin) {
      // If there is a policy active, evaluate the supplied password before its no longer in memory
      const meetsRequirements = this.evaluateMasterPassword(
        credentials,
        masterPasswordPolicyOptions,
      );
      if (meetsRequirements) {
        return authResult;
      }

      if (identityResponse instanceof IdentityTwoFactorResponse) {
        // Save the flag to this strategy for use in 2fa login as the master password is about to pass out of scope
        this.cache.next({
          ...this.cache.value,
          forcePasswordResetReason: ForceSetPasswordReason.WeakMasterPassword,
        });
      } else {
        // Authentication was successful, save the force update password options with the state service
        await this.masterPasswordService.setForceSetPasswordReason(
          ForceSetPasswordReason.WeakMasterPassword,
          authResult.userId, // userId is only available on successful login
        );
        authResult.forcePasswordReset = ForceSetPasswordReason.WeakMasterPassword;
      }
    }

    return authResult;
  }

  protected override async processTokenResponse(
    response: IdentityTokenResponse,
  ): Promise<AuthResult> {
    const authResult = await super.processTokenResponse(response);

    const opaqueKeyExchangeFeatureFlagEnabled = await this.configService.getFeatureFlag(
      FeatureFlag.OpaqueKeyExchange,
    );
    if (opaqueKeyExchangeFeatureFlagEnabled) {
      // Register the user for opaque password key exchange
      await this.registerUserForOpaqueKeyExchange(authResult.userId);
    }

    return authResult;
  }

  override async logInTwoFactor(
    twoFactor: TokenTwoFactorRequest,
    captchaResponse: string,
  ): Promise<AuthResult> {
    const data = this.cache.value;
    data.tokenRequest.captchaResponse = captchaResponse ?? data.captchaBypassToken;
    this.cache.next(data);

    const result = await super.logInTwoFactor(twoFactor);

    // 2FA was successful, save the force update password options with the state service if defined
    const forcePasswordResetReason = this.cache.value.forcePasswordResetReason;
    if (
      !result.requiresTwoFactor &&
      !result.requiresCaptcha &&
      forcePasswordResetReason != ForceSetPasswordReason.None
    ) {
      await this.masterPasswordService.setForceSetPasswordReason(
        forcePasswordResetReason,
        result.userId,
      );
      result.forcePasswordReset = forcePasswordResetReason;
    }

    return result;
  }

  protected override async setMasterKey(response: IdentityTokenResponse, userId: UserId) {
    const { masterKey, localMasterKeyHash } = this.cache.value;
    await this.masterPasswordService.setMasterKey(masterKey, userId);
    await this.masterPasswordService.setMasterKeyHash(localMasterKeyHash, userId);
  }

  protected override async setUserKey(
    response: IdentityTokenResponse,
    userId: UserId,
  ): Promise<void> {
    // If migration is required, we won't have a user key to set yet.
    if (this.encryptionKeyMigrationRequired(response)) {
      return;
    }
    await this.keyService.setMasterKeyEncryptedUserKey(response.key, userId);

    const masterKey = await firstValueFrom(this.masterPasswordService.masterKey$(userId));
    if (masterKey) {
      const userKey = await this.masterPasswordService.decryptUserKeyWithMasterKey(
        masterKey,
        userId,
      );
      await this.keyService.setUserKey(userKey, userId);
    }
  }

  protected override async setPrivateKey(
    response: IdentityTokenResponse,
    userId: UserId,
  ): Promise<void> {
    await this.keyService.setPrivateKey(
      response.privateKey ?? (await this.createKeyPairForOldAccount(userId)),
      userId,
    );
  }

  protected override encryptionKeyMigrationRequired(response: IdentityTokenResponse): boolean {
    return !response.key;
  }

  private getMasterPasswordPolicyOptionsFromResponse(
    response:
      | IdentityTokenResponse
      | IdentityTwoFactorResponse
      | IdentityDeviceVerificationResponse,
  ): MasterPasswordPolicyOptions {
    if (response == null || response instanceof IdentityDeviceVerificationResponse) {
      return null;
    }
    return MasterPasswordPolicyOptions.fromResponse(response.masterPasswordPolicy);
  }

  private evaluateMasterPassword(
    { masterPassword, email }: PasswordHashLoginCredentials,
    options: MasterPasswordPolicyOptions,
  ): boolean {
    const passwordStrength = this.passwordStrengthService.getPasswordStrength(
      masterPassword,
      email,
    )?.score;

    return this.policyService.evaluateMasterPassword(passwordStrength, masterPassword, options);
  }

  exportCache(): CacheData {
    return {
      password: this.cache.value,
    };
  }

  async logInNewDeviceVerification(deviceVerificationOtp: string): Promise<AuthResult> {
    const data = this.cache.value;
    data.tokenRequest.newDeviceOtp = deviceVerificationOtp;
    this.cache.next(data);

    const [authResult] = await this.startLogIn();
    return authResult;
  }

  /**
   * Registers password using users with the OPAQUE key exchange protocol which is a more secure password
   * authN protocol which prevents the server from ever knowing anything about the user's password.
   */
  private async registerUserForOpaqueKeyExchange(userId: UserId) {
    const masterPassword = this.cache.value?.masterPassword;
    const userKey = await firstValueFrom(this.keyService.userKey$(userId));

    // PBKDF2 is not recommended for opaque, so force use of Argon2 with default params if the user is using PBKDF2.
    const userConfiguredKdf = await this.kdfConfigService.getKdfConfig();

    if (!masterPassword || !userKey || !userConfiguredKdf) {
      this.logService.error(
        `Unable to register user for OPAQUE key exchange due to missing data. MasterPassword exists: ${!!masterPassword}; UserKey exists ${!!userKey}; KdfConfig exists: ${!!userConfiguredKdf}`,
      );
      return;
    }

    const cipherConfig = OpaqueCipherConfiguration.fromKdfConfig(
      userConfiguredKdf.kdfType === KdfType.Argon2id
        ? userConfiguredKdf
        : DEFAULT_OPAQUE_KDF_CONFIG,
    );

    try {
      const sessionId = await this.opaqueKeyExchangeService.register(
        masterPassword,
        userKey,
        cipherConfig,
      );
      await this.opaqueKeyExchangeService.setRegistrationActive(sessionId);
    } catch (error) {
      // If this process fails for any reason, we don't want to stop the login process
      // so just log the error and continue.
      this.logService.error(`Failed to register user for OPAQUE key exchange: ${error}`);
    }
  }
}
