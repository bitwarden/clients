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
   * Analyzes password health for multiple ciphers: identifies weak, reused, and exposed passwords.
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
