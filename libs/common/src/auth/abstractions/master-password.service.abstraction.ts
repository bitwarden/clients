import { Observable } from "rxjs";

import { EncString } from "../../platform/models/domain/enc-string";
import { UserId } from "../../types/guid";
import { MasterKey } from "../../types/key";
import { ForceSetPasswordReason } from "../models/domain/force-set-password-reason";

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
}

export abstract class InternalMasterPasswordServiceAbstraction extends MasterPasswordServiceAbstraction {
  /**
   * Set the master key for the user.
   * @param masterKey The master key.
   * @param userId The user ID.
   * @throws If the user ID or master key is missing.
   */
  abstract setMasterKey: (masterKey: MasterKey, userId: UserId) => Promise<void>;
  /**
   * Set the master key hash for the user.
   * @param masterKeyHash The master key hash.
   * @param userId The user ID.
   * @throws If the user ID or master key hash is missing.
   */
  abstract setMasterKeyHash: (masterKeyHash: string, userId: UserId) => Promise<void>;
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
