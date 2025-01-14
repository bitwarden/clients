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
}
