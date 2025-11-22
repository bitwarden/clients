import { Jsonify, Opaque } from "type-fest";

// eslint-disable-next-line no-restricted-imports
import {
  fromSdkKdfConfig,
  Argon2KdfConfig,
  KdfConfig,
  KdfType,
  PBKDF2KdfConfig,
} from "@bitwarden/key-management";
import {
  EncString,
  MasterPasswordUnlockData as SdkMasterPasswordUnlockData,
  MasterPasswordAuthenticationData as SdkMasterPasswordAuthenticationData,
} from "@bitwarden/sdk-internal";

/**
 * The Base64-encoded master password authentication hash, that is sent to the server for authentication.
 */
export type MasterPasswordAuthenticationHash = Opaque<string, "MasterPasswordAuthenticationHash">;
/**
 * You MUST obtain this through the emailToSalt function in MasterPasswordService
 */
export type MasterPasswordSalt = Opaque<string, "MasterPasswordSalt">;
export type MasterKeyWrappedUserKey = Opaque<EncString, "MasterKeyWrappedUserKey">;

/**
 * Encapsulates the data needed to unlock a vault using a master password.
 * It contains the masterKeyWrappedUserKey along with the KDF settings and salt used to derive the master key.
 * It is currently backwards compatible to master-key based unlock, but this will not be the case in the future.
 * Features relating to master-password-based unlock should use this abstraction.
 */
export class MasterPasswordUnlockData {
  constructor(
    readonly salt: MasterPasswordSalt,
    readonly kdf: KdfConfig,
    readonly masterKeyWrappedUserKey: MasterKeyWrappedUserKey,
  ) {}

  static fromSdk(sdkData: SdkMasterPasswordUnlockData): MasterPasswordUnlockData {
    return new MasterPasswordUnlockData(
      sdkData.salt as MasterPasswordSalt,
      fromSdkKdfConfig(sdkData.kdf),
      sdkData.masterKeyWrappedUserKey as MasterKeyWrappedUserKey,
    );
  }

  toJSON(): any {
    return {
      salt: this.salt,
      kdf: this.kdf,
      masterKeyWrappedUserKey: this.masterKeyWrappedUserKey,
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
      obj.masterKeyWrappedUserKey as MasterKeyWrappedUserKey,
    );
  }
}

/**
 * Encapsulates the data required to authenticate using a master password.
 * It contains the masterPasswordAuthenticationHash, along with the KDF settings and salt used to derive it.
 * The encapsulated abstraction prevents authentication issues resulting from unsynchronized state.
 */
export type MasterPasswordAuthenticationData = {
  salt: MasterPasswordSalt;
  kdf: KdfConfig;
  masterPasswordAuthenticationHash: MasterPasswordAuthenticationHash;
};

export function fromSdkAuthenticationData(
  sdkData: SdkMasterPasswordAuthenticationData,
): MasterPasswordAuthenticationData {
  return {
    salt: sdkData.salt as MasterPasswordSalt,
    kdf: fromSdkKdfConfig(sdkData.kdf),
    masterPasswordAuthenticationHash:
      sdkData.masterPasswordAuthenticationHash as MasterPasswordAuthenticationHash,
  };
}
