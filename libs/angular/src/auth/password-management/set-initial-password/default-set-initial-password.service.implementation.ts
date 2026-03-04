import { concatMap, firstValueFrom } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import {
  OrganizationUserApiService,
  OrganizationUserResetPasswordEnrollmentRequest,
} from "@bitwarden/admin-console/common";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { InternalUserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { MasterPasswordApiService } from "@bitwarden/common/auth/abstractions/master-password-api.service.abstraction";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { SetPasswordRequest } from "@bitwarden/common/auth/models/request/set-password.request";
import { UpdateTdeOffboardingPasswordRequest } from "@bitwarden/common/auth/models/request/update-tde-offboarding-password.request";
import { assertNonNullish, assertTruthy } from "@bitwarden/common/auth/utils";
import { AccountCryptographicStateService } from "@bitwarden/common/key-management/account-cryptography/account-cryptographic-state.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import {
  MasterPasswordAuthenticationData,
  MasterPasswordSalt,
  MasterPasswordUnlockData,
} from "@bitwarden/common/key-management/master-password/types/master-password.types";
import { KeysRequest } from "@bitwarden/common/models/request/keys.request";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { RegisterSdkService } from "@bitwarden/common/platform/abstractions/sdk/register-sdk.service";
import { asUuid } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { UserId } from "@bitwarden/common/types/guid";
import { MasterKey, UserKey } from "@bitwarden/common/types/key";
import {
  fromSdkKdfConfig,
  KdfConfig,
  KdfConfigService,
  KeyService,
} from "@bitwarden/key-management";
import { OrganizationId as SdkOrganizationId, UserId as SdkUserId } from "@bitwarden/sdk-internal";

import {
  InitializeJitPasswordCredentials,
  SetInitialPasswordCredentials,
  SetInitialPasswordService,
  SetInitialPasswordUserType,
  SetInitialPasswordTdeOffboardingCredentialsOld,
  SetInitialPasswordTdeOffboardingCredentials,
  SetInitialPasswordTdeUserWithPermissionCredentials,
} from "./set-initial-password.service.abstraction";

export class DefaultSetInitialPasswordService implements SetInitialPasswordService {
  constructor(
    protected apiService: ApiService,
    protected encryptService: EncryptService,
    protected i18nService: I18nService,
    protected kdfConfigService: KdfConfigService,
    protected keyService: KeyService,
    protected masterPasswordApiService: MasterPasswordApiService,
    protected masterPasswordService: InternalMasterPasswordServiceAbstraction,
    protected organizationApiService: OrganizationApiServiceAbstraction,
    protected organizationUserApiService: OrganizationUserApiService,
    protected userDecryptionOptionsService: InternalUserDecryptionOptionsServiceAbstraction,
    protected accountCryptographicStateService: AccountCryptographicStateService,
    protected registerSdkService: RegisterSdkService,
  ) {}

