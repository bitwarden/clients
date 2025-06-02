import { firstValueFrom, Observable } from "rxjs";

import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { VerificationType } from "@bitwarden/common/auth/enums/verification-type";
import { MasterPasswordVerification } from "@bitwarden/common/auth/types/verification";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { DeviceTrustServiceAbstraction } from "@bitwarden/common/key-management/device-trust/abstractions/device-trust.service.abstraction";
import { SigningKey } from "@bitwarden/common/key-management/keys/models/signing-key";
import { VerifyingKey } from "@bitwarden/common/key-management/keys/models/verifying-key";
import { SignedPublicKey } from "@bitwarden/common/key-management/types";
import { VaultTimeoutService } from "@bitwarden/common/key-management/vault-timeout";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkClientFactory } from "@bitwarden/common/platform/abstractions/sdk/sdk-client-factory";
import { EncryptionType, HashPurpose } from "@bitwarden/common/platform/enums";
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
import { UpdateKeyRequest } from "./request/update-key.request";
import { UserDataRequest } from "./request/userdata.request";
import { UserKeyRotationApiService } from "./user-key-rotation-api.service";

type MasterPasswordAuthenticationAndUnlockData = {
  masterPassword: string;
  masterKeySalt: string;
  masterKeyKdfConfig: KdfConfig;
  masterPasswordHint: string;
};

/**
 * Implementation of the user key rotation service, with all sub functions
 * exposed for unit testing. It is wrapped by UserKeyRotationService to only
 * expose the public API.
 */
