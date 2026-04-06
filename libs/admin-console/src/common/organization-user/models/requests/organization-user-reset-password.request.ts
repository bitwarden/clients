// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore

import {
  MasterPasswordAuthenticationData,
  MasterPasswordUnlockData,
} from "@bitwarden/common/key-management/master-password/types/master-password.types";

export class OrganizationUserResetPasswordRequest {
  // https://bitwarden.atlassian.net/browse/PM-23234
  constructor(
    public resetMasterPassword: boolean = true,
    public resetTwoFactor: boolean = false,
    public newMasterPasswordHash?: string,
    public key?: string,
  ) {}

  static newConstructor(
    authenticationData: MasterPasswordAuthenticationData,
    unlockData: MasterPasswordUnlockData,
    resetTwoFactor: boolean = false,
  ): OrganizationUserResetPasswordRequest {
    return new OrganizationUserResetPasswordRequest(
      true,
      resetTwoFactor,
      authenticationData.masterPasswordAuthenticationHash,
      unlockData.masterKeyWrappedUserKey,
    );
  }
}
