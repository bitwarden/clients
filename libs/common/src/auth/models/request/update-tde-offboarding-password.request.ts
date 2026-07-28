import {
  MasterPasswordAuthenticationData,
  MasterPasswordUnlockData,
} from "../../../key-management/master-password/types/master-password.types";

export class UpdateTdeOffboardingPasswordRequest {
  constructor(
    readonly authenticationData: MasterPasswordAuthenticationData,
    readonly unlockData: MasterPasswordUnlockData,
    readonly masterPasswordHint: string,
  ) {}
}
