// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { Argon2KdfConfig, KdfConfig, KdfType, PBKDF2KdfConfig } from "@bitwarden/key-management";

import { PasswordPreloginResponse } from "./password-prelogin.response";

/**
 * Domain model representing the server's prelogin response for password-based authentication.
 * Contains the KDF configuration needed to derive the master key from the user's master password.
 */
export class PasswordPreloginData {
  constructor(readonly kdfConfig: KdfConfig) {}

  /**
   * Creates a PasswordPreloginData instance from a prelogin API response.
   * @param response The raw API response from the prelogin endpoint.
   */
  static fromResponse(response: PasswordPreloginResponse): PasswordPreloginData {
    const kdfConfig =
      response.kdf === KdfType.PBKDF2_SHA256
        ? new PBKDF2KdfConfig(response.kdfIterations)
        : new Argon2KdfConfig(
            response.kdfIterations,
            response.kdfMemory!,
            response.kdfParallelism!,
          );
    kdfConfig.validateKdfConfigForPrelogin();
    return new PasswordPreloginData(kdfConfig);
  }
}
