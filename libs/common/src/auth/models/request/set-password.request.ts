// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { KdfConfig, KdfType } from "@bitwarden/legacy-crypto";

import {
  MasterPasswordAuthenticationData,
  MasterPasswordUnlockData,
} from "../../../key-management/master-password/types/master-password.types";
import { KeysRequest } from "../../../models/request/keys.request";

// ============================================================
// PM-42990 — ROLLBACK NOTE
// ============================================================
// This class sends the old request shape to the set-password endpoint.
// It sends a master password hash, an encrypted user key, and raw KDF values.
//
// Every caller must use this class for 3 releases after the server accepts
// the new shape, to stay compatible with self hosted servers.
//
// The method newConstructor() converts new authentication data and unlock
// data into this old shape. Some callers already use newConstructor().
//
// DELETE: Search the repo for the text SetPasswordRequest. Update every
// file that imports it, including api service files and test files. Once
// no file imports this class, delete this file. Delete newConstructor() at
// the same time. See https://github.com/bitwarden/clients/pull/20643 for
// initial pass at this refactor.
// ============================================================
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
    kdf: KdfConfig,
  ) {
    this.masterPasswordHash = masterPasswordHash;
    this.key = key;
    this.masterPasswordHint = masterPasswordHint;
    this.orgIdentifier = orgIdentifier;
    this.keys = keys;

    if (kdf.kdfType === KdfType.PBKDF2_SHA256) {
      this.kdf = KdfType.PBKDF2_SHA256;
      this.kdfIterations = kdf.iterations;
    } else if (kdf.kdfType === KdfType.Argon2id) {
      this.kdf = KdfType.Argon2id;
      this.kdfIterations = kdf.iterations;
      this.kdfMemory = kdf.memory;
      this.kdfParallelism = kdf.parallelism;
    } else {
      throw new Error(`Unsupported KDF type: ${kdf}`);
    }
  }

  // This will eventually be changed to be an actual constructor, once all callers are updated.
  // The body of this request will be changed to carry the authentication data and unlock data.
  // https://bitwarden.atlassian.net/browse/PM-23234
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
      unlockData.kdf,
    );
    return request;
  }
}
