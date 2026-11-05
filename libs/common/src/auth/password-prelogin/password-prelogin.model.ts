// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { KdfConfig } from "@bitwarden/legacy-crypto";

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
}
