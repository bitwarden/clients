import { Observable } from "rxjs";

import { ProfileOrganizationResponse } from "@bitwarden/common/admin-console/models/response/profile-organization.response";
import { ProfileProviderOrganizationResponse } from "@bitwarden/common/admin-console/models/response/profile-provider-organization.response";
import { ProfileProviderResponse } from "@bitwarden/common/admin-console/models/response/profile-provider.response";
import {
  EncryptedString,
  EncString,
} from "@bitwarden/common/key-management/crypto/models/enc-string";
import { KeySuffixOptions, HashPurpose } from "@bitwarden/common/platform/enums";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import {
  UserKey,
  MasterKey,
  OrgKey,
  ProviderKey,
  CipherKey,
  UserPrivateKey,
  UserPublicKey,
} from "@bitwarden/common/types/key";

import { KdfConfig } from "../models/kdf-config";

export class UserPrivateKeyDecryptionFailedError extends Error {
  constructor() {
    super("Failed to decrypt the user's private key.");
  }
}

/**
 * An object containing all the users key needed to decrypt a users personal and organization vaults.
 */
export type CipherDecryptionKeys = {
  /**
   * A users {@link UserKey} that is useful for decrypted ciphers in the users personal vault.
   */
  userKey: UserKey;

  /**
   * A users decrypted organization keys.
   */
  orgKeys: Record<OrganizationId, OrgKey> | null;
};

export abstract class KeyService {
  /**
   * Retrieves a stream of the given users {@see UserKey} values. Can emit null if the user does not have a user key, e.g. the user
   * is in a locked or logged out state.
   * @param userId The user id of the user to get the {@see UserKey} for.
   */
  abstract userKey$(userId: UserId): Observable<UserKey | null>;
  /**
   * Returns the an observable key for the given user id.
   *
   * @note this observable represents only user keys stored in memory. A null value does not indicate that we cannot load a user key from storage.
   * @param userId The desired user
   */
  abstract getInMemoryUserKeyFor$(userId: UserId): Observable<UserKey>;
  /**
   * Sets the provided user key and stores
   * any other necessary versions (such as auto, biometrics,
   * or pin)
   *
   * @throws Error when key or userId is null. Lock the account to clear a key.
   * @param key The user key to set
   * @param userId The desired user
   */
  abstract setUserKey(key: UserKey, userId: UserId): Promise<void>;
  /**
   * Sets the provided user keys and stores any other necessary versions
   * (such as auto, biometrics, or pin).
   * Also sets the user's encrypted private key in storage and
   * clears the decrypted private key from memory
   * Note: does not clear the private key if null is provided
   *
   * @throws Error when userKey, encPrivateKey or userId is null
   * @throws UserPrivateKeyDecryptionFailedError when the userKey cannot decrypt encPrivateKey
   * @param userKey The user key to set
   * @param encPrivateKey An encrypted private key
   * @param userId The desired user
   */
  abstract setUserKeys(userKey: UserKey, encPrivateKey: string, userId: UserId): Promise<void>;
  /**
   * Gets the user key from memory and sets it again,
   * kicking off a refresh of any additional keys
   * (such as auto, biometrics, or pin)
   * @param userId The target user to refresh keys for.
   * @throws Error when userId is null or undefined.
   * @throws When userKey doesn't exist in memory for the target user.
   */
  abstract refreshAdditionalKeys(userId: UserId): Promise<void>;

  /**
   * Observable value that returns whether or not the user has ever had a userKey,
   * i.e. has ever been unlocked/decrypted. This is key for differentiating between TDE locked and standard locked states.
   */
  abstract everHadUserKey$(userId: UserId): Observable<boolean>;

  /**
   * Retrieves the user key
   * @param userId The desired user
   * @returns The user key
   *
   * @deprecated Use {@link userKey$} with a required {@link UserId} instead.
   */
  abstract getUserKey(userId?: string): Promise<UserKey>;

  /**
   * Retrieves the user key from storage
   * @param keySuffix The desired version of the user's key to retrieve
   * @param userId The desired user
   * @returns The user key
   * @throws Error when userId is null or undefined.
   */
  abstract getUserKeyFromStorage(
    keySuffix: KeySuffixOptions,
    userId: string,
  ): Promise<UserKey | null>;

