import { UserId } from "@bitwarden/common/types/guid";
import { UserKey, MasterKey, OrgKey, ProviderKey } from "@bitwarden/common/types/key";

import { EncString } from "../models/enc-string";
import { KdfConfig } from "../models/kdf-config";
import { SymmetricCryptoKey } from "../models/symmetric-crypto-key";

/**
 * Low-level cryptographic primitives that used to live on the KeyService.
 * These do not manage state, but instead are responsible for miscelaneous cryptographic functions
 * and account initialization.
 *
 * All functions here are deprecated. Do not add consumers to them where possible, and instead move
 * functionality to the SDK.
 *
 * @deprecated
 */
export abstract class LegacyCompatKeyService {
  /**
   * Generates a new user key
   * @deprecated Interacting with the master key directly is prohibited.
   * For new features please use the KM provided SDK methods for user cryptography initialization or reach out to the KM team.
   * @throws Error when master key is null or undefined.
   * @param masterKey The user's master key.
   * @returns A new user key and the master key protected version of it
   */
  abstract makeUserKey(masterKey: MasterKey): Promise<[UserKey, EncString]>;

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
   * Encrypts the provided user key with the provided master key.
   * @deprecated Interacting with the master key directly is prohibited. Use a high level function from MasterPasswordService instead.
   * @param masterKey The user's master key
   * @param userKey The user key
   * @throws Error when userKey or masterKey is null/undefined.
   * @returns The user key and the master key protected version of it
   */
  abstract encryptUserKeyWithMasterKey(
    masterKey: MasterKey,
    userKey: UserKey,
  ): Promise<[UserKey, EncString]>;

  /**
   * Creates a master password hash from the user's master password. Can
   * be used for local authentication or for server authentication depending
   * on the hashPurpose provided.
   * @deprecated Interacting with the master key directly is prohibited. Use a high level function from MasterPasswordService instead.
   * @param password The user's master password
   * @param key The user's master key or active's user master key.
   * @throws Error when password is null/undefined or key is null/undefined.
   * @returns The user's master password hash
   */
  abstract hashMasterKey(password: string, key: MasterKey): Promise<string>;

  /**
   * Makes a fresh attachment content encryption key and returns it along with a wrapped (encrypted) version of it.
   * @deprecated Do not use this for new code / new cryptographic designs.
   * @param key The organization's symmetric key or the user's user key to wrap the attachment key with
   * @returns The new attachment content encryption key and the wrapped version of it
   */
  abstract makeDataEncKey<T extends UserKey | OrgKey>(
    key: T,
  ): Promise<[SymmetricCryptoKey, EncString]>;

  /**
   * Creates a new organization key and encrypts it with the user's public key.
   * This method can also return Provider keys for creating new Provider users.
   * @deprecated New use-cases of this function are prohibited. Low-level cryptographic constructions and initialization should be done in the SDK.
   * @param userId The user id of the target user's public key to use.
   * @throws Error when userId is null or undefined.
   * @throws Error when no public key is found for the target user.
   * @returns The new encrypted OrgKey | ProviderKey and the decrypted key itself
   */
  abstract makeOrgKey<T extends OrgKey | ProviderKey>(userId: UserId): Promise<[EncString, T]>;

  /**
   * Generates a fingerprint phrase for the public key provided.
   *
   * @deprecated New use-cases of this function are prohibited. Low-level cryptographic constructions and initialization should be done in the SDK.
   * @throws Error when publicKey is null or undefined.
   * @param fingerprintMaterial Fingerprint material
   * @param publicKey The public key to generate the fingerprint phrase for.
   * @returns The fingerprint phrase
   */
  abstract getFingerprint(fingerprintMaterial: string, publicKey: Uint8Array): Promise<string[]>;

  /**
   * Generates a new keypair
   * @deprecated New use-cases of this function are prohibited. Low-level cryptographic constructions and initialization should be done in the SDK.
   * @param key A symmetric key to wrap the newly created private key with.
   * @returns A new keypair: [publicKey in Base64, wrapped privateKey]
   * @throws If the provided key is a null-ish value.
   */
  abstract makeKeyPair(key: SymmetricCryptoKey): Promise<[string, EncString]>;

  /**
   * @deprecated New use-cases of this function are prohibited. Low-level cryptographic constructions and initialization should be done in the SDK.
   * @param keyMaterial The key material to derive the send key from
   * @returns A new send key
   */
  abstract makeSendKey(keyMaterial: Uint8Array): Promise<SymmetricCryptoKey>;
}
