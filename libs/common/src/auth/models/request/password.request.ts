import {
  MasterPasswordAuthenticationData,
  MasterPasswordAuthenticationHash,
  MasterPasswordUnlockData,
} from "../../../key-management/master-password/types/master-password.types";

export class PasswordRequest {
  constructor(
    readonly masterPasswordHash: MasterPasswordAuthenticationHash,
    readonly authenticationData: MasterPasswordAuthenticationData,
    readonly unlockData: MasterPasswordUnlockData,
    readonly masterPasswordHint: string,
  ) {}
}
