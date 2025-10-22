import type {
  CipherRiskResult,
  CipherRiskOptions,
  ExposedPasswordResult,
  PasswordReuseMap,
  CipherId,
} from "@bitwarden/sdk-internal";

import { UserId } from "../../types/guid";
import { CipherView } from "../models/view/cipher.view";

export abstract class CipherRiskService {
  /**
   * Compute password risks for multiple ciphers.
   * Only processes Login ciphers with passwords.
   *
   * @param ciphers - The ciphers to evaluate for password risks
   * @param userId - The user ID for SDK client context
   * @param options - Optional configuration for risk computation (passwordMap, checkExposed)
   * @returns Array of CipherRisk results from SDK containing password_strength, exposed_result, and reuse_count
   */
  abstract computeRiskForCiphers(
    ciphers: CipherView[],
    userId: UserId,
    options?: CipherRiskOptions,
  ): Promise<CipherRiskResult[]>;

  /**
   * Compute password risk for a single cipher by its ID. Will automatically build a password reuse map
   * from all the user's ciphers via the CipherService.
   * @param cipherId
   * @param userId
   * @param checkExposed - Whether to check if the password has been exposed in data breaches via HIBP
   * @returns CipherRisk result from SDK containing password_strength, exposed_result, and reuse_count
   */
  abstract computeCipherRiskForUser(
    cipherId: CipherId,
    userId: UserId,
    checkExposed?: boolean,
  ): Promise<CipherRiskResult>;

  /**
   * Build a password reuse map for the given ciphers.
   * Maps each password to the number of times it appears across ciphers.
   * Only processes Login ciphers with passwords.
   *
   * @param ciphers - The ciphers to analyze for password reuse
   * @param userId - The user ID for SDK client context
   * @returns A map of password to count of occurrences
   */
  abstract buildPasswordReuseMap(ciphers: CipherView[], userId: UserId): Promise<PasswordReuseMap>;
}

// Re-export SDK types for convenience
export type { CipherRiskResult, CipherRiskOptions, ExposedPasswordResult, PasswordReuseMap };
