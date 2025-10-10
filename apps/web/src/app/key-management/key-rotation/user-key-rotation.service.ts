import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { LogoutService } from "@bitwarden/auth/common";
import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { DeviceTrustServiceAbstraction } from "@bitwarden/common/key-management/device-trust/abstractions/device-trust.service.abstraction";
import { firstValueFromOrThrow } from "@bitwarden/common/key-management/utils";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { EncryptionType, HashPurpose } from "@bitwarden/common/platform/enums";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { DialogService, ToastService } from "@bitwarden/components";
import { KdfConfig, KdfConfigService, KeyService } from "@bitwarden/key-management";
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
import { UserDataRequest } from "./request/userdata.request";
import { UserKeyRotationApiService } from "./user-key-rotation-api.service";

type MasterPasswordAuthenticationAndUnlockData = {
  masterPassword: string;
  masterKeySalt: string;
  masterKeyKdfConfig: KdfConfig;
  masterPasswordHint: string;
};

@Injectable({ providedIn: "root" })
export class UserKeyRotationService {
  constructor(
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
    private logoutService: LogoutService,
    private toastService: ToastService,
    private i18nService: I18nService,
    private dialogService: DialogService,
    private configService: ConfigService,
    private cryptoFunctionService: CryptoFunctionService,
    private kdfConfigService: KdfConfigService,
  ) {}

  /**
   * Creates a new user key and re-encrypts all required data with the it.
   * @param currentMasterPassword: The current master password
   * @param newMasterPassword: The new master password
   * @param user: The user account
   * @param newMasterPasswordHint: The hint for the new master password
   */
  async rotateUserKeyMasterPasswordAndEncryptedData(
    currentMasterPassword: string,
    newMasterPassword: string,
    user: Account,
    newMasterPasswordHint?: string,
  ): Promise<void> {
    this.logService.info("[UserKey Rotation] Starting user key rotation...");

    const upgradeToV2FeatureFlagEnabled = await this.configService.getFeatureFlag(
      FeatureFlag.EnrollAeadOnKeyRotation,
    );

    // Make sure all conditions match - e.g. account state is up to date
    await this.ensureIsAllowedToRotateUserKey();

    // First, the provided organizations and emergency access users need to be verified;
    // this is currently done by providing the user a manual confirmation dialog.
    const { wasTrustDenied, trustedOrganizationPublicKeys, trustedEmergencyAccessUserPublicKeys } =
      await this.verifyTrust(user);
    if (wasTrustDenied) {
      this.logService.info("[Userkey rotation] Trust was denied by user. Aborting!");
      return;
    }

    // Read current cryptographic state / settings
    const masterKeyKdfConfig: KdfConfig = (await firstValueFromOrThrow(
      this.kdfConfigService.getKdfConfig$(user.id),
      "KDF config",
    ))!;
    // The masterkey salt used for deriving the masterkey always needs to be trimmed and lowercased.
    const masterKeySalt = user.email.trim().toLowerCase();
    const currentUserKey: UserKey = (await firstValueFromOrThrow(
      this.keyService.userKey$(user.id),
      "User key",
    ))!;
    const currentUserKeyWrappedPrivateKey = new EncString(
      (await firstValueFromOrThrow(
        this.keyService.userEncryptedPrivateKey$(user.id),
        "User encrypted private key",
      ))!,
    );

    // Update account keys
    // This creates at least a new user key, and possibly upgrades user encryption formats
    let newUserKey: UserKey;
    let wrappedPrivateKey: EncString;
    let publicKey: string;
    if (upgradeToV2FeatureFlagEnabled) {
      this.logService.info("[Userkey rotation] Using v2 account keys");
      const { userKey, asymmetricEncryptionKeys } = await this.getNewAccountKeysV2(
        currentUserKey,
        currentUserKeyWrappedPrivateKey,
      );
      newUserKey = userKey;
      wrappedPrivateKey = asymmetricEncryptionKeys.wrappedPrivateKey;
      publicKey = asymmetricEncryptionKeys.publicKey;
    } else {
      this.logService.info("[Userkey rotation] Using v1 account keys");
      const { userKey, asymmetricEncryptionKeys } = await this.getNewAccountKeysV1(
        currentUserKey,
        currentUserKeyWrappedPrivateKey,
      );
      newUserKey = userKey;
      wrappedPrivateKey = asymmetricEncryptionKeys.wrappedPrivateKey;
      publicKey = asymmetricEncryptionKeys.publicKey;
    }

    // Assemble the key rotation request
    const request = new RotateUserAccountKeysRequest(
      await this.getAccountUnlockDataRequest(
        user.id,
        currentUserKey,
        newUserKey,
        {
          masterPassword: newMasterPassword,
          masterKeyKdfConfig,
          masterKeySalt,
          masterPasswordHint: newMasterPasswordHint,
        } as MasterPasswordAuthenticationAndUnlockData,
        trustedEmergencyAccessUserPublicKeys,
        trustedOrganizationPublicKeys,
      ),
      new AccountKeysRequest(wrappedPrivateKey.encryptedString!, publicKey),
      await this.getAccountDataRequest(currentUserKey, newUserKey, user),
      await this.makeServerMasterKeyAuthenticationHash(
        currentMasterPassword,
        masterKeyKdfConfig,
        masterKeySalt,
      ),
    );

    this.logService.info("[Userkey rotation] Posting user key rotation request to server");
    await this.apiService.postUserKeyUpdate(request);
    this.logService.info("[Userkey rotation] Userkey rotation request posted to server");

    this.toastService.showToast({
      variant: "success",
      title: this.i18nService.t("rotationCompletedTitle"),
      message: this.i18nService.t("rotationCompletedDesc"),
      timeout: 15000,
    });

    await this.logoutService.logout(user.id);
  }