export class TestableUserKeyRotationService {
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
    private cryptoFunctionService: CryptoFunctionService,
    private kdfConfigService: KdfConfigService,
    private sdkClientFactory: SdkClientFactory,
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
    }

    // Read current cryptographic state / settings
    const masterKeyKdfConfig: KdfConfig = (await this.firstValueFromOrThrow(
      this.kdfConfigService.getKdfConfig$(user.id),
      "KDF config",
    ))!;
    // The masterkey salt used for deriving the masterkey always needs to be trimmed and lowercased.
    const masterKeySalt = user.email.trim().toLowerCase();
    const currentUserKey: UserKey = (await this.firstValueFromOrThrow(
      this.keyService.userKey$(user.id),
      "User key",
    ))!;
    const currentUserKeyWrappedPrivateKey = new EncString(
      (await this.firstValueFromOrThrow(
        this.keyService.userEncryptedPrivateKey$(user.id),
        "User encrypted private key",
      ))!,
    );
    const currentUserKeyWrappedSigningKey = await firstValueFrom(
      this.keyService.userSigningKey$(user.id),
    );

    // Update account keys
    // This creates at least a new user key, and possibly upgrades user encryption formats
    let newUserKey: UserKey;
    let accountKeysRequest: AccountKeysRequest;
    if (upgradeToV2FeatureFlagEnabled) {
      this.logService.info("[Userkey rotation] Using v2 account keys");
      const { userKey, asymmetricEncryptionKeypair, signingKeypair } =
        await this.getNewAccountKeysV2(
          currentUserKey,
          currentUserKeyWrappedPrivateKey,
          currentUserKeyWrappedSigningKey,
          user.email,
          masterKeyKdfConfig,
          user.id,
        );
      newUserKey = userKey;
      accountKeysRequest = new AccountKeysRequest(
        asymmetricEncryptionKeypair.wrappedPrivateKey.encryptedString!,
        asymmetricEncryptionKeypair.publicKey,
        asymmetricEncryptionKeypair.signedPublicKey,
        signingKeypair.signingKey,
        signingKeypair.verifyingKey,
      );
    } else {
      this.logService.info("[Userkey rotation] Using v1 account keys");
      const { userKey, asymmetricEncryptionKeypair } = await this.getNewAccountKeysV1(
        currentUserKey,
        currentUserKeyWrappedPrivateKey,
      );
      newUserKey = userKey;
      accountKeysRequest = new AccountKeysRequest(
        asymmetricEncryptionKeypair.wrappedPrivateKey.encryptedString!,
        asymmetricEncryptionKeypair.publicKey,
        null,
        null,
        null,
      );
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
      accountKeysRequest,
      await this.getAccountDataRequest(currentUserKey, newUserKey, user),
      await this.makeServerMasterKeyAuthenticationHash(
        currentMasterPassword,
        masterKeyKdfConfig,
        masterKeySalt,
      ),
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

  async ensureIsAllowedToRotateUserKey(): Promise<void> {
    if ((await this.syncService.getLastSync()) === null) {
      this.logService.info("[Userkey rotation] Client was never synced. Aborting!");
      throw new Error(
        "The local vault is de-synced and the keys cannot be rotated. Please log out and log back in to resolve this issue.",
      );
    }
  }

  async getNewAccountKeysV1(
    currentUserKey: UserKey,
    currentUserKeyWrappedPrivateKey: EncString,
  ): Promise<{
    userKey: UserKey;
    asymmetricEncryptionKeypair: {
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
    const publicKey = Utils.fromBufferToB64(
      await this.cryptoFunctionService.rsaExtractPublicKey(privateKey),
    );

    return {
      userKey: newUserKey,
      asymmetricEncryptionKeypair: {
        wrappedPrivateKey: newUserKeyWrappedPrivateKey,
        publicKey: publicKey,
      },
    };
  }

  async getNewAccountKeysV2(
    currentUserKey: UserKey,
    currentUserKeyWrappedPrivateKey: EncString,
    currentUserKeyWrappedSigningKey: SigningKey | undefined,
    email: string,
    kdfParams: KdfConfig,
    userId: UserId,
  ): Promise<{
    userKey: UserKey;
    asymmetricEncryptionKeypair: {
      wrappedPrivateKey: EncString;
      publicKey: string;
      signedPublicKey: SignedPublicKey;
    };
    signingKeypair: {
      signingKey: SigningKey;
      verifyingKey: VerifyingKey;
    };
  }> {
    if (this.isV1User(currentUserKey)) {
      return this.upgradeToV2User(
        currentUserKey,
        currentUserKeyWrappedPrivateKey,
        email,
        kdfParams,
        userId,
      );
    } else {
      return this.rotateV2User(
        currentUserKey,
        currentUserKeyWrappedPrivateKey,
        currentUserKeyWrappedSigningKey!,
        email,
        kdfParams,
        userId,
      );
    }
  }

  async upgradeToV2User(
    currentUserKey: UserKey,
    currentUserKeyWrappedPrivateKey: EncString,
    email: string,
    kdfParams: KdfConfig,
    userId: UserId,
  ): Promise<{
    userKey: UserKey;
    asymmetricEncryptionKeypair: {
      wrappedPrivateKey: EncString;
      publicKey: string;
      signedPublicKey: SignedPublicKey;
    };
    signingKeypair: {
      signingKey: SigningKey;
      verifyingKey: VerifyingKey;
    };
  }> {
    // A v1 user has: AES256-CBC-HMAC userkey, no signing key, RSA-2048 bit private key for RSA-OAEP-SHA1.
    // A v2 user has: XChaCha20-Poly1305 userkey, ed25519 signing key, RSA-2048 bit private key for RSA-OAEP-SHA1,
    // and a copy of the public key, corresponding to the private key, signed by the signing key.
    // To upgrade, a new userkey is created, and the private key is re-wrapped with the new user key.
    // The private key is NOT rotated for this migration, but may be rotated in a later migration.
    // A signing key is generated and wrapped with the new user key.

    // Make new XChaCha20-Poly1305 user key
    const newUserKey: UserKey = new SymmetricCryptoKey(
      PureCrypto.make_user_key_xchacha20_poly1305(),
    ) as UserKey;

    // Re-wrap the user private key with the new user key
    const privateKey = await this.encryptService.unwrapDecapsulationKey(
      currentUserKeyWrappedPrivateKey,
      currentUserKey,
    );
    const newUserKeyWrappedPrivateKey = await this.encryptService.wrapDecapsulationKey(
      privateKey,
      newUserKey,
    );
    const publicKey = Utils.fromBufferToB64(
      await this.cryptoFunctionService.rsaExtractPublicKey(privateKey),
    );

    // Make a new signing key pair. For this, we initialize an SDK instance with no signing key,
    // with the new user key.
    const sdkClient = await this.sdkClientFactory.createSdkClient();
    await sdkClient.crypto().initialize_user_crypto({
      userId: userId,
      kdfParams: kdfParams.toSdkConfig(),
      email: email,
      privateKey: newUserKeyWrappedPrivateKey.encryptedString!,
      signingKey: undefined,
      method: {
        decryptedKey: { decrypted_user_key: newUserKey.toBase64() },
      },
    });
    const makeSigningKeysResult = sdkClient.crypto().make_signing_keys();

    return {
      userKey: newUserKey,
      asymmetricEncryptionKeypair: {
        wrappedPrivateKey: newUserKeyWrappedPrivateKey,
        publicKey: publicKey,
        signedPublicKey: makeSigningKeysResult.signedPublicKey,
      },
      signingKeypair: {
        signingKey: new SigningKey(makeSigningKeysResult.signingKey),
        verifyingKey: new VerifyingKey(makeSigningKeysResult.verifyingKey),
      },
    };
  }

  async rotateV2User(
    currentUserKey: UserKey,
    currentUserKeyWrappedPrivateKey: EncString,
    currentUserKeyWrappedSigningKey: SigningKey,
    email: string,
    kdfParams: KdfConfig,
    userId: UserId,
  ): Promise<{
    userKey: UserKey;
    asymmetricEncryptionKeypair: {
      wrappedPrivateKey: EncString;
      publicKey: string;
      signedPublicKey: SignedPublicKey;
    };
    signingKeypair: {
      signingKey: SigningKey;
      verifyingKey: VerifyingKey;
    };
  }> {
    // Rotating a v2 user means creating a new XChaCha20-Poly1305 user key, re-wrapping the private key and signing key.
    // The signature of the public key is also updated. Rotating a v2 user does not change the private key or signing key.

    // Make new XChaCha20-Poly1305 user key
    const newUserKey: UserKey = new SymmetricCryptoKey(
      PureCrypto.make_user_key_xchacha20_poly1305(),
    ) as UserKey;

    // Initialize a new sdk client with the *current* user key. The function to re-wrap takes the current user key.
    const sdkClient = await this.sdkClientFactory.createSdkClient();
    await sdkClient.crypto().initialize_user_crypto({
      userId: userId,
      kdfParams: kdfParams.toSdkConfig(),
      email: email,
      signingKey: currentUserKeyWrappedSigningKey.inner(),
      privateKey: currentUserKeyWrappedPrivateKey.encryptedString!,
      method: {
        decryptedKey: { decrypted_user_key: currentUserKey.toBase64() },
      },
    });
    const rotatedKeys = sdkClient.crypto().rotate_account_keys(newUserKey.toBase64());

    return {
      userKey: newUserKey,
      asymmetricEncryptionKeypair: {
        wrappedPrivateKey: new EncString(rotatedKeys.privateKey),
        publicKey: rotatedKeys.publicKey,
        // This contains the same public key, but signed
        signedPublicKey: rotatedKeys.signedPublicKey,
      },
      signingKeypair: {
        signingKey: new SigningKey(rotatedKeys.signingKey),
        verifyingKey: new VerifyingKey(rotatedKeys.verifyingKey),
      },
    };
  }

  async createMasterPasswordUnlockDataRequest(
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

  async getAccountUnlockDataRequest(
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

  async verifyTrust(user: Account): Promise<{
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

  async getAccountDataRequest(
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

  async makeNewUserKeyV1(oldUserKey: UserKey): Promise<UserKey> {
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

  /**
   * A V1 user has no signing key, and uses AES256-CBC-HMAC.
   * A V2 user has a signing key, and uses XChaCha20-Poly1305.
   */
  isV1User(userKey: UserKey): boolean {
    return userKey.inner().type === EncryptionType.AesCbc256_HmacSha256_B64;
  }

  isUserWithMasterPassword(id: UserId): boolean {
    // Currently, key rotation can only be activated when the user has a master password.
    return true;
  }

  async makeServerMasterKeyAuthenticationHash(
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

  async firstValueFromOrThrow<T>(value: Observable<T>, name: string): Promise<T> {
    const result = await firstValueFrom(value);
    if (result == null) {
      throw new Error(`Failed to get ${name}`);
    }
    return result;
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

  /**
   * @deprecated Will be deleted when legacy migration is removed
   */
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
