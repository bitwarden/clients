import { Observable } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { RiskCategory, VaultHealthReportState } from "../../models";

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
   * Builds the report for `userId` and publishes it. Failures (e.g. a breach
   * lookup being down) come back as an `error` status, not a thrown error, so
   * callers read the outcome from {@link getVaultHealthReport$}.
   */
  abstract buildVaultHealthReport(ciphers: CipherView[], userId: UserId): Promise<void>;

  /**
   * The user's scan status and latest report. Starts at `idle` with no report
   * until a build runs.
   */
  abstract getVaultHealthReport$(userId: UserId): Observable<VaultHealthReportState>;

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
