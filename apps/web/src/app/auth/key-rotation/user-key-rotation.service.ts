import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { AccountInfo } from "@bitwarden/common/auth/abstractions/account.service";
import { DeviceTrustServiceAbstraction } from "@bitwarden/common/auth/abstractions/device-trust.service.abstraction";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { VerificationType } from "@bitwarden/common/auth/enums/verification-type";
import { MasterPasswordVerification } from "@bitwarden/common/auth/types/verification";
import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";
import { EncryptedString } from "@bitwarden/common/platform/models/domain/enc-string";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { KeyService } from "@bitwarden/key-management";

import { OrganizationUserResetPasswordService } from "../../admin-console/organizations/members/services/organization-user-reset-password/organization-user-reset-password.service";
import { WebauthnLoginAdminService } from "../core";
import { EmergencyAccessService } from "../emergency-access";

import { UpdateKeyRequest } from "./request/update-key.request";
import { UserKeyRotationApiService } from "./user-key-rotation-api.service";

@Injectable()
export class UserKeyRotationService {
  constructor(
    private userVerificationService: UserVerificationService,
    private apiService: UserKeyRotationApiService,
    private cipherService: CipherService,
    private folderService: FolderService,
    private sendService: SendService,
    private emergencyAccessService: EmergencyAccessService,
    private resetPasswordService: OrganizationUserResetPasswordService,
    private deviceTrustService: DeviceTrustServiceAbstraction,
    private keyService: KeyService,
    private encryptService: EncryptService,
    private syncService: SyncService,
    private webauthnLoginAdminService: WebauthnLoginAdminService,
  ) {}

  /**
   * Creates a new user key and re-encrypts all required data with the it.
   * @param masterPassword current master password (used for validation)
   */
  async rotateUserKeyAndEncryptedData(
    masterPassword: string,
    user: { id: UserId } & AccountInfo,
  ): Promise<void> {
    if (!masterPassword) {
      throw new Error("Invalid master password");
    }

    if ((await this.syncService.getLastSync()) === null) {
      throw new Error(
        "The local vault is de-synced and the keys cannot be rotated. Please log out and log back in to resolve this issue.",
      );
    }

    // Verify master password
    // UV service sets master key on success since it is stored in memory and can be lost on refresh
    const verification = {
      type: VerificationType.MasterPassword,
      secret: masterPassword,
    } as MasterPasswordVerification;

    const { masterKey } = await this.userVerificationService.verifyUserByMasterPassword(
      verification,
      user.id,
      user.email,
    );

    const [newUserKey, newEncUserKey] = await this.keyService.makeUserKey(masterKey);

    if (!newUserKey || !newEncUserKey) {
      throw new Error("User key could not be created");
    }

    // Create new request
    const request = new UpdateKeyRequest();

    // Add new user key
    request.key = newEncUserKey.encryptedString;

    // Add master key hash
    const masterPasswordHash = await this.keyService.hashMasterKey(masterPassword, masterKey);
    request.masterPasswordHash = masterPasswordHash;

    // Get original user key
    // Note: We distribute the legacy key, but not all domains actually use it. If any of those
    // domains break their legacy support it will break the migration process for legacy users.
    const originalUserKey = await this.keyService.getUserKeyWithLegacySupport(user.id);

    // Add re-encrypted data
    request.privateKey = await this.encryptPrivateKey(newUserKey, user.id);

    const rotatedCiphers = await this.cipherService.getRotatedData(
      originalUserKey,
      newUserKey,
      user.id,
    );
    if (rotatedCiphers != null) {
      request.ciphers = rotatedCiphers;
    }

    const rotatedFolders = await this.folderService.getRotatedData(
      originalUserKey,
      newUserKey,
      user.id,
    );
    if (rotatedFolders != null) {
      request.folders = rotatedFolders;
    }

    const rotatedSends = await this.sendService.getRotatedData(
      originalUserKey,
      newUserKey,
      user.id,
    );
    if (rotatedSends != null) {
      request.sends = rotatedSends;
    }

    const rotatedEmergencyAccessKeys = await this.emergencyAccessService.getRotatedData(
      originalUserKey,
      newUserKey,
      user.id,
    );
    if (rotatedEmergencyAccessKeys != null) {
      request.emergencyAccessKeys = rotatedEmergencyAccessKeys;
    }

    // Note: Reset password keys request model has user verification
    // properties, but the rotation endpoint uses its own MP hash.
    const rotatedResetPasswordKeys = await this.resetPasswordService.getRotatedData(
      originalUserKey,
      newUserKey,
      user.id,
    );
    if (rotatedResetPasswordKeys != null) {
      request.resetPasswordKeys = rotatedResetPasswordKeys;
    }

    const rotatedWebauthnKeys = await this.webauthnLoginAdminService.getRotatedData(
      originalUserKey,
      newUserKey,
      user.id,
    );
    if (rotatedWebauthnKeys != null) {
      request.webauthnKeys = rotatedWebauthnKeys;
    }

    await this.apiService.postUserKeyUpdate(request);

    // TODO PM-2199: Add device trust rotation support to the user key rotation endpoint
    await this.deviceTrustService.rotateDevicesTrust(user.id, newUserKey, masterPasswordHash);
  }

  private async encryptPrivateKey(
    newUserKey: UserKey,
    userId: UserId,
  ): Promise<EncryptedString | null> {
    const privateKey = await firstValueFrom(
      this.keyService.userPrivateKeyWithLegacySupport$(userId),
    );
    if (!privateKey) {
      throw new Error("No private key found for user key rotation");
    }
    return (await this.encryptService.encrypt(privateKey, newUserKey)).encryptedString;
  }
}
