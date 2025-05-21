import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { VerificationType } from "@bitwarden/common/auth/enums/verification-type";
import { MasterPasswordVerification } from "@bitwarden/common/auth/types/verification";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { DeviceTrustServiceAbstraction } from "@bitwarden/common/key-management/device-trust/abstractions/device-trust.service.abstraction";
import { VaultTimeoutService } from "@bitwarden/common/key-management/vault-timeout";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { HashPurpose } from "@bitwarden/common/platform/enums";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { EncryptedString, EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { DialogService, ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";
import {
  AccountRecoveryTrustComponent,
  EmergencyAccessTrustComponent,
  KeyRotationTrustInfoComponent,
} from "@bitwarden/key-management-ui";
import { PureCrypto } from "@bitwarden/sdk-internal";

import { OrganizationUserResetPasswordService } from "../../admin-console/organizations/members/services/organization-user-reset-password/organization-user-reset-password.service";
import { WebauthnLoginAdminService } from "../../auth/core";
import { EmergencyAccessService } from "../../auth/emergency-access";

import { AccountKeysRequest } from "./request/account-keys.request";
import { MasterPasswordUnlockDataRequest } from "./request/master-password-unlock-data.request";
import { RotateUserAccountKeysRequest } from "./request/rotate-user-account-keys.request";
import { UnlockDataRequest } from "./request/unlock-data.request";
import { UpdateKeyRequest } from "./request/update-key.request";
import { UserDataRequest } from "./request/userdata.request";
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
    private logService: LogService,
    private vaultTimeoutService: VaultTimeoutService,
    private toastService: ToastService,
    private i18nService: I18nService,
    private dialogService: DialogService,
    private configService: ConfigService,
  ) {}

  /**
   * Creates a new user key and re-encrypts all required data with the it.
   * @param oldMasterPassword: The current master password
   * @param newMasterPassword: The new master password
   * @param user: The user account
   * @param newMasterPasswordHint: The hint for the new master password
   */
  async rotateUserKeyMasterPasswordAndEncryptedData(
    oldMasterPassword: string,
    newMasterPassword: string,
    user: Account,
    newMasterPasswordHint?: string,
  ): Promise<void> {
    this.logService.info("[Userkey rotation] Starting user key rotation...");
    if (!newMasterPassword) {
      this.logService.info("[Userkey rotation] Invalid master password provided. Aborting!");
      throw new Error("Invalid master password");
    }

    if ((await this.syncService.getLastSync()) === null) {
      this.logService.info("[Userkey rotation] Client was never synced. Aborting!");
      throw new Error(
        "The local vault is de-synced and the keys cannot be rotated. Please log out and log back in to resolve this issue.",
      );
    }

    const emergencyAccessGrantees = await this.emergencyAccessService.getPublicKeys();
    const orgs = await this.resetPasswordService.getPublicKeys(user.id);
    if (orgs.length > 0 || emergencyAccessGrantees.length > 0) {
      const trustInfoDialog = KeyRotationTrustInfoComponent.open(this.dialogService, {
        numberOfEmergencyAccessUsers: emergencyAccessGrantees.length,
        orgName: orgs.length > 0 ? orgs[0].orgName : undefined,
      });
      const result = await firstValueFrom(trustInfoDialog.closed);
      if (!result) {
        this.logService.info("[Userkey rotation] Trust info dialog closed. Aborting!");
        return;
      }
    }

    const {
      masterKey: oldMasterKey,
      email,
      kdfConfig,
    } = await this.userVerificationService.verifyUserByMasterPassword(
      {
        type: VerificationType.MasterPassword,
        secret: oldMasterPassword,
      },
      user.id,
      user.email,
    );

    const newMasterKey = await this.keyService.makeMasterKey(newMasterPassword, email, kdfConfig);

    let userKeyBytes: Uint8Array;
    if (await this.configService.getFeatureFlag(FeatureFlag.EnrollAeadOnKeyRotation)) {
      userKeyBytes = PureCrypto.make_user_key_xchacha20_poly1305();
    } else {
      userKeyBytes = PureCrypto.make_user_key_aes256_cbc_hmac();
    }

    const newMasterKeyEncryptedUserKey = new EncString(
      PureCrypto.encrypt_user_key_with_master_password(
        userKeyBytes,
        newMasterPassword,
        email,
        kdfConfig.toSdkConfig(),
      ),
    );
    const newUnencryptedUserKey = new SymmetricCryptoKey(userKeyBytes) as UserKey;

    if (!newUnencryptedUserKey || !newMasterKeyEncryptedUserKey) {
      this.logService.info("[Userkey rotation] User key could not be created. Aborting!");
      throw new Error("User key could not be created");
    }

    const newMasterKeyAuthenticationHash = await this.keyService.hashMasterKey(
      newMasterPassword,
      newMasterKey,
      HashPurpose.ServerAuthorization,
    );
    const masterPasswordUnlockData = new MasterPasswordUnlockDataRequest(
      kdfConfig,
      email,
      newMasterKeyAuthenticationHash,
      newMasterKeyEncryptedUserKey.encryptedString!,
      newMasterPasswordHint,
    );

    const keyPair = await firstValueFrom(this.keyService.userEncryptionKeyPair$(user.id));
    if (keyPair == null) {
      this.logService.info("[Userkey rotation] Key pair is null. Aborting!");
      throw new Error("Key pair is null");
    }
    const { privateKey, publicKey } = keyPair;

    const accountKeysRequest = new AccountKeysRequest(
      (
        await this.encryptService.wrapDecapsulationKey(privateKey, newUnencryptedUserKey)
      ).encryptedString!,
      Utils.fromBufferToB64(publicKey),
    );

    const originalUserKey = await firstValueFrom(this.keyService.userKey$(user.id));
    if (originalUserKey == null) {
      this.logService.info("[Userkey rotation] Userkey is null. Aborting!");
      throw new Error("Userkey key is null");
    }

    const rotatedCiphers = await this.cipherService.getRotatedData(
      originalUserKey,
      newUnencryptedUserKey,
      user.id,
    );
    const rotatedFolders = await this.folderService.getRotatedData(
      originalUserKey,
      newUnencryptedUserKey,
      user.id,
    );
    const rotatedSends = await this.sendService.getRotatedData(
      originalUserKey,
      newUnencryptedUserKey,
      user.id,
    );
    if (rotatedCiphers == null || rotatedFolders == null || rotatedSends == null) {
      this.logService.info("[Userkey rotation] ciphers, folders, or sends are null. Aborting!");
      throw new Error("ciphers, folders, or sends are null");
    }
    const accountDataRequest = new UserDataRequest(rotatedCiphers, rotatedFolders, rotatedSends);

    for (const details of emergencyAccessGrantees) {
      this.logService.info("[Userkey rotation] Emergency access grantee: " + details.name);
      this.logService.info(
        "[Userkey rotation] Emergency access grantee fingerprint: " +
          (await this.keyService.getFingerprint(details.granteeId, details.publicKey)).join("-"),
      );

      const dialogRef = EmergencyAccessTrustComponent.open(this.dialogService, {
        name: details.name,
        userId: details.granteeId,
        publicKey: details.publicKey,
      });
      const result = await firstValueFrom(dialogRef.closed);
      if (result === true) {
        this.logService.info("[Userkey rotation] Emergency access grantee confirmed");
      } else {
        this.logService.info("[Userkey rotation] Emergency access grantee not confirmed");
        return;
      }
    }
    const trustedUserPublicKeys = emergencyAccessGrantees.map((d) => d.publicKey);

    const emergencyAccessUnlockData = await this.emergencyAccessService.getRotatedData(
      newUnencryptedUserKey,
      trustedUserPublicKeys,
      user.id,
    );

    for (const organization of orgs) {
      this.logService.info(
        "[Userkey rotation] Reset password organization: " + organization.orgName,
      );
      this.logService.info(
        "[Userkey rotation] Trusted organization public key: " + organization.publicKey,
      );
      const fingerprint = await this.keyService.getFingerprint(
        organization.orgId,
        organization.publicKey,
      );
      this.logService.info(
        "[Userkey rotation] Trusted organization fingerprint: " + fingerprint.join("-"),
      );

      const dialogRef = AccountRecoveryTrustComponent.open(this.dialogService, {
        name: organization.orgName,
        orgId: organization.orgId,
        publicKey: organization.publicKey,
      });
      const result = await firstValueFrom(dialogRef.closed);
      if (result === true) {
        this.logService.info("[Userkey rotation] Organization trusted");
      } else {
        this.logService.info("[Userkey rotation] Organization not trusted");
        return;
      }
    }
    const trustedOrgPublicKeys = orgs.map((d) => d.publicKey);
    // Note: Reset password keys request model has user verification
    // properties, but the rotation endpoint uses its own MP hash.
    const organizationAccountRecoveryUnlockData = (await this.resetPasswordService.getRotatedData(
      newUnencryptedUserKey,
      trustedOrgPublicKeys,
      user.id,
    ))!;
    const passkeyUnlockData = await this.webauthnLoginAdminService.getRotatedData(
      originalUserKey,
      newUnencryptedUserKey,
      user.id,
    );

    const trustedDeviceUnlockData = await this.deviceTrustService.getRotatedData(
      originalUserKey,
      newUnencryptedUserKey,
      user.id,
    );

    const unlockDataRequest = new UnlockDataRequest(
      masterPasswordUnlockData,
      emergencyAccessUnlockData,
      organizationAccountRecoveryUnlockData,
      passkeyUnlockData,
      trustedDeviceUnlockData,
    );

    const request = new RotateUserAccountKeysRequest(
      unlockDataRequest,
      accountKeysRequest,
      accountDataRequest,
      await this.keyService.hashMasterKey(oldMasterPassword, oldMasterKey),
    );

    this.logService.info("[Userkey rotation] Posting user key rotation request to server");
    await this.apiService.postUserKeyUpdateV2(request);
    this.logService.info("[Userkey rotation] Userkey rotation request posted to server");

    this.toastService.showToast({
      variant: "success",
      title: this.i18nService.t("rotationCompletedTitle"),
      message: this.i18nService.t("rotationCompletedDesc"),
      timeout: 15000,
    });

    // temporary until userkey can be better verified
    await this.vaultTimeoutService.logOut();
  }

  /**
   * Creates a new user key and re-encrypts all required data with the it.
   * @param masterPassword current master password (used for validation)
   * @deprecated
   */
  async rotateUserKeyAndEncryptedDataLegacy(masterPassword: string, user: Account): Promise<void> {
    this.logService.info("[Userkey rotation] Starting legacy user key rotation...");
    if (!masterPassword) {
      this.logService.info("[Userkey rotation] Invalid master password provided. Aborting!");
      throw new Error("Invalid master password");
    }

    if ((await this.syncService.getLastSync()) === null) {
      this.logService.info("[Userkey rotation] Client was never synced. Aborting!");
      throw new Error(
        "The local vault is de-synced and the keys cannot be rotated. Please log out and log back in to resolve this issue.",
      );
    }

    const emergencyAccessGrantees = await this.emergencyAccessService.getPublicKeys();
    const orgs = await this.resetPasswordService.getPublicKeys(user.id);

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

    if (newUserKey == null || newEncUserKey == null || newEncUserKey.encryptedString == null) {
      this.logService.info("[Userkey rotation] User key could not be created. Aborting!");
      throw new Error("User key could not be created");
    }

    // New user key
    const key = newEncUserKey.encryptedString;

    // Add master key hash
    const masterPasswordHash = await this.keyService.hashMasterKey(masterPassword, masterKey);

    // Get original user key
    // Note: We distribute the legacy key, but not all domains actually use it. If any of those
    // domains break their legacy support it will break the migration process for legacy users.
    const originalUserKey = await this.keyService.getUserKeyWithLegacySupport(user.id);
    const isMasterKey =
      (await firstValueFrom(this.keyService.userKey$(user.id))) != originalUserKey;
    this.logService.info("[Userkey rotation] Is legacy user: " + isMasterKey);

    // Add re-encrypted data
    const privateKey = await this.encryptPrivateKey(newUserKey, user.id);
    if (privateKey == null) {
      this.logService.info("[Userkey rotation] Private key could not be encrypted. Aborting!");
      throw new Error("Private key could not be encrypted");
    }

    // Create new request
    const request = new UpdateKeyRequest(masterPasswordHash, key, privateKey);

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

    const trustedUserPublicKeys = emergencyAccessGrantees.map((d) => d.publicKey);
    const rotatedEmergencyAccessKeys = await this.emergencyAccessService.getRotatedData(
      newUserKey,
      trustedUserPublicKeys,
      user.id,
    );
    if (rotatedEmergencyAccessKeys != null) {
      request.emergencyAccessKeys = rotatedEmergencyAccessKeys;
    }

    const trustedOrgPublicKeys = orgs.map((d) => d.publicKey);
    // Note: Reset password keys request model has user verification
    // properties, but the rotation endpoint uses its own MP hash.
    const rotatedResetPasswordKeys = await this.resetPasswordService.getRotatedData(
      originalUserKey,
      trustedOrgPublicKeys,
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

    this.logService.info("[Userkey rotation] Posting user key rotation request to server");
    await this.apiService.postUserKeyUpdate(request);
    this.logService.info("[Userkey rotation] Userkey rotation request posted to server");

    // TODO PM-2199: Add device trust rotation support to the user key rotation endpoint
    this.logService.info("[Userkey rotation] Rotating device trust...");
    await this.deviceTrustService.rotateDevicesTrust(user.id, newUserKey, masterPasswordHash);
    this.logService.info("[Userkey rotation] Device trust rotation completed");
    await this.vaultTimeoutService.logOut();
  }

  private async encryptPrivateKey(
    newUserKey: UserKey,
    userId: UserId,
  ): Promise<EncryptedString | undefined> {
    const privateKey = await firstValueFrom(
      this.keyService.userPrivateKeyWithLegacySupport$(userId),
    );
    if (privateKey == null) {
      throw new Error("No private key found for user key rotation");
    }
    return (await this.encryptService.wrapDecapsulationKey(privateKey, newUserKey)).encryptedString;
  }
}
