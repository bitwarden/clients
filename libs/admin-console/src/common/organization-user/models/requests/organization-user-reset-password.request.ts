import {
  MasterPasswordAuthenticationData,
  MasterPasswordUnlockData,
} from "@bitwarden/common/key-management/master-password/types/master-password.types";

export class OrganizationUserResetPasswordRequest {
  constructor(
    readonly resetMasterPassword: boolean = true,
    readonly resetTwoFactor: boolean = false,
    readonly authenticationData?: MasterPasswordAuthenticationData,
    readonly unlockData?: MasterPasswordUnlockData,
  ) {}
}
