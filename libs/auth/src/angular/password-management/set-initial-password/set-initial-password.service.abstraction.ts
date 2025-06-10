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
   *     with a starting role that requires a master password (admin, owner, etc.)
   *  2. An user in a trusted-device-encryption org whose role was upgraded to one
   *     that requires a master password (admin, owner, etc.)
   */
  TDE_ORG_USER_ROLE_REQUIRES_MP: "tde_org_user_role_requires_mp",
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

/**
 * Handles setting an initial password for an existing authed user.
 *
 * To see the different scenarios where an existing authed user needs to set an
 * initial password, see {@link SetInitialPasswordUser}
 */
export abstract class SetInitialPasswordService {
  /**
   * Sets an initial password for an existing authed user who is either:
   * - {@link SetInitialPasswordUser.JIT_PROVISIONED_MP_ORG_USER}
   * - {@link SetInitialPasswordUser.TDE_ORG_USER_ROLE_REQUIRES_MP}
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
}