  protected async ensureIsAllowedToRotateUserKey(): Promise<void> {
    if ((await this.syncService.getLastSync()) === null) {
      this.logService.info("[Userkey rotation] Client was never synced. Aborting!");
      throw new Error(
        "The local vault is de-synced and the keys cannot be rotated. Please log out and log back in to resolve this issue.",
      );
    }
  }

  protected async getNewAccountKeysV1(
    currentUserKey: UserKey,
    currentUserKeyWrappedPrivateKey: EncString,
  ): Promise<{
    userKey: UserKey;
    asymmetricEncryptionKeys: {
      wrappedPrivateKey: EncString;
      publicKey: string;
    };
  }> {
    // Account key rotation creates a new userkey. All downstream data and keys need to be re-encrypted under this key.
    // Further, this method is used to create new keys in the event that the key hierarchy changes, such as for the
    // creation of a new signing key pair.
    const newUserKey = await this.makeNewUserKeyV1(currentUserKey);

    // Re-encrypt the private key with the new user key
    // Rotation of the private key is not supported yet
    const privateKey = await this.encryptService.unwrapDecapsulationKey(
      currentUserKeyWrappedPrivateKey,
      currentUserKey,
    );
    const newUserKeyWrappedPrivateKey = await this.encryptService.wrapDecapsulationKey(
      privateKey,
      newUserKey,
    );
    const publicKey = await this.cryptoFunctionService.rsaExtractPublicKey(privateKey);

    return {
      userKey: newUserKey,
      asymmetricEncryptionKeys: {
        wrappedPrivateKey: newUserKeyWrappedPrivateKey,
        publicKey: Utils.fromBufferToB64(publicKey),
      },
    };
  }

  protected async getNewAccountKeysV2(
    currentUserKey: UserKey,
    currentUserKeyWrappedPrivateKey: EncString,
  ): Promise<{
    userKey: UserKey;
    asymmetricEncryptionKeys: {
      wrappedPrivateKey: EncString;
      publicKey: string;
    };
  }> {
    throw new Error("User encryption v2 upgrade is not supported yet");
  }

  protected async createMasterPasswordUnlockDataRequest(
    userKey: UserKey,
    newUnlockData: MasterPasswordAuthenticationAndUnlockData,
  ): Promise<MasterPasswordUnlockDataRequest> {
    // Decryption via stretched-masterkey-wrapped-userkey
    const newMasterKeyEncryptedUserKey = new EncString(
      PureCrypto.encrypt_user_key_with_master_password(
        userKey.toEncoded(),
        newUnlockData.masterPassword,
        newUnlockData.masterKeySalt,
        newUnlockData.masterKeyKdfConfig.toSdkConfig(),
      ),
    );

    const newMasterKeyAuthenticationHash = await this.makeServerMasterKeyAuthenticationHash(
      newUnlockData.masterPassword,
      newUnlockData.masterKeyKdfConfig,
      newUnlockData.masterKeySalt,
    );

    return new MasterPasswordUnlockDataRequest(
      newUnlockData.masterKeyKdfConfig,
      newUnlockData.masterKeySalt,
      newMasterKeyAuthenticationHash,
      newMasterKeyEncryptedUserKey.encryptedString!,
      newUnlockData.masterPasswordHint,
    );
  }

