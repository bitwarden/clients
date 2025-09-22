import { Observable } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { KdfConfig } from "@bitwarden/key-management";

import { ForceSetPasswordReason } from "../../../auth/models/domain/force-set-password-reason";
import { UserId } from "../../../types/guid";
import { MasterKey, UserKey } from "../../../types/key";
import { EncString } from "../../crypto/models/enc-string";
import {
  MasterPasswordAuthenticationData,
  MasterPasswordSalt,
  MasterPasswordUnlockData,
} from "../types/master-password.types";

export abstract class MasterPasswordServiceAbstraction {
  /**
   * An observable that emits if the user is being forced to set a password on login and why.
   * @param userId The user ID.
   * @throws If the user ID is missing.
   */
  abstract forceSetPasswordReason$: (userId: UserId) => Observable<ForceSetPasswordReason>;
  /**
   * An observable that emits the master password salt for the user.
   * @param userId The user ID.
   * @throws If the user ID is missing.
   * @throws If the user ID is provided, but the user is not found.
   */
  abstract saltForUser$: (userId: UserId) => Observable<MasterPasswordSalt>;
  /**
   * Converts an email to a master password salt. This is a canonical encoding of the
   * email, no matter how the email is capitalized.
   */
  abstract emailToSalt(email: string): MasterPasswordSalt;
  /**
   * An observable that emits the master key for the user.
   * @deprecated Interacting with the master-key directly is deprecated. Please use {@link makeMasterPasswordUnlockData}, {@link makeMasterPasswordAuthenticationData} or {@link unwrapUserKeyFromMasterPasswordUnlockData} instead.
   * @param userId The user ID.
   * @throws If the user ID is missing.
   */
  abstract masterKey$: (userId: UserId) => Observable<MasterKey>;
  /**
   * An observable that emits the master key hash for the user.
   * @deprecated Interacting with the master-key directly is deprecated. Please use {@link makeMasterPasswordAuthenticationData}.
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
   * @deprecated Interacting with the master-key directly is deprecated. Please use {@link unwrapUserKeyFromMasterPasswordUnlockData} instead.
   * @param masterKey The user's master key
   *    * @param userId The desired user
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
   * Makes the authentication hash for authenticating to the server with the master password.
   * @param password The master password.
   * @param kdf The KDF configuration.
   * @param salt The master password salt to use. See {@link saltForUser$} for current salt.
   * @throws If password, KDF or salt are null or undefined.
   */
  abstract makeMasterPasswordAuthenticationData: (
    password: string,
    kdf: KdfConfig,
    salt: MasterPasswordSalt,
  ) => Promise<MasterPasswordAuthenticationData>;

  /**
   * Creates a MasterPasswordUnlockData bundle that encrypts the user-key with a key derived from the password. The
   * bundle also contains the KDF settings and salt used to derive the key, which are required to decrypt the user-key later.
   * @param password The master password.
   * @param kdf The KDF configuration.
   * @param salt The master password salt to use. See {@link saltForUser$} for current salt.
   * @param userKey The user's userKey to encrypt.
   * @throws If password, KDF, salt, or userKey are null or undefined.
   */
  abstract makeMasterPasswordUnlockData: (
    password: string,
    kdf: KdfConfig,
    salt: MasterPasswordSalt,
    userKey: UserKey,
  ) => Promise<MasterPasswordUnlockData>;

  /**
   * Unwraps a user-key that was wrapped with a password provided KDF settings. The same KDF settings and salt must be provided to unwrap the user-key, otherwise it will fail to decrypt.
   * @throws If the encryption type is not supported.
   * @throws If the password, KDF, or salt don't match the original wrapping parameters.
   */
  abstract unwrapUserKeyFromMasterPasswordUnlockData: (
    password: string,
    masterPasswordUnlockData: MasterPasswordUnlockData,
  ) => Promise<UserKey>;
}

export abstract class InternalMasterPasswordServiceAbstraction extends MasterPasswordServiceAbstraction {
  /**
   * Set the master key for the user.
   * Note: Use {@link clearMasterKey} to clear the master key.
   * @deprecated Interacting with the master-key directly is deprecated.
   * @param masterKey The master key.
   * @param userId The user ID.
   * @throws If the user ID or master key is missing.
   */
  abstract setMasterKey: (masterKey: MasterKey, userId: UserId) => Promise<void>;
  /**
   * Clear the master key for the user.
   * @deprecated Interacting with the master-key directly is deprecated.
   * @param userId The user ID.
   * @throws If the user ID is missing.
   */
  abstract clearMasterKey: (userId: UserId) => Promise<void>;
  /**
   * Set the master key hash for the user.
   * Note: Use {@link clearMasterKeyHash} to clear the master key hash.
   * @deprecated Interacting with the master-key directly is deprecated.
   * @param masterKeyHash The master key hash.
   * @param userId The user ID.
   * @throws If the user ID or master key hash is missing.
   */
  abstract setMasterKeyHash: (masterKeyHash: string, userId: UserId) => Promise<void>;
  /**
   * Clear the master key hash for the user.
   * @deprecated Interacting with the master-key directly is deprecated.
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

  /**
   * Sets the master password unlock data for the user.
   * This data is used to unlock the user key with the master password.
   * @param masterPasswordUnlockData The master password unlock data containing the KDF settings, salt, and encrypted user key.
   * @param userId The user ID.
   * @throws Error If the user ID or master password unlock data is missing.
   */
  abstract setMasterPasswordUnlockData(
    masterPasswordUnlockData: MasterPasswordUnlockData,
    userId: UserId,
  ): Promise<void>;
}
