import type {
  CipherRisk,
  CipherRiskOptions,
  ExposedPasswordResult,
  PasswordReuseMap,
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
  abstract computeRisk(
    ciphers: CipherView[],
    userId: UserId,
    options?: CipherRiskOptions,
  ): Promise<CipherRisk[]>;

  /**
   * Build a password reuse map for the given ciphers.
   * Maps each password to the number of times it appears across ciphers.
   * Only processes Login ciphers with passwords.
   *
   * @param ciphers - The ciphers to analyze for password reuse
   * @returns A map of password to count of occurrences
   */
  abstract buildPasswordReuseMap(ciphers: CipherView[]): Promise<PasswordReuseMap>;
}

// Re-export SDK types for convenience
export type { CipherRisk, CipherRiskOptions, ExposedPasswordResult, PasswordReuseMap };
