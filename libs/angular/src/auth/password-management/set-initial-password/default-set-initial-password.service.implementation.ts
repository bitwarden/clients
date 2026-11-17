import { firstValueFrom } from "rxjs";

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
import { SsoJitProvisionFinishService } from "@bitwarden/common/auth/sso-jit-provision-finish";
import { assertNonNullish, assertTruthy } from "@bitwarden/common/auth/utils";
import { AccountCryptographicStateService } from "@bitwarden/common/key-management/account-cryptography/account-cryptographic-state.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import {
  MasterPasswordAuthenticationData,
  MasterPasswordUnlockData,
} from "@bitwarden/common/key-management/master-password/types/master-password.types";
import { KeysRequest } from "@bitwarden/common/models/request/keys.request";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UserId } from "@bitwarden/common/types/guid";
import { MasterKey, UserKey } from "@bitwarden/common/types/key";
import { KdfConfigService, KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import {
  EncryptService,
  EncString,
  fromSdkKdfConfig,
  KdfConfig,
  LegacyCompatKeyService,
  SymmetricCryptoKey,
} from "@bitwarden/legacy-crypto";
import { UnlockService } from "@bitwarden/unlock";

import {
  InitializeJitPasswordCredentials,
  SetInitialPasswordCredentials,
  SetInitialPasswordService,
  SetInitialPasswordUserType,
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
    protected legacyCompatKeyService: LegacyCompatKeyService,
    protected masterPasswordApiService: MasterPasswordApiService,
    protected masterPasswordService: InternalMasterPasswordServiceAbstraction,
    protected organizationApiService: OrganizationApiServiceAbstraction,
    protected organizationUserApiService: OrganizationUserApiService,
    protected userDecryptionOptionsService: InternalUserDecryptionOptionsServiceAbstraction,
    protected accountCryptographicStateService: AccountCryptographicStateService,
    protected ssoJitProvisionFinishService: SsoJitProvisionFinishService,
    protected unlockService: UnlockService,
  ) {}

  /**
   * @deprecated use `initializePasswordJitPasswordUserV2Encryption()` instead
   */
  async setInitialPassword(
    credentials: SetInitialPasswordCredentials,
    userType: SetInitialPasswordUserType,
    userId: UserId,
  ): Promise<void> {
    const {
      newMasterKey,
      newServerMasterKeyHash,
      newPasswordHint,
      kdfConfig,
      orgSsoIdentifier,
      orgId,
      resetPasswordAutoEnroll,
      newPassword,
      salt,
      acceptOrganizationInvite,
    } = credentials;

    for (const [key, value] of Object.entries(credentials)) {
      // Optional: undefined means the legacy set-password flow runs
      if (key === "acceptOrganizationInvite") {
        continue;
      }
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
        keyPair = await this.legacyCompatKeyService.makeKeyPair(masterKeyEncryptedUserKey[0]);
      }

      if (keyPair == null) {
        throw new Error("keyPair not found. Could not set password.");
      }
      if (!keyPair[1].encryptedString) {
        throw new Error("encrypted private key not found. Could not set password.");
      }

      keysRequest = new KeysRequest(keyPair[0], keyPair[1].encryptedString);
    }

    // Set master password unlock data for unlock path pointed to with
    // MasterPasswordUnlockData feature development
    // (requires: password, salt, kdf, userKey).
    // As migration to this strategy continues, both unlock paths need supported.
    // [PM-28494]: The unlock data is set to state below so that an immediate lock/unlock with the
    // new password does not fail before sync completes.
    const masterPasswordUnlock = await this.masterPasswordService.makeMasterPasswordUnlockData(
      newPassword,
      kdfConfig,
      salt,
      masterKeyEncryptedUserKey[0],
    );

    if (userType === SetInitialPasswordUserType.JIT_PROVISIONED_MP_ORG_USER) {
      assertNonNullish(keysRequest, "keysRequest", "Could not set password.");

      const masterPasswordAuthentication =
        await this.masterPasswordService.makeMasterPasswordAuthenticationData(
          newPassword,
          kdfConfig,
          salt,
        );

      // The SSO JIT provision finish service chooses the endpoint from the
      // pm-34429-invite-link-auto-confirm flag.
      const result = await this.ssoJitProvisionFinishService.finishPassword({
        userId,
        orgId,
        orgSsoIdentifier,
        newPassword,
        newPasswordHint,
        salt,
        resetPasswordAutoEnroll,
        acceptOrganizationInvite,
        v1Keys: { masterPasswordAuthentication, masterPasswordUnlock, keys: keysRequest },
      });
      if (result.encryptionVersion !== "V1") {
        throw new Error("Unexpected V2 SSO JIT provisioning result. Could not set password.");
      }
    } else {
      // ============================================================
      // PM-42990 — ROLLBACK NOTE
      // ============================================================
      // This code builds the request from a master password hash. The caller
      // computes that hash in SetInitialPasswordComponent.
      //
      // This path (non-JIT users) does not build the request from authentication
      // data or unlock data. The JIT path does.
      //
      // This exists because the set-password endpoint needs the old shape for
      // 3 releases, to stay compatible with self hosted servers.
      //
      // BUILD: Move the hash and key computation back into this method. Build
      // the request from authentication data and unlock data, not a hash.
      //
      // DELETE: Remove the assertions on newMasterKey and newServerMasterKeyHash
      // below. Delete newMasterKey and newServerMasterKeyHash from
      // SetInitialPasswordCredentials and PasswordInputResult. See
      // https://github.com/bitwarden/clients/pull/20643 for initial pass at this
      // refactor.
      // ============================================================
      const request = new SetPasswordRequest(
        newServerMasterKeyHash,
        masterKeyEncryptedUserKey[1].encryptedString,
        newPasswordHint,
        orgSsoIdentifier,
        keysRequest,
        kdfConfig,
      );
      await this.masterPasswordApiService.setPassword(request);
    }

    // Clear force set password reason to allow navigation back to vault.
    await this.masterPasswordService.setForceSetPasswordReason(ForceSetPasswordReason.None, userId);

    // User now has a password so update account decryption options in state
    await this.updateAccountDecryptionProperties(kdfConfig, userId);

    await this.masterPasswordService.setMasterPasswordUnlockData(masterPasswordUnlock, userId);

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

    // Unlocking initializes the SDK from state, so it has to run after the account cryptographic
    // state above has been persisted. handleResetPasswordAutoEnrollOld below reads the user key back
    // out of state, so it has to run after this.
    await this.unlockService.unlockWithDecryptedUserKey(userId, masterKeyEncryptedUserKey[0]);

    // Enrollment accepts the organization invite, so skip it when the invite must stay Invited.
    if (resetPasswordAutoEnroll && acceptOrganizationInvite !== false) {
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

    const request = new UpdateTdeOffboardingPasswordRequest(
      authenticationData,
      unlockData,
      newPasswordHint,
    );

    await this.masterPasswordApiService.putUpdateTdeOffboardingPassword(request);

    // TODO: investigate removing this call to clear forceSetPasswordReason in https://bitwarden.atlassian.net/browse/PM-32660
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
      // Optional: undefined means the legacy SDK flow runs
      if (key === "acceptOrganizationInvite") {
        continue;
      }
      if (value == null) {
        throw new Error(`${key} is required.`);
      }
    }

    const organizationKeys = await this.organizationApiService.getKeys(credentials.orgId);
    if (organizationKeys == null) {
      throw new Error("Organization keys response is null.");
    }

    const result = await this.ssoJitProvisionFinishService.finishPassword({
      userId,
      orgId: credentials.orgId,
      orgSsoIdentifier: credentials.orgSsoIdentifier,
      newPassword: credentials.newPassword,
      newPasswordHint: credentials.newPasswordHint,
      salt: credentials.salt,
      resetPasswordAutoEnroll: credentials.resetPasswordAutoEnroll,
      acceptOrganizationInvite: credentials.acceptOrganizationInvite,
      orgPublicKey: organizationKeys.publicKey,
    });
    if (result.encryptionVersion !== "V2") {
      throw new Error("Unexpected V1 SSO JIT provisioning result.");
    }
    const registerResult = result.registration;

    if (!("V2" in registerResult.account_cryptographic_state)) {
      throw new Error("Unexpected V2 account cryptographic state");
    }

    // Note: When SDK state management matures, the state writes and the unlock below should all be
    // moved into post_keys_for_jit_password_registration
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

    await this.updateLegacyState(
      fromSdkKdfConfig(registerResult.master_password_unlock.kdf),
      userId,
    );

    // Unlocking initializes the SDK from state, so it has to run after the state written above -
    // in particular the new KDF config - has been persisted.
    await this.unlockService.unlockWithDecryptedUserKey(
      userId,
      SymmetricCryptoKey.fromString(registerResult.user_key),
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

    // ============================================================
    // PM-42990 — ROLLBACK NOTE
    // ============================================================
    // This method already builds authentication data and unlock data.
    // The method newConstructor() converts that data into the old request shape.
    //
    // It converts to the old shape because the endpoint needs it for 3
    // releases, to stay compatible with self hosted servers.
    //
    // BUILD: Replace this call with a direct call to the new request
    // constructor. No other change is needed here.
    //
    // DELETE: Nothing to delete at this call site. See
    // https://github.com/bitwarden/clients/pull/20643 for initial pass at this
    // refactor.
    // ============================================================
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
    await this.updateLegacyState(unlockData.kdf, userId);

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
   * @deprecated along with `setInitialPassword()` deprecation
   */
  private async makeMasterKeyEncryptedUserKey(
    masterKey: MasterKey,
    userId: UserId,
  ): Promise<[UserKey, EncString]> {
    let masterKeyEncryptedUserKey: [UserKey, EncString] | null = null;

    const userKey = await firstValueFrom(this.keyService.userKey$(userId));

    if (userKey == null) {
      masterKeyEncryptedUserKey = await this.legacyCompatKeyService.makeUserKey(masterKey);
    } else {
      masterKeyEncryptedUserKey = await this.legacyCompatKeyService.encryptUserKeyWithMasterKey(
        masterKey,
        userKey,
      );
    }

    return masterKeyEncryptedUserKey;
  }

  /**
   * @deprecated along with `setInitialPassword()` deprecation
   */
  private async updateAccountDecryptionProperties(kdfConfig: KdfConfig, userId: UserId) {
    const userDecryptionOpts = await firstValueFrom(
      this.userDecryptionOptionsService.userDecryptionOptionsById$(userId),
    );
    userDecryptionOpts.hasMasterPassword = true;
    await this.userDecryptionOptionsService.setUserDecryptionOptionsById(
      userId,
      userDecryptionOpts,
    );
    await this.kdfConfigService.setKdfConfig(userId, kdfConfig);
  }

  // Deprecated legacy support - to be removed in future
  private async updateLegacyState(kdfConfig: KdfConfig, userId: UserId) {
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
  }

  /**
   * @deprecated
   *
   * This method is now deprecated because it is used with the deprecated `setInitialPassword()` method,
   * which handles both JIT MP and TDE + Permission user flows.
   *
   * Since these methods can handle the JIT MP flow - which creates a new user key and sets it to state - we
   * must retrieve that user key here in this method.
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
