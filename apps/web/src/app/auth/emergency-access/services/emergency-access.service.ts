import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { PolicyData } from "@bitwarden/common/admin-console/models/data/policy.data";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import {
  EncryptedString,
  EncString,
} from "@bitwarden/common/key-management/crypto/models/enc-string";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  Argon2KdfConfig,
  KdfConfig,
  PBKDF2KdfConfig,
  KeyService,
  KdfType,
  UserKeyRotationKeyRecoveryProvider,
} from "@bitwarden/key-management";

import { EmergencyAccessStatusType } from "../enums/emergency-access-status-type";
import { EmergencyAccessType } from "../enums/emergency-access-type";
import {
  GranteeEmergencyAccess,
  GranteeEmergencyAccessWithPublicKey,
  GrantorEmergencyAccess,
} from "../models/emergency-access";
import { EmergencyAccessAcceptRequest } from "../request/emergency-access-accept.request";
import { EmergencyAccessConfirmRequest } from "../request/emergency-access-confirm.request";
import { EmergencyAccessInviteRequest } from "../request/emergency-access-invite.request";
import { EmergencyAccessPasswordRequest } from "../request/emergency-access-password.request";
import {
  EmergencyAccessUpdateRequest,
  EmergencyAccessWithIdRequest,
} from "../request/emergency-access-update.request";
import { EmergencyAccessGranteeDetailsResponse } from "../response/emergency-access.response";

import { EmergencyAccessApiService } from "./emergency-access-api.service";

