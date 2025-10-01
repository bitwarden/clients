import { Injectable } from "@angular/core";
import { firstValueFrom, Observable } from "rxjs";

import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { DeviceTrustServiceAbstraction } from "@bitwarden/common/key-management/device-trust/abstractions/device-trust.service.abstraction";
import { SecurityStateService } from "@bitwarden/common/key-management/security-state/abstractions/security-state.service";
import {
  SignedSecurityState,
  UnsignedPublicKey,
  WrappedPrivateKey,
  WrappedSigningKey,
} from "@bitwarden/common/key-management/types";
import { VaultTimeoutService } from "@bitwarden/common/key-management/vault-timeout";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkClientFactory } from "@bitwarden/common/platform/abstractions/sdk/sdk-client-factory";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { asUuid } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { EncryptionType, HashPurpose } from "@bitwarden/common/platform/enums";
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
import { PureCrypto, TokenProvider } from "@bitwarden/sdk-internal";

import { OrganizationUserResetPasswordService } from "../../admin-console/organizations/members/services/organization-user-reset-password/organization-user-reset-password.service";
import { WebauthnLoginAdminService } from "../../auth/core";
import { EmergencyAccessService } from "../../auth/emergency-access";

import { AccountKeysRequest } from "./request/account-keys.request";
import { MasterPasswordUnlockDataRequest } from "./request/master-password-unlock-data.request";
import { RotateUserAccountKeysRequest } from "./request/rotate-user-account-keys.request";
import { UnlockDataRequest } from "./request/unlock-data.request";
import { UserDataRequest } from "./request/userdata.request";
import { V1UserCryptographicState } from "./types/v1-cryptographic-state";
import {
  fromSdkV2KeysToV2UserCryptographicState,
  V2UserCryptographicState,
} from "./types/v2-cryptographic-state";
import { UserKeyRotationApiService } from "./user-key-rotation-api.service";

type MasterPasswordAuthenticationAndUnlockData = {
  masterPassword: string;
  masterKeySalt: string;
  masterKeyKdfConfig: KdfConfig;
  masterPasswordHint: string;
};

/**
 * A token provider that exposes a null access token to the SDK.
 */
class NoopTokenProvider implements TokenProvider {
  constructor() {}

