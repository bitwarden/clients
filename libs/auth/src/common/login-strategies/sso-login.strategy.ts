// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom, Observable, map, BehaviorSubject } from "rxjs";
import { Jsonify } from "type-fest";

import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { SsoTokenRequest } from "@bitwarden/common/auth/models/request/identity-token/sso-token.request";
import { AuthRequestResponse } from "@bitwarden/common/auth/models/response/auth-request.response";
import { IdentityTokenResponse } from "@bitwarden/common/auth/models/response/identity-token.response";
import { HttpStatusCode } from "@bitwarden/common/enums";
import { DeviceTrustServiceAbstraction } from "@bitwarden/common/key-management/device-trust/abstractions/device-trust.service.abstraction";
import { KeyConnectorService } from "@bitwarden/common/key-management/key-connector/abstractions/key-connector.service";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { UserId } from "@bitwarden/common/types/guid";
import { UnlockService } from "@bitwarden/unlock";

import { AuthRequestServiceAbstraction } from "../abstractions";
import { SsoLoginCredentials } from "../models/domain/login-credentials";
import { CacheData } from "../services/login-strategies/login-strategy.state";

import { LoginStrategyData, LoginStrategy } from "./login.strategy";

export class SsoLoginStrategyData implements LoginStrategyData {
  tokenRequest: SsoTokenRequest;
  /**
   * User's entered email obtained pre-login. Present in most SSO flows, but not CLI + SSO Flow.
   */
  userEnteredEmail?: string;
  /**
   * User email address. Only available after authentication.
   */
  email?: string;
  /**
   * The organization ID that the user is logging into. Used for Key Connector
   * purposes after authentication.
   */
  orgId: string;
  /**
   * A token provided by the server as an authentication factor for sending
   * email OTPs to the user's configured 2FA email address. This is required
   * as we don't have a master password hash or other verifiable secret when using SSO.
   */
  ssoEmail2FaSessionToken?: string;

  static fromJSON(obj: Jsonify<SsoLoginStrategyData>): SsoLoginStrategyData {
    return Object.assign(new SsoLoginStrategyData(), obj, {
      tokenRequest: SsoTokenRequest.fromJSON(obj.tokenRequest),
    });
  }
}

export class SsoLoginStrategy extends LoginStrategy {
  /**
   * @see {@link SsoLoginStrategyData.email}
   */
  email$: Observable<string | null>;
  /**
   * @see {@link SsoLoginStrategyData.orgId}
   */
  orgId$: Observable<string>;
  /**
   * @see {@link SsoLoginStrategyData.ssoEmail2FaSessionToken}
   */
  ssoEmail2FaSessionToken$: Observable<string | null>;

  protected cache: BehaviorSubject<SsoLoginStrategyData>;

  constructor(
    data: SsoLoginStrategyData,
    private keyConnectorService: KeyConnectorService,
    private unlockService: UnlockService,
    private deviceTrustService: DeviceTrustServiceAbstraction,
    private authRequestService: AuthRequestServiceAbstraction,
    ...sharedDeps: ConstructorParameters<typeof LoginStrategy>
  ) {
    super(...sharedDeps);

    this.cache = new BehaviorSubject(data);
    this.email$ = this.cache.pipe(map((state) => state.email));
    this.orgId$ = this.cache.pipe(map((state) => state.orgId));
    this.ssoEmail2FaSessionToken$ = this.cache.pipe(map((state) => state.ssoEmail2FaSessionToken));
  }

  async logIn(credentials: SsoLoginCredentials): Promise<AuthResult> {
    const data = new SsoLoginStrategyData();
    data.orgId = credentials.orgId;

    data.userEnteredEmail = credentials.email;

    const deviceRequest = await this.buildDeviceRequest();

    this.logService.info("Logging in with appId %s.", deviceRequest.identifier);

    data.tokenRequest = new SsoTokenRequest(
      credentials.code,
      credentials.codeVerifier,
      credentials.redirectUrl,
      await this.buildTwoFactor(credentials.twoFactor, credentials.email),
      deviceRequest,
    );

    this.cache.next(data);

    const [ssoAuthResult] = await this.startLogIn();

    const email = ssoAuthResult.email;
    const ssoEmail2FaSessionToken = ssoAuthResult.ssoEmail2FaSessionToken;

    this.cache.next({
      ...this.cache.value,
      email,
      ssoEmail2FaSessionToken,
    });

    return ssoAuthResult;
  }

  private isKeyConnectorAvailable(tokenResponse: IdentityTokenResponse): boolean {
    return tokenResponse?.userDecryptionOptions?.keyConnectorOption?.keyConnectorUrl != null;
  }

