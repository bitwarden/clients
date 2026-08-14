import { Observable } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { VaultHealthReportView } from "../../models/view/vault-health-report.view";

/**
 * Report builder and publisher for the browser Health tab.
 *
 * Given the caller's list of vault ciphers, it filters to the personal-vault
 * logins in scope, runs the password-health checks via the Vault-owned
 * CipherRiskService (does not re-implement report logic), categorizes and
 * deduplicates the results (highest-risk-wins: Exposed > Weak > Reused), and
 * computes the vault-health score. The caller (the Health-tab root component)
 * owns fetching the ciphers and deciding when to recompute; this service owns
 * the resulting report state and publishes it to every Health page.
 */
export abstract class VaultHealthReportService {
  /**
   * Builds the aggregated vault-health report from the given ciphers and
   * publishes it for `userId`. Errors from the underlying risk computation
   * (e.g. an HIBP failure) propagate so the caller can route to the
   * scan-failure state (PM-39223); they are not swallowed here.
   */
  abstract buildVaultHealthReport(ciphers: CipherView[], userId: UserId): Promise<void>;

  /** Get the latest vault health scan report for a user, run buildVaultHealthReport first to generate the report.
   * @returns an observable that emits the latest report built for `userId`, or
   * null until a scan completes for that user
   */
  abstract getVaultHealthReport$(userId: UserId): Observable<VaultHealthReportView | null>;
}
