// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  MasterPasswordAuthenticationData,
  MasterPasswordUnlockData,
} from "@bitwarden/common/key-management/master-password/types/master-password.types";

import { SecretVerificationRequest } from "./secret-verification.request";

export class PasswordRequest extends SecretVerificationRequest {
  newMasterPasswordHash: string;
  masterPasswordHint: string;
  key: string;

  authenticationData?: MasterPasswordAuthenticationData;
  unlockData?: MasterPasswordUnlockData;

  // This will eventually be changed to be an actual constructor, once all callers are updated.
  // https://bitwarden.atlassian.net/browse/PM-23234
  static newConstructor(
    authenticationData: MasterPasswordAuthenticationData,
    unlockData: MasterPasswordUnlockData,
  ): PasswordRequest {
    const request = new PasswordRequest();
    request.newMasterPasswordHash = authenticationData.masterPasswordAuthenticationHash;
    request.key = unlockData.masterKeyWrappedUserKey;
    request.authenticationData = authenticationData;
    request.unlockData = unlockData;
    return request;
  }
}
