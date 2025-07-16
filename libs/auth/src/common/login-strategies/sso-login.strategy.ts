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
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";

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
    private deviceTrustService: DeviceTrustServiceAbstraction,
    private authRequestService: AuthRequestServiceAbstraction,
    private i18nService: I18nService,
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

  protected override async setMasterKey(tokenResponse: IdentityTokenResponse, userId: UserId) {
    // The only way we can be setting a master key at this point is if we are using Key Connector.
    // First, check to make sure that we should do so based on the token response.
    if (this.shouldSetMasterKeyFromKeyConnector(tokenResponse)) {
      // If we're here, we know that the user should use Key Connector (they have a KeyConnectorUrl) and does not have a master password.
      // We can now check the key on the token response to see whether they are a brand new user or an existing user.
      // The presence of a masterKeyEncryptedUserKey indicates that the user has already been provisioned in Key Connector.
      const newSsoUser = tokenResponse.key == null;
      if (newSsoUser) {
        await this.keyConnectorService.convertNewSsoUserToKeyConnector(
          tokenResponse,
          this.cache.value.orgId,
          userId,
        );
      } else {
        const keyConnectorUrl = this.getKeyConnectorUrl(tokenResponse);
        await this.keyConnectorService.setMasterKeyFromUrl(keyConnectorUrl, userId);
      }
    }
  }

  /**
   * Determines if it is possible set the `masterKey` from Key Connector.
   * @param tokenResponse
   * @returns `true` if the master key can be set from Key Connector, `false` otherwise
   */
  private shouldSetMasterKeyFromKeyConnector(tokenResponse: IdentityTokenResponse): boolean {
    const userDecryptionOptions = tokenResponse?.userDecryptionOptions;

    if (userDecryptionOptions != null) {
      const userHasMasterPassword = userDecryptionOptions.hasMasterPassword;
      const userHasKeyConnectorUrl =
        userDecryptionOptions.keyConnectorOption?.keyConnectorUrl != null;

      // In order for us to set the master key from Key Connector, we need to have a Key Connector URL
      // and the user must not have a master password.
      return userHasKeyConnectorUrl && !userHasMasterPassword;
    } else {
      // In pre-TDE versions of the server, the userDecryptionOptions will not be present.
      // In this case, we can determine if the user has a master password and has a Key Connector URL by
      // just checking the keyConnectorUrl property. This is because the server short-circuits on the response
      // and will not pass back the URL in the response if the user has a master password.
      // TODO: remove compatibility check after 2023.10 release (https://bitwarden.atlassian.net/browse/PM-3537)
      return tokenResponse.keyConnectorUrl != null;
    }
  }

  private getKeyConnectorUrl(tokenResponse: IdentityTokenResponse): string {
    // TODO: remove tokenResponse.keyConnectorUrl reference after 2023.10 release (https://bitwarden.atlassian.net/browse/PM-3537)
    const userDecryptionOptions = tokenResponse?.userDecryptionOptions;
    return (
      tokenResponse.keyConnectorUrl ?? userDecryptionOptions?.keyConnectorOption?.keyConnectorUrl
    );
  }

  // TODO: future passkey login strategy will need to support setting user key (decrypting via TDE or admin approval request)
  // so might be worth moving this logic to a common place (base login strategy or a separate service?)
  protected override async setUserKey(
    tokenResponse: IdentityTokenResponse,
    userId: UserId,
  ): Promise<void> {
    const masterKeyEncryptedUserKey = tokenResponse.key;

    // Note: masterKeyEncryptedUserKey is undefined for SSO JIT provisioned users
    // on account creation and subsequent logins (confirmed or unconfirmed)
    // but that is fine for TDE so we cannot return if it is undefined

    if (masterKeyEncryptedUserKey) {
      // set the master key encrypted user key if it exists
      await this.masterPasswordService.setMasterKeyEncryptedUserKey(
        masterKeyEncryptedUserKey,
        userId,
      );
    }

    const userDecryptionOptions = tokenResponse?.userDecryptionOptions;

    // Note: TDE and key connector are mutually exclusive
    if (userDecryptionOptions?.trustedDeviceOption) {
      this.logService.info("Attempting to set user key with approved admin auth request.");

      // Try to use the user key from an approved admin request if it exists.
      // Using it will clear it from state and future requests will use the device key.
      await this.trySetUserKeyWithApprovedAdminRequestIfExists(userId);

      const hasUserKey = await this.keyService.hasUserKey(userId);

      // Only try to set user key with device key if admin approval request was not successful.
      if (!hasUserKey) {
        this.logService.info("Attempting to set user key with device key.");

        await this.trySetUserKeyWithDeviceKey(tokenResponse, userId);
      }
    } else if (
      masterKeyEncryptedUserKey != null &&
      this.getKeyConnectorUrl(tokenResponse) != null
    ) {
      // Key connector enabled for user
      await this.trySetUserKeyWithMasterKey(userId);
    }

    // Note: In the traditional SSO flow with MP without key connector, the lock component
    // is responsible for deriving master key from MP entry and then decrypting the user key
  }

  private async trySetUserKeyWithApprovedAdminRequestIfExists(userId: UserId): Promise<void> {
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
      // if masterPasswordHash has a value, we will always receive authReqResponse.key
      // as authRequestPublicKey(masterKey) + authRequestPublicKey(masterPasswordHash)
      if (adminAuthReqResponse.masterPasswordHash) {
        await this.authRequestService.setKeysAfterDecryptingSharedMasterKeyAndHash(
          adminAuthReqResponse,
          adminAuthReqStorable.privateKey,
          userId,
        );
      } else {
        // if masterPasswordHash is null, we will always receive authReqResponse.key
        // as authRequestPublicKey(userKey)
        await this.authRequestService.setUserKeyAfterDecryptingSharedUserKey(
          adminAuthReqResponse,
          adminAuthReqStorable.privateKey,
          userId,
        );
      }

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

  private async trySetUserKeyWithDeviceKey(
    tokenResponse: IdentityTokenResponse,
    userId: UserId,
  ): Promise<void> {
    const trustedDeviceOption = tokenResponse.userDecryptionOptions?.trustedDeviceOption;

    if (!trustedDeviceOption) {
      this.logService.error("Unable to set user key due to missing trustedDeviceOption.");
      return;
    }

    const deviceKey = await this.deviceTrustService.getDeviceKey(userId);
    const encDevicePrivateKey = trustedDeviceOption?.encryptedPrivateKey;
    const encUserKey = trustedDeviceOption?.encryptedUserKey;

    if (!deviceKey || !encDevicePrivateKey || !encUserKey) {
      if (!deviceKey) {
        this.logService.warning("Unable to set user key due to missing device key.");
      } else if (!encDevicePrivateKey || !encUserKey) {
        // Tell the server that we have a device key, but received no decryption keys
        await this.deviceTrustService.recordDeviceTrustLoss();
      }
      if (!encDevicePrivateKey) {
        this.logService.warning(
          "Unable to set user key due to missing encrypted device private key.",
        );
      }
      if (!encUserKey) {
        this.logService.warning("Unable to set user key due to missing encrypted user key.");
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
      await this.keyService.setUserKey(userKey, userId);
    }
  }

  private async trySetUserKeyWithMasterKey(userId: UserId): Promise<void> {
    const masterKey = await firstValueFrom(this.masterPasswordService.masterKey$(userId));

    // There is a scenario in which the master key is not set here. That will occur if the user
    // has a master password and is using Key Connector. In that case, we cannot set the master key
    // because the user hasn't entered their master password yet.
    // Instead, we'll return here and let the migration to Key Connector handle setting the master key.
    if (!masterKey) {
      return;
    }

    const userKey = await this.masterPasswordService.decryptUserKeyWithMasterKey(masterKey, userId);
    await this.keyService.setUserKey(userKey, userId);
  }

  protected override async setPrivateKey(
    tokenResponse: IdentityTokenResponse,
    userId: UserId,
  ): Promise<void> {
    if (tokenResponse.hasMasterKeyEncryptedUserKey()) {
      // User has masterKeyEncryptedUserKey, so set the userKeyEncryptedPrivateKey
      // Note: new JIT provisioned SSO users will not yet have a user asymmetric key pair
      // and so we don't want them falling into the createKeyPairForOldAccount flow
      await this.keyService.setPrivateKey(
        tokenResponse.privateKey ?? (await this.createKeyPairForOldAccount(userId)),
        userId,
      );
    } else if (tokenResponse.privateKey) {
      // User doesn't have masterKeyEncryptedUserKey but they do have a userKeyEncryptedPrivateKey
      // This is just existing TDE users or a TDE offboarder on an untrusted device
      await this.keyService.setPrivateKey(tokenResponse.privateKey, userId);
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
      this.userDecryptionOptionsService.userDecryptionOptions$,
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
    // TDE would not have been able to decrypt their user key b/c we don't send down TDE as a valid decryption option, so the user key will be unavilable here for TDE org users on untrusted devices.
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
