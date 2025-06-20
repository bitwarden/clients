import { Observable } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { KdfConfig } from "@bitwarden/key-management";

import { ForceSetPasswordReason } from "../../../auth/models/domain/force-set-password-reason";
import { HashPurpose } from "../../../platform/enums";
import { EncString } from "../../../platform/models/domain/enc-string";
import { UserId } from "../../../types/guid";
import { MasterKey, UserKey } from "../../../types/key";

export abstract class MasterPasswordServiceAbstraction {
  /**
   * An observable that emits if the user is being forced to set a password on login and why.
   * @param userId The user ID.
   * @throws If the user ID is missing.
   */
  abstract forceSetPasswordReason$: (userId: UserId) => Observable<ForceSetPasswordReason>;
  /**
   * An observable that emits the master key for the user.
   * @param userId The user ID.
   * @throws If the user ID is missing.
   */
  abstract masterKey$: (userId: UserId) => Observable<MasterKey>;
  /**
   * An observable that emits the master key hash for the user.
   * @param userId The user ID.
   * @throws If the user ID is missing.
   */
  abstract masterKeyHash$: (userId: UserId) => Observable<string>;
  /**
   * Returns the master key encrypted user key for the user.
   * @param userId The user ID.
   * @throws If the user ID is missing.
   */
  abstract getMasterKeyEncryptedUserKey: (userId: UserId) => Promise<EncString>;
  /**
   * Decrypts the user key with the provided master key
   * @param masterKey The user's master key
   * @param userId The desired user
   * @param userKey The user's encrypted symmetric key
   * @throws If either the MasterKey or UserKey are not resolved, or if the UserKey encryption type
   *         is neither AesCbc256_B64 nor AesCbc256_HmacSha256_B64
   * @returns The user key or null if the masterkey is wrong
   */
  abstract decryptUserKeyWithMasterKey: (
    masterKey: MasterKey,
    userId: string,
    userKey?: EncString,
  ) => Promise<UserKey | null>;
  /**
   * @param password The user's master password that will be used to derive a master key if one isn't found
   * @param userId The desired user
   * @throws Error when userId is null/undefined.
   * @throws Error when email or Kdf configuration cannot be found for the user.
   * @returns The user's master key if it exists, or a newly derived master key.
   */
  abstract getOrDeriveMasterKey(password: string, userId: UserId): Promise<MasterKey>;
  /**
   * Generates a master key from the provided password
   * @param password The user's master password
   * @param email The user's email
   * @param KdfConfig The user's key derivation function configuration
   * @returns A master key derived from the provided password
   */
  abstract makeMasterKey(password: string, email: string, KdfConfig: KdfConfig): Promise<MasterKey>;
  /**
   * Creates a master password hash from the user's master password. Can
   * be used for local authentication or for server authentication depending
   * on the hashPurpose provided.
   * @param password The user's master password
   * @param key The user's master key or active's user master key.
   * @param hashPurpose The iterations to use for the hash
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
   * @param masterPassword The user's master password
   * @param masterKey The user's master key
   * @param userId The id of the user to do the operation for.
   * @throws Error when master key is null/undefined.
   * @returns True if the provided master password matches either the stored
   * key hash or the server key hash
   */
  abstract compareKeyHash(
    masterPassword: string,
    masterKey: MasterKey,
    userId: UserId,
  ): Promise<boolean>;
}

export abstract class InternalMasterPasswordServiceAbstraction extends MasterPasswordServiceAbstraction {
  /**
   * Set the master key for the user.
   * Note: Use {@link clearMasterKey} to clear the master key.
   * @param masterKey The master key.
   * @param userId The user ID.
   * @throws If the user ID or master key is missing.
   */
  abstract setMasterKey: (masterKey: MasterKey, userId: UserId) => Promise<void>;
  /**
   * Clear the master key for the user.
   * @param userId The user ID.
   * @throws If the user ID is missing.
   */
  abstract clearMasterKey: (userId: UserId) => Promise<void>;
  /**
   * Set the master key hash for the user.
   * Note: Use {@link clearMasterKeyHash} to clear the master key hash.
   * @param masterKeyHash The master key hash.
   * @param userId The user ID.
   * @throws If the user ID or master key hash is missing.
   */
  abstract setMasterKeyHash: (masterKeyHash: string, userId: UserId) => Promise<void>;
  /**
   * Clear the master key hash for the user.
   * @param userId The user ID.
   * @throws If the user ID is missing.
   */
  abstract clearMasterKeyHash: (userId: UserId) => Promise<void>;

  /**
   * Set the master key encrypted user key for the user.
   * @param encryptedKey The master key encrypted user key.
   * @param userId The user ID.
   * @throws If the user ID or encrypted key is missing.
   */
  abstract setMasterKeyEncryptedUserKey: (encryptedKey: EncString, userId: UserId) => Promise<void>;
  /**
   * Set the force set password reason for the user.
   * @param reason The reason the user is being forced to set a password.
   * @param userId The user ID.
   * @throws If the user ID or reason is missing.
   */
  abstract setForceSetPasswordReason: (
    reason: ForceSetPasswordReason,
    userId: UserId,
  ) => Promise<void>;
}
