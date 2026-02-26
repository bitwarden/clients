// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { OrganizationUserResetPasswordRequest } from "@bitwarden/admin-console/common";
import {
  MasterPasswordAuthenticationData,
  MasterPasswordUnlockData,
} from "@bitwarden/common/key-management/master-password/types/master-password.types";

export class UpdateTdeOffboardingPasswordRequest extends OrganizationUserResetPasswordRequest {
  masterPasswordHint: string;

  // This will eventually be changed to be an actual constructor, once all callers are updated.
  // The body of this request will be changed to carry the authentication data and unlock data.
  // https://bitwarden.atlassian.net/browse/PM-23234
  static newConstructorWithHint(
    authenticationData: MasterPasswordAuthenticationData,
    unlockData: MasterPasswordUnlockData,
    masterPasswordHint: string,
  ): UpdateTdeOffboardingPasswordRequest {
    const request = new UpdateTdeOffboardingPasswordRequest();
    request.newMasterPasswordHash = authenticationData.masterPasswordAuthenticationHash;
    request.key = unlockData.masterKeyWrappedUserKey;
    request.masterPasswordHint = masterPasswordHint;
    return request;
  }
}
