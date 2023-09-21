import { ProfileOrganizationResponse } from "../../admin-console/models/response/profile-organization.response";
import { ProfileProviderOrganizationResponse } from "../../admin-console/models/response/profile-provider-organization.response";
import { ProfileProviderResponse } from "../../admin-console/models/response/profile-provider.response";
import { KdfConfig } from "../../auth/models/domain/kdf-config";
import { KeySuffixOptions, KdfType, HashPurpose } from "../../enums";
import { EncArrayBuffer } from "../models/domain/enc-array-buffer";
import { EncString } from "../models/domain/enc-string";
import {
  MasterKey,
  OrgKey,
  PinKey,
  ProviderKey,
  SymmetricCryptoKey,
  UserKey,
} from "../models/domain/symmetric-crypto-key";

export abstract class CryptoService {
  /**
   * Sets the provided user key and stores
   * any other necessary versions (such as auto, biometrics,
   * or pin)
   * @param key The user key to set
   * @param userId The desired user
   */
  setUserKey: (key: UserKey, userId?: string) => Promise<void>;
  /**
   * Gets the user key from memory and sets it again,
   * kicking off a refresh of any additional keys
   * (such as auto, biometrics, or pin)
   */
  /**
   * Check if the current sessions has ever had a user key, i.e. has ever been unlocked/decrypted.
   * This is key for differentiating between TDE locked and standard locked states.
   * @param userId The desired user
   * @returns True if the current session has ever had a user key
   */
  getEverHadUserKey: (userId?: string) => Promise<boolean>;
  refreshAdditionalKeys: () => Promise<void>;
  /**
   * Retrieves the user key
   * @param userId The desired user
   * @returns The user key
   */
  getUserKey: (userId?: string) => Promise<UserKey>;

  /**
   * Checks if the user is using an old encryption scheme that used the master key
   * for encryption of data instead of the user key.
   */
  isLegacyUser: (masterKey?: MasterKey, userId?: string) => Promise<boolean>;
  /**
   * Use for encryption/decryption of data in order to support legacy
   * encryption models. It will return the user key if available,
   * if not it will return the master key.
   * @param userId The desired user
   */
  getUserKeyWithLegacySupport: (userId?: string) => Promise<UserKey>;
  /**
   * Retrieves the user key from storage
   * @param keySuffix The desired version of the user's key to retrieve
   * @param userId The desired user
   * @returns The user key
   */
  getUserKeyFromStorage: (keySuffix: KeySuffixOptions, userId?: string) => Promise<UserKey>;

  /**
   * @returns True if the user key is available
   */
  hasUserKey: () => Promise<boolean>;
  /**
   * @param userId The desired user
   * @returns True if the user key is set in memory
   */
  hasUserKeyInMemory: (userId?: string) => Promise<boolean>;
  /**
   * @param keySuffix The desired version of the user's key to check
   * @param userId The desired user
   * @returns True if the provided version of the user key is stored
   */
  hasUserKeyStored: (keySuffix: KeySuffixOptions, userId?: string) => Promise<boolean>;
  /**
   * Generates a new user key
   * @param masterKey The user's master key
   * @returns A new user key and the master key protected version of it
   */
  makeUserKey: (key: MasterKey) => Promise<[UserKey, EncString]>;
  /**
   * Clears the user key
   * @param clearStoredKeys Clears all stored versions of the user keys as well,
   * such as the biometrics key
   * @param userId The desired user
   */
  clearUserKey: (clearSecretStorage?: boolean, userId?: string) => Promise<void>;
  /**
   * Clears the user's stored version of the user key
   * @param keySuffix The desired version of the key to clear
   * @param userId The desired user
   */
  clearStoredUserKey: (keySuffix: KeySuffixOptions, userId?: string) => Promise<void>;
  /**
   * Stores the master key encrypted user key
   * @param userKeyMasterKey The master key encrypted user key to set
   * @param userId The desired user
   */
  setMasterKeyEncryptedUserKey: (UserKeyMasterKey: string, userId?: string) => Promise<void>;
  /**
   * Sets the user's master key
   * @param key The user's master key to set
   * @param userId The desired user
   */
  setMasterKey: (key: MasterKey, userId?: string) => Promise<void>;
  /**
   * @param userId The desired user
   * @returns The user's master key
   */
  getMasterKey: (userId?: string) => Promise<MasterKey>;

