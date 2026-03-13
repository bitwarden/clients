import { Observable } from "rxjs";

import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { CipherHealthView } from "../../models";

/**
 * Analyzes cipher password health including weak passwords, reuse, and HIBP breaches.
 *
 * Platform-agnostic domain service used by ReportGenerationService.
 */
export abstract class CipherHealthService {
  /**
   * Analyzes password health for multiple ciphers.
   *
   * Checks all ciphers for weak passwords (zxcvbn score <= 2), password reuse,
   * and HIBP exposure. HIBP calls are concurrency-limited (max 5 concurrent) to
   * prevent rate limiting.
   *
   * @param ciphers - Array of ciphers to analyze
   * @returns Map of cipher ID to health results for O(1) lookups
   *
   * @example
   * ```typescript
   * // In ReportGenerationService
   * this.cipherHealthService.checkCipherHealth(ciphers).pipe(
   *   map(healthMap => {
   *     const atRiskCiphers = ciphers.filter(c =>
   *       healthMap.get(c.id)?.isAtRisk()
   *     );
   *     return this.buildReport(ciphers, healthMap);
   *   })
   * )
   * ```
   */
  abstract checkCipherHealth(ciphers: CipherView[]): Observable<Map<string, CipherHealthView>>;

  /**
   * Analyzes password health for a single cipher.
   *
   * Checks for weak password and HIBP exposure. Cannot detect password reuse
   * without other ciphers for comparison (use checkCipherHealth for reuse detection).
   *
   * @param cipher - Single cipher to analyze
   * @returns Health results for the cipher
   */
  abstract checkSingleCipherHealth(cipher: CipherView): Observable<CipherHealthView>;

  /**
   * Detects password reuse across all ciphers.
   *
   * Groups ciphers by password to identify reuse. Only returns passwords
   * used by 2+ ciphers (unique passwords are excluded).
   *
   * @param ciphers - Array of ciphers to analyze
   * @returns Map of password to array of cipher IDs sharing that password
   */
  abstract detectPasswordReuse(ciphers: CipherView[]): Observable<Map<string, string[]>>;
}
