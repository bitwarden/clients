// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import {
  OrganizationUserApiService,
  OrganizationUserResetPasswordRequest,
  OrganizationUserResetPasswordWithIdRequest,
} from "@bitwarden/admin-console/common";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { EncryptedString, EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import {
  Argon2KdfConfig,
  KdfConfig,
  PBKDF2KdfConfig,
  UserKeyRotationDataProvider,
  KeyService,
  KdfType,
} from "@bitwarden/key-management";

@Injectable({
  providedIn: "root",
})
export class OrganizationUserResetPasswordService
  implements UserKeyRotationDataProvider<OrganizationUserResetPasswordWithIdRequest>
{
  constructor(
    private keyService: KeyService,
    private encryptService: EncryptService,
    private organizationService: OrganizationService,
    private organizationUserApiService: OrganizationUserApiService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private i18nService: I18nService,
  ) {}

  /**
   * Returns the user key encrypted by the organization's public key.
   * Intended for use in enrollment
   * @param orgId desired organization
   */
  async buildRecoveryKey(orgId: string, userKey?: UserKey): Promise<EncryptedString> {
    // Retrieve Public Key
    const orgKeys = await this.organizationApiService.getKeys(orgId);
    if (orgKeys == null) {
      throw new Error(this.i18nService.t("resetPasswordOrgKeysError"));
    }

    const publicKey = Utils.fromB64ToArray(orgKeys.publicKey);

    // RSA Encrypt user key with organization's public key
    userKey ??= await this.keyService.getUserKey();
    if (userKey == null) {
      throw new Error("No user key found");
    }
    const encryptedKey = await this.encryptService.rsaEncrypt(userKey.key, publicKey);

    return encryptedKey.encryptedString;
  }

  /**
   * Sets a user's master password through account recovery.
   * Intended for organization admins
   * @param newMasterPassword user's new master password
   * @param email user's email
   * @param orgUserId organization user's id
   * @param orgId organization id
   */
  async resetMasterPassword(
    newMasterPassword: string,
    email: string,
    orgUserId: string,
    orgId: string,
  ): Promise<void> {
    const response = await this.organizationUserApiService.getOrganizationUserResetPasswordDetails(
      orgId,
      orgUserId,
    );

    if (response == null) {
      throw new Error(this.i18nService.t("resetPasswordDetailsError"));
    }

    // Decrypt Organization's encrypted Private Key with org key
    const orgSymKey = await this.keyService.getOrgKey(orgId);
    if (orgSymKey == null) {
      throw new Error("No org key found");
    }
    const decPrivateKey = await this.encryptService.decryptToBytes(
      new EncString(response.encryptedPrivateKey),
      orgSymKey,
    );

    // Decrypt User's Reset Password Key to get UserKey
    const decValue = await this.encryptService.rsaDecrypt(
      new EncString(response.resetPasswordKey),
      decPrivateKey,
    );
    const existingUserKey = new SymmetricCryptoKey(decValue) as UserKey;

    // determine Kdf Algorithm
    const kdfConfig: KdfConfig =
      response.kdf === KdfType.PBKDF2_SHA256
        ? new PBKDF2KdfConfig(response.kdfIterations)
        : new Argon2KdfConfig(response.kdfIterations, response.kdfMemory, response.kdfParallelism);

    // Create new master key and hash new password
    const newMasterKey = await this.keyService.makeMasterKey(
      newMasterPassword,
      email.trim().toLowerCase(),
      kdfConfig,
    );
    const newMasterKeyHash = await this.keyService.hashMasterKey(newMasterPassword, newMasterKey);

    // Create new encrypted user key for the User
    const newUserKey = await this.keyService.encryptUserKeyWithMasterKey(
      newMasterKey,
      existingUserKey,
    );

    // Create request
    const request = new OrganizationUserResetPasswordRequest();
    request.key = newUserKey[1].encryptedString;
    request.newMasterPasswordHash = newMasterKeyHash;

    // Change user's password
    await this.organizationUserApiService.putOrganizationUserResetPassword(
      orgId,
      orgUserId,
      request,
    );
  }

  /**
   * Returns existing account recovery keys re-encrypted with the new user key.
   * @param originalUserKey the original user key
   * @param newUserKey the new user key
   * @param userId the user id
   * @throws Error if new user key is null
   * @returns a list of account recovery keys that have been re-encrypted with the new user key
   */
  async getRotatedData(
    originalUserKey: UserKey,
    newUserKey: UserKey,
    userId: UserId,
  ): Promise<OrganizationUserResetPasswordWithIdRequest[] | null> {
    if (newUserKey == null) {
      throw new Error("New user key is required for rotation.");
    }

    const allOrgs = await firstValueFrom(this.organizationService.organizations$(userId));

    if (!allOrgs) {
      return;
    }

    const requests: OrganizationUserResetPasswordWithIdRequest[] = [];
    for (const org of allOrgs) {
      // If not already enrolled, skip
      if (!org.resetPasswordEnrolled) {
        continue;
      }

      // Re-enroll - encrypt user key with organization public key
      const encryptedKey = await this.buildRecoveryKey(org.id, newUserKey);

      // Create/Execute request
      const request = new OrganizationUserResetPasswordWithIdRequest();
      request.organizationId = org.id;
      request.resetPasswordKey = encryptedKey;
      request.masterPasswordHash = "ignored";

      requests.push(request);
    }
    return requests;
  }
}
