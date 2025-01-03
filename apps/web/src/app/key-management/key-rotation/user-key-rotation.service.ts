// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Injectable } from "@angular/core";
import { firstValueFrom, lastValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { VaultTimeoutService } from "@bitwarden/common/abstractions/vault-timeout/vault-timeout.service";
import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { DeviceTrustServiceAbstraction } from "@bitwarden/common/auth/abstractions/device-trust.service.abstraction";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/auth/abstractions/master-password.service.abstraction";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { VerificationType } from "@bitwarden/common/auth/enums/verification-type";
import { MasterPasswordVerification } from "@bitwarden/common/auth/types/verification";
import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { HashPurpose } from "@bitwarden/common/platform/enums";
import { EncryptedString } from "@bitwarden/common/platform/models/domain/enc-string";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { DialogService, ToastService } from "@bitwarden/components";
import { Argon2KdfConfig, KdfType, KeyService } from "@bitwarden/key-management";

import {
  OrganizationTrustComponent,
  OrganizationTrustDialogResult,
} from "../../admin-console/organizations/manage/organization-trust.component";
import { OrganizationUserResetPasswordService } from "../../admin-console/organizations/members/services/organization-user-reset-password/organization-user-reset-password.service";
import { WebauthnLoginAdminService } from "../../auth/core";
import { EmergencyAccessService } from "../../auth/emergency-access";
import {
  EmergencyAccessConfirmComponent,
  EmergencyAccessConfirmDialogResult,
} from "../../auth/settings/emergency-access/confirm/emergency-access-confirm.component";

import { MasterPasswordUnlockDataRequest } from "./request/master-password-unlock-data.request";
import { RotateUserAccountKeysRequest } from "./request/rotate-user-account-keys.request";
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
    private logService: LogService,
    private vaultTimeoutService: VaultTimeoutService,
    private dialogService: DialogService,
    private fullApiService: ApiService,
    private tokenService: TokenService,
    private toastService: ToastService,
    private i18nService: I18nService,
    private masterPasswordService: InternalMasterPasswordServiceAbstraction,
  ) {}

  /**
   * Creates a new user key and re-encrypts all required data with the it.
   * @param masterPassword current master password (used for validation)
   */
  async rotateUserKeyMasterPasswordAndEncryptedData(
    oldMasterPassword: string,
    newMasterPassword: string,
    user: Account,
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

    const [newUnencryptedUserKey, newMasterkeyEncryptedUserkey] =
      await this.keyService.makeUserKey(newMasterKey);

    if (!newUnencryptedUserKey || !newMasterkeyEncryptedUserkey) {
      this.logService.info("[Userkey rotation] User key could not be created. Aborting!");
      throw new Error("User key could not be created");
    }

    const masterPasswordUnlockData = new MasterPasswordUnlockDataRequest();
    masterPasswordUnlockData.kdfType = kdfConfig.kdfType;
    masterPasswordUnlockData.kdfIterations = kdfConfig.iterations;
    if (kdfConfig.kdfType === KdfType.Argon2id) {
      masterPasswordUnlockData.kdfMemory = (kdfConfig as Argon2KdfConfig).memory;
      masterPasswordUnlockData.kdfParallelism = (kdfConfig as Argon2KdfConfig).parallelism;
    }
    masterPasswordUnlockData.email = email;
    const newMasterPasswordHash = await this.keyService.hashMasterKey(
      newMasterPassword,
      newMasterKey,
    );
    masterPasswordUnlockData.masterPasswordHash = newMasterPasswordHash;
    masterPasswordUnlockData.masterKeyEncryptedUserKey =
      newMasterkeyEncryptedUserkey.encryptedString;

    // Create new request
    const request = new RotateUserAccountKeysRequest();
    request.masterPasswordUnlockData = masterPasswordUnlockData;
    request.oldMasterPasswordHash = await this.keyService.hashMasterKey(
      oldMasterPassword,
      oldMasterKey,
    );

    const originalUserKey = await firstValueFrom(this.keyService.userKey$(user.id));

    // Add re-encrypted data
    request.userkeyEncryptedPrivateKey = await this.encryptPrivateKey(
      newUnencryptedUserKey,
      user.id,
    );

    const rotatedCiphers = await this.cipherService.getRotatedData(
      originalUserKey,
      newUnencryptedUserKey,
      user.id,
    );
    if (rotatedCiphers != null) {
      request.ciphers = rotatedCiphers;
    }

    const rotatedFolders = await this.folderService.getRotatedData(
      originalUserKey,
      newUnencryptedUserKey,
      user.id,
    );
    if (rotatedFolders != null) {
      request.folders = rotatedFolders;
    }

    const rotatedSends = await this.sendService.getRotatedData(
      originalUserKey,
      newUnencryptedUserKey,
      user.id,
    );
    if (rotatedSends != null) {
      request.sends = rotatedSends;
    }

    const emergencyAccessGrantees = await this.emergencyAccessService.getPublicKeys();
    for (const details of emergencyAccessGrantees) {
      this.logService.info("[Userkey rotation] Emergency access grantee: " + details.name);
      this.logService.info(
        "[Userkey rotation] Emergency access grantee fingerprint: " +
          (await this.keyService.getFingerprint(details.granteeId, details.publicKey)).join("-"),
      );

      const dialogRef = EmergencyAccessConfirmComponent.open(this.dialogService, {
        data: {
          name: details.name,
          emergencyAccessId: details.id,
          userId: details.granteeId,
          publicKey: details.publicKey,
        },
      });
      const result = await lastValueFrom(dialogRef.closed);
      if (result === EmergencyAccessConfirmDialogResult.Confirmed) {
        this.logService.info("[Userkey rotation] Emergency access grantee confirmed");
      } else {
        this.logService.info("[Userkey rotation] Emergency access grantee not confirmed");
        throw new Error("Emergency access grantee not confirmed, aborting user key rotation");
      }
    }
    const trustedUserPublicKeys = emergencyAccessGrantees.map((d) => d.publicKey);
    const rotatedEmergencyAccessKeys = await this.emergencyAccessService.getRotatedData(
      newUnencryptedUserKey,
      trustedUserPublicKeys,
      user.id,
    );
    if (rotatedEmergencyAccessKeys != null) {
      request.emergencyAccessKeys = rotatedEmergencyAccessKeys;
    }

    const orgs = await this.resetPasswordService.getPublicKeys();
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

      const dialogRef = OrganizationTrustComponent.open(this.dialogService, {
        data: {
          name: organization.orgName,
          orgId: organization.orgId,
          publicKey: organization.publicKey,
        },
      });
      const result = await lastValueFrom(dialogRef.closed);
      if (result === OrganizationTrustDialogResult.Trusted) {
        this.logService.info("[Userkey rotation] Organization trusted");
      } else {
        this.logService.info("[Userkey rotation] Organization not trusted");
        throw new Error("Organization not trusted, aborting user key rotation");
      }
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
      newUnencryptedUserKey,
      user.id,
    );
    if (rotatedWebauthnKeys != null) {
      request.webauthnKeys = rotatedWebauthnKeys;
    }

    this.logService.info("[Userkey rotation] Posting user key rotation request to server");
    await this.apiService.postUserKeyUpdateV2(request);
    this.logService.info("[Userkey rotation] Userkey rotation request posted to server");

    // TODO PM-2199: Add device trust rotation support to the user key rotation endpoint
    this.logService.info("[Userkey rotation] Rotating device trust...");
    await this.deviceTrustService.rotateDevicesTrust(
      user.id,
      newUnencryptedUserKey,
      newMasterPasswordHash,
    );
    this.logService.info("[Userkey rotation] Device trust rotation completed");

    const newSecurityStamp = (await this.fullApiService.getSync()).profile.securityStamp;
    await this.tokenService.setSecurityStamp(newSecurityStamp);
    await this.keyService.setMasterKeyEncryptedUserKey(
      newMasterkeyEncryptedUserkey.encryptedString.toString(),
      user.id,
    );
    await this.keyService.setUserKey(newUnencryptedUserKey, user.id);
    await this.syncService.fullSync(true);

    await this.masterPasswordService.setMasterKeyHash(
      await this.keyService.hashMasterKey(
        newMasterPassword,
        newMasterKey,
        HashPurpose.LocalAuthorization,
      ),
      user.id,
    );
    await this.masterPasswordService.setMasterKey(newMasterKey, user.id);

    this.toastService.showToast({
      variant: "success",
      title: this.i18nService.t("rotationCompletedTitle"),
      message: this.i18nService.t("rotationCompletedDesc"),
      timeout: 15000,
    });
  }

  /**
   * Creates a new user key and re-encrypts all required data with the it.
   * @param masterPassword current master password (used for validation)
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
      this.logService.info("[Userkey rotation] User key could not be created. Aborting!");
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
    const isMasterKey =
      (await firstValueFrom(this.keyService.userKey$(user.id))) != originalUserKey;
    this.logService.info("[Userkey rotation] Is legacy user: " + isMasterKey);

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

    const emergencyAccessGrantees = await this.emergencyAccessService.getPublicKeys();
    const trustedUserPublicKeys = emergencyAccessGrantees.map((d) => d.publicKey);
    const rotatedEmergencyAccessKeys = await this.emergencyAccessService.getRotatedData(
      newUserKey,
      trustedUserPublicKeys,
      user.id,
    );
    if (rotatedEmergencyAccessKeys != null) {
      request.emergencyAccessKeys = rotatedEmergencyAccessKeys;
    }

    const orgs = await this.resetPasswordService.getPublicKeys();
    const trustedOrgPublicKeys = orgs.map((d) => d.publicKey);
    // Note: Reset password keys request model has user verification
    // properties, but the rotation endpoint uses its own MP hash.
    const rotatedResetPasswordKeys = await this.resetPasswordService.getRotatedData(
      newUserKey,
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
