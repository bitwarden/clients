import { Observable } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { VaultHealthReportState } from "../../models";

/**
 * Report builder and publisher for the browser Health tab. Scoring a login is the
 * Vault-owned CipherRiskService's job and is not reimplemented here.
 *
 * The caller owns fetching the ciphers and deciding when to recompute. This service
 * owns the report, the state of generating it, and publishing both to every Health
 * page.
 *
 * Two ways to recompute: {@link buildVaultHealthReport} for a scan the user asked
 * for, which shows progress, and {@link refreshVaultHealthReport} for a vault
 * change, which updates in the background.
 */
export abstract class VaultHealthReportService {
  /**
   * Builds the report for `userId` and publishes it. Failures (e.g. a breach
   * lookup being down) come back as an `error` status, not a thrown error, so
   * callers read the outcome from {@link getVaultHealthReport$}.
   */
  abstract buildVaultHealthReport(ciphers: CipherView[], userId: UserId): Promise<void>;

  /**
   * Brings an already-published report back in line with `ciphers` and publishes
   * the result.
   *
   * Never emits `loading`, so the results already on screen stay put.
   *
   * Does nothing until a report exists to update, and nothing when no scoped login
   * was added, removed, or saved since the last publish.
   *
   * Never rejects. A failure leaves the published report as it was, and the next
   * vault change retries the same work.
   */
  abstract refreshVaultHealthReport(ciphers: CipherView[], userId: UserId): Promise<void>;

  /**
   * The user's scan status and latest report. Starts at `idle` with no report
   * until a build runs.
   */
  abstract getVaultHealthReport$(userId: UserId): Observable<VaultHealthReportState>;
}
