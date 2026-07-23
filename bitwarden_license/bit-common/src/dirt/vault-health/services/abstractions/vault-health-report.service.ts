import { Observable } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";

import { VaultHealthReportView } from "../../models/view/vault-health-report.view";

/**
 * Orchestration layer for the browser Health tab.
 *
 * Runs the password-health checks for the user's personal-vault logins via the
 * Vault-owned CipherRiskService (does not re-implement report logic),
 * categorizes and deduplicates the results (highest-risk-wins:
 * Exposed > Weak > Reused), computes the vault-health score, and emits the
 * aggregated result reactively, re-emitting when the vault changes.
 */
export abstract class VaultHealthReportService {
  /**
   * Emits the aggregated vault-health report for the given user, re-emitting
   * whenever the user's vault changes. Errors from the underlying risk
   * computation (e.g. an HIBP failure) propagate so the caller can route to
   * the scan-failure state (PM-39223); they are not swallowed here.
   */
  abstract vaultHealthReport$(userId: UserId): Observable<VaultHealthReportView>;
}
