import { Observable } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { RiskCategory, VaultHealthReportState } from "../../models";
import { VaultHealthReportView } from "../../models/view/vault-health-report.view";

/**
 * Report builder and publisher for the browser Health tab.
 *
 * Given the caller's list of vault ciphers, it filters to the personal-vault
 * logins in scope, runs the password-health checks via the Vault-owned
 * CipherRiskService (does not re-implement report logic), categorizes and
 * deduplicates the results (highest-risk-wins: Exposed > Weak > Reused), and
 * computes the vault-health score. The caller owns fetching the ciphers and
 * deciding when to recompute; this service owns the report and the state of
 * generating it, and publishes both to every Health page.
 */
export abstract class VaultHealthReportService {
  /**
   * Builds the aggregated vault-health report from the given ciphers and
   * publishes it for `userId`.
   *
   * Publishes `loading` before starting and then `success` or `error`, so a
   * failure in the underlying risk computation (e.g. an HIBP failure) surfaces
   * through `getVaultHealthReportState$` rather than as a rejection. Callers
   * read the outcome from that stream rather than catching failures from this
   * call.
   */
  abstract buildVaultHealthReport(ciphers: CipherView[], userId: UserId): Promise<void>;

  /**
   * Where report generation is for `userId`.
   * @returns an observable that emits the current state, starting at `idle`
   * until a build is started for that user
   */
  abstract getVaultHealthReportState$(userId: UserId): Observable<VaultHealthReportState>;

  /** Get the latest vault health scan report for a user, run buildVaultHealthReport first to generate the report.
   * @returns an observable that emits the last report successfully built for
   * `userId`, or null when there is none. Retained while a rescan is in flight
   * and after a failed one, so it never blinks to null mid-generation; read
   * `getVaultHealthReportState$` to tell those apart.
   */
  abstract getVaultHealthReport$(userId: UserId): Observable<VaultHealthReportView | null>;

  /**
   * Delete an item from an existing vault health report, without rebuilding the report.
   *
   * @param cipherId the id of the cipher/item to be deleted from the report
   * @param category the risk category the cipher/item belongs to
   * @param userId the id of the user deleting the item
   * @returns n/a
   */
  abstract deleteItemFromReport(cipherId: string, category: RiskCategory, userId: UserId): void;
}