  protected async getAccountUnlockDataRequest(
    userId: UserId,
    currentUserKey: UserKey,
    newUserKey: UserKey,
    masterPasswordAuthenticationAndUnlockData: MasterPasswordAuthenticationAndUnlockData,
    trustedEmergencyAccessGranteesPublicKeys: Uint8Array[],
    trustedOrganizationPublicKeys: Uint8Array[],
  ): Promise<UnlockDataRequest> {
    // To ensure access; all unlock methods need to be updated and provided the new user key.
    // User unlock methods
    let masterPasswordUnlockData: MasterPasswordUnlockDataRequest;
    if (this.isUserWithMasterPassword(userId)) {
      masterPasswordUnlockData = await this.createMasterPasswordUnlockDataRequest(
        newUserKey,
        masterPasswordAuthenticationAndUnlockData,
      );
    }
    const passkeyUnlockData = await this.webauthnLoginAdminService.getRotatedData(
      currentUserKey,
      newUserKey,
      userId,
    );
    const trustedDeviceUnlockData = await this.deviceTrustService.getRotatedData(
      currentUserKey,
      newUserKey,
      userId,
    );

    // Unlock methods that share to a different user / group
    const emergencyAccessUnlockData = await this.emergencyAccessService.getRotatedData(
      newUserKey,
      trustedEmergencyAccessGranteesPublicKeys,
      userId,
    );
    const organizationAccountRecoveryUnlockData = (await this.resetPasswordService.getRotatedData(
      newUserKey,
      trustedOrganizationPublicKeys,
      userId,
    ))!;

    return new UnlockDataRequest(
      masterPasswordUnlockData!,
      emergencyAccessUnlockData,
      organizationAccountRecoveryUnlockData,
      passkeyUnlockData,
      trustedDeviceUnlockData,
    );
  }

  protected async verifyTrust(user: Account): Promise<{
    wasTrustDenied: boolean;
    trustedOrganizationPublicKeys: Uint8Array[];
    trustedEmergencyAccessUserPublicKeys: Uint8Array[];
  }> {
    // Since currently the joined organizations and emergency access grantees are
    // not signed, manual trust prompts are required, to verify that the server
    // does not inject public keys here.
    //
    // Once signing is implemented, this is the place to also sign the keys and
    // upload the signed trust claims.
    //
    // The flow works in 3 steps:
    // 1. Prepare the user by showing them a dialog telling them they'll be asked
    //    to verify the trust of their organizations and emergency access users.
    // 2. Show the user a dialog for each organization and ask them to verify the trust.
    // 3. Show the user a dialog for each emergency access user and ask them to verify the trust.

    this.logService.info("[Userkey rotation] Verifying trust...");
    const emergencyAccessGrantees = await this.emergencyAccessService.getPublicKeys();
    const organizations = await this.resetPasswordService.getPublicKeys(user.id);

    if (organizations.length > 0 || emergencyAccessGrantees.length > 0) {
      const trustInfoDialog = KeyRotationTrustInfoComponent.open(this.dialogService, {
        numberOfEmergencyAccessUsers: emergencyAccessGrantees.length,
        orgName: organizations.length > 0 ? organizations[0].orgName : undefined,
      });
      if (!(await firstValueFrom(trustInfoDialog.closed))) {
        return {
          wasTrustDenied: true,
          trustedOrganizationPublicKeys: [],
          trustedEmergencyAccessUserPublicKeys: [],
        };
      }
    }

    for (const organization of organizations) {
      const dialogRef = AccountRecoveryTrustComponent.open(this.dialogService, {
        name: organization.orgName,
        orgId: organization.orgId,
        publicKey: organization.publicKey,
      });
      if (!(await firstValueFrom(dialogRef.closed))) {
        return {
          wasTrustDenied: true,
          trustedOrganizationPublicKeys: [],
          trustedEmergencyAccessUserPublicKeys: [],
        };
      }
    }

    for (const details of emergencyAccessGrantees) {
      const dialogRef = EmergencyAccessTrustComponent.open(this.dialogService, {
        name: details.name,
        userId: details.granteeId,
        publicKey: details.publicKey,
      });
      if (!(await firstValueFrom(dialogRef.closed))) {
        return {
          wasTrustDenied: true,
          trustedOrganizationPublicKeys: [],
          trustedEmergencyAccessUserPublicKeys: [],
        };
      }
    }

    this.logService.info(
      "[Userkey rotation] Trust verified for all organizations and emergency access users",
    );
    return {
      wasTrustDenied: false,
      trustedOrganizationPublicKeys: organizations.map((d) => d.publicKey),
      trustedEmergencyAccessUserPublicKeys: emergencyAccessGrantees.map((d) => d.publicKey),
    };
  }

