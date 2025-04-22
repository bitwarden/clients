// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { UserId } from "@bitwarden/common/types/guid";
import { MasterKey } from "@bitwarden/common/types/key";
import { PBKDF2KdfConfig } from "@bitwarden/key-management";

import { PasswordInputResult } from "../input-password/password-input-result";

export enum SetInitialPasswordUserType {
  /**
   * A new user being "just-in-time" provisioned into a master-password-encryption org
   */
  MASTER_PASSWORD_ORG_USER,
  /**
   * Could be either:
   *  1. A new user being "just-in-time" provisioned into a trusted-device-encryption org
   *     with a role that requires a master password
   *  2. An existing user in a trusted-device-encryption org whose role was upgraded to one
   *     that requires a master password
   */
  TRUSTED_DEVICE_ORG_USER,
  /**
   * A user in an org that recently offboarded from trusted device encryption and is now in
   * a master password encryption org
   */
  OFFBOARDED_TRUSTED_DEVICE_ORG_USER,
}

export interface SetInitialPasswordCredentials {
  masterKey: MasterKey;
  serverMasterKeyHash: string;
  localMasterKeyHash: string;
  kdfConfig: PBKDF2KdfConfig;
  hint: string;
  orgSsoIdentifier: string;
  orgId: string;
  resetPasswordAutoEnroll: boolean;
}

/**
 * Handles setting an initial password for an existing authed user.
 */
export abstract class SetInitialPasswordService {
  /**
   * Sets an initial password for an existing authed user
   *
   * @param credentials An object of the credentials needed to set the initial password
   * @throws If any property on the `credentials` object is null or undefined, or if a
   *         masterKeyEncryptedUserKey or newKeyPair could not be created.
   */
  setInitialPassword: (
    credentials: SetInitialPasswordCredentials,
    userType: SetInitialPasswordUserType,
    userId: UserId,
  ) => Promise<void>;

  setInitialPasswordTdeOffboarding: (
    passwordInputResult: PasswordInputResult,
    userId: UserId,
  ) => Promise<void>;
}
