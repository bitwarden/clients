// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { KdfConfig, fromSdkKdfConfig } from "@bitwarden/legacy-crypto";
import { PasswordPreloginResponse as SdkPasswordPreloginResponse } from "@bitwarden/sdk-internal";

import { MasterPasswordSalt } from "../../key-management/master-password/types/master-password.types";

import { PasswordPreloginResponse } from "./password-prelogin.response";

/**
 * Domain model representing the server's prelogin response for password-based authentication.
 * Contains the KDF configuration and salt needed to derive the master key from the user's master
 * password.
 */
export class PasswordPreloginData {
  constructor(
    readonly kdfConfig: KdfConfig,
    /** The salt to derive the master key with. */
    readonly salt: MasterPasswordSalt,
  ) {}

  /**
   * Creates a PasswordPreloginData instance from a prelogin API response, rejecting KDF settings
   * below the pre-login minimums.
   * @param response The raw API response from the prelogin endpoint.
   * @param salt The salt to derive with. The response's own salt is not read; choosing the salt
   * is the caller's decision.
   */
  static fromResponse(
    response: PasswordPreloginResponse,
    salt: MasterPasswordSalt,
  ): PasswordPreloginData {
    const kdfConfig = response.kdfSettings.toKdfConfig();
    kdfConfig.validateKdfConfigForPrelogin();
    return new PasswordPreloginData(kdfConfig, salt);
  }

  /**
   * Creates a PasswordPreloginData instance from the SDK's prelogin response, rejecting KDF
   * settings below the pre-login minimums.
   * @param response The SDK prelogin response. Its salt is used as-is.
   * @throws If the response has no salt. The SDK types the salt as non-null, so a missing one
   * means that contract broke; deriving from it would crash or produce the wrong master key.
   */
  static fromSdk(response: SdkPasswordPreloginResponse): PasswordPreloginData {
    if (response.salt == null) {
      throw new Error("A salt is required to derive the master key.");
    }
    const kdfConfig = fromSdkKdfConfig(response.kdf);
    kdfConfig.validateKdfConfigForPrelogin();
    return new PasswordPreloginData(kdfConfig, response.salt as MasterPasswordSalt);
  }
}
