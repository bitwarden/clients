// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore

import {
  MasterPasswordAuthenticationData,
  MasterPasswordUnlockData,
} from "@bitwarden/common/key-management/master-password/types/master-password.types";

export class OrganizationUserResetPasswordRequest {
  newMasterPasswordHash: string;
  key: string;

  // This will eventually be changed to be an actual constructor, once all callers are updated.
  // The body of this request will be changed to carry the authentication data and unlock data.
  // https://bitwarden.atlassian.net/browse/PM-23234
  static newConstructor(
    authenticationData: MasterPasswordAuthenticationData,
    unlockData: MasterPasswordUnlockData,
  ): OrganizationUserResetPasswordRequest {
    const request = new OrganizationUserResetPasswordRequest();
    request.newMasterPasswordHash = authenticationData.masterPasswordAuthenticationHash;
    request.key = unlockData.masterKeyWrappedUserKey;
    return request;
  }
}
