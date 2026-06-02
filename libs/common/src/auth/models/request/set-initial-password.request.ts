import {
  MasterPasswordAuthenticationData,
  MasterPasswordUnlockData,
} from "@bitwarden/common/key-management/master-password/types/master-password.types";

import { KeysRequest } from "../../../models/request/keys.request";

export class SetInitialPasswordRequest {
  constructor(
    readonly masterPasswordAuthentication: MasterPasswordAuthenticationData,
    readonly masterPasswordUnlock: MasterPasswordUnlockData,
    readonly masterPasswordHint: string,
    readonly orgIdentifier: string,
    readonly keys: KeysRequest | null,
  ) {}
}
