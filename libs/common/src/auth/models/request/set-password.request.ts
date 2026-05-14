import {
  MasterPasswordAuthenticationData,
  MasterPasswordUnlockData,
} from "@bitwarden/common/key-management/master-password/types/master-password.types";

import { KeysRequest } from "../../../models/request/keys.request";

export class SetPasswordRequest {
  constructor(
    readonly authenticationData: MasterPasswordAuthenticationData,
    readonly unlockData: MasterPasswordUnlockData,
    readonly masterPasswordHint: string,
    readonly orgIdentifier: string,
    readonly keys: KeysRequest | null,
  ) {}
}
