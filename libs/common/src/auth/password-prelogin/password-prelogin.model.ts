// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { KdfConfig } from "@bitwarden/legacy-crypto";

import { PasswordPreloginResponse } from "./password-prelogin.response";

/**
 * Domain model representing the server's prelogin response for password-based authentication.
 * Contains the KDF configuration and salt needed to derive the master key from the user's master
 * password.
 */
export class PasswordPreloginData {
  constructor(
    readonly kdfConfig: KdfConfig,
    /**
     * The salt to derive the master key with. This is not always a verbatim echo of the server
     * response: the server salt is nullable, so a null falls back to the normalized email.
     */
    readonly salt: string,
  ) {}

  /**
   * Creates a PasswordPreloginData instance from a prelogin API response.
   * @param response The raw API response from the prelogin endpoint.
   * @param email The email the prelogin request was made for. Used as the salt when the server
   * does not supply one.
   */
  static fromResponse(response: PasswordPreloginResponse, email: string): PasswordPreloginData {
    const kdfConfig = response.kdfSettings.toKdfConfig();
    kdfConfig.validateKdfConfigForPrelogin();
    return new PasswordPreloginData(kdfConfig, response.salt ?? email.trim().toLowerCase());
  }
}
