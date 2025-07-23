import {
  MasterPasswordAuthenticationData,
  MasterPasswordUnlockData,
} from "@bitwarden/common/key-management/master-password/types/master-password.types";
// eslint-disable-next-line no-restricted-imports
import { KdfType } from "@bitwarden/key-management";

import { PasswordRequest } from "../../auth/models/request/password.request";

export class KdfRequest extends PasswordRequest {
  /** @deprecated */
  kdf: KdfType;
  /** @deprecated */
  kdfIterations: number;
  /** @deprecated */
  kdfMemory?: number;
  /** @deprecated */
  kdfParallelism?: number;

  constructor(
    authenticationData: MasterPasswordAuthenticationData,
    unlockData: MasterPasswordUnlockData,
  ) {
    super();
    // Note, this init code should be in the super constructor, once PasswordRequest's constructor is updated.
    this.newMasterPasswordHash = authenticationData.masterPasswordAuthenticationHash;
    this.key = unlockData.masterKeyWrappedUserKey.toEncryptedString();
    this.authenticationData = authenticationData;
    this.unlockData = unlockData;

    this.kdf = authenticationData.kdf.kdfType;
    this.kdfIterations = authenticationData.kdf.iterations;
    this.kdfMemory = authenticationData.kdf.memory;
    this.kdfParallelism = authenticationData.kdf.parallelism;
  }
}