  /**
   * @param password The user's master password that will be used to derive a master key if one isn't found
   * @param userId The desired user
   */
  getOrDeriveMasterKey: (password: string, userId?: string) => Promise<MasterKey>;
  /**
   * Generates a master key from the provided password
   * @param password The user's master password
   * @param email The user's email
   * @param kdf The user's selected key derivation function to use
   * @param KdfConfig The user's key derivation function configuration
   * @returns A master key derived from the provided password
   */
  makeMasterKey: (
    password: string,
    email: string,
    kdf: KdfType,
    KdfConfig: KdfConfig
  ) => Promise<MasterKey>;
  /**
   * Clears the user's master key
   * @param userId The desired user
   */
  clearMasterKey: (userId?: string) => Promise<void>;
  /**
   * Encrypts the existing (or provided) user key with the
   * provided master key
   * @param masterKey The user's master key
   * @param userKey The user key
   * @returns The user key and the master key protected version of it
   */
  encryptUserKeyWithMasterKey: (
    masterKey: MasterKey,
    userKey?: UserKey
  ) => Promise<[UserKey, EncString]>;
  /**
   * Decrypts the user key with the provided master key
   * @param masterKey The user's master key
   * @param userKey The user's encrypted symmetric key
   * @param userId The desired user
   * @returns The user key
   */
  decryptUserKeyWithMasterKey: (
    masterKey: MasterKey,
    userKey?: EncString,
    userId?: string
  ) => Promise<UserKey>;
  /**
   * Creates a master password hash from the user's master password. Can
   * be used for local authentication or for server authentication depending
   * on the hashPurpose provided.
   * @param password The user's master password
   * @param key The user's master key
   * @param hashPurpose The iterations to use for the hash
   * @returns The user's master password hash
   */
  hashMasterKey: (password: string, key: MasterKey, hashPurpose?: HashPurpose) => Promise<string>;
  /**
   * Sets the user's master password hash
   * @param keyHash The user's master password hash to set
   */
  setMasterKeyHash: (keyHash: string) => Promise<void>;
  /**
   * @returns The user's master password hash
   */
  getMasterKeyHash: () => Promise<string>;
  /**
   * Clears the user's stored master password hash
   * @param userId The desired user
   */
  clearMasterKeyHash: (userId?: string) => Promise<void>;
  /**
   * Compares the provided master password to the stored password hash and server password hash.
   * Updates the stored hash if outdated.
   * @param masterPassword The user's master password
   * @param key The user's master key
   * @returns True if the provided master password matches either the stored
   * key hash or the server key hash
   */
  compareAndUpdateKeyHash: (masterPassword: string, masterKey: MasterKey) => Promise<boolean>;
  /**
   * Stores the encrypted organization keys and clears any decrypted
   * organization keys currently in memory
   * @param orgs The organizations to set keys for
   * @param providerOrgs The provider organizations to set keys for
   */
  setOrgKeys: (
    orgs: ProfileOrganizationResponse[],
    providerOrgs: ProfileProviderOrganizationResponse[]
  ) => Promise<void>;
  /**
   * Returns the organization's symmetric key
   * @param orgId The desired organization
   * @returns The organization's symmetric key
   */
  getOrgKey: (orgId: string) => Promise<OrgKey>;
  /**
   * @returns A map of the organization Ids to their symmetric keys
   */
  getOrgKeys: () => Promise<Map<string, SymmetricCryptoKey>>;
  /**
   * Uses the org key to derive a new symmetric key for encrypting data
   * @param orgKey The organization's symmetric key
   */
  makeDataEncKey: <T extends UserKey | OrgKey>(key: T) => Promise<[SymmetricCryptoKey, EncString]>;
  /**
   * Clears the user's stored organization keys
   * @param memoryOnly Clear only the in-memory keys
   * @param userId The desired user
   */
  clearOrgKeys: (memoryOnly?: boolean, userId?: string) => Promise<void>;
  /**
   * Stores the encrypted provider keys and clears any decrypted
   * provider keys currently in memory
   * @param providers The providers to set keys for
   */
  setProviderKeys: (orgs: ProfileProviderResponse[]) => Promise<void>;
  /**
   * @param providerId The desired provider
   * @returns The provider's symmetric key
   */
  getProviderKey: (providerId: string) => Promise<ProviderKey>;
  /**
   * @returns A map of the provider Ids to their symmetric keys
   */
  getProviderKeys: () => Promise<Map<string, ProviderKey>>;
  /**
   * @param memoryOnly Clear only the in-memory keys
   * @param userId The desired user
   */
  clearProviderKeys: (memoryOnly?: boolean, userId?: string) => Promise<void>;
  /**
   * Returns the public key from memory. If not available, extracts it
   * from the private key and stores it in memory
   * @returns The user's public key
   */
  getPublicKey: () => Promise<Uint8Array>;
  /**
   * Creates a new organization key and encrypts it with the user's public key.
   * This method can also return Provider keys for creating new Provider users.
   * @returns The new encrypted org key and the decrypted key itself
   */
  makeOrgKey: <T extends OrgKey | ProviderKey>() => Promise<[EncString, T]>;
  /**
   * Sets the the user's encrypted private key in storage and
   * clears the decrypted private key from memory
   * Note: does not clear the private key if null is provided
   * @param encPrivateKey An encrypted private key
   */
  setPrivateKey: (encPrivateKey: string) => Promise<void>;
  /**
   * Returns the private key from memory. If not available, decrypts it
   * from storage and stores it in memory
   * @returns The user's private key
   */
  getPrivateKey: () => Promise<Uint8Array>;
  /**
   * Generates a fingerprint phrase for the user based on their public key
   * @param fingerprintMaterial Fingerprint material
   * @param publicKey The user's public key
   * @returns The user's fingerprint phrase
   */
  getFingerprint: (fingerprintMaterial: string, publicKey?: Uint8Array) => Promise<string[]>;
  /**
   * Generates a new keypair
   * @param key A key to encrypt the private key with. If not provided,
   * defaults to the user key
   * @returns A new keypair: [publicKey in Base64, encrypted privateKey]
   */
  makeKeyPair: (key?: SymmetricCryptoKey) => Promise<[string, EncString]>;
  /**
   * Clears the user's key pair
   * @param memoryOnly Clear only the in-memory keys
   * @param userId The desired user
   */
  clearKeyPair: (memoryOnly?: boolean, userId?: string) => Promise<void[]>;
  /**
   * @param pin The user's pin
   * @param salt The user's salt
   * @param kdf The user's kdf
   * @param kdfConfig The user's kdf config
   * @returns A key derived from the user's pin
   */
  makePinKey: (pin: string, salt: string, kdf: KdfType, kdfConfig: KdfConfig) => Promise<PinKey>;
  /**
   * Clears the user's pin keys from storage
   * Note: This will remove the stored pin and as a result,
   * disable pin protection for the user
   * @param userId The desired user
   */
  clearPinKeys: (userId?: string) => Promise<void>;
  /**
   * Decrypts the user key with their pin
   * @param pin The user's PIN
   * @param salt The user's salt
   * @param kdf The user's KDF
   * @param kdfConfig The user's KDF config
   * @param pinProtectedUserKey The user's PIN protected symmetric key, if not provided
   * it will be retrieved from storage
   * @returns The decrypted user key
   */
  decryptUserKeyWithPin: (
    pin: string,
    salt: string,
    kdf: KdfType,
    kdfConfig: KdfConfig,
    protectedKeyCs?: EncString
  ) => Promise<UserKey>;
  /**
   * Creates a new Pin key that encrypts the user key instead of the
   * master key. Clears the old Pin key from state.
   * @param masterPasswordOnRestart True if Master Password on Restart is enabled
   * @param pin User's PIN
   * @param email User's email
   * @param kdf User's KdfType
   * @param kdfConfig User's KdfConfig
   * @param oldPinKey The old Pin key from state (retrieved from different
   * places depending on if Master Password on Restart was enabled)
   * @returns The user key
   */
  decryptAndMigrateOldPinKey: (
    masterPasswordOnRestart: boolean,
    pin: string,
    email: string,
    kdf: KdfType,
    kdfConfig: KdfConfig,
    oldPinKey: EncString
  ) => Promise<UserKey>;
  /**
   * Replaces old master auto keys with new user auto keys
   */
  migrateAutoKeyIfNeeded: (userId?: string) => Promise<void>;
  /**
   * @param keyMaterial The key material to derive the send key from
   * @returns A new send key
   */
  makeSendKey: (keyMaterial: Uint8Array) => Promise<SymmetricCryptoKey>;
  /**
   * Clears all of the user's keys from storage
   * @param userId The user's Id
   */
  clearKeys: (userId?: string) => Promise<any>;
  /**
   * RSA encrypts a value.
   * @param data The data to encrypt
   * @param publicKey The public key to use for encryption, if not provided, the user's public key will be used
   * @returns The encrypted data
   */
  rsaEncrypt: (data: Uint8Array, publicKey?: Uint8Array) => Promise<EncString>;
  /**
   * Decrypts a value using RSA.
   * @param encValue The encrypted value to decrypt
   * @param privateKeyValue The private key to use for decryption
   * @returns The decrypted value
   */
  rsaDecrypt: (encValue: string, privateKeyValue?: Uint8Array) => Promise<Uint8Array>;
  randomNumber: (min: number, max: number) => Promise<number>;

