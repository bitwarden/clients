import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { DeviceTrustCryptoServiceAbstraction } from "@bitwarden/common/auth/abstractions/device-trust-crypto.service.abstraction";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { EncryptedString } from "@bitwarden/common/platform/models/domain/enc-string";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { UserKey } from "@bitwarden/common/types/key";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherWithIdRequest } from "@bitwarden/common/vault/models/request/cipher-with-id.request";
import { FolderWithIdRequest } from "@bitwarden/common/vault/models/request/folder-with-id.request";

import { OrganizationUserResetPasswordService } from "../../admin-console/organizations/members/services/organization-user-reset-password/organization-user-reset-password.service";
import { EmergencyAccessService } from "../emergency-access";

import { UpdateKeyRequest } from "./request/update-key.request";
import { UserKeyRotationApiService } from "./user-key-rotation-api.service";

@Injectable()
export class UserKeyRotationService {
  constructor(
    private apiService: UserKeyRotationApiService,
    private cipherService: CipherService,
    private folderService: FolderService,
    private sendService: SendService,
    private emergencyAccessService: EmergencyAccessService,
    private resetPasswordService: OrganizationUserResetPasswordService,
    private deviceTrustCryptoService: DeviceTrustCryptoServiceAbstraction,
    private cryptoService: CryptoService,
    private encryptService: EncryptService,
    private stateService: StateService,
    private configService: ConfigService,
  ) {}

  /**
   * Creates a new user key and re-encrypts all required data with the it.
   * @param masterPassword current master password (used for validation)
   */
  async rotateUserKeyAndEncryptedData(masterPassword: string): Promise<void> {
    if (!masterPassword) {
      throw new Error("Invalid master password");
    }

    // Create master key to validate the master password
    const masterKey = await this.cryptoService.makeMasterKey(
      masterPassword,
      await this.stateService.getEmail(),
      await this.stateService.getKdfType(),
      await this.stateService.getKdfConfig(),
    );

    if (!masterKey) {
      throw new Error("Master key could not be created");
    }

    // Set master key again in case it was lost (could be lost on refresh)
    await this.cryptoService.setMasterKey(masterKey);
    const [newUserKey, newEncUserKey] = await this.cryptoService.makeUserKey(masterKey);

    if (!newUserKey || !newEncUserKey) {
      throw new Error("User key could not be created");
    }

    // Create new request
    const request = new UpdateKeyRequest();

    // Add new user key
    request.key = newEncUserKey.encryptedString;

    // Add master key hash
    const masterPasswordHash = await this.cryptoService.hashMasterKey(masterPassword, masterKey);
    request.masterPasswordHash = masterPasswordHash;

    // Add re-encrypted data
    request.privateKey = await this.encryptPrivateKey(newUserKey);
    request.ciphers = await this.encryptCiphers(newUserKey);
    request.folders = await this.encryptFolders(newUserKey);
    request.sends = await this.sendService.getRotatedKeys(newUserKey);
    request.emergencyAccessKeys = await this.emergencyAccessService.getRotatedKeys(newUserKey);
    request.resetPasswordKeys = await this.resetPasswordService.getRotatedKeys(newUserKey);

    if (await this.configService.getFeatureFlag<boolean>(FeatureFlag.KeyRotationImprovements)) {
      await this.apiService.postUserKeyUpdate(request);
    } else {
      await this.rotateUserKeyAndEncryptedDataLegacy(request);
    }

    await this.deviceTrustCryptoService.rotateDevicesTrust(newUserKey, masterPasswordHash);
  }

  private async encryptPrivateKey(newUserKey: UserKey): Promise<EncryptedString | null> {
    const privateKey = await this.cryptoService.getPrivateKey();
    if (!privateKey) {
      return;
    }
    return (await this.encryptService.encrypt(privateKey, newUserKey)).encryptedString;
  }

  private async encryptCiphers(newUserKey: UserKey): Promise<CipherWithIdRequest[]> {
    const ciphers = await this.cipherService.getAllDecrypted();
    if (!ciphers) {
      // Must return an empty array for backwards compatibility
      return [];
    }
    return await Promise.all(
      ciphers.map(async (cipher) => {
        const encryptedCipher = await this.cipherService.encrypt(cipher, newUserKey);
        return new CipherWithIdRequest(encryptedCipher);
      }),
    );
  }

  private async encryptFolders(newUserKey: UserKey): Promise<FolderWithIdRequest[]> {
    const folders = await firstValueFrom(this.folderService.folderViews$);
    if (!folders) {
      // Must return an empty array for backwards compatibility
      return [];
    }
    return await Promise.all(
      folders.map(async (folder) => {
        const encryptedFolder = await this.folderService.encrypt(folder, newUserKey);
        return new FolderWithIdRequest(encryptedFolder);
      }),
    );
  }

  private async rotateUserKeyAndEncryptedDataLegacy(request: UpdateKeyRequest): Promise<void> {
    // Update keys, ciphers, folders, and sends
    await this.apiService.postUserKeyUpdate(request);

    // Update emergency access keys
    await this.emergencyAccessService.postLegacyRotation(request.emergencyAccessKeys);

    // Update account recovery keys
    const userId = await this.stateService.getUserId();
    await this.resetPasswordService.postLegacyRotation(userId, request.resetPasswordKeys);
  }
}