  /**
   * Determines whether the user key is available for the given user in memory.
   * @param userId The desired user. If null or undefined, will return false.
   * @returns True if the user key is available, returns false otherwise.
   */
  abstract hasUserKey(userId: UserId): Promise<boolean>;

  /**
   * Generates a new user key
   * @deprecated Interacting with the master key directly is prohibited. Use {@link makeUserKeyV1} instead.
   * @throws Error when master key is null and there is no active user
   * @param masterKey The user's master key. When null, grabs master key from active user.
   * @returns A new user key and the master key protected version of it
   */
  abstract makeUserKey(masterKey: MasterKey | null): Promise<[UserKey, EncString]>;
  /**
   * Generates a new user key for a V1 user
   * Note: This will be replaced by a higher level function to initialize a whole users cryptographic state in the near future.
   * @returns A new user key
   */
  abstract makeUserKeyV1(): Promise<UserKey>;
  /**
   * Clears the user's stored version of the user key
   * @param keySuffix The desired version of the key to clear
   * @param userId The desired user
   * @throws Error when userId is null or undefined.
   */
  abstract clearStoredUserKey(keySuffix: KeySuffixOptions, userId: string): Promise<void>;
  /**
   * Retrieves the user's master key if it is in state, or derives it from the provided password
   * @param password The user's master password that will be used to derive a master key if one isn't found
   * @param userId The desired user
   * @deprecated Interacting with the master key directly is prohibited. Use a high level function from MasterPasswordService instead.
   * @throws Error when userId is null/undefined.
   * @throws Error when email or Kdf configuration cannot be found for the user.
   * @returns The user's master key if it exists, or a newly derived master key.
   */
  abstract getOrDeriveMasterKey(password: string, userId: UserId): Promise<MasterKey>;
  /**
   * Generates a master key from the provided password
   * @deprecated Interacting with the master key directly is prohibited.
   * @param password The user's master password
   * @param email The user's email
   * @param KdfConfig The user's key derivation function configuration
   * @returns A master key derived from the provided password
   */
  abstract makeMasterKey(password: string, email: string, kdfConfig: KdfConfig): Promise<MasterKey>;
  /**
   * Encrypts the existing (or provided) user key with the
   * provided master key
   * @deprecated Interacting with the master key directly is prohibited. Use a high level function from MasterPasswordService instead.
   * @param masterKey The user's master key
   * @param userKey The user key
   * @returns The user key and the master key protected version of it
   */
  abstract encryptUserKeyWithMasterKey(
    masterKey: MasterKey,
    userKey?: UserKey,
  ): Promise<[UserKey, EncString]>;
  /**
   * Creates a master password hash from the user's master password. Can
   * be used for local authentication or for server authentication depending
   * on the hashPurpose provided.
   * @deprecated Interacting with the master key directly is prohibited. Use a high level function from MasterPasswordService instead.
   * @param password The user's master password
   * @param key The user's master key or active's user master key.
   * @param hashPurpose The iterations to use for the hash. Defaults to {@link HashPurpose.ServerAuthorization}.
   * @throws Error when password is null/undefined or key is null/undefined.
   * @returns The user's master password hash
   */
  abstract hashMasterKey(
    password: string,
    key: MasterKey,
    hashPurpose?: HashPurpose,
  ): Promise<string>;
  /**
   * Compares the provided master password to the stored password hash.
   * @deprecated Interacting with the master key directly is prohibited. Use a high level function from MasterPasswordService instead.
   * @param masterPassword The user's master password
   * @param masterKey The user's master key
   * @param userId The id of the user to do the operation for.
   * @throws Error when master key is null/undefined.
   * @returns True if the derived master password hash matches the stored
   * key hash, false otherwise.
   */
  abstract compareKeyHash(
    masterPassword: string,
    masterKey: MasterKey,
    userId: UserId,
  ): Promise<boolean>;
  /**
   * Stores the encrypted organization keys and clears any decrypted
   * organization keys currently in memory
   * @param orgs The organizations to set keys for
   * @param providerOrgs The provider organizations to set keys for
   * @param userId The user id of the user to set the org keys for
   */
  abstract setOrgKeys(
    orgs: ProfileOrganizationResponse[],
    providerOrgs: ProfileProviderOrganizationResponse[],
    userId: UserId,
  ): Promise<void>;
  /**
   * Retrieves a stream of the active users organization keys,
   * will NOT emit any value if there is no active user.
   *
   * @deprecated Use {@link orgKeys$} with a required {@link UserId} instead.
   */
  abstract activeUserOrgKeys$: Observable<Record<OrganizationId, OrgKey>>;
  /**
   * Returns the organization's symmetric key
   * @deprecated Use the observable userOrgKeys$ and `map` to the desired {@link OrgKey} instead
   * @throws Error when not active user
   * @param orgId The desired organization
   * @returns The organization's symmetric key
   */
  abstract getOrgKey(orgId: string): Promise<OrgKey | null>;
  /**
   * Uses the org key to derive a new symmetric key for encrypting data
   * @param key The organization's symmetric key
   */
  abstract makeDataEncKey<T extends UserKey | OrgKey>(
    key: T,
  ): Promise<[SymmetricCryptoKey, EncString]>;

