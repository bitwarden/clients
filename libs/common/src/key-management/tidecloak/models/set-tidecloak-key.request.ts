// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { KdfConfig, KdfType } from "@bitwarden/key-management";

import { KeysRequest } from "../../../models/request/keys.request";

/**
 * Request model for setting the TideCloak-encrypted master key on the server.
 * This is sent after a new SSO user confirms the TideCloak domain and
 * their master key has been encrypted via SMPC.
 */
export class SetTideCloakKeyRequest {
  /** The TideCloak-encrypted master key (encrypted via SMPC) */
  key: string;
  /** The user's public/private key pair */
  keys: KeysRequest;
  /** The KDF algorithm type */
  kdf: KdfType;
  /** KDF iterations */
  kdfIterations: number;
  /** Argon2 memory parameter (only for Argon2id) */
  kdfMemory?: number;
  /** Argon2 parallelism parameter (only for Argon2id) */
  kdfParallelism?: number;
  /** The organization identifier */
  orgIdentifier: string;

  constructor(key: string, kdfConfig: KdfConfig, orgIdentifier: string, keys: KeysRequest) {
    this.key = key;
    this.kdf = kdfConfig.kdfType;
    this.kdfIterations = kdfConfig.iterations;
    if (kdfConfig.kdfType === KdfType.Argon2id) {
      this.kdfMemory = kdfConfig.memory;
      this.kdfParallelism = kdfConfig.parallelism;
    }
    this.orgIdentifier = orgIdentifier;
    this.keys = keys;
  }
}
