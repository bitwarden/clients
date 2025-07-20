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
import { IdentityDeviceVerificationResponse } from "@bitwarden/common/auth/models/response/identity-device-verification.response";
import { IdentityTokenResponse } from "@bitwarden/common/auth/models/response/identity-token.response";
import { IdentityTwoFactorResponse } from "@bitwarden/common/auth/models/response/identity-two-factor.response";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { HashPurpose } from "@bitwarden/common/platform/enums";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
import { UserId } from "@bitwarden/common/types/guid";
import { MasterKey } from "@bitwarden/common/types/key";

import { LoginStrategyServiceAbstraction } from "../abstractions";
import { PasswordLoginCredentials } from "../models/domain/login-credentials";
import { CacheData } from "../services/login-strategies/login-strategy.state";

import { LoginStrategy, LoginStrategyData } from "./login.strategy";

export class PasswordLoginStrategyData implements LoginStrategyData {
  tokenRequest: PasswordTokenRequest;

  /** User's entered email obtained pre-login. Always present in MP login. */
  userEnteredEmail: string;
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

export class PasswordLoginStrategy extends LoginStrategy {
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
    private loginStrategyService: LoginStrategyServiceAbstraction,
    ...sharedDeps: ConstructorParameters<typeof LoginStrategy>
  ) {
    super(...sharedDeps);

    this.cache = new BehaviorSubject(data);
    this.email$ = this.cache.pipe(map((state) => state.tokenRequest.email));
    this.serverMasterKeyHash$ = this.cache.pipe(
      map((state) => state.tokenRequest.masterPasswordHash),
    );
    this.localMasterKeyHash$ = this.cache.pipe(map((state) => state.localMasterKeyHash));
  }

  override async logIn(credentials: PasswordLoginCredentials): Promise<AuthResult> {
    const { email, masterPassword, twoFactor } = credentials;

    const data = new PasswordLoginStrategyData();
    data.masterKey = await this.loginStrategyService.makePreloginKey(masterPassword, email);
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
      await this.buildTwoFactor(twoFactor, email),
      await this.buildDeviceRequest(),
    );

    this.cache.next(data);

    const [authResult, identityResponse] = await this.startLogIn();

    await this.evaluateMasterPasswordIfRequired(identityResponse, credentials, authResult);

    return authResult;
  }

  override async logInTwoFactor(twoFactor: TokenTwoFactorRequest): Promise<AuthResult> {
    const result = await super.logInTwoFactor(twoFactor);

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

    if (response.key) {
      await this.masterPasswordService.setMasterKeyEncryptedUserKey(response.key, userId);
    }

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

  private async evaluateMasterPasswordIfRequired(
    identityResponse:
      | IdentityTokenResponse
      | IdentityTwoFactorResponse
      | IdentityDeviceVerificationResponse,
    credentials: PasswordLoginCredentials,
    authResult: AuthResult,
  ): Promise<void> {
    // TODO: PM-21084 - investigate if we should be sending down masterPasswordPolicy on the
    // IdentityDeviceVerificationResponse like we do for the IdentityTwoFactorResponse
    // If the response is a device verification response, we don't need to evaluate the password
    if (identityResponse instanceof IdentityDeviceVerificationResponse) {
      return;
    }

    // The identity result can contain master password policies for the user's organizations
    let masterPasswordPolicyOptions: MasterPasswordPolicyOptions | undefined;

    if (
      await this.configService.getFeatureFlag(FeatureFlag.PM16117_ChangeExistingPasswordRefactor)
    ) {
      // Get the master password policy options from both the org invite and the identity response.
      masterPasswordPolicyOptions = this.policyService.combineMasterPasswordPolicyOptions(
        credentials.masterPasswordPoliciesFromOrgInvite,
        this.getMasterPasswordPolicyOptionsFromResponse(identityResponse),
      );

      // We deliberately do not check enforceOnLogin as existing users who are logging
      // in after getting an org invite should always be forced to set a password that
      // meets the org's policy. Org Invite -> Registration also works this way for
      // new BW users as well.
      if (
        !credentials.masterPasswordPoliciesFromOrgInvite &&
        !masterPasswordPolicyOptions?.enforceOnLogin
      ) {
        return;
      }
    } else {
      masterPasswordPolicyOptions =
        this.getMasterPasswordPolicyOptionsFromResponse(identityResponse);

      if (!masterPasswordPolicyOptions?.enforceOnLogin) {
        return;
      }
    }

    // If there is a policy active, evaluate the supplied password before its no longer in memory
    const meetsRequirements = this.evaluateMasterPassword(credentials, masterPasswordPolicyOptions);
    if (meetsRequirements) {
      return;
    }

    if (identityResponse instanceof IdentityTwoFactorResponse) {
      // Save the flag to this strategy for use in 2fa as the master password is about to pass out of scope
      this.cache.next({
        ...this.cache.value,
        forcePasswordResetReason: ForceSetPasswordReason.WeakMasterPassword,
      });
      return;
    }

    // Authentication was successful, save the force update password options with the state service
    // if there isn't already a reason set (this would only be AdminForcePasswordReset as that can be set server side
    // and would have already been processed in the base login strategy processForceSetPasswordReason method)
    // Note: masterPasswordService.setForceSetPasswordReason will not allow overwriting
    // AdminForcePasswordReset with any other reason except for None. This is because
    // an AdminForcePasswordReset will always force a user to update their password to a password that meets the policy.
    await this.masterPasswordService.setForceSetPasswordReason(
      ForceSetPasswordReason.WeakMasterPassword,
      authResult.userId, // userId is only available on successful login
    );
  }

  private getMasterPasswordPolicyOptionsFromResponse(
    response: IdentityTokenResponse | IdentityTwoFactorResponse,
  ): MasterPasswordPolicyOptions | null {
    if (response == null) {
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
   * Override to handle the WeakMasterPassword reason if no other reason is set.
   * @param authResult - The authentication result
   * @param userId - The user ID
   */
  override async processForceSetPasswordReason(
    adminForcePasswordReset: boolean,
    userId: UserId,
  ): Promise<boolean> {
    // handle any existing reasons
    const adminForcePasswordResetFlagSet = await super.processForceSetPasswordReason(
      adminForcePasswordReset,
      userId,
    );

    // If we are already processing an admin force password reset, don't process other reasons
    if (adminForcePasswordResetFlagSet) {
      return false;
    }

    // If we have a cached weak password reason from login/logInTwoFactor apply it
    const cachedReason = this.cache.value.forcePasswordResetReason;
    if (cachedReason !== ForceSetPasswordReason.None) {
      await this.masterPasswordService.setForceSetPasswordReason(cachedReason, userId);
      return true;
    }

    // If none of the conditions are met, return false
    return false;
  }
}
