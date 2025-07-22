// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CipherType } from "@bitwarden/common/vault/enums";
export class MenuUpdateRequest {
  activeUserId: string;
  accounts: { [userId: string]: MenuAccount };
  restrictedCipherTypes: CipherType[];
}

export class MenuAccount {
  isAuthenticated: boolean;
  isLocked: boolean;
  isLockable: boolean;
  userId: string;
  email: string;
  hasMasterPassword: boolean;
}
