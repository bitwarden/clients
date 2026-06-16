import { Injectable } from "@angular/core";
import { firstValueFrom, map, switchMap } from "rxjs";

import {
  OrganizationUserApiService,
  OrganizationUserResetPasswordRequest,
  OrganizationUserResetPasswordWithIdRequest,
} from "@bitwarden/admin-console/common";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import {
  EncryptedString,
  EncString,
} from "@bitwarden/common/key-management/crypto/models/enc-string";
import { MasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { MasterPasswordSalt } from "@bitwarden/common/key-management/master-password/types/master-password.types";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import {
  Argon2KdfConfig,
  KdfConfig,
  PBKDF2KdfConfig,
  UserKeyRotationKeyRecoveryProvider,
  KeyService,
  KdfType,
} from "@bitwarden/key-management";

import { OrganizationUserResetPasswordEntry } from "./organization-user-reset-password-entry";

export type RecoverAccountRequest = {
  organizationUserId: string;
  organizationId: OrganizationId;
  resetMasterPassword: boolean;
  resetTwoFactor: boolean;
  /** Required when resetMasterPassword is true */
  newMasterPassword?: string;
  /** Required when resetMasterPassword is true */
  email?: string;
};

@Injectable({
  providedIn: "root",
})
export class OrganizationUserResetPasswordService implements UserKeyRotationKeyRecoveryProvider<
  OrganizationUserResetPasswordWithIdRequest,
  OrganizationUserResetPasswordEntry
> {
  constructor(
    private keyService: KeyService,
    private encryptService: EncryptService,
    private organizationService: OrganizationService,
    private organizationUserApiService: OrganizationUserApiService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private i18nService: I18nService,
    private accountService: AccountService,
    private masterPasswordService: MasterPasswordServiceAbstraction,
  ) {}

  /**
   * Builds a recovery key for a user to recover their account.
   *
   * @param orgId desired organization
   * @param userKey user key
   * @param trustedPublicKeys public keys of organizations that the user trusts
   */
  async buildRecoveryKey(
    orgId: string,
    userKey: UserKey,
    trustedPublicKeys: Uint8Array[],
  ): Promise<EncryptedString | undefined> {
    if (userKey == null) {
      throw new Error("User key is required for recovery.");
    }

    // Retrieve Public Key
    const orgKeys = await this.organizationApiService.getKeys(orgId);
    if (orgKeys == null) {
      throw new Error(this.i18nService.t("resetPasswordOrgKeysError"));
    }

    const publicKey = Utils.fromB64ToArray(orgKeys.publicKey);

    if (
      !trustedPublicKeys.some(
        (key) => Utils.fromArrayToHex(key) === Utils.fromArrayToHex(publicKey),
      )
    ) {
      throw new Error("Untrusted public key");
    }

    // RSA Encrypt user key with organization's public key
    const encryptedKey = await this.encryptService.encapsulateKeyUnsigned(userKey, publicKey);

    return encryptedKey.encryptedString;
  }

  /**
   * Recovers an organization user's account by optionally resetting their master password
   * and/or two-step login.
   */
  async recoverAccount(request: RecoverAccountRequest): Promise<void> {
    let newMasterPasswordHash: string | undefined;
    let key: string | undefined;

    if (request.resetMasterPassword) {
      const newMasterPassword = request.newMasterPassword;
      if (Utils.isNullOrWhitespace(newMasterPassword) || newMasterPassword == undefined) {
        throw new Error(this.i18nService.t("resetPasswordNewPasswordRequired"));
      }

      const email = request.email;
      if (Utils.isNullOrWhitespace(email) || email == undefined) {
        throw new Error(this.i18nService.t("emailRequired"));
      }

      const resetPasswordDetails =
        await this.organizationUserApiService.getOrganizationUserResetPasswordDetails(
          request.organizationId,
          request.organizationUserId,
        );

      if (resetPasswordDetails == null) {
        throw new Error(this.i18nService.t("resetPasswordDetailsError"));
      }

      const kdfConfig = this.buildKdfConfig(resetPasswordDetails);
      const existingUserKey = await this.decryptUserKey(
        resetPasswordDetails,
        request.organizationId,
      );
      // Prefer server-provided salt; fallback to normalized email for legacy servers
      // that don't yet return MasterPasswordSalt in the account-recovery details response.
      // TODO: PM-32059 — When salt is disconnected from email (Stage 3) we will no longer fall back to email.
      const salt: MasterPasswordSalt =
        typeof resetPasswordDetails.masterPasswordSalt === "string"
          ? (resetPasswordDetails.masterPasswordSalt as MasterPasswordSalt)
          : this.masterPasswordService.emailToSalt(email);

      ({ newMasterPasswordHash, key } = await this.buildResetPasswordRequest(
        newMasterPassword,
        salt,
        kdfConfig,
        existingUserKey,
      ));
    }

    await this.organizationUserApiService.putOrganizationUserRecoverAccount(
      request.organizationId,
      request.organizationUserId,
      new OrganizationUserResetPasswordRequest(
        request.resetMasterPassword,
        request.resetTwoFactor,
        newMasterPasswordHash,
        key,
      ),
    );
  }

  /**
   * Sets a user's master password through account recovery.
   * Intended for organization admins.
   *
   * @deprecated Use `recoverAccount` instead.
   */
  async resetMasterPassword(
    newMasterPassword: string,
    email: string,
    orgUserId: string,
    orgId: OrganizationId,
  ): Promise<void> {
    return this.recoverAccount({
      organizationUserId: orgUserId,
      organizationId: orgId,
      resetMasterPassword: true,
      resetTwoFactor: false,
      newMasterPassword,
      email,
    });
  }

  async getPublicKeys(userId: UserId): Promise<OrganizationUserResetPasswordEntry[]> {
    const allOrgs = (await firstValueFrom(this.organizationService.organizations$(userId))).filter(
      (org) => org.resetPasswordEnrolled,
    );

    const entries: OrganizationUserResetPasswordEntry[] = [];
    for (const org of allOrgs) {
      const publicKey = await this.organizationApiService.getKeys(org.id);
      const encodedPublicKey = Utils.fromB64ToArray(publicKey.publicKey);
      const entry = new OrganizationUserResetPasswordEntry(org.id, encodedPublicKey, org.name);
      entries.push(entry);
    }
    return entries;
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
    newUserKey: UserKey,
    trustedPublicKeys: Uint8Array[],
    userId: UserId,
  ): Promise<OrganizationUserResetPasswordWithIdRequest[]> {
    if (newUserKey == null) {
      throw new Error("New user key is required for rotation.");
    }

    const allOrgs = await firstValueFrom(this.organizationService.organizations$(userId));
    if (!allOrgs) {
      throw new Error("Could not get organizations");
    }

    const requests: OrganizationUserResetPasswordWithIdRequest[] = [];
    for (const org of allOrgs) {
      // If not already enrolled, skip
      if (!org.resetPasswordEnrolled) {
        continue;
      }

      // Re-enroll - encrypt user key with organization public key
      const encryptedKey = await this.buildRecoveryKey(org.id, newUserKey, trustedPublicKeys);

      // Create/Execute request
      const request = new OrganizationUserResetPasswordWithIdRequest(org.id);
      request.resetPasswordKey = encryptedKey;
      request.masterPasswordHash = "ignored";

      requests.push(request);
    }
    return requests;
  }

  /** Constructs the appropriate KDF config from reset password details response. */
  private buildKdfConfig(response: {
    kdf: KdfType;
    kdfIterations: number;
    kdfMemory?: number;
    kdfParallelism?: number;
  }): KdfConfig {
    switch (response.kdf) {
      case KdfType.PBKDF2_SHA256:
        return new PBKDF2KdfConfig(response.kdfIterations);
      case KdfType.Argon2id:
        if (response.kdfMemory == null || response.kdfParallelism == null) {
          throw new Error("Invalid KDF configuration");
        }
        return new Argon2KdfConfig(
          response.kdfIterations,
          response.kdfMemory,
          response.kdfParallelism,
        );
      default:
        throw new Error("Unsupported KDF type");
    }
  }

  /** Decrypts the user's UserKey using the organization's private key and the stored reset password key. */
  private async decryptUserKey(
    response: { encryptedPrivateKey: string; resetPasswordKey: string },
    orgId: OrganizationId,
  ): Promise<UserKey> {
    const orgSymKey = await firstValueFrom(
      this.accountService.activeAccount$.pipe(
        getUserId,
        switchMap((userId) => this.keyService.orgKeys$(userId)),
        map((orgKeys) => orgKeys?.[orgId as OrganizationId] ?? null),
      ),
    );

    if (orgSymKey == null) {
      throw new Error("No org key found");
    }

    const decPrivateKey = await this.encryptService.unwrapDecapsulationKey(
      new EncString(response.encryptedPrivateKey),
      orgSymKey,
    );

    return (await this.encryptService.decapsulateKeyUnsigned(
      new EncString(response.resetPasswordKey),
      decPrivateKey,
    )) as UserKey;
  }

  private async buildResetPasswordRequest(
    newMasterPassword: string,
    salt: MasterPasswordSalt,
    kdfConfig: KdfConfig,
    existingUserKey: UserKey,
  ): Promise<Pick<OrganizationUserResetPasswordRequest, "newMasterPasswordHash" | "key">> {
    const authenticationData =
      await this.masterPasswordService.makeMasterPasswordAuthenticationData(
        newMasterPassword,
        kdfConfig,
        salt,
      );

    const unlockData = await this.masterPasswordService.makeMasterPasswordUnlockData(
      newMasterPassword,
      kdfConfig,
      salt,
      existingUserKey,
    );

    return {
      newMasterPasswordHash: authenticationData.masterPasswordAuthenticationHash,
      key: unlockData.masterKeyWrappedUserKey,
    };
  }
}