  /**
   * Stores the provider keys for a given user.
   * @param orgs The provider orgs for which to save the keys from.
   * @param userId The user id of the user for which to store the keys for.
   */
  abstract setProviderKeys(orgs: ProfileProviderResponse[], userId: UserId): Promise<void>;
  /**
   *
   * @throws Error when providerId is null or no active user
   * @param providerId The desired provider
   * @returns The provider's symmetric key
   */
  abstract getProviderKey(providerId: string): Promise<ProviderKey | null>;
  /**
   * Creates a new organization key and encrypts it with the user's public key.
   * This method can also return Provider keys for creating new Provider users.
   * @param userId The user id of the target user's public key to use.
   * @throws Error when userId is null or undefined.
   * @throws Error when no public key is found for the target user.
   * @returns The new encrypted OrgKey | ProviderKey and the decrypted key itself
   */
  abstract makeOrgKey<T extends OrgKey | ProviderKey>(userId: UserId): Promise<[EncString, T]>;
  /**
   * Sets the user's encrypted private key in storage and
   * clears the decrypted private key from memory
   * Note: does not clear the private key if null is provided
   * @param encPrivateKey An encrypted private key
   */
  abstract setPrivateKey(encPrivateKey: string, userId: UserId): Promise<void>;

  /**
   * Gets an observable stream of the given users decrypted private key, will emit null if the user
   * doesn't have a UserKey to decrypt the encrypted private key or null if the user doesn't have an
   * encrypted private key at all.
   *
   * @param userId The user id of the user to get the data for.
   * @returns An observable stream of the decrypted private key or null.
   * @throws Error when decryption of the encrypted private key fails.
   */
  abstract userPrivateKey$(userId: UserId): Observable<UserPrivateKey | null>;

  /**
   * Gets an observable stream of the given users encrypted private key, will emit null if the user
   * doesn't have an encrypted private key at all.
   *
   * @param userId The user id of the user to get the data for.
   *
   * @deprecated Temporary function to allow the SDK to be initialized after the login process, it
   * will be removed when auth has been migrated to the SDK.
   */
  abstract userEncryptedPrivateKey$(userId: UserId): Observable<EncryptedString | null>;

  /**
   * Gets an observable stream of the given users decrypted private key and public key, guaranteed to be consistent.
   * Will emit null if the user doesn't have a userkey to decrypt the encrypted private key, or null if the user doesn't have a private key
   * at all.
   *
   * @param userId The user id of the user to get the data for.
   */
  abstract userEncryptionKeyPair$(
    userId: UserId,
  ): Observable<{ privateKey: UserPrivateKey; publicKey: UserPublicKey } | null>;

  /**
   * Gets an observable stream of the given users decrypted private key and public key, guaranteed to be consistent.
   * Will emit null if the user doesn't have a userkey to decrypt the encrypted private key, or null if the user doesn't have a private key
   * at all.
   *
   * @param userId The user id of the user to get the data for.
   */
  abstract userEncryptionKeyPair$(
    userId: UserId,
  ): Observable<{ privateKey: UserPrivateKey; publicKey: UserPublicKey } | null>;

