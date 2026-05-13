import {
  MasterPasswordAuthenticationData,
  MasterPasswordUnlockData,
} from "@bitwarden/common/key-management/master-password/types/master-password.types";

export class UpdateTempPasswordRequest {
  constructor(
    readonly authenticationData: MasterPasswordAuthenticationData,
    readonly unlockData: MasterPasswordUnlockData,
    readonly masterPasswordHint: string,
  ) {}
}