  /**
   * Initialize all necessary crypto keys needed for a new account.
   * Warning! This completely replaces any existing keys!
   * @returns The user's newly created  public key, private key, and encrypted private key
   */
  initAccount: () => Promise<{
    userKey: UserKey;
    publicKey: string;
    privateKey: EncString;
  }>;

  /**
   * @deprecated Left for migration purposes. Use decryptUserKeyWithPin instead.
   */
  decryptMasterKeyWithPin: (
    pin: string,
    salt: string,
    kdf: KdfType,
    kdfConfig: KdfConfig,
    protectedKeyCs?: EncString
  ) => Promise<MasterKey>;
  /**
   * Previously, the master key was used for any additional key like the biometrics or pin key.
   * We have switched to using the user key for these purposes. This method is for clearing the state
   * of the older keys on logout or post migration.
   * @param keySuffix The desired type of key to clear
   * @param userId The desired user
   */
  clearDeprecatedKeys: (keySuffix: KeySuffixOptions, userId?: string) => Promise<void>;
  /**
   * @deprecated July 25 2022: Get the key you need from CryptoService (getKeyForUserEncryption or getOrgKey)
   * and then call encryptService.encrypt
   */
  encrypt: (plainValue: string | Uint8Array, key?: SymmetricCryptoKey) => Promise<EncString>;
  /**
   * @deprecated July 25 2022: Get the key you need from CryptoService (getKeyForUserEncryption or getOrgKey)
   * and then call encryptService.encryptToBytes
   */
  encryptToBytes: (plainValue: Uint8Array, key?: SymmetricCryptoKey) => Promise<EncArrayBuffer>;
  /**
   * @deprecated July 25 2022: Get the key you need from CryptoService (getKeyForUserEncryption or getOrgKey)
   * and then call encryptService.decryptToBytes
   */
  decryptToBytes: (encString: EncString, key?: SymmetricCryptoKey) => Promise<Uint8Array>;
  /**
   * @deprecated July 25 2022: Get the key you need from CryptoService (getKeyForUserEncryption or getOrgKey)
   * and then call encryptService.decryptToUtf8
   */
  decryptToUtf8: (encString: EncString, key?: SymmetricCryptoKey) => Promise<string>;
  /**
   * @deprecated July 25 2022: Get the key you need from CryptoService (getKeyForUserEncryption or getOrgKey)
   * and then call encryptService.decryptToBytes
   */
  decryptFromBytes: (encBuffer: EncArrayBuffer, key: SymmetricCryptoKey) => Promise<Uint8Array>;
}
