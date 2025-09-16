import { Jsonify, Opaque } from "type-fest";

// eslint-disable-next-line no-restricted-imports
import { Argon2KdfConfig, KdfConfig, KdfType, PBKDF2KdfConfig } from "@bitwarden/key-management";

import { EncString } from "../../crypto/models/enc-string";

/**
 * The Base64-encoded master password authentication hash, that is sent to the server for authentication.
 */
export type MasterPasswordAuthenticationHash = Opaque<string, "MasterPasswordAuthenticationHash">;
/**
 * You MUST obtain this through the emailToSalt function in MasterPasswordService
 */
export type MasterPasswordSalt = Opaque<string, "MasterPasswordSalt">;
export type MasterKeyWrappedUserKey = Opaque<EncString, "MasterPasswordSalt">;

/**
 * The data required to unlock with the master password.
 */
export class MasterPasswordUnlockData {
  constructor(
    readonly salt: MasterPasswordSalt,
    readonly kdf: KdfConfig,
    readonly masterKeyWrappedUserKey: MasterKeyWrappedUserKey,
  ) {}

  toJSON(): any {
    return {
      salt: this.salt,
      kdf: this.kdf,
      masterKeyWrappedUserKey: this.masterKeyWrappedUserKey.toJSON(),
    };
  }

  static fromJSON(obj: Jsonify<MasterPasswordUnlockData>): MasterPasswordUnlockData | null {
    if (obj == null) {
      return null;
    }

    return new MasterPasswordUnlockData(
      obj.salt,
      obj.kdf.kdfType === KdfType.PBKDF2_SHA256
        ? PBKDF2KdfConfig.fromJSON(obj.kdf)
        : Argon2KdfConfig.fromJSON(obj.kdf),
      EncString.fromJSON(obj.masterKeyWrappedUserKey) as MasterKeyWrappedUserKey,
    );
  }
}

/**
 * The data required to authenticate with the master password.
 */
export type MasterPasswordAuthenticationData = {
  salt: MasterPasswordSalt;
  kdf: KdfConfig;
  masterPasswordAuthenticationHash: MasterPasswordAuthenticationHash;
};
