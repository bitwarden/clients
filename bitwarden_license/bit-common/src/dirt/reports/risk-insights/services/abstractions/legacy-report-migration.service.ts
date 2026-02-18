import { Observable } from "rxjs";

import { OrganizationId } from "@bitwarden/common/types/guid";

import { RiskInsightsView } from "../../models/view/risk-insights.view";

/**
 * Migrates V1 Access Intelligence reports to V2 architecture.
 *
 * Handles one-time migration of legacy reports from the old data model
 * (duplicated member arrays) to the new member registry pattern.
 *
 * Platform-agnostic service using RxJS Observables.
 */
export abstract class LegacyReportMigrationService {
  /**
   * Load and migrate a V1 report to V2 format
   *
   * Loads V1 report from API, transforms data structures, and returns V2 view model.
   * Returns null if no V1 report exists.
   *
   * @param orgId - Organization to load V1 report for
   * @returns Observable emitting V2 RiskInsightsView or null
   *
   * @example
   * ```typescript
   * this.migrationService.migrateV1Report$(orgId).subscribe(report => {
   *   if (report) {
   *     console.log('V1 report migrated to V2');
   *     this.persistenceService.saveReport$(report).subscribe();
   *   }
   * });
   * ```
   */
  abstract migrateV1Report$(orgId: OrganizationId): Observable<RiskInsightsView | null>;
}
