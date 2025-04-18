// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom } from "rxjs";

import {
  OrganizationUserApiService,
  OrganizationUserResetPasswordEnrollmentRequest,
} from "@bitwarden/admin-console/common";
import { InternalUserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { MasterPasswordApiService } from "@bitwarden/common/auth/abstractions/master-password-api.service.abstraction";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { SetPasswordRequest } from "@bitwarden/common/auth/models/request/set-password.request";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { KeysRequest } from "@bitwarden/common/models/request/keys.request";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { UserId } from "@bitwarden/common/types/guid";
import { MasterKey, UserKey } from "@bitwarden/common/types/key";
import { PBKDF2KdfConfig, KdfConfigService, KeyService } from "@bitwarden/key-management";

import {
  SetInitialPasswordService,
  SetInitialPasswordCredentials,
} from "./set-initial-password.service.abstraction";

export class DefaultSetInitialPasswordService implements SetInitialPasswordService {
  constructor(
    protected apiService: ApiService,
    protected masterPasswordApiService: MasterPasswordApiService,
    protected keyService: KeyService,
    protected encryptService: EncryptService,
    protected i18nService: I18nService,
    protected kdfConfigService: KdfConfigService,
    protected masterPasswordService: InternalMasterPasswordServiceAbstraction,
    protected organizationApiService: OrganizationApiServiceAbstraction,
    protected organizationUserApiService: OrganizationUserApiService,
    protected userDecryptionOptionsService: InternalUserDecryptionOptionsServiceAbstraction,
  ) {}

  async setPassword(credentials: SetInitialPasswordCredentials): Promise<void> {
    const {
      masterKey,
      serverMasterKeyHash,
      localMasterKeyHash,
      hint,
      kdfConfig,
      orgSsoIdentifier,
      orgId,
      resetPasswordAutoEnroll,
      userId,
    } = credentials;

    for (const [key, value] of Object.entries(credentials)) {
      if (value == null) {
        throw new Error(`${key} not found. Could not set password.`);
      }
    }

    const masterKeyEncryptedUserKey = await this.makeProtectedUserKey(masterKey, userId);
    if (masterKeyEncryptedUserKey == null) {
      throw new Error("masterKeyEncryptedUserKey not found. Could not set password.");
    }

    const forceSetPasswordReason = await firstValueFrom(
      this.masterPasswordService.forceSetPasswordReason$(userId),
    );

    let keyPair: [string, EncString] | null = null;
    let keysRequest: KeysRequest | null = null;

    if (
      forceSetPasswordReason !=
      ForceSetPasswordReason.TdeUserWithoutPasswordHasPasswordResetPermission
    ) {
      /**
       * If inside this block, this is a JIT provisioned user in a MP encryption org setting an initial password.
       * Therefore they will not already have a user asymmetric key pair, and we must create it for them.
       *
       * Sidenote: In the TDE case the user already has a user asymmetric key pair, so we skip this block
       * because we don't want to re-create one.
       */

      // Extra safety check (see description on https://github.com/bitwarden/clients/pull/10180):
      //   In case we have have a local private key and are not sure whether it has been posed to the server,
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
          await this.encryptService.encrypt(existingUserPrivateKey, masterKeyEncryptedUserKey[0]),
        ];
      } else {
        // New key pair
        keyPair = await this.keyService.makeKeyPair(masterKeyEncryptedUserKey[0]);
      }

      keysRequest = new KeysRequest(keyPair[0], keyPair[1].encryptedString);
    }

    const request = new SetPasswordRequest(
      serverMasterKeyHash,
      masterKeyEncryptedUserKey[1].encryptedString,
      hint,
      orgSsoIdentifier,
      keysRequest,
      kdfConfig.kdfType, // kdfConfig is always DEFAULT_KDF_CONFIG (see InputPasswordComponent)
      kdfConfig.iterations,
    );

    await this.masterPasswordApiService.setPassword(request);

    // Clear force set password reason to allow navigation back to vault.
    await this.masterPasswordService.setForceSetPasswordReason(ForceSetPasswordReason.None, userId);

    // User now has a password so update account decryption options in state
    await this.updateAccountDecryptionProperties(
      masterKey,
      kdfConfig,
      masterKeyEncryptedUserKey,
      userId,
    );

    /**
     * Set the private key only for new JIT provisioned users in MP encryption orgs.
     * (Existing TDE users will have their private key set on sync or on login.)
     */
    if (
      keyPair != null &&
      forceSetPasswordReason !=
        ForceSetPasswordReason.TdeUserWithoutPasswordHasPasswordResetPermission
    ) {
      await this.keyService.setPrivateKey(keyPair[1].encryptedString, userId);
    }

    await this.masterPasswordService.setMasterKeyHash(localMasterKeyHash, userId);

    if (resetPasswordAutoEnroll) {
      await this.handleResetPasswordAutoEnroll(serverMasterKeyHash, orgId, userId);
    }
  }

  private async makeProtectedUserKey(
    masterKey: MasterKey,
    userId: UserId,
  ): Promise<[UserKey, EncString]> {
    let protectedUserKey: [UserKey, EncString] = null;

    const userKey = await firstValueFrom(this.keyService.userKey$(userId));

    if (userKey == null) {
      protectedUserKey = await this.keyService.makeUserKey(masterKey);
    } else {
      protectedUserKey = await this.keyService.encryptUserKeyWithMasterKey(masterKey);
    }

    return protectedUserKey;
  }

  private async updateAccountDecryptionProperties(
    masterKey: MasterKey,
    kdfConfig: PBKDF2KdfConfig,
    protectedUserKey: [UserKey, EncString],
    userId: UserId,
  ) {
    const userDecryptionOpts = await firstValueFrom(
      this.userDecryptionOptionsService.userDecryptionOptions$,
    );
    userDecryptionOpts.hasMasterPassword = true;
    await this.userDecryptionOptionsService.setUserDecryptionOptions(userDecryptionOpts);
    await this.kdfConfigService.setKdfConfig(userId, kdfConfig);
    await this.masterPasswordService.setMasterKey(masterKey, userId);
    await this.keyService.setUserKey(protectedUserKey[0], userId);
  }

  private async handleResetPasswordAutoEnroll(
    masterKeyHash: string,
    orgId: string,
    userId: UserId,
  ) {
    const organizationKeys = await this.organizationApiService.getKeys(orgId);

    if (organizationKeys == null) {
      throw new Error(this.i18nService.t("resetPasswordOrgKeysError"));
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

    const resetRequest = new OrganizationUserResetPasswordEnrollmentRequest();
    resetRequest.masterPasswordHash = masterKeyHash;
    resetRequest.resetPasswordKey = orgPublicKeyEncryptedUserKey.encryptedString;

    await this.organizationUserApiService.putOrganizationUserResetPasswordEnrollment(
      orgId,
      userId,
      resetRequest,
    );
  }
}