  async get_access_token(): Promise<string | undefined> {
    // Ignore from the test coverage, since this is called by the SDK
    /* istanbul ignore next */
    return undefined;
  }
}

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
    private vaultTimeoutService: VaultTimeoutService,
    private toastService: ToastService,
    private i18nService: I18nService,
    private dialogService: DialogService,
    private configService: ConfigService,
    private cryptoFunctionService: CryptoFunctionService,
    private kdfConfigService: KdfConfigService,
    private sdkClientFactory: SdkClientFactory,
    private securityStateService: SecurityStateService,
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
    // Key-rotation uses the SDK, so we need to ensure that the SDK is loaded / the WASM initialized.
    await SdkLoadService.Ready;

    const upgradeToV2FeatureFlagEnabled = await this.configService.getFeatureFlag(
      FeatureFlag.EnrollAeadOnKeyRotation,
    );

    this.logService.info("[UserKey Rotation] Starting user key rotation...");

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
    const {
      masterKeyKdfConfig,
      masterKeySalt,
      cryptographicStateParameters: currentCryptographicStateParameters,
    } = await this.getCryptographicStateForUser(user);

    // Get new set of keys for the account.
    const { userKey: newUserKey, accountKeysRequest } = await this.getRotatedAccountKeysFlagged(
      user.id,
      masterKeyKdfConfig,
      user.email,
      currentCryptographicStateParameters,
      upgradeToV2FeatureFlagEnabled,
    );

    // Assemble the key rotation request
    const request = new RotateUserAccountKeysRequest(
      await this.getAccountUnlockDataRequest(
        user.id,
        currentCryptographicStateParameters.userKey,
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
      await this.getAccountDataRequest(
        currentCryptographicStateParameters.userKey,
        newUserKey,
        user,
      ),
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

    // temporary until userkey can be better verified
    await this.vaultTimeoutService.logOut();
  }

  protected async ensureIsAllowedToRotateUserKey(): Promise<void> {
    if ((await this.syncService.getLastSync()) === null) {
      this.logService.info("[Userkey rotation] Client was never synced. Aborting!");
      throw new Error(
        "The local vault is de-synced and the keys cannot be rotated. Please log out and log back in to resolve this issue.",
      );
    }
  }

  async getRotatedAccountKeysFlagged(
    userId: UserId,
    kdfConfig: KdfConfig,
    masterKeySalt: string,
    cryptographicStateParameters: V1CryptographicStateParameters | V2CryptographicStateParameters,
    v2UpgradeEnabled: boolean,
  ): Promise<{ userKey: UserKey; accountKeysRequest: AccountKeysRequest }> {
    if (v2UpgradeEnabled || cryptographicStateParameters.version === 2) {
      const keys = await this.getNewAccountKeysV2(
        userId,
        kdfConfig,
        masterKeySalt,
        cryptographicStateParameters,
      );
      return {
        userKey: keys.userKey,
        accountKeysRequest: await AccountKeysRequest.fromV2CryptographicState(keys),
      };
    } else {
      const keys = await this.getNewAccountKeysV1(
        cryptographicStateParameters as V1CryptographicStateParameters,
      );
      return {
        userKey: keys.userKey,
        accountKeysRequest: AccountKeysRequest.fromV1CryptographicState(keys),
      };
    }
  }

  /**
   * This method rotates the user key of a V1 user and re-encrypts the private key.
   * @deprecated Removed after roll-out of V2 encryption.
   */
  protected async getNewAccountKeysV1(
    cryptographicStateParameters: V1CryptographicStateParameters,
  ): Promise<V1UserCryptographicState> {
    // Account key rotation creates a new user key. All downstream data and keys need to be re-encrypted under this key.
    // Further, this method is used to create new keys in the event that the key hierarchy changes, such as for the
    // creation of a new signing key pair.
    const newUserKey = new SymmetricCryptoKey(
      PureCrypto.make_user_key_aes256_cbc_hmac(),
    ) as UserKey;

    // Re-encrypt the private key with the new user key
    // Rotation of the private key is not supported yet
    const privateKey = await this.encryptService.unwrapDecapsulationKey(
      new EncString(cryptographicStateParameters.publicKeyEncryptionKeyPair.wrappedPrivateKey),
      cryptographicStateParameters.userKey,
    );
    const newUserKeyWrappedPrivateKey = (
      await this.encryptService.wrapDecapsulationKey(privateKey, newUserKey)
    ).encryptedString! as string as WrappedPrivateKey;
    const publicKey = (await this.cryptoFunctionService.rsaExtractPublicKey(
      privateKey,
    )) as UnsignedPublicKey;

    return {
      userKey: newUserKey,
      publicKeyEncryptionKeyPair: {
        wrappedPrivateKey: newUserKeyWrappedPrivateKey,
        publicKey: publicKey,
      },
    };
  }

  /**
   * This method either enrolls a user from v1 encryption to v2 encryption, rotating the user key, or rotates the keys of a v2 user, staying on v2.
   */
  protected async getNewAccountKeysV2(
    userId: UserId,
    masterKeyKdfConfig: KdfConfig,
    masterKeySalt: string,
    cryptographicStateParameters: V1CryptographicStateParameters | V2CryptographicStateParameters,
  ): Promise<V2UserCryptographicState> {
    if (cryptographicStateParameters.version === 1) {
      return this.upgradeV1UserToV2UserAccountKeys(
        userId,
        masterKeyKdfConfig,
        masterKeySalt,
        cryptographicStateParameters as V1CryptographicStateParameters,
      );
    } else {
      return this.rotateV2UserAccountKeys(
        userId,
        masterKeyKdfConfig,
        masterKeySalt,
        cryptographicStateParameters as V2CryptographicStateParameters,
      );
    }
  }

  /**
   * Upgrades a V1 user to a V2 user by creating a new user key, re-encrypting the private key, generating a signature key-pair, and
   * finally creating a signed security state.
   */
  protected async upgradeV1UserToV2UserAccountKeys(
    userId: UserId,
    kdfConfig: KdfConfig,
    email: string,
    cryptographicStateParameters: V1CryptographicStateParameters,
  ): Promise<V2UserCryptographicState> {
    // Initialize an SDK with the current cryptographic state
    const sdk = await this.sdkClientFactory.createSdkClient(new NoopTokenProvider());
    await sdk.crypto().initialize_user_crypto({
      userId: asUuid(userId),
      kdfParams: kdfConfig.toSdkConfig(),
      email: email,
      privateKey: cryptographicStateParameters.publicKeyEncryptionKeyPair.wrappedPrivateKey,
      signingKey: undefined,
      securityState: undefined,
      method: {
        decryptedKey: { decrypted_user_key: cryptographicStateParameters.userKey.toBase64() },
      },
    });

    return fromSdkV2KeysToV2UserCryptographicState(sdk.crypto().make_keys_for_user_crypto_v2());
  }

  /**
   * Generates a new user key for a v2 user, and re-encrypts the private key, signing key.
   */
  protected async rotateV2UserAccountKeys(
    userId: UserId,
    kdfConfig: KdfConfig,
    email: string,
    cryptographicStateParameters: V2CryptographicStateParameters,
  ): Promise<V2UserCryptographicState> {
    // Initialize an SDK with the current cryptographic state
    const sdk = await this.sdkClientFactory.createSdkClient(new NoopTokenProvider());
    await sdk.crypto().initialize_user_crypto({
      userId: asUuid(userId),
      kdfParams: kdfConfig.toSdkConfig(),
      email: email,
      privateKey: cryptographicStateParameters.publicKeyEncryptionKeyPair.wrappedPrivateKey,
      signingKey: cryptographicStateParameters.signingKey,
      securityState: cryptographicStateParameters.securityState,
      method: {
        decryptedKey: { decrypted_user_key: cryptographicStateParameters.userKey.toBase64() },
      },
    });

    return fromSdkV2KeysToV2UserCryptographicState(sdk.crypto().get_v2_rotated_account_keys());
  }

  /**
   * Generates a new request for updating the master-password unlock/authentication data.
   */
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

  /**
   * Re-generates the accounts unlock methods, including master-password, passkey, trusted device, emergency access, and organization account recovery
   * for the new user key.
   */
  protected async getAccountUnlockDataRequest(
    userId: UserId,
    currentUserKey: UserKey,
    newUserKey: UserKey,
    masterPasswordAuthenticationAndUnlockData: MasterPasswordAuthenticationAndUnlockData,
    trustedEmergencyAccessGranteesPublicKeys: UnsignedPublicKey[],
    trustedOrganizationPublicKeys: UnsignedPublicKey[],
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

  /**
   * Verifies the trust of the organizations and emergency access users by prompting the user. Denying any of these will return early.
   */
  protected async verifyTrust(user: Account): Promise<{
    wasTrustDenied: boolean;
    trustedOrganizationPublicKeys: UnsignedPublicKey[];
    trustedEmergencyAccessUserPublicKeys: UnsignedPublicKey[];
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
      trustedOrganizationPublicKeys: organizations.map((d) => d.publicKey as UnsignedPublicKey),
      trustedEmergencyAccessUserPublicKeys: emergencyAccessGrantees.map(
        (d) => d.publicKey as UnsignedPublicKey,
      ),
    };
  }

  /**
   * Re-encrypts the account data owned by the user, such as ciphers, folders, and sends with the new user key.
   */
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

  /**
   * Gets the cryptographic state for a user. This can be a V1 user or a V2 user.
   */
  protected async getCryptographicStateForUser(user: Account): Promise<{
    masterKeyKdfConfig: KdfConfig;
    masterKeySalt: string;
    cryptographicStateParameters: V1CryptographicStateParameters | V2CryptographicStateParameters;
  }> {
    // Master password unlock
    const masterKeyKdfConfig: KdfConfig = (await this.firstValueFromOrThrow(
      this.kdfConfigService.getKdfConfig$(user.id),
      "KDF config",
    ))!;
    // The master key salt used for deriving the masterkey always needs to be trimmed and lowercased.
    const masterKeySalt = user.email.trim().toLowerCase();

    // V1 and V2 users both have a user key and a private key
    const currentUserKey: UserKey = (await this.firstValueFromOrThrow(
      this.keyService.userKey$(user.id),
      "User key",
    ))!;
    const currentUserKeyWrappedPrivateKey: WrappedPrivateKey = new EncString(
      (await this.firstValueFromOrThrow(
        this.keyService.userEncryptedPrivateKey$(user.id),
        "Private key",
      ))!,
    ).encryptedString! as string as WrappedPrivateKey;
    const publicKey = (await this.cryptoFunctionService.rsaExtractPublicKey(
      await this.encryptService.unwrapDecapsulationKey(
        new EncString(currentUserKeyWrappedPrivateKey),
        currentUserKey,
      ),
    )) as UnsignedPublicKey;

    if (this.isV1User(currentUserKey)) {
      return {
        masterKeyKdfConfig,
        masterKeySalt,
        cryptographicStateParameters: {
          version: 1,
          userKey: currentUserKey,
          publicKeyEncryptionKeyPair: {
            wrappedPrivateKey: currentUserKeyWrappedPrivateKey,
            publicKey: publicKey,
          },
        },
      };
    } else if (currentUserKey.inner().type === EncryptionType.CoseEncrypt0) {
      const signingKey = await this.firstValueFromOrThrow(
        this.keyService.userSigningKey$(user.id),
        "User signing key",
      );
      const securityState = await this.firstValueFromOrThrow(
        this.securityStateService.accountSecurityState$(user.id),
        "User security state",
      );

      return {
        masterKeyKdfConfig,
        masterKeySalt,
        cryptographicStateParameters: {
          version: 2,
          userKey: currentUserKey,
          publicKeyEncryptionKeyPair: {
            wrappedPrivateKey: currentUserKeyWrappedPrivateKey,
            publicKey: publicKey,
          },
          signingKey: signingKey,
          securityState: securityState,
        },
      };
    }

    /// AES-CBC (no-hmac) keys are not supported as user keys
    throw new Error(
      `Unsupported user key type: ${currentUserKey.inner().type}. Expected AesCbc256_HmacSha256_B64 or XChaCha20_Poly1305_B64.`,
    );
  }

  async firstValueFromOrThrow<T>(value: Observable<T>, name: string): Promise<T> {
    const result = await firstValueFrom(value);
    if (result == null) {
      throw new Error(`Failed to get ${name}`);
    }
    return result as T;
  }
}

export type V1CryptographicStateParameters = {
  version: 1;
  userKey: UserKey;
  publicKeyEncryptionKeyPair: {
    wrappedPrivateKey: WrappedPrivateKey;
    publicKey: UnsignedPublicKey;
  };
};

export type V2CryptographicStateParameters = {
  version: 2;
  userKey: UserKey;
  publicKeyEncryptionKeyPair: {
    wrappedPrivateKey: WrappedPrivateKey;
    publicKey: UnsignedPublicKey;
  };
  signingKey: WrappedSigningKey;
  securityState: SignedSecurityState;
};