  /**
   * Generates a fingerprint phrase for the public key provided.
   *
   * @throws Error when publicKey is null or undefined.
   * @param fingerprintMaterial Fingerprint material
   * @param publicKey The public key to generate the fingerprint phrase for.
   * @returns The fingerprint phrase
   */
  abstract getFingerprint(fingerprintMaterial: string, publicKey: Uint8Array): Promise<string[]>;
  /**
   * Generates a new keypair
   * @param key A key to encrypt the private key with. If not provided,
   * defaults to the user key
   * @returns A new keypair: [publicKey in Base64, encrypted privateKey]
   * @throws If the provided key is a null-ish value.
   */
  abstract makeKeyPair(key: SymmetricCryptoKey): Promise<[string, EncString]>;
  /**
   * Clears the user's pin keys from storage
   * Note: This will remove the stored pin and as a result,
   * disable pin protection for the user
   * @param userId The desired user
   * @throws Error when provided userId is null or undefined
   */
  abstract clearPinKeys(userId: UserId): Promise<void>;
  /**
   * @param keyMaterial The key material to derive the send key from
   * @returns A new send key
   */
  abstract makeSendKey(keyMaterial: Uint8Array): Promise<SymmetricCryptoKey>;
  /**
   * Clears all of the user's keys from storage
   * @param userId The user's Id
   * @throws Error when provided userId is null or undefined
   */
  abstract clearKeys(userId: UserId): Promise<void>;
  abstract randomNumber(min: number, max: number): Promise<number>;
  /**
   * Generates a new cipher key
   * @returns A new cipher key
   */
  abstract makeCipherKey(): Promise<CipherKey>;

  /**
   * Initialize all necessary crypto keys needed for a new account.
   * Warning! This completely replaces any existing keys!
   * @param userId The user id of the target user.
   * @returns The user's newly created  public key, private key, and encrypted private key
   * @throws An error if the userId is null or undefined.
   * @throws An error if the user already has a user key.
   */
  abstract initAccount(userId: UserId): Promise<{
    userKey: UserKey;
    publicKey: string;
    privateKey: EncString;
  }>;

  /**
   * Retrieves all the keys needed for decrypting Ciphers
   * @param userId The user id of the keys to retrieve or null if the user is not Unlocked
   * @param legacySupport `true` if you need to support retrieving the legacy version of the users key, `false` if
   * you do not need legacy support. Use `true` by necessity only. Defaults to `false`. Legacy support is for users
   * that may not have updated to use the new {@link UserKey} yet.
   *
   * @throws If an invalid user id is passed in.
   */
  abstract cipherDecryptionKeys$(
    userId: UserId,
    legacySupport?: boolean,
  ): Observable<CipherDecryptionKeys | null>;

  /**
   * Gets an observable of org keys for the given user.
   * @param userId The user id of the user of which to get the keys for.
   * @return An observable stream of the users organization keys if they are unlocked, or null if the user is not unlocked.
   * The observable will stay alive through locks/unlocks.
   *
   * @throws If an invalid user id is passed in.
   */
  abstract orgKeys$(userId: UserId): Observable<Record<OrganizationId, OrgKey> | null>;

  /**
   * Gets an observable stream of the given users encrypted organisation keys.
   *
   * @param userId The user id of the user to get the data for.
   *
   * @deprecated Temporary function to allow the SDK to be initialized after the login process, it
   * will be removed when auth has been migrated to the SDK.
   */
  abstract encryptedOrgKeys$(userId: UserId): Observable<Record<OrganizationId, EncString>>;

  /**
   * Gets an observable stream of the users public key. If the user is does not have
   * a {@link UserKey} or {@link UserPrivateKey} that is decryptable, this will emit null.
   *
   * @param userId The user id of the user of which to get the public key for.
   *
   * @throws If an invalid user id is passed in.
   */
  abstract userPublicKey$(userId: UserId): Observable<UserPublicKey | null>;

  /**
   * Validates that a userkey is correct for a given user
   * @param key The key to validate
   * @param userId The user id for the key
   */
  abstract validateUserKey(key: UserKey, userId: UserId): Promise<boolean>;
}
