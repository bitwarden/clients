import { Observable } from "rxjs";

import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { OrganizationId, OrganizationReportId } from "@bitwarden/common/types/guid";

import { RiskInsightsView } from "../../models/view/risk-insights.view";

/**
 * Service for persisting Risk Insights reports with backend flexibility.
 *
 * Handles encryption, compression, and storage coordination. The abstract
 * interface stays stable while implementations can vary (DB, blob storage, etc.).
 *
 * Platform-agnostic domain service used by AccessIntelligenceDataService.
 */
export abstract class ReportPersistenceService {
  /**
   * Save a complete report (payload + metadata + summary)
   *
   * Encrypts and compresses the full report, then saves to the configured
   * storage backend. Computes metrics from view using view.toMetrics().
   *
   * @param view - View model containing decrypted report data
   * @param organizationId - Organization this report belongs to
   * @returns Observable emitting server-assigned report ID
   *
   * @example
   * ```typescript
   * this.persistenceService.saveReport$(generatedReport, orgId).subscribe((reportId) => {
   *   generatedReport.id = reportId;
   *   console.log('Saved:', reportId);
   * });
   * ```
   */
  abstract saveReport$(
    view: RiskInsightsView,
    organizationId: OrganizationId,
  ): Observable<{ id: OrganizationReportId; contentEncryptionKey: EncString }>;

  /**
   * Update application metadata (critical flags, review dates) and summary
   *
   * Called after user mutates the report via view model methods.
   * The view model handles business logic and recomputes the summary,
   * this service encrypts and persists the updated state. Computes metrics
   * from view using view.toMetrics().
   *
   * @param view - Updated view model with mutated applications/summary
   * @returns Observable that completes when update finishes
   *
   * @example
   * ```typescript
   * report.markApplicationAsCritical('github.com');
   * this.persistenceService.saveApplicationMetadata$(report).subscribe();
   * ```
   */
  abstract saveApplicationMetadata$(view: RiskInsightsView): Observable<void>;

  /**
   * Load the latest report for an organization
   *
   * Fetches from storage backend, decrypts, decompresses, and assembles
   * into a complete RiskInsightsView. Returns null if no report exists.
   *
   * @param organizationId - Organization to load report for
   * @returns Observable emitting the decrypted report view, or null if none exists
   *
   * @example
   * ```typescript
   * this.persistenceService.loadReport$(orgId).subscribe((report) => {
   *   if (report) {
   *     console.log('Loaded:', report.id);
   *   } else {
   *     console.log('No report, generate new one');
   *   }
   * });
   * ```
   */
  abstract loadReport$(organizationId: OrganizationId): Observable<RiskInsightsView | null>;
}