  /**
   * @deprecated To be removed in PM-28143. When you remove this, also check for any objects/methods
   * in this default service that are now un-used and can also be removed.
   */
  async setInitialPassword(
    credentials: SetInitialPasswordCredentials,
    userType: SetInitialPasswordUserType,
    userId: UserId,
  ): Promise<void> {
    const {
      newMasterKey,
      newServerMasterKeyHash,
      newLocalMasterKeyHash,
      newPasswordHint,
      kdfConfig,
      orgSsoIdentifier,
      orgId,
      resetPasswordAutoEnroll,
      newPassword,
      salt,
    } = credentials;

    for (const [key, value] of Object.entries(credentials)) {
      if (value == null) {
        throw new Error(`${key} not found. Could not set password.`);
      }
    }
    if (userId == null) {
      throw new Error("userId not found. Could not set password.");
    }
    if (userType == null) {
      throw new Error("userType not found. Could not set password.");
    }

    const masterKeyEncryptedUserKey = await this.makeMasterKeyEncryptedUserKey(
      newMasterKey,
      userId,
    );
    if (masterKeyEncryptedUserKey == null || !masterKeyEncryptedUserKey[1].encryptedString) {
      throw new Error("masterKeyEncryptedUserKey not found. Could not set password.");
    }

    let keyPair: [string, EncString] | null = null;
    let keysRequest: KeysRequest | null = null;

    if (userType === SetInitialPasswordUserType.JIT_PROVISIONED_MP_ORG_USER) {
      /**
       * A user being JIT provisioned into a MP encryption org does not yet have a user
       * asymmetric key pair, so we create it for them here.
       *
       * Sidenote:
       *   In the case of a TDE user whose permissions require that they have a MP - that user
       *   will already have a user asymmetric key pair by this point, so we skip this if-block
       *   so that we don't create a new key pair for them.
       */

      // Extra safety check (see description on https://github.com/bitwarden/clients/pull/10180):
      //   In case we have have a local private key and are not sure whether it has been posted to the server,
      //   we post the local private key instead of generating a new one
      const existingUserPrivateKey = (await firstValueFrom(
        this.keyService.userPrivateKey$(userId),
      )) as Uint8Array;

      const existingUserPublicKey = await firstValueFrom(this.keyService.userPublicKey$(userId));

      if (existingUserPrivateKey != null && existingUserPublicKey != null) {
        const existingUserPublicKeyB64 = Utils.fromBufferToB64(existingUserPublicKey);

        // Existing key pair
        keyPair = [
          existingUserPublicKeyB64,
          await this.encryptService.wrapDecapsulationKey(
            existingUserPrivateKey,
            masterKeyEncryptedUserKey[0],
          ),
        ];
      } else {
        // New key pair
        keyPair = await this.keyService.makeKeyPair(masterKeyEncryptedUserKey[0]);
      }

      if (keyPair == null) {
        throw new Error("keyPair not found. Could not set password.");
      }
      if (!keyPair[1].encryptedString) {
        throw new Error("encrypted private key not found. Could not set password.");
      }

      keysRequest = new KeysRequest(keyPair[0], keyPair[1].encryptedString);
    }

    const request = new SetPasswordRequest(
      newServerMasterKeyHash,
      masterKeyEncryptedUserKey[1].encryptedString,
      newPasswordHint,
      orgSsoIdentifier,
      keysRequest,
      kdfConfig,
    );

    await this.masterPasswordApiService.setPassword(request);

    // Clear force set password reason to allow navigation back to vault.
    await this.masterPasswordService.setForceSetPasswordReason(ForceSetPasswordReason.None, userId);

    // User now has a password so update account decryption options in state
    await this.updateAccountDecryptionProperties(
      newMasterKey,
      kdfConfig,
      masterKeyEncryptedUserKey,
      userId,
    );

    // Set master password unlock data for unlock path pointed to with
    // MasterPasswordUnlockData feature development
    // (requires: password, salt, kdf, userKey).
    // As migration to this strategy continues, both unlock paths need supported.
    // Several invocations in this file become redundant and can be removed once
    // the feature is enshrined/unwound. These are marked with [PM-23246] below.
    await this.setMasterPasswordUnlockData(
      newPassword,
      salt,
      kdfConfig,
      masterKeyEncryptedUserKey[0],
      userId,
    );

    /**
     * Set the private key only for new JIT provisioned users in MP encryption orgs.
     * (Existing TDE users will have their private key set on sync or on login.)
     */
    if (keyPair != null && userType === SetInitialPasswordUserType.JIT_PROVISIONED_MP_ORG_USER) {
      if (!keyPair[1].encryptedString) {
        throw new Error("encrypted private key not found. Could not set private key in state.");
      }
      await this.accountCryptographicStateService.setAccountCryptographicState(
        {
          V1: {
            private_key: keyPair[1].encryptedString,
          },
        },
        userId,
      );
    }

    // [PM-23246] "Legacy" master key setting path - to be removed once unlock path migration is complete
    await this.masterPasswordService.setMasterKeyHash(newLocalMasterKeyHash, userId);

    if (resetPasswordAutoEnroll) {
      await this.handleResetPasswordAutoEnrollOld(newServerMasterKeyHash, orgId, userId);
    }
  }