  private needsKeyConnectorEnrollmentForNewUser(tokenResponse: IdentityTokenResponse): boolean {
    // A key connector URL alone is not enough: it is also present for an existing master-password
    // user in an org that has just enabled key connector, who must be converted rather than
    // enrolled. Only a brand-new SSO user has neither a master password nor a wrapped user key.
    return (
      this.isKeyConnectorAvailable(tokenResponse) &&
      tokenResponse.userDecryptionOptions?.hasMasterPassword === false &&
      tokenResponse.key == null
    );
  }

  private getKeyConnectorUrl(tokenResponse: IdentityTokenResponse): string {
    const userDecryptionOptions = tokenResponse?.userDecryptionOptions;
    return userDecryptionOptions?.keyConnectorOption?.keyConnectorUrl;
  }

  // TODO: future passkey login strategy will need to support setting user key (decrypting via TDE or admin approval request)
  // so might be worth moving this logic to a common place (base login strategy or a separate service?)
  protected override async unlock(
    tokenResponse: IdentityTokenResponse,
    userId: UserId,
  ): Promise<void> {
    // Note: Ideally we would refactor this to classify into distinct states based on the token response
    // with a return enum "mainUnlockMethod". This work is currently not tracked.

    if (this.needsKeyConnectorEnrollmentForNewUser(tokenResponse)) {
      // Not for existing users that need to be converted!
      await this.keyConnectorService.setNewSsoUserKeyConnectorConversionData(
        {
          kdfConfig: tokenResponse.kdfConfig,
          keyConnectorUrl: this.getKeyConnectorUrl(tokenResponse),
          organizationId: this.cache.value.orgId,
        },
        userId,
      );
    } else if (tokenResponse.canUnlockWithKeyConnector()) {
      await this.unlockService.unlockWithKeyConnector(
        userId,
        tokenResponse.intoKeyConnectorUnlockData(),
      );
    } else {
      // A TDE or master-password user
      const userDecryptionOptions = tokenResponse?.userDecryptionOptions;

      // Note: TDE and key connector are mutually exclusive
      if (userDecryptionOptions?.trustedDeviceOption) {
        this.logService.info("Attempting to unlock user with approved admin auth request.");

        // Try to use the user key from an approved admin request if it exists.
        // Using it will clear it from state and future requests will use the device key.
        await this.tryUnlockWithApprovedAdminRequestIfExists(userId);

        const isUnlocked = await this.keyService.hasUserKey(userId);

        // Only try to unlock user with device key if admin approval request was not successful.
        if (!isUnlocked) {
          this.logService.info("Attempting to unlock user with device key.");

          await this.tryUnlockWithDeviceKey(tokenResponse, userId);
        }
      }
    }
  }

  private async tryUnlockWithApprovedAdminRequestIfExists(userId: UserId): Promise<void> {
    // At this point a user could have an admin auth request that has been approved
    const adminAuthReqStorable = await this.authRequestService.getAdminAuthRequest(userId);

    if (!adminAuthReqStorable) {
      return;
    }

    // Call server to see if admin auth request has been approved
    let adminAuthReqResponse: AuthRequestResponse;

    try {
      adminAuthReqResponse = await this.apiService.getAuthRequest(adminAuthReqStorable.id);
    } catch (error) {
      if (error instanceof ErrorResponse && error.statusCode === HttpStatusCode.NotFound) {
        // if we get a 404, it means the auth request has been deleted so clear it from storage
        await this.authRequestService.clearAdminAuthRequest(userId);
      }

      // Always return on an error here as we don't want to block the user from logging in
      return;
    }

    if (adminAuthReqResponse?.requestApproved) {
      await this.authRequestService.setUserKeyAfterDecryptingSharedUserKey(
        adminAuthReqResponse,
        adminAuthReqStorable.privateKey,
        userId,
      );

      if (await this.keyService.hasUserKey(userId)) {
        // Now that we have a decrypted user key in memory, we can check if we
        // need to establish trust on the current device
        await this.deviceTrustService.trustDeviceIfRequired(userId);

        // if we successfully decrypted the user key, we can delete the admin auth request out of state
        // TODO: eventually we post and clean up DB as well once consumed on client
        await this.authRequestService.clearAdminAuthRequest(userId);

        // This notification will be picked up by the SsoComponent to handle displaying a toast to the user
        this.authRequestService.emitAdminLoginApproved();
      }
    }
  }

