// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { BehaviorSubject, firstValueFrom, map, Observable } from "rxjs";
import { Jsonify } from "type-fest";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { OpaqueTokenRequest } from "@bitwarden/common/auth/models/request/identity-token/opaque-token.request";
import { PasswordTokenRequest } from "@bitwarden/common/auth/models/request/identity-token/password-token.request";
import { TokenTwoFactorRequest } from "@bitwarden/common/auth/models/request/identity-token/token-two-factor.request";
import { IdentityCaptchaResponse } from "@bitwarden/common/auth/models/response/identity-captcha.response";
import { IdentityDeviceVerificationResponse } from "@bitwarden/common/auth/models/response/identity-device-verification.response";
import { IdentityTokenResponse } from "@bitwarden/common/auth/models/response/identity-token.response";
import { IdentityTwoFactorResponse } from "@bitwarden/common/auth/models/response/identity-two-factor.response";
import { HashPurpose } from "@bitwarden/common/platform/enums";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
import { UserId } from "@bitwarden/common/types/guid";
import { MasterKey } from "@bitwarden/common/types/key";

import { LoginStrategyServiceAbstraction } from "../abstractions";
import { PasswordLoginCredentials } from "../models/domain/login-credentials";
import { CacheData } from "../services/login-strategies/login-strategy.state";

import { LoginStrategy, LoginStrategyData } from "./login.strategy";

export class OpaqueLoginStrategyData implements LoginStrategyData {
  tokenRequest: OpaqueTokenRequest;

  /** User's entered email obtained pre-login. Always present in MP login. */
  userEnteredEmail: string;

  /** The local version of the user's master key hash */
  localMasterKeyHash: string;

  /** The user's master key */
  masterKey: MasterKey;

  /**
   * Tracks if the user needs to be forced to update their password
   */
  forcePasswordResetReason: ForceSetPasswordReason = ForceSetPasswordReason.None;

  static fromJSON(obj: Jsonify<OpaqueLoginStrategyData>): OpaqueLoginStrategyData {
    const data = Object.assign(new OpaqueLoginStrategyData(), obj, {
      tokenRequest: PasswordTokenRequest.fromJSON(obj.tokenRequest),
      masterKey: SymmetricCryptoKey.fromJSON(obj.masterKey),
    });
    return data;
  }
}

// TODO: link to RFC and give simple, brief explanation of the protocol
/**
 *
 * A login strategy that uses the ...
 */
export class OpaqueLoginStrategy extends LoginStrategy {
  /** The email address of the user attempting to log in. */
  email$: Observable<string>;

  /** The local master key hash we store client side */
  localMasterKeyHash$: Observable<string | null>;

  protected cache: BehaviorSubject<OpaqueLoginStrategyData>;

  constructor(
    data: OpaqueLoginStrategyData,
    private passwordStrengthService: PasswordStrengthServiceAbstraction,
    private policyService: PolicyService,
    private loginStrategyService: LoginStrategyServiceAbstraction,
    ...sharedDeps: ConstructorParameters<typeof LoginStrategy>
  ) {
    super(...sharedDeps);

    this.cache = new BehaviorSubject(data);
    this.email$ = this.cache.pipe(map((state) => state.tokenRequest.email));

    this.localMasterKeyHash$ = this.cache.pipe(map((state) => state.localMasterKeyHash));
  }

  // TODO: build OpaqueLoginCredentials
  override async logIn(credentials: PasswordLoginCredentials) {
    const { email, masterPassword, twoFactor } = credentials;

    const data = new OpaqueLoginStrategyData();

    // TODO: we will still generate a master key here but we need to extract the prelogin call out of the makePreloginKey
    // and simply rename it deriveMasterKey or something similar
    data.masterKey = await this.loginStrategyService.makePreloginKey(masterPassword, email);
    data.userEnteredEmail = email;

    // Hash the password early (before authentication) so we don't persist it in memory in plaintext
    data.localMasterKeyHash = await this.keyService.hashMasterKey(
      masterPassword,
      data.masterKey,
      HashPurpose.LocalAuthorization,
    );

    // const serverMasterKeyHash = await this.keyService.hashMasterKey(masterPassword, data.masterKey);

    // TODO: we must figure out how we will handle 2FA at some point.
    data.tokenRequest = new OpaqueTokenRequest(
      email,
      undefined,
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

  override async logInTwoFactor(twoFactor: TokenTwoFactorRequest): Promise<AuthResult> {
    const data = this.cache.value;
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

    // We still need this for local user verification scenarios
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
  ): MasterPasswordPolicyOptions | null {
    if (
      response == null ||
      response instanceof IdentityDeviceVerificationResponse ||
      response.masterPasswordPolicy == null
    ) {
      return null;
    }
    return MasterPasswordPolicyOptions.fromResponse(response.masterPasswordPolicy);
  }

  private evaluateMasterPassword(
    { masterPassword, email }: PasswordLoginCredentials,
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
      opaque: this.cache.value,
    };
  }

  async logInNewDeviceVerification(deviceVerificationOtp: string): Promise<AuthResult> {
    const data = this.cache.value;
    data.tokenRequest.newDeviceOtp = deviceVerificationOtp;
    this.cache.next(data);

    const [authResult] = await this.startLogIn();
    return authResult;
  }
}
