import {
  MasterPasswordAuthenticationData,
  MasterPasswordUnlockData,
} from "@bitwarden/common/key-management/master-password/types/master-password.types";

import { PasswordRequest } from "../../auth/models/request/password.request";

export class KdfRequest extends PasswordRequest {
  constructor(
    authenticationData: MasterPasswordAuthenticationData,
    unlockData: MasterPasswordUnlockData,
  ) {
    super();
    // Note, this init code should be in the super constructor, once PasswordRequest's constructor is updated.
    this.newMasterPasswordHash = authenticationData.masterPasswordAuthenticationHash;
    this.key = unlockData.masterKeyWrappedUserKey;
    this.authenticationData = authenticationData;
    this.unlockData = unlockData;
  }
}
