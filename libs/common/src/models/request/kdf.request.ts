import {
  MasterPasswordAuthenticationData,
  MasterPasswordAuthenticationHash,
  MasterPasswordUnlockData,
} from "@bitwarden/common/key-management/master-password/types/master-password.types";

export class KdfRequest {
  constructor(
    readonly masterPasswordHash: MasterPasswordAuthenticationHash,
    readonly authenticationData: MasterPasswordAuthenticationData,
    readonly unlockData: MasterPasswordUnlockData,
  ) {}
}
