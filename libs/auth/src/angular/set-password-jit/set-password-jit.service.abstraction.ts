// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { UserId } from "@bitwarden/common/types/guid";
import { MasterKey } from "@bitwarden/common/types/key";
import { PBKDF2KdfConfig } from "@bitwarden/key-management";

export interface SetPasswordCredentials {
  masterKey: MasterKey;
  masterKeyHash: string;
  localMasterKeyHash: string;
  kdfConfig: PBKDF2KdfConfig;
  hint: string;
  orgSsoIdentifier: string;
  orgId: string;
  resetPasswordAutoEnroll: boolean;
  userId: UserId;
}

/**
 * This service handles setting a password for a "just-in-time" provisioned user.
 *
 * A "just-in-time" (JIT) provisioned user is a user who does not have a registered account at the
 * time they first click "Login with SSO". Once they click "Login with SSO" we register the account on
 * the fly ("just-in-time").
 */
export abstract class SetPasswordJitService {
  /**
   * Sets the password for a JIT provisioned user.
   *
   * @param credentials An object of the credentials needed to set the password for a JIT provisioned user
   * @throws If any property on the `credentials` object is null or undefined, or if a protectedUserKey
   *         or newKeyPair could not be created.
   */
  setPassword: (credentials: SetPasswordCredentials) => Promise<void>;
}
