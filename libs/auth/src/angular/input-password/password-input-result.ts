import { MasterPasswordSalt } from "@bitwarden/common/key-management/master-password/types/master-password.types";
import { MasterKey } from "@bitwarden/common/types/key";
// eslint-disable-next-line no-restricted-imports
import { KdfConfig } from "@bitwarden/legacy-crypto";

export interface PasswordInputResult {
  currentPassword?: string;
  newPassword: string;
  kdfConfig?: KdfConfig;
  salt?: MasterPasswordSalt;
  newPasswordHint?: string;
  rotateUserKey?: boolean;

  // ============================================================
  // PM-42990 — ROLLBACK NOTE
  // ============================================================
  // SetInitialPasswordComponent sets newMasterKey and newServerMasterKeyHash.
  // It sets them only because the set-password endpoint uses the old request shape.
  //
  // DELETE: Delete newMasterKey and newServerMasterKeyHash below. Delete the
  // code in SetInitialPasswordComponent that sets them. Delete the matching
  // assertions in DefaultSetInitialPasswordService.setInitialPassword(). See
  // https://github.com/bitwarden/clients/pull/20643 for initial pass at this
  // refactor.
  // ============================================================
  newMasterKey?: MasterKey;
  newServerMasterKeyHash?: string;
}
