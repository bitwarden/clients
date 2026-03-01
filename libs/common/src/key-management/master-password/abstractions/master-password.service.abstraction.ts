import { Observable } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { KdfConfig } from "@bitwarden/key-management";

import { ForceSetPasswordReason } from "../../../auth/models/domain/force-set-password-reason";
import { UserId } from "../../../types/guid";
import { UserKey } from "../../../types/key";
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

  /**
   * Returns whether the user has a master password set.
   * @param userId The user ID.
   * @throws If the user ID is missing.
   */
  abstract userHasMasterPassword(userId: UserId): Promise<boolean>;
}

export abstract class InternalMasterPasswordServiceAbstraction extends MasterPasswordServiceAbstraction {
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

  /**
   * An observable that emits the master password unlock data for the target user.
   * @param userId The user ID.
   * @throws If the user ID is null or undefined.
   * @returns An observable that emits the master password unlock data or null if not found.
   */
  abstract masterPasswordUnlockData$(userId: UserId): Observable<MasterPasswordUnlockData | null>;
}
