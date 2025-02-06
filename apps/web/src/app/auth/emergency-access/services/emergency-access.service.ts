// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Injectable } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { PolicyData } from "@bitwarden/common/admin-console/models/data/policy.data";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { BulkEncryptService } from "@bitwarden/common/key-management/crypto/abstractions/bulk-encrypt.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { EncryptedString, EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  Argon2KdfConfig,
  KdfConfig,
  PBKDF2KdfConfig,
  UserKeyRotationDataProvider,
  KeyService,
  KdfType,
} from "@bitwarden/key-management";

import { EmergencyAccessStatusType } from "../enums/emergency-access-status-type";
import { EmergencyAccessType } from "../enums/emergency-access-type";
import { GranteeEmergencyAccess, GrantorEmergencyAccess } from "../models/emergency-access";
import { EmergencyAccessAcceptRequest } from "../request/emergency-access-accept.request";
import { EmergencyAccessConfirmRequest } from "../request/emergency-access-confirm.request";
import { EmergencyAccessInviteRequest } from "../request/emergency-access-invite.request";
import { EmergencyAccessPasswordRequest } from "../request/emergency-access-password.request";
import {
  EmergencyAccessUpdateRequest,
  EmergencyAccessWithIdRequest,
} from "../request/emergency-access-update.request";

import { EmergencyAccessApiService } from "./emergency-access-api.service";

