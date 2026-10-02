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
   * Checks all ciphers for weak passwords (zxcvbn score <= 2), password reuse, and HIBP exposure.
   *
   * With `pm-43231-access-intelligence-performance-at-scale` on, exposure is looked up once per
   * distinct password rather than once per cipher, so the number of requests tracks reuse rather
   * than vault size. With it off, the pre-deduplication path runs instead, as the measurement
   * baseline.
   *
   * With the flag on, a failed exposure lookup does not fail the batch: that cipher is reported as
   * not exposed and its strength and reuse results still stand. Every cipher is present in the
   * returned map.
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
}