@Injectable()
export class EmergencyAccessService
  implements
    UserKeyRotationKeyRecoveryProvider<
      EmergencyAccessWithIdRequest,
      GranteeEmergencyAccessWithPublicKey
    >
{
  constructor(
    private emergencyAccessApiService: EmergencyAccessApiService,
    private apiService: ApiService,
    private keyService: KeyService,
    private encryptService: EncryptService,
    private cipherService: CipherService,
    private logService: LogService,
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
    const listResponse = await this.emergencyAccessApiService.getEmergencyAccessTrusted();
    if (!listResponse || listResponse.data.length === 0) {
      return [];
    }
    return listResponse.data.map((response) => GranteeEmergencyAccess.fromResponse(response));
  }

  /**
   * Gets all emergency access that the user has granted.
   */
  async getEmergencyAccessGranted(): Promise<GrantorEmergencyAccess[]> {
    const listResponse = await this.emergencyAccessApiService.getEmergencyAccessGranted();
    if (!listResponse || listResponse.data.length === 0) {
      return [];
    }
    return listResponse.data.map((response) => GrantorEmergencyAccess.fromResponse(response));
  }

  /**
   * Returns policies that apply to the grantor if the grantor is the owner of an org, otherwise returns null.
   * Intended for grantee.
   * @param id emergency access id
   *
   * @remarks
   * The ONLY time the API call will return an array of policies is when the Grantor is the OWNER
   * of an organization. In all other scenarios the server returns null. Even if the Grantor
   * is the member of an org that has enforced MP policies, the server will still return null
   * because in the Emergency Access Takeover process, the Grantor gets removed from the org upon
   * takeover, and therefore the MP policies are irrelevant.
   *
   * The only scenario where a Grantor does NOT get removed from the org is when that Grantor is the
   * OWNER of the org. In that case the server returns Grantor policies and we enforce them on the client.
   */
  async getGrantorPolicies(id: string): Promise<Policy[]> {
    const response = await this.emergencyAccessApiService.getEmergencyGrantorPolicies(id);
    let policies: Policy[] = [];
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
   * @param granteeId id of the grantee
   * @param publicKey public key of grantee
   * @param activeUserId the active user's id
   */
  async confirm(
    id: string,
    granteeId: string,
    publicKey: Uint8Array,
    activeUserId: UserId,
  ): Promise<void> {
    const userKey = await firstValueFrom(this.keyService.userKey$(activeUserId));
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
   * @param activeUserId the user id of the active user
   */
  async getViewOnlyCiphers(id: string, activeUserId: UserId): Promise<CipherView[]> {
    const response = await this.emergencyAccessApiService.postEmergencyAccessView(id);

    const activeUserPrivateKey = await firstValueFrom(
      this.keyService.userPrivateKey$(activeUserId),
    );

    if (activeUserPrivateKey == null) {
      throw new Error("Active user does not have a private key, cannot get view only ciphers.");
    }

    const grantorUserKey = (await this.encryptService.decapsulateKeyUnsigned(
      new EncString(response.keyEncrypted),
      activeUserPrivateKey,
    )) as UserKey;

    let ciphers: CipherView[] = [];
    const ciphersEncrypted = response.ciphers.map((c) => new Cipher(c));
    ciphers = await Promise.all(ciphersEncrypted.map(async (c) => c.decrypt(grantorUserKey)));
    return ciphers.sort(this.cipherService.getLocaleSortingFunction());
  }

  /**
   * Changes the password for an emergency access.
   * Intended for grantee.
   * @param id emergency access id
   * @param masterPassword new master password
   * @param email email address of grantee (must be consistent or login will fail)
   * @param activeUserId the user id of the active user
   */
  async takeover(id: string, masterPassword: string, email: string, activeUserId: UserId) {
    const takeoverResponse = await this.emergencyAccessApiService.postEmergencyAccessTakeover(id);

    const activeUserPrivateKey = await firstValueFrom(
      this.keyService.userPrivateKey$(activeUserId),
    );

    if (activeUserPrivateKey == null) {
      throw new Error("Active user does not have a private key, cannot complete a takeover.");
    }

    const grantorKey = await this.encryptService.decapsulateKeyUnsigned(
      new EncString(takeoverResponse.keyEncrypted),
      activeUserPrivateKey,
    );
    if (grantorKey == null) {
      throw new Error("Failed to decrypt grantor key");
    }

    const grantorUserKey = grantorKey as UserKey;

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

    if (encKey == null || !encKey[1].encryptedString) {
      throw new Error("masterKeyEncryptedUserKey not found");
    }

    const request = new EmergencyAccessPasswordRequest();
    request.newMasterPasswordHash = masterKeyHash;
    request.key = encKey[1].encryptedString;

    await this.emergencyAccessApiService.postEmergencyAccessPassword(id, request);
  }

  private async getEmergencyAccessData(): Promise<EmergencyAccessGranteeDetailsResponse[]> {
    const existingEmergencyAccess =
      await this.emergencyAccessApiService.getEmergencyAccessTrusted();

    if (!existingEmergencyAccess || existingEmergencyAccess.data.length === 0) {
      return [];
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

    return filteredAccesses;
  }

  async getPublicKeys(): Promise<GranteeEmergencyAccessWithPublicKey[]> {
    const emergencyAccessData = await this.getEmergencyAccessData();
    const emergencyAccessDataWithPublicKeys = await Promise.all(
      emergencyAccessData.map(async (details) => {
        const grantee = new GranteeEmergencyAccessWithPublicKey();
        grantee.id = details.id;
        grantee.granteeId = details.granteeId;
        grantee.name = details.name;
        grantee.email = details.email;
        grantee.type = details.type;
        grantee.status = details.status;
        grantee.waitTimeDays = details.waitTimeDays;
        grantee.creationDate = details.creationDate;
        grantee.avatarColor = details.avatarColor;
        grantee.publicKey = Utils.fromB64ToArray(
          (await this.apiService.getUserPublicKey(details.granteeId)).publicKey,
        );
        return grantee;
      }),
    );

    return emergencyAccessDataWithPublicKeys;
  }

  /**
   * Returns existing emergency access keys re-encrypted with new user key.
   * Intended for grantor.
   * @param newUserKey the new user key
   * @param trustedPublicKeys the public keys of the emergency access grantors. These *must* be trusted somehow, and MUST NOT be passed in untrusted
   * @param userId the user id
   * @throws Error if newUserKey is nullish
   * @returns an array of re-encrypted emergency access requests or an empty array if there are no requests
   */
  async getRotatedData(
    newUserKey: UserKey,
    trustedPublicKeys: Uint8Array[],
    userId: UserId,
  ): Promise<EmergencyAccessWithIdRequest[]> {
    if (newUserKey == null) {
      throw new Error("New user key is required for rotation.");
    }

    const requests: EmergencyAccessWithIdRequest[] = [];

    this.logService.info(
      "Starting emergency access rotation, with trusted keys: ",
      trustedPublicKeys,
    );

    const allDetails = await this.getPublicKeys();
    for (const details of allDetails) {
      if (
        trustedPublicKeys.find(
          (pk) => Utils.fromBufferToHex(pk) === Utils.fromBufferToHex(details.publicKey),
        ) == null
      ) {
        this.logService.info(
          `Public key for user ${details.granteeId} is not trusted, skipping rotation.`,
        );
        throw new Error("Public key for user is not trusted.");
      }

      // Encrypt new user key with public key
      const encryptedKey = await this.encryptKey(newUserKey, details.publicKey);

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
    const publicKeyEncryptedUserKey = await this.encryptService.encapsulateKeyUnsigned(
      userKey,
      publicKey,
    );

    if (publicKeyEncryptedUserKey == null || !publicKeyEncryptedUserKey.encryptedString) {
      throw new Error("publicKeyEncryptedUserKey not found");
    }

    return publicKeyEncryptedUserKey.encryptedString;
  }
}
