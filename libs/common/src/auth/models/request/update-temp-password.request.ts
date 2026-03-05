// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { OrganizationUserResetPasswordRequest } from "@bitwarden/admin-console/common";
import {
  MasterPasswordAuthenticationData,
  MasterPasswordUnlockData,
} from "@bitwarden/common/key-management/master-password/types/master-password.types";

export class UpdateTempPasswordRequest extends OrganizationUserResetPasswordRequest {
  masterPasswordHint: string;

  static override newConstructor(
    authenticationData: MasterPasswordAuthenticationData,
    unlockData: MasterPasswordUnlockData,
  ): UpdateTempPasswordRequest {
    const request = new UpdateTempPasswordRequest();
    request.newMasterPasswordHash = authenticationData.masterPasswordAuthenticationHash;
    request.key = unlockData.masterKeyWrappedUserKey;
    return request;
  }
}
