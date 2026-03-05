// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CipherType } from "@bitwarden/common/vault/enums";
export class MenuUpdateRequest {
  activeUserId: string | null;
  accounts: { [userId: string]: MenuAccount } | null;
  restrictedCipherTypes: CipherType[] | null;
}

export class MenuAccount {
  isAuthenticated: boolean;
  isLocked: boolean;
  isLockable: boolean;
  userId: string;
  email: string;
  hasMasterPassword: boolean;
}