  protected async getAccountDataRequest(
    originalUserKey: UserKey,
    newUnencryptedUserKey: UserKey,
    user: Account,
  ): Promise<UserDataRequest> {
    // Account data is any data owned by the user; this is folders, ciphers (and their attachments), and sends.

    // Currently, ciphers, folders and sends are directly encrypted with the user key. This means
    // that they need to be re-encrypted and re-uploaded. In the future, content-encryption keys
    // (such as cipher keys) will make it so only re-encrypted keys are required.
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
    return new UserDataRequest(rotatedCiphers, rotatedFolders, rotatedSends);
  }

  protected async makeNewUserKeyV1(oldUserKey: UserKey): Promise<UserKey> {
    // The user's account format is determined by the user key.
    // Being tied to the userkey ensures an all-or-nothing approach. A compromised
    // server cannot downgrade to a previous format (no signing keys) without
    // completely making the account unusable.
    //
    // V0: AES256-CBC (no userkey, directly using masterkey) (pre-2019 accounts)
    //     This format is unsupported, and not secure; It is being forced migrated, and being removed
    // V1: AES256-CBC-HMAC userkey, no signing key (2019-2025)
    //     This format is still supported, but may be migrated in the future
    // V2: XChaCha20-Poly1305 userkey, signing key, account security version
    //     This is the new, modern format.
    if (this.isV1User(oldUserKey)) {
      this.logService.info(
        "[Userkey rotation] Existing userkey key is AES256-CBC-HMAC; not upgrading",
      );
      return new SymmetricCryptoKey(PureCrypto.make_user_key_aes256_cbc_hmac()) as UserKey;
    } else {
      // If the feature flag is rolled back, we want to block rotation in order to be as safe as possible with the user's account.
      this.logService.info(
        "[Userkey rotation] Existing userkey key is XChaCha20-Poly1305, but feature flag is not enabled; aborting..",
      );
      throw new Error(
        "User account crypto format is v2, but the feature flag is disabled. User key rotation cannot proceed.",
      );
    }
  }

  protected async makeNewUserKeyV2(
    oldUserKey: UserKey,
  ): Promise<{ isUpgrading: boolean; newUserKey: UserKey }> {
    // The user's account format is determined by the user key.
    // Being tied to the userkey ensures an all-or-nothing approach. A compromised
    // server cannot downgrade to a previous format (no signing keys) without
    // completely making the account unusable.
    //
    // V0: AES256-CBC (no userkey, directly using masterkey) (pre-2019 accounts)
    //     This format is unsupported, and not secure; It is being forced migrated, and being removed
    // V1: AES256-CBC-HMAC userkey, no signing key (2019-2025)
    //     This format is still supported, but may be migrated in the future
    // V2: XChaCha20-Poly1305 userkey, signing key, account security version
    //     This is the new, modern format.
    const newUserKey: UserKey = new SymmetricCryptoKey(
      PureCrypto.make_user_key_xchacha20_poly1305(),
    ) as UserKey;
    const isUpgrading = this.isV1User(oldUserKey);
    if (isUpgrading) {
      this.logService.info(
        "[Userkey rotation] Existing userkey key is AES256-CBC-HMAC; upgrading to XChaCha20-Poly1305",
      );
    } else {
      this.logService.info(
        "[Userkey rotation] Existing userkey key is XChaCha20-Poly1305; no upgrade needed",
      );
    }
    return { isUpgrading, newUserKey };
  }

  /**
   * A V1 user has no signing key, and uses AES256-CBC-HMAC.
   * A V2 user has a signing key, and uses XChaCha20-Poly1305.
   */
  protected isV1User(userKey: UserKey): boolean {
    return userKey.inner().type === EncryptionType.AesCbc256_HmacSha256_B64;
  }

  protected isUserWithMasterPassword(id: UserId): boolean {
    // Currently, key rotation can only be activated when the user has a master password.
    return true;
  }

  protected async makeServerMasterKeyAuthenticationHash(
    masterPassword: string,
    masterKeyKdfConfig: KdfConfig,
    masterKeySalt: string,
  ): Promise<string> {
    const masterKey = await this.keyService.makeMasterKey(
      masterPassword,
      masterKeySalt,
      masterKeyKdfConfig,
    );
    return this.keyService.hashMasterKey(
      masterPassword,
      masterKey,
      HashPurpose.ServerAuthorization,
    );
  }
}
