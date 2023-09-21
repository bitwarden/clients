import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationUserService } from "@bitwarden/common/abstractions/organization-user/organization-user.service";
import { OrganizationUserResetPasswordEnrollmentRequest } from "@bitwarden/common/abstractions/organization-user/requests";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { EmergencyAccessStatusType } from "@bitwarden/common/auth/enums/emergency-access-status-type";
import { EmergencyAccessUpdateRequest } from "@bitwarden/common/auth/models/request/emergency-access-update.request";
import { UpdateKeyRequest } from "@bitwarden/common/models/request/update-key.request";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { EncryptedString, EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { UserKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { SendWithIdRequest } from "@bitwarden/common/tools/send/models/request/send-with-id.request";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { CipherWithIdRequest } from "@bitwarden/common/vault/models/request/cipher-with-id.request";
import { FolderWithIdRequest } from "@bitwarden/common/vault/models/request/folder-with-id.request";

// TODO: PM-3797 - This service should be expanded and used for user key rotations in change-password.component.ts
@Injectable()
export class MigrateFromLegacyEncryptionService {
  constructor(
    private organizationService: OrganizationService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private organizationUserService: OrganizationUserService,
    private apiService: ApiService,
    private cryptoService: CryptoService,
    private encryptService: EncryptService,
    private syncService: SyncService,
    private cipherService: CipherService,
    private folderService: FolderService,
    private sendService: SendService,
    private stateService: StateService
  ) {}

  /**
   * Validates the master password and creates a new user key.
   * @returns A new user key along with the encrypted version
   */
  async createNewUserKey(masterPassword: string): Promise<[UserKey, EncString]> {
    // Create master key to validate the master password
    const masterKey = await this.cryptoService.makeMasterKey(
      masterPassword,
      await this.stateService.getEmail(),
      await this.stateService.getKdfType(),
      await this.stateService.getKdfConfig()
    );

    if (!masterKey) {
      throw new Error("Invalid master password");
    }

    if (!(await this.cryptoService.isLegacyUser(masterKey))) {
      throw new Error("Invalid master password or user may not be legacy");
    }

    // Set master key again in case it was lost (could be lost on refresh)
    await this.cryptoService.setMasterKey(masterKey);
    return await this.cryptoService.makeUserKey(masterKey);
  }

  /**
   * Updates the user key, master key hash, private key, folders, ciphers, and sends
   * on the server.
   * @param masterPassword The master password
   * @param newUserKey The new user key
   * @param newEncUserKey The new encrypted user key
   */
  async updateKeysAndEncryptedData(
    masterPassword: string,
    newUserKey: UserKey,
    newEncUserKey: EncString
  ): Promise<void> {
    // Create new request and add master key and hash
    const request = new UpdateKeyRequest();
    request.key = newEncUserKey.encryptedString;
    request.masterPasswordHash = await this.cryptoService.hashMasterKey(
      masterPassword,
      await this.cryptoService.getOrDeriveMasterKey(masterPassword)
    );

    // Sync before encrypting to make sure we have latest data
    await this.syncService.fullSync(true);

    request.privateKey = await this.encryptPrivateKey(newUserKey);
    request.folders = await this.encryptFolders(newUserKey);
    request.ciphers = await this.encryptCiphers(newUserKey);
    request.sends = await this.encryptSends(newUserKey);

    return this.apiService.postAccountKey(request);
  }

  /**
   * Gets user's emergency access details from server and encrypts with new user key
   * on the server.
   * @param newUserKey The new user key
   */
  async updateEmergencyAccesses(newUserKey: UserKey) {
    const emergencyAccess = await this.apiService.getEmergencyAccessTrusted();
    // Any Invited or Accepted requests won't have the key yet, so we don't need to update them
    const allowedStatuses = new Set([
      EmergencyAccessStatusType.Confirmed,
      EmergencyAccessStatusType.RecoveryInitiated,
      EmergencyAccessStatusType.RecoveryApproved,
    ]);
    const filteredAccesses = emergencyAccess.data.filter((d) => allowedStatuses.has(d.status));

    for (const details of filteredAccesses) {
      // Get public key of grantee
      const publicKeyResponse = await this.apiService.getUserPublicKey(details.granteeId);
      const publicKey = Utils.fromB64ToArray(publicKeyResponse.publicKey);

      // Encrypt new user key with public key
      const encryptedKey = await this.cryptoService.rsaEncrypt(newUserKey.key, publicKey);

      const updateRequest = new EmergencyAccessUpdateRequest();
      updateRequest.type = details.type;
      updateRequest.waitTimeDays = details.waitTimeDays;
      updateRequest.keyEncrypted = encryptedKey.encryptedString;

      await this.apiService.putEmergencyAccess(details.id, updateRequest);
    }
  }

  /** Updates all admin recovery keys on the server with the new user key
   * @param masterPassword The user's master password
   * @param newUserKey The new user key
   */
  async updateAllAdminRecoveryKeys(masterPassword: string, newUserKey: UserKey) {
    const allOrgs = await this.organizationService.getAll();

    for (const org of allOrgs) {
      // If not already enrolled, skip
      if (!org.resetPasswordEnrolled) {
        continue;
      }

      // Retrieve public key
      const response = await this.organizationApiService.getKeys(org.id);
      const publicKey = Utils.fromB64ToArray(response?.publicKey);

      // Re-enroll - encrypt user key with organization public key
      const encryptedKey = await this.cryptoService.rsaEncrypt(newUserKey.key, publicKey);

      // Create/Execute request
      const request = new OrganizationUserResetPasswordEnrollmentRequest();
      request.resetPasswordKey = encryptedKey.encryptedString;
      request.masterPasswordHash = await this.cryptoService.hashMasterKey(
        masterPassword,
        await this.cryptoService.getOrDeriveMasterKey(masterPassword)
      );

      await this.organizationUserService.putOrganizationUserResetPasswordEnrollment(
        org.id,
        org.userId,
        request
      );
    }
  }

  private async encryptPrivateKey(newUserKey: UserKey): Promise<EncryptedString | null> {
    const privateKey = await this.cryptoService.getPrivateKey();
    if (!privateKey) {
      return;
    }
    return (await this.encryptService.encrypt(privateKey, newUserKey)).encryptedString;
  }

  private async encryptFolders(newUserKey: UserKey): Promise<FolderWithIdRequest[] | null> {
    const folders = await firstValueFrom(this.folderService.folderViews$);
    if (!folders) {
      return;
    }
    return await Promise.all(
      folders.map(async (folder) => {
        const encryptedFolder = await this.folderService.encrypt(folder, newUserKey);
        return new FolderWithIdRequest(encryptedFolder);
      })
    );
  }

  private async encryptCiphers(newUserKey: UserKey): Promise<CipherWithIdRequest[] | null> {
    const ciphers = await this.cipherService.getAllDecrypted();
    if (!ciphers) {
      return;
    }
    return await Promise.all(
      ciphers.map(async (cipher) => {
        const encryptedCipher = await this.cipherService.encrypt(cipher, newUserKey);
        return new CipherWithIdRequest(encryptedCipher);
      })
    );
  }

  private async encryptSends(newUserKey: UserKey): Promise<SendWithIdRequest[] | null> {
    const sends = await firstValueFrom(this.sendService.sends$);
    if (!sends) {
      return;
    }
    return await Promise.all(
      sends.map(async (send) => {
        const sendKey = await this.encryptService.decryptToBytes(send.key, null);
        send.key = (await this.encryptService.encrypt(sendKey, newUserKey)) ?? send.key;
        return new SendWithIdRequest(send);
      })
    );
  }
}
