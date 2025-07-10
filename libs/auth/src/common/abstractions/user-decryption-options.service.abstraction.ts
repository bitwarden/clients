import { Observable } from "rxjs";

import { UserDecryptionOptions } from "../models";

export abstract class UserDecryptionOptionsServiceAbstraction {
  /**
   * Returns what decryption options are available for the current user.
   * @remark This is sent from the server on authentication.
   */
  abstract userDecryptionOptions$: Observable<UserDecryptionOptions>;
  /**
   * Uses user decryption options to determine if current user has a master password.
   * @remark This is sent from the server, and does not indicate if the master password
   * was used to login and/or if a master key is saved locally.
   */
  abstract hasMasterPassword$: Observable<boolean>;

  /**
   * Returns the user decryption options for the given user id.
   * @param userId The user id to check.
   */
  abstract userDecryptionOptionsById$(userId: string): Observable<UserDecryptionOptions>;
}

export abstract class InternalUserDecryptionOptionsServiceAbstraction extends UserDecryptionOptionsServiceAbstraction {
  /**
   * Sets the current decryption options for the user, contains the current configuration
   * of the users account related to how they can decrypt their vault.
   * @remark Intended to be used when user decryption options are received from server, does
   * not update the server. Consider syncing instead of updating locally.
   * @param userDecryptionOptions Current user decryption options received from server.
   */
  abstract setUserDecryptionOptions(userDecryptionOptions: UserDecryptionOptions): Promise<void>;
}
