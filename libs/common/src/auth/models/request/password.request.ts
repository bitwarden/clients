// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  MasterPasswordAuthenticationData,
  MasterPasswordAuthenticationHash,
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
    currentMasterPasswordAuthenticationHash: MasterPasswordAuthenticationHash,
    newAuthenticationData: MasterPasswordAuthenticationData,
    newUnlockData: MasterPasswordUnlockData,
    newMasterPasswordHint: string,
  ): PasswordRequest {
    const request = new PasswordRequest();
    request.masterPasswordHash = currentMasterPasswordAuthenticationHash;
    request.newMasterPasswordHash = newAuthenticationData.masterPasswordAuthenticationHash;
    request.key = newUnlockData.masterKeyWrappedUserKey;
    request.authenticationData = newAuthenticationData;
    request.unlockData = newUnlockData;
    request.masterPasswordHint = newMasterPasswordHint;
    return request;
  }
}
