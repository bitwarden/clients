// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.

import {
  MasterPasswordAuthenticationData,
  MasterPasswordUnlockData,
} from "@bitwarden/common/key-management/master-password/types/master-password.types";
// eslint-disable-next-line no-restricted-imports
import { KdfType } from "@bitwarden/key-management";

import { KeysRequest } from "../../../models/request/keys.request";

export class SetPasswordRequest {
  masterPasswordHash: string;
  key: string;
  masterPasswordHint: string;
  keys: KeysRequest | null;
  kdf: KdfType;
  kdfIterations: number;
  kdfMemory?: number;
  kdfParallelism?: number;
  orgIdentifier: string;

  constructor(
    masterPasswordHash: string,
    key: string,
    masterPasswordHint: string,
    orgIdentifier: string,
    keys: KeysRequest | null,
    kdf: KdfType,
    kdfIterations: number,
    kdfMemory?: number,
    kdfParallelism?: number,
  ) {
    this.masterPasswordHash = masterPasswordHash;
    this.key = key;
    this.masterPasswordHint = masterPasswordHint;
    this.kdf = kdf;
    this.kdfIterations = kdfIterations;
    this.kdfMemory = kdfMemory;
    this.kdfParallelism = kdfParallelism;
    this.orgIdentifier = orgIdentifier;
    this.keys = keys;
  }

  // This will eventually be changed to be an actual constructor, once all callers are updated.
  // The body of this request will be changed to carry the authentication data and unlock data.
  static newConstructor(
    authenticationData: MasterPasswordAuthenticationData,
    unlockData: MasterPasswordUnlockData,
    masterPasswordHint: string,
    orgIdentifier: string,
    keys: KeysRequest | null,
  ): SetPasswordRequest {
    const request = new SetPasswordRequest(
      authenticationData.masterPasswordAuthenticationHash,
      unlockData.masterKeyWrappedUserKey,
      masterPasswordHint,
      orgIdentifier,
      keys,
      authenticationData.kdf.kdfType,
      authenticationData.kdf.iterations,
      authenticationData.kdf.memory,
      authenticationData.kdf.parallelism,
    );
    return request;
  }
}
