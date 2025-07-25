import { Opaque } from "type-fest";

// eslint-disable-next-line no-restricted-imports
import { KdfConfig } from "@bitwarden/key-management";

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
export type MasterPasswordUnlockData = {
  salt: MasterPasswordSalt;
  kdf: KdfConfig;
  masterKeyWrappedUserKey: MasterKeyWrappedUserKey;
};

/**
 * The data required to authenticate with the master password.
 */
export type MasterPasswordAuthenticationData = {
  salt: MasterPasswordSalt;
  kdf: KdfConfig;
  masterPasswordAuthenticationHash: MasterPasswordAuthenticationHash;
};
