import { Observable } from "rxjs";

import { OrganizationId } from "@bitwarden/common/types/guid";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { ReportProgress } from "../../../reports/risk-insights/models/report-models";
import { AccessReportView } from "../../models";

/**
 * Orchestrates Access Intelligence (Risk Insights) data loading, generation, and persistence.
 *
 * Serves as the single source of truth for report data. Components subscribe to observables
 * for reactive state updates. Coordinates with ReportGenerationService for report creation
 * and ReportPersistenceService for storage.
 *
 * Platform-agnostic service using RxJS Observables for compatibility across web, desktop,
 * browser, and CLI clients.
 */
export abstract class AccessIntelligenceDataService {
  /**
   * Current report state (single source of truth)
   *
   * Emits the latest report or null if no report loaded.
   * All UI components derive state from this observable.
   */
  abstract readonly report$: Observable<AccessReportView | null>;

  /**
   * Organization ciphers for display purposes
   *
   * Exposed for UI needs like getCipherIcon(). Loaded during report generation
   * and stored for the current session.
   */
  abstract readonly ciphers$: Observable<CipherView[]>;

  /**
   * Loading state indicator
   *
   * True during report generation or loading operations.
   * Components use this to show loading spinners.
   */
  abstract readonly loading$: Observable<boolean>;

  /**
   * Error state
   *
   * Emits error messages when operations fail.
   * Null when no error present.
   */
  abstract readonly error$: Observable<string | null>;

  /**
   * Report generation progress
   *
   * Emits progress steps during report generation (FetchingMembers → Complete).
   * Null when no generation is in progress.
   */
  abstract readonly reportProgress$: Observable<ReportProgress | null>;

  /**
   * Initialize service for a specific organization
   *
   * Loads organization data and existing report if available.
   * Call this when user navigates to Access Intelligence page.
   *
   * @param orgId - Organization to initialize for
   * @returns Observable that completes when initialization finishes
   *
   * @example
   * ```typescript
   * this.dataService.initializeForOrganization$(orgId).subscribe(() => {
   *   console.log('Ready to display report');
   * });
   * ```
   */
  abstract initializeForOrganization$(orgId: OrganizationId): Observable<void>;

  /**
   * Generate a new report from latest organization data
   *
   * Loads fresh data from API, generates report, saves, and emits via report$.
   * Carries over previous application metadata (critical flags, review dates).
   *
   * @param orgId - Organization to generate report for
   * @returns Observable that completes when generation and save finish
   *
   * @example
   * ```typescript
   * this.dataService.generateNewReport$(orgId).subscribe({
   *   next: () => console.log('Report generated'),
   *   error: (err) => console.error('Generation failed', err)
   * });
   * ```
   */
  abstract generateNewReport$(orgId: OrganizationId): Observable<void>;

  /**
   * Load existing report from persistence
   *
   * Fetches saved report, decrypts, and emits via report$.
   * Returns immediately if no report exists (report$ emits null).
   *
   * @param orgId - Organization to load report for
   * @returns Observable that completes when load finishes
   *
   * @example
   * ```typescript
   * this.dataService.loadExistingReport$(orgId).subscribe(() => {
   *   console.log('Report loaded or null emitted');
   * });
   * ```
   */
  abstract loadExistingReport$(orgId: OrganizationId): Observable<void>;

  /**
   * Refresh report with latest data
   *
   * Re-generates report from current organization data while preserving
   * application metadata (critical flags, review dates).
   *
   * @param orgId - Organization to refresh report for
   * @returns Observable that completes when refresh finishes
   *
   * @example
   * ```typescript
   * this.dataService.refreshReport$(orgId).subscribe(() => {
   *   console.log('Report refreshed with latest data');
   * });
   * ```
   */
  abstract refreshReport$(orgId: OrganizationId): Observable<void>;

  /**
   * Mark one or more applications as critical in a single save operation
   *
   * Mutates all view models at once, recomputes the summary once, and persists
   * once to avoid multiple round-trips.
   * Also marks each application as reviewed if not already reviewed.
   *
   * @param appNames - Application names to mark as critical
   * @returns Observable that completes when save finishes
   *
   * @example
   * ```typescript
   * this.dataService.markApplicationsAsCritical$(['github.com', 'gitlab.com']).subscribe();
   * ```
   */
  abstract markApplicationsAsCritical$(appNames: string[]): Observable<void>;

  /**
   * Unmark one or more applications as critical in a single save operation
   *
   * Mutates all view models at once, recomputes the summary once, and persists
   * once to avoid multiple round-trips.
   *
   * @param appNames - Application names to unmark as critical
   * @returns Observable that completes when save finishes
   *
   * @example
   * ```typescript
   * this.dataService.unmarkApplicationsAsCritical$(['github.com', 'gitlab.com']).subscribe();
   * ```
   */
  abstract unmarkApplicationsAsCritical$(appNames: string[]): Observable<void>;

  /**
   * Mark one or more applications as reviewed in a single save operation
   *
   * Mutates all view models at once and persists once to avoid multiple
   * round-trips.
   * Does NOT recompute summary (review status is not part of summary).
   *
   * @param appNames - Application names to mark as reviewed
   * @param date - Review date (defaults to current date)
   * @returns Observable that completes when save finishes
   *
   * @example
   * ```typescript
   * this.dataService.markApplicationsAsReviewed$(['github.com', 'gitlab.com']).subscribe();
   * ```
   */
  abstract markApplicationsAsReviewed$(appNames: string[], date?: Date): Observable<void>;
}