  async setInitialPasswordTdeOffboarding(
    credentials: SetInitialPasswordTdeOffboardingCredentials,
    userId: UserId,
  ) {
    const ctx = "Could not set initial password.";
    assertTruthy(credentials.newPassword, "newPassword", ctx);
    assertTruthy(credentials.salt, "salt", ctx);
    assertNonNullish(credentials.kdfConfig, "kdfConfig", ctx);
    assertNonNullish(credentials.newPasswordHint, "newPasswordHint", ctx);

    if (userId == null) {
      throw new Error("userId not found. Could not set password.");
    }

    const { newPassword, salt, kdfConfig, newPasswordHint } = credentials;

    const userKey = await firstValueFrom(this.keyService.userKey$(userId));
    if (userKey == null) {
      throw new Error("userKey not found. Could not set password.");
    }

    const authenticationData: MasterPasswordAuthenticationData =
      await this.masterPasswordService.makeMasterPasswordAuthenticationData(
        newPassword,
        kdfConfig,
        salt,
      );

    const unlockData: MasterPasswordUnlockData =
      await this.masterPasswordService.makeMasterPasswordUnlockData(
        newPassword,
        kdfConfig,
        salt,
        userKey,
      );

    const request = UpdateTdeOffboardingPasswordRequest.newConstructorWithHint(
      authenticationData,
      unlockData,
      newPasswordHint,
    );

    await this.masterPasswordApiService.putUpdateTdeOffboardingPassword(request);

    // TODO: investigate removing this call to clear forceSetPasswordReason in https://bitwarden.atlassian.net/browse/PM-32660
    // Clear force set password reason to allow navigation back to vault.
    await this.masterPasswordService.setForceSetPasswordReason(ForceSetPasswordReason.None, userId);
  }

  /**
   * @deprecated To be removed in PM-28143
   */
  async setInitialPasswordTdeOffboardingOld(
    credentials: SetInitialPasswordTdeOffboardingCredentialsOld,
    userId: UserId,
  ) {
    const { newMasterKey, newServerMasterKeyHash, newPasswordHint } = credentials;
    for (const [key, value] of Object.entries(credentials)) {
      if (value == null) {
        throw new Error(`${key} not found. Could not set password.`);
      }
    }

    if (userId == null) {
      throw new Error("userId not found. Could not set password.");
    }

    const userKey = await firstValueFrom(this.keyService.userKey$(userId));
    if (userKey == null) {
      throw new Error("userKey not found. Could not set password.");
    }

    const newMasterKeyEncryptedUserKey = await this.keyService.encryptUserKeyWithMasterKey(
      newMasterKey,
      userKey,
    );

    if (!newMasterKeyEncryptedUserKey[1].encryptedString) {
      throw new Error("newMasterKeyEncryptedUserKey not found. Could not set password.");
    }

    const request = new UpdateTdeOffboardingPasswordRequest();
    request.key = newMasterKeyEncryptedUserKey[1].encryptedString;
    request.newMasterPasswordHash = newServerMasterKeyHash;
    request.masterPasswordHint = newPasswordHint;

    await this.masterPasswordApiService.putUpdateTdeOffboardingPassword(request);

    // Clear force set password reason to allow navigation back to vault.
    await this.masterPasswordService.setForceSetPasswordReason(ForceSetPasswordReason.None, userId);
  }

  async initializePasswordJitPasswordUserV2Encryption(
    credentials: InitializeJitPasswordCredentials,
    userId: UserId,
  ): Promise<void> {
    if (userId == null) {
      throw new Error("User ID is required.");
    }

    for (const [key, value] of Object.entries(credentials)) {
      if (value == null) {
        throw new Error(`${key} is required.`);
      }
    }

    const { newPasswordHint, orgSsoIdentifier, orgId, resetPasswordAutoEnroll, newPassword, salt } =
      credentials;

    const organizationKeys = await this.organizationApiService.getKeys(orgId);
    if (organizationKeys == null) {
      throw new Error("Organization keys response is null.");
    }

    const registerResult = await firstValueFrom(
      this.registerSdkService.registerClient$(userId).pipe(
        concatMap(async (sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }

          using ref = sdk.take();
          return await ref.value
            .auth()
            .registration()
            .post_keys_for_jit_password_registration({
              org_id: asUuid<SdkOrganizationId>(orgId),
              org_public_key: organizationKeys.publicKey,
              master_password: newPassword,
              master_password_hint: newPasswordHint,
              salt: salt,
              organization_sso_identifier: orgSsoIdentifier,
              user_id: asUuid<SdkUserId>(userId),
              reset_password_enroll: resetPasswordAutoEnroll,
            });
        }),
      ),
    );

