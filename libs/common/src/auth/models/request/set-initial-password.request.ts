import { AccountKeysRequest } from "@bitwarden/common/key-management/account-keys/request/account-keys.request";
import {
  MasterPasswordAuthenticationData,
  MasterPasswordUnlockData,
} from "@bitwarden/common/key-management/master-password/types/master-password.types";

export class SetInitialPasswordRequest {
  constructor(
    readonly masterPasswordAuthentication: MasterPasswordAuthenticationData,
    readonly masterPasswordUnlock: MasterPasswordUnlockData,
    readonly masterPasswordHint: string,
    readonly orgIdentifier: string,
    readonly accountKeys: AccountKeysRequest | null,
  ) {}
}
