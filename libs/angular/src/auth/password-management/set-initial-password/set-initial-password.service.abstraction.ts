import { UserId } from "@bitwarden/common/types/guid";
import { MasterKey } from "@bitwarden/common/types/key";
import { KdfConfig } from "@bitwarden/key-management";

export const _SetInitialPasswordUserType = {
  /**
   * A user being "just-in-time" (JIT) provisioned into a master-password-encryption org
   */
  JIT_PROVISIONED_MP_ORG_USER: "jit_provisioned_mp_org_user",

  /**
   * Could be one of two scenarios:
   *  1. A user being "just-in-time" (JIT) provisioned into a trusted-device-encryption org
   *     with the reset password permission granted ("manage account recovery"), which requires
   *     that the user sets a master password
   *  2. An user in a trusted-device-encryption org whose permissions were upgraded to include
   *     the reset password permission ("manage account recovery"), which requires that the user
   *     sets a master password
   */
  TDE_ORG_USER_RESET_PASSWORD_PERMISSION_REQUIRES_MP:
    "tde_org_user_reset_password_permission_requires_mp",

  /**
   * A user in an org that offboarded from trusted device encryption and is now a
   * master-password-encryption org. User is on a trusted device.
   */
  OFFBOARDED_TDE_ORG_USER: "offboarded_tde_org_user",

  /**
   * A user in an org that offboarded from trusted device encryption and is now a
   * master-password-encryption org. User is on an untrusted device.
   */
  OFFBOARDED_TDE_ORG_USER_UNTRUSTED_DEVICE: "offboarded_tde_org_user_untrusted_device",
} as const;

type _SetInitialPasswordUserType = typeof _SetInitialPasswordUserType;

export type SetInitialPasswordUserType =
  _SetInitialPasswordUserType[keyof _SetInitialPasswordUserType];
export const SetInitialPasswordUserType: Readonly<{
  [K in keyof typeof _SetInitialPasswordUserType]: SetInitialPasswordUserType;
}> = Object.freeze(_SetInitialPasswordUserType);

export interface SetInitialPasswordCredentials {
  newMasterKey: MasterKey;
  newServerMasterKeyHash: string;
  newLocalMasterKeyHash: string;
  newPasswordHint: string;
  kdfConfig: KdfConfig;
  orgSsoIdentifier: string;
  orgId: string;
  resetPasswordAutoEnroll: boolean;
}

export interface SetInitialPasswordTdeOffboardingCredentials {
  newMasterKey: MasterKey;
  newServerMasterKeyHash: string;
  newPasswordHint: string;
}

/**
 * Handles setting an initial password for an existing authed user.
 *
 * To see the different scenarios where an existing authed user needs to set an
 * initial password, see {@link SetInitialPasswordUserType}
 */
export abstract class SetInitialPasswordService {
  /**
   * Sets an initial password for an existing authed user who is either:
   * - {@link SetInitialPasswordUserType.JIT_PROVISIONED_MP_ORG_USER}
   * - {@link SetInitialPasswordUserType.TDE_ORG_USER_RESET_PASSWORD_PERMISSION_REQUIRES_MP}
   *
   * @param credentials An object of the credentials needed to set the initial password
   * @throws If any property on the `credentials` object is null or undefined, or if a
   *         masterKeyEncryptedUserKey or newKeyPair could not be created.
   */
  abstract setInitialPassword: (
    credentials: SetInitialPasswordCredentials,
    userType: SetInitialPasswordUserType,
    userId: UserId,
  ) => Promise<void>;

  /**
   * Sets an initial password for a user who logs in after their org offboarded from
   * trusted device encryption and is now a master-password-encryption org:
   * - {@link SetInitialPasswordUserType.OFFBOARDED_TDE_ORG_USER}
   *
   * @param passwordInputResult credentials object received from the `InputPasswordComponent`
   * @param userId the account `userId`
   */
  abstract setInitialPasswordTdeOffboarding: (
    credentials: SetInitialPasswordTdeOffboardingCredentials,
    userId: UserId,
  ) => Promise<void>;
}