@Injectable()
export class EmergencyAccessService
  implements UserKeyRotationDataProvider<EmergencyAccessWithIdRequest>
{
  constructor(
    private emergencyAccessApiService: EmergencyAccessApiService,
    private apiService: ApiService,
    private keyService: KeyService,
    private encryptService: EncryptService,
    private bulkEncryptService: BulkEncryptService,
    private cipherService: CipherService,
    private logService: LogService,
    private configService: ConfigService,
  ) {}

  /**
   * Gets an emergency access by id.
   * @param id emergency access id
   */
  getEmergencyAccess(id: string): Promise<GranteeEmergencyAccess> {
    return this.emergencyAccessApiService.getEmergencyAccess(id);
  }

  /**
   * Gets all emergency access that the user has been granted.
   */
  async getEmergencyAccessTrusted(): Promise<GranteeEmergencyAccess[]> {
    return (await this.emergencyAccessApiService.getEmergencyAccessTrusted()).data;
  }

  /**
   * Gets all emergency access that the user has granted.
   */
  async getEmergencyAccessGranted(): Promise<GrantorEmergencyAccess[]> {
    return (await this.emergencyAccessApiService.getEmergencyAccessGranted()).data;
  }

  /**
   * Returns policies that apply to the grantor.
   * Intended for grantee.
   * @param id emergency access id
   */
  async getGrantorPolicies(id: string): Promise<Policy[]> {
    const response = await this.emergencyAccessApiService.getEmergencyGrantorPolicies(id);
    let policies: Policy[];
    if (response.data != null && response.data.length > 0) {
      policies = response.data.map((policyResponse) => new Policy(new PolicyData(policyResponse)));
    }
    return policies;
  }

  /**
   * Invites the email address to be an emergency contact.
   * Step 1 of the 3 step setup flow.
   * Intended for grantor.
   * @param email email address of trusted emergency contact
   * @param type type of emergency access
   * @param waitTimeDays number of days to wait before granting access
   */
  async invite(email: string, type: EmergencyAccessType, waitTimeDays: number): Promise<void> {
    const request = new EmergencyAccessInviteRequest();
    request.email = email.trim();
    request.type = type;
    request.waitTimeDays = waitTimeDays;

    await this.emergencyAccessApiService.postEmergencyAccessInvite(request);
  }

  /**
   * Sends another email for an existing emergency access invitation.
   * Intended for grantor.
   * @param id emergency access id
   */
  reinvite(id: string): Promise<void> {
    return this.emergencyAccessApiService.postEmergencyAccessReinvite(id);
  }

  /**
   * Edits an existing emergency access.
   * Intended for grantor.
   * @param id emergency access id
   * @param type type of emergency access
   * @param waitTimeDays number of days to wait before granting access
   */
  async update(id: string, type: EmergencyAccessType, waitTimeDays: number) {
    const request = new EmergencyAccessUpdateRequest();
    request.type = type;
    request.waitTimeDays = waitTimeDays;

    await this.emergencyAccessApiService.putEmergencyAccess(id, request);
  }

  /**
   * Accepts an emergency access invitation.
   * Step 2 of the 3 step setup flow.
   * Intended for grantee.
   * @param id emergency access id
   * @param token secret token provided in email
   */
  async accept(id: string, token: string): Promise<void> {
    const request = new EmergencyAccessAcceptRequest();
    request.token = token;

    await this.emergencyAccessApiService.postEmergencyAccessAccept(id, request);
  }

  /**
   * Encrypts user key with grantee's public key and sends to bitwarden.
   * Step 3 of the 3 step setup flow.
   * Intended for grantor.
   * @param id emergency access id
   * @param token secret token provided in email
   * @param publicKey public key of grantee
   */
  async confirm(id: string, granteeId: string, publicKey: Uint8Array): Promise<void> {
    const userKey = await this.keyService.getUserKey();
    if (!userKey) {
      throw new Error("No user key found");
    }

    try {
      this.logService.debug(
        "User's fingerprint: " +
          (await this.keyService.getFingerprint(granteeId, publicKey)).join("-"),
      );
    } catch {
      // Ignore errors since it's just a debug message
    }

    const request = new EmergencyAccessConfirmRequest();
    request.key = await this.encryptKey(userKey, publicKey);
    await this.emergencyAccessApiService.postEmergencyAccessConfirm(id, request);
  }

  /**
   * Deletes an existing emergency access.
   * Intended for either grantor or grantee.
   * @param id emergency access id
   */
  delete(id: string): Promise<void> {
    return this.emergencyAccessApiService.deleteEmergencyAccess(id);
  }

  /**
   * Requests access to grantor's vault.
   * Intended for grantee.
   * @param id emergency access id
   */
  requestAccess(id: string): Promise<void> {
    return this.emergencyAccessApiService.postEmergencyAccessInitiate(id);
  }

  /**
   * Approves access to grantor's vault.
   * Intended for grantor.
   * @param id emergency access id
   */
  approve(id: string): Promise<void> {
    return this.emergencyAccessApiService.postEmergencyAccessApprove(id);
  }

  /**
   * Rejects access to grantor's vault.
   * Intended for grantor.
   * @param id emergency access id
   */
  reject(id: string): Promise<void> {
    return this.emergencyAccessApiService.postEmergencyAccessReject(id);
  }

  /**
   * Gets the grantor ciphers for an emergency access in view mode.
   * Intended for grantee.
   * @param id emergency access id
   */
  async getViewOnlyCiphers(id: string): Promise<CipherView[]> {
    const response = await this.emergencyAccessApiService.postEmergencyAccessView(id);

    const activeUserPrivateKey = await this.keyService.getPrivateKey();

    if (activeUserPrivateKey == null) {
      throw new Error("Active user does not have a private key, cannot get view only ciphers.");
    }

    const grantorKeyBuffer = await this.encryptService.rsaDecrypt(
      new EncString(response.keyEncrypted),
      activeUserPrivateKey,
    );
    const grantorUserKey = new SymmetricCryptoKey(grantorKeyBuffer) as UserKey;

    let ciphers: CipherView[] = [];
    if (await this.configService.getFeatureFlag(FeatureFlag.PM4154_BulkEncryptionService)) {
      ciphers = await this.bulkEncryptService.decryptItems(
        response.ciphers.map((c) => new Cipher(c)),
        grantorUserKey,
      );
    } else {
      ciphers = await this.encryptService.decryptItems(
        response.ciphers.map((c) => new Cipher(c)),
        grantorUserKey,
      );
    }
    return ciphers.sort(this.cipherService.getLocaleSortingFunction());
  }

  /**
   * Changes the password for an emergency access.
   * Intended for grantee.
   * @param id emergency access id
   * @param masterPassword new master password
   * @param email email address of grantee (must be consistent or login will fail)
   */
  async takeover(id: string, masterPassword: string, email: string) {
    const takeoverResponse = await this.emergencyAccessApiService.postEmergencyAccessTakeover(id);

    const activeUserPrivateKey = await this.keyService.getPrivateKey();

    if (activeUserPrivateKey == null) {
      throw new Error("Active user does not have a private key, cannot complete a takeover.");
    }

    const grantorKeyBuffer = await this.encryptService.rsaDecrypt(
      new EncString(takeoverResponse.keyEncrypted),
      activeUserPrivateKey,
    );
    if (grantorKeyBuffer == null) {
      throw new Error("Failed to decrypt grantor key");
    }

    const grantorUserKey = new SymmetricCryptoKey(grantorKeyBuffer) as UserKey;

    let config: KdfConfig;

    switch (takeoverResponse.kdf) {
      case KdfType.PBKDF2_SHA256:
        config = new PBKDF2KdfConfig(takeoverResponse.kdfIterations);
        break;
      case KdfType.Argon2id:
        config = new Argon2KdfConfig(
          takeoverResponse.kdfIterations,
          takeoverResponse.kdfMemory,
          takeoverResponse.kdfParallelism,
        );
        break;
    }

    const masterKey = await this.keyService.makeMasterKey(masterPassword, email, config);
    const masterKeyHash = await this.keyService.hashMasterKey(masterPassword, masterKey);

    const encKey = await this.keyService.encryptUserKeyWithMasterKey(masterKey, grantorUserKey);

    const request = new EmergencyAccessPasswordRequest();
    request.newMasterPasswordHash = masterKeyHash;
    request.key = encKey[1].encryptedString;

    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.emergencyAccessApiService.postEmergencyAccessPassword(id, request);
  }

  /**
   * Returns existing emergency access keys re-encrypted with new user key.
   * Intended for grantor.
   * @param originalUserKey the original user key
   * @param newUserKey the new user key
   * @param userId the user id
   * @throws Error if newUserKey is nullish
   * @returns an array of re-encrypted emergency access requests or an empty array if there are no requests
   */
  async getRotatedData(
    originalUserKey: UserKey,
    newUserKey: UserKey,
    userId: UserId,
  ): Promise<EmergencyAccessWithIdRequest[]> {
    if (newUserKey == null) {
      throw new Error("New user key is required for rotation.");
    }

    const requests: EmergencyAccessWithIdRequest[] = [];
    const existingEmergencyAccess =
      await this.emergencyAccessApiService.getEmergencyAccessTrusted();

    if (!existingEmergencyAccess || existingEmergencyAccess.data.length === 0) {
      return requests;
    }

    // Any Invited or Accepted requests won't have the key yet, so we don't need to update them
    const allowedStatuses = new Set([
      EmergencyAccessStatusType.Confirmed,
      EmergencyAccessStatusType.RecoveryInitiated,
      EmergencyAccessStatusType.RecoveryApproved,
    ]);
    const filteredAccesses = existingEmergencyAccess.data.filter((d) =>
      allowedStatuses.has(d.status),
    );

    for (const details of filteredAccesses) {
      // Get public key of grantee
      const publicKeyResponse = await this.apiService.getUserPublicKey(details.granteeId);
      const publicKey = Utils.fromB64ToArray(publicKeyResponse.publicKey);

      // Encrypt new user key with public key
      const encryptedKey = await this.encryptKey(newUserKey, publicKey);

      const updateRequest = new EmergencyAccessWithIdRequest();
      updateRequest.id = details.id;
      updateRequest.type = details.type;
      updateRequest.waitTimeDays = details.waitTimeDays;
      updateRequest.keyEncrypted = encryptedKey;
      requests.push(updateRequest);
    }
    return requests;
  }

  private async encryptKey(userKey: UserKey, publicKey: Uint8Array): Promise<EncryptedString> {
    return (await this.encryptService.rsaEncrypt(userKey.key, publicKey)).encryptedString;
  }
}