  private async tryUnlockWithDeviceKey(
    tokenResponse: IdentityTokenResponse,
    userId: UserId,
  ): Promise<void> {
    const trustedDeviceOption = tokenResponse.userDecryptionOptions?.trustedDeviceOption;

    if (!trustedDeviceOption) {
      this.logService.error("Unable to unlock user due to missing trustedDeviceOption.");
      return;
    }

    const deviceKey = await this.deviceTrustService.getDeviceKey(userId);
    const encDevicePrivateKey = trustedDeviceOption?.encryptedPrivateKey;
    const encUserKey = trustedDeviceOption?.encryptedUserKey;

    if (!deviceKey || !encDevicePrivateKey || !encUserKey) {
      if (!deviceKey) {
        this.logService.warning("Unable to unlock user due to missing device key.");
      } else if (!encDevicePrivateKey || !encUserKey) {
        // Tell the server that we have a device key, but received no decryption keys
        await this.deviceTrustService.recordDeviceTrustLoss();
      }
      if (!encDevicePrivateKey) {
        this.logService.warning(
          "Unable to unlock user due to missing encrypted device private key.",
        );
      }
      if (!encUserKey) {
        this.logService.warning("Unable to unlock user due to missing encrypted user key.");
      }

      return;
    }

    const userKey = await this.deviceTrustService.decryptUserKeyWithDeviceKey(
      userId,
      encDevicePrivateKey,
      encUserKey,
      deviceKey,
    );

    if (userKey) {
      // TDE unlock during SSO login; the user key comes from DeviceTrustService.decryptUserKeyWithDeviceKey.
      await this.unlockService.unlockWithDecryptedUserKey(userId, userKey);
    }
  }

  exportCache(): CacheData {
    return {
      sso: this.cache.value,
    };
  }

  /**
   * Override to handle SSO-specific ForceSetPasswordReason flags,including TdeOffboarding,
   * TdeUserWithoutPasswordHasPasswordResetPermission, and SsoNewJitProvisionedUser cases.
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

    // Check for TDE-related conditions
    const userDecryptionOptions = await firstValueFrom(
      this.userDecryptionOptionsService.userDecryptionOptionsById$(userId),
    );

    if (!userDecryptionOptions) {
      return false;
    }

    // Check for TDE offboarding - user is being offboarded from TDE and needs to set a password on a trusted device
    if (userDecryptionOptions.trustedDeviceOption?.isTdeOffboarding) {
      await this.masterPasswordService.setForceSetPasswordReason(
        ForceSetPasswordReason.TdeOffboarding,
        userId,
      );
      return true;
    }

    // If a TDE org user in an offboarding state logs in on an untrusted device, then they will receive their existing userKeyEncryptedPrivateKey from the server, but
    // TDE would not have been able to decrypt their user key b/c we don't send down TDE as a valid decryption option, so the user key will be unavailable here for TDE org users on untrusted devices.
    // - UserDecryptionOptions.trustedDeviceOption is undefined -- device isn't trusted.
    // - UserDecryptionOptions.hasMasterPassword is false -- user doesn't have a master password.
    // - UserDecryptionOptions.UsesKeyConnector is undefined. -- they aren't using key connector
    // - UserKey is not set after successful login -- because automatic decryption is not available
    // - userKeyEncryptedPrivateKey is set after successful login -- this is the key differentiator between a TDE org user logging into an untrusted device and MP encryption JIT provisioned user logging in for the first time.
    //     Why is that the case?  Because we set the userKeyEncryptedPrivateKey when we create the userKey, and this is serving as a proxy to tell us that the userKey has been created already (when enrolling in TDE).
    const hasUserKeyEncryptedPrivateKey = await firstValueFrom(
      this.keyService.userEncryptedPrivateKey$(userId),
    );
    const hasUserKey = await this.keyService.hasUserKey(userId);

    // TODO: PM-23491 we should explore consolidating this logic into a flag on the server. It could be set when an org is switched from TDE to MP encryption for each org user.
    if (
      !userDecryptionOptions.trustedDeviceOption &&
      !userDecryptionOptions.hasMasterPassword &&
      !userDecryptionOptions.keyConnectorOption?.keyConnectorUrl &&
      hasUserKeyEncryptedPrivateKey &&
      !hasUserKey
    ) {
      await this.masterPasswordService.setForceSetPasswordReason(
        ForceSetPasswordReason.TdeOffboardingUntrustedDevice,
        userId,
      );
      return true;
    }

    // Check if user has permission to set password but hasn't yet
    if (
      !userDecryptionOptions.hasMasterPassword &&
      userDecryptionOptions.trustedDeviceOption?.hasManageResetPasswordPermission
    ) {
      await this.masterPasswordService.setForceSetPasswordReason(
        ForceSetPasswordReason.TdeUserWithoutPasswordHasPasswordResetPermission,
        userId,
      );

      return true;
    }

    // Check for new SSO JIT provisioned user
    // If a user logs in via SSO but has no master password and no alternative encryption methods
    // Then they must be a newly provisioned user who needs to set up their encryption
    if (
      !userDecryptionOptions.hasMasterPassword &&
      !userDecryptionOptions.keyConnectorOption?.keyConnectorUrl &&
      !userDecryptionOptions.trustedDeviceOption
    ) {
      await this.masterPasswordService.setForceSetPasswordReason(
        ForceSetPasswordReason.SsoNewJitProvisionedUser,
        userId,
      );
      return true;
    }

    // If none of the conditions are met, return false
    return false;
  }
}