    if (!("V2" in registerResult.account_cryptographic_state)) {
      throw new Error("Unexpected V2 account cryptographic state");
    }

    // Note: When SDK state management matures, these should be moved into post_keys_for_tde_registration
    // Set account cryptography state
    await this.accountCryptographicStateService.setAccountCryptographicState(
      registerResult.account_cryptographic_state,
      userId,
    );

    // Clear force set password reason to allow navigation back to vault.
    await this.masterPasswordService.setForceSetPasswordReason(ForceSetPasswordReason.None, userId);

    const masterPasswordUnlockData = MasterPasswordUnlockData.fromSdk(
      registerResult.master_password_unlock,
    );
    await this.masterPasswordService.setMasterPasswordUnlockData(masterPasswordUnlockData, userId);

    await this.keyService.setUserKey(
      SymmetricCryptoKey.fromString(registerResult.user_key) as UserKey,
      userId,
    );

    await this.updateLegacyState(
      newPassword,
      fromSdkKdfConfig(registerResult.master_password_unlock.kdf),
      new EncString(registerResult.master_password_unlock.masterKeyWrappedUserKey),
      userId,
      masterPasswordUnlockData,
    );
  }

  async setInitialPasswordTdeUserWithPermission(
    credentials: SetInitialPasswordTdeUserWithPermissionCredentials,
    userId: UserId,
  ): Promise<void> {
    const ctx =
      "Could not set initial password for TDE user with Manage Account Recovery permission.";

    assertTruthy(credentials.newPassword, "newPassword", ctx);
    assertTruthy(credentials.salt, "salt", ctx);
    assertNonNullish(credentials.kdfConfig, "kdfConfig", ctx);
    assertNonNullish(credentials.newPasswordHint, "newPasswordHint", ctx); // can have an empty string as a valid value, so check non-nullish
    assertTruthy(credentials.orgSsoIdentifier, "orgSsoIdentifier", ctx);
    assertTruthy(credentials.orgId, "orgId", ctx);
    assertNonNullish(credentials.resetPasswordAutoEnroll, "resetPasswordAutoEnroll", ctx); // can have `false` as a valid value, so check non-nullish
    assertTruthy(userId, "userId", ctx);

    const {
      newPassword,
      salt,
      kdfConfig,
      newPasswordHint,
      orgSsoIdentifier,
      orgId,
      resetPasswordAutoEnroll,
    } = credentials;

    const userKey = await firstValueFrom(this.keyService.userKey$(userId));

    if (!userKey) {
      throw new Error("userKey not found.");
    }

    const authenticationData: MasterPasswordAuthenticationData =
      await this.masterPasswordService.makeMasterPasswordAuthenticationData(
        newPassword,
        kdfConfig,
        salt,
      );

    const unlockData: MasterPasswordUnlockData =
      await this.masterPasswordService.makeMasterPasswordUnlockData(
        newPassword,
        kdfConfig,
        salt,
        userKey,
      );

    const request = SetPasswordRequest.newConstructor(
      authenticationData,
      unlockData,
      newPasswordHint,
      orgSsoIdentifier,
      null, // no KeysRequest for TDE user because they already have a key pair
    );

    await this.masterPasswordApiService.setPassword(request);

    // Clear force set password reason to allow navigation back to vault.
    await this.masterPasswordService.setForceSetPasswordReason(ForceSetPasswordReason.None, userId);

    // User now has a password so update decryption state
    await this.masterPasswordService.setMasterPasswordUnlockData(unlockData, userId);
    await this.updateLegacyState(
      newPassword,
      unlockData.kdf,
      new EncString(unlockData.masterKeyWrappedUserKey),
      userId,
      unlockData,
    );

    if (resetPasswordAutoEnroll) {
      await this.handleResetPasswordAutoEnroll(
        authenticationData.masterPasswordAuthenticationHash,
        orgId,
        userId,
        userKey,
      );
    }
  }

  /**
   * @deprecated To be removed in PM-28143
   */
  private async makeMasterKeyEncryptedUserKey(
    masterKey: MasterKey,
    userId: UserId,
  ): Promise<[UserKey, EncString]> {
    let masterKeyEncryptedUserKey: [UserKey, EncString] | null = null;

    const userKey = await firstValueFrom(this.keyService.userKey$(userId));

    if (userKey == null) {
      masterKeyEncryptedUserKey = await this.keyService.makeUserKey(masterKey);
    } else {
      masterKeyEncryptedUserKey = await this.keyService.encryptUserKeyWithMasterKey(
        masterKey,
        userKey,
      );
    }

    return masterKeyEncryptedUserKey;
  }

  private async updateAccountDecryptionProperties(
    masterKey: MasterKey,
    kdfConfig: KdfConfig,
    masterKeyEncryptedUserKey: [UserKey, EncString],
    userId: UserId,
  ) {
    const userDecryptionOpts = await firstValueFrom(
      this.userDecryptionOptionsService.userDecryptionOptionsById$(userId),
    );
    userDecryptionOpts.hasMasterPassword = true;
    await this.userDecryptionOptionsService.setUserDecryptionOptionsById(
      userId,
      userDecryptionOpts,
    );
    await this.kdfConfigService.setKdfConfig(userId, kdfConfig);
    // [PM-23246] "Legacy" master key setting path - to be removed once unlock path migration is complete
    await this.masterPasswordService.setMasterKey(masterKey, userId);
    // [PM-23246] "Legacy" master key setting path - to be removed once unlock path migration is complete
    await this.masterPasswordService.setMasterKeyEncryptedUserKey(
      masterKeyEncryptedUserKey[1],
      userId,
    );
    await this.keyService.setUserKey(masterKeyEncryptedUserKey[0], userId);
  }

  // Deprecated legacy support - to be removed in future
  private async updateLegacyState(
    newPassword: string,
    kdfConfig: KdfConfig,
    masterKeyWrappedUserKey: EncString,
    userId: UserId,
    masterPasswordUnlockData: MasterPasswordUnlockData,
  ) {
    // TODO Remove HasMasterPassword from UserDecryptionOptions https://bitwarden.atlassian.net/browse/PM-23475
    const userDecryptionOpts = await firstValueFrom(
      this.userDecryptionOptionsService.userDecryptionOptionsById$(userId),
    );
    userDecryptionOpts.hasMasterPassword = true;
    await this.userDecryptionOptionsService.setUserDecryptionOptionsById(
      userId,
      userDecryptionOpts,
    );

    // TODO Remove KDF state https://bitwarden.atlassian.net/browse/PM-30661
    await this.kdfConfigService.setKdfConfig(userId, kdfConfig);
    // TODO Remove master key memory state https://bitwarden.atlassian.net/browse/PM-23477
    await this.masterPasswordService.setMasterKeyEncryptedUserKey(masterKeyWrappedUserKey, userId);

    // TODO Removed with https://bitwarden.atlassian.net/browse/PM-30676
    await this.masterPasswordService.setLegacyMasterKeyFromUnlockData(
      newPassword,
      masterPasswordUnlockData,
      userId,
    );
  }

  /**
   * @deprecated To be removed in PM-28143
   *
   * As part of [PM-28494], adding this setting path to accommodate the changes that are
   * emerging with pm-23246-unlock-with-master-password-unlock-data.
   * Without this, immediately locking/unlocking the vault with the new password _may_ still fail
   * if sync has not completed. Sync will eventually set this data, but we want to ensure it's
   * set right away here to prevent a race condition UX issue that prevents immediate unlock.
   */
  private async setMasterPasswordUnlockData(
    password: string,
    salt: MasterPasswordSalt,
    kdfConfig: KdfConfig,
    userKey: UserKey,
    userId: UserId,
  ): Promise<void> {
    const masterPasswordUnlockData = await this.masterPasswordService.makeMasterPasswordUnlockData(
      password,
      kdfConfig,
      salt,
      userKey,
    );

    await this.masterPasswordService.setMasterPasswordUnlockData(masterPasswordUnlockData, userId);
  }

  /**
   * @deprecated To be removed in PM-28143
   *
   * This method is now deprecated because it is used with the deprecated `setInitialPassword()` method,
   * which handles both JIT MP and TDE + Permission user flows.
   *
   * Since these methods can handle the JIT MP flow - which creates a new user key and sets it to state - we
   * must retreive that user key here in this method.
   *
   * But the new handleResetPasswordAutoEnroll() method is only used in the TDE + Permission user case, in which
   * case we already have the user key and can simply pass it through via method parameter ( @see handleResetPasswordAutoEnroll )
   */
  private async handleResetPasswordAutoEnrollOld(
    masterKeyHash: string,
    orgId: string,
    userId: UserId,
  ) {
    const organizationKeys = await this.organizationApiService.getKeys(orgId);

    if (organizationKeys == null) {
      throw new Error(
        "Organization keys response is null. Could not handle reset password auto enroll.",
      );
    }

    const orgPublicKey = Utils.fromB64ToArray(organizationKeys.publicKey);
    const userKey = await firstValueFrom(this.keyService.userKey$(userId));

    if (userKey == null) {
      throw new Error("userKey not found. Could not handle reset password auto enroll.");
    }

    // RSA encrypt user key with organization public key
    const orgPublicKeyEncryptedUserKey = await this.encryptService.encapsulateKeyUnsigned(
      userKey,
      orgPublicKey,
    );

    if (orgPublicKeyEncryptedUserKey == null || !orgPublicKeyEncryptedUserKey.encryptedString) {
      throw new Error(
        "orgPublicKeyEncryptedUserKey not found. Could not handle reset password auto enroll.",
      );
    }

    const enrollmentRequest = new OrganizationUserResetPasswordEnrollmentRequest();
    enrollmentRequest.masterPasswordHash = masterKeyHash;
    enrollmentRequest.resetPasswordKey = orgPublicKeyEncryptedUserKey.encryptedString;

    await this.organizationUserApiService.putOrganizationUserResetPasswordEnrollment(
      orgId,
      userId,
      enrollmentRequest,
    );
  }

  private async handleResetPasswordAutoEnroll(
    masterKeyHash: string,
    orgId: string,
    userId: UserId,
    userKey: UserKey,
  ) {
    const organizationKeys = await this.organizationApiService.getKeys(orgId);

    if (organizationKeys == null) {
      throw new Error(
        "Organization keys response is null. Could not handle reset password auto enroll.",
      );
    }

    const orgPublicKey = Utils.fromB64ToArray(organizationKeys.publicKey);

    // RSA encrypt user key with organization public key
    const orgPublicKeyEncryptedUserKey = await this.encryptService.encapsulateKeyUnsigned(
      userKey,
      orgPublicKey,
    );

    if (orgPublicKeyEncryptedUserKey == null || !orgPublicKeyEncryptedUserKey.encryptedString) {
      throw new Error(
        "orgPublicKeyEncryptedUserKey not found. Could not handle reset password auto enroll.",
      );
    }

    const enrollmentRequest = new OrganizationUserResetPasswordEnrollmentRequest();
    enrollmentRequest.masterPasswordHash = masterKeyHash;
    enrollmentRequest.resetPasswordKey = orgPublicKeyEncryptedUserKey.encryptedString;

    await this.organizationUserApiService.putOrganizationUserResetPasswordEnrollment(
      orgId,
      userId,
      enrollmentRequest,
    );
  }
}
