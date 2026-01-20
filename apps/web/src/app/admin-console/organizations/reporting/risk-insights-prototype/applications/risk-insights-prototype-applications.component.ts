/* eslint-disable no-restricted-imports -- Prototype feature using licensed services */
import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { RiskInsightsPrototypeOrchestrationService } from "@bitwarden/bit-common/dirt/reports/risk-insights/services";
import {
  ProcessingPhase,
  RiskInsightsApplication,
  RiskInsightsItem,
  RiskInsightsItemStatus,
} from "@bitwarden/common/dirt/reports/risk-insights";
import { BadgeModule, TableDataSource, TableModule } from "@bitwarden/components";
/* eslint-enable no-restricted-imports */

import { CipherHealthBadgesComponent } from "../shared/cipher-health-badges.component";

/**
 * Applications tab component for the Risk Insights Prototype.
 *
 * Displays a table of applications (domains) with aggregated cipher data.
 * Features:
 * - Expandable rows to show ciphers within each application
 * - Virtual scrolling table for large datasets
 * - Distinct member counts per application
 */
@Component({
  selector: "app-risk-insights-prototype-applications",
  templateUrl: "./risk-insights-prototype-applications.component.html",
  standalone: true,
  imports: [CommonModule, JslibModule, TableModule, BadgeModule, CipherHealthBadgesComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RiskInsightsPrototypeApplicationsComponent {
  // ============================================================================
  // Injected Dependencies
  // ============================================================================
  private readonly orchestrator = inject(RiskInsightsPrototypeOrchestrationService);

  // ============================================================================
  // Expose Orchestrator Signals to Template
  // ============================================================================

  // Configuration flags (for conditional rendering in expanded rows)
  readonly enableWeakPassword = this.orchestrator.enableWeakPassword;
  readonly enableHibp = this.orchestrator.enableHibp;
  readonly enableReusedPassword = this.orchestrator.enableReusedPassword;

  // Processing state
  readonly processingPhase = this.orchestrator.processingPhase;
  readonly error = this.orchestrator.error;

  // Results
  readonly applications = this.orchestrator.applications;
  readonly items = this.orchestrator.items;

  // Expose constants for template access
  readonly ProcessingPhase = ProcessingPhase;
  readonly RiskInsightsItemStatus = RiskInsightsItemStatus;

  // ============================================================================
  // Component State
  // ============================================================================

  /** Table data source for virtual scrolling */
  protected readonly dataSource = new TableDataSource<RiskInsightsApplication>();

  /** Row size for virtual scrolling (in pixels) */
  protected readonly ROW_SIZE = 52;

  /** Set of expanded application domains */
  protected readonly expandedApplications = signal(new Set<string>());

  /** Cached map of cipher ID to item for O(1) lookups */
  private readonly itemMap = computed(() => {
    const items = this.items();
    return new Map(items.map((item) => [item.cipherId, item]));
  });

  // ============================================================================
  // Lifecycle
  // ============================================================================

  constructor() {
    // Effect to sync applications signal to table data source
    effect(() => {
      const applications = this.applications();
      this.dataSource.data = applications;
    });
  }

  // ============================================================================
  // Expansion Methods
  // ============================================================================

  /** Toggle expansion state for an application */
  protected toggleExpanded(domain: string): void {
    this.expandedApplications.update((current) => {
      const newSet = new Set(current);
      if (newSet.has(domain)) {
        newSet.delete(domain);
      } else {
        newSet.add(domain);
      }
      return newSet;
    });
  }

  /** Check if an application is expanded */
  protected isExpanded(domain: string): boolean {
    return this.expandedApplications().has(domain);
  }

  /** Get cipher items for an application (for expanded view) */
  protected getCiphersForApplication(cipherIds: string[]): RiskInsightsItem[] {
    const map = this.itemMap();
    return cipherIds
      .map((id) => map.get(id))
      .filter((item): item is RiskInsightsItem => item !== undefined);
  }

  // ============================================================================
  // TrackBy Functions
  // ============================================================================

  /** TrackBy function for applications */
  protected trackByDomain(_index: number, app: RiskInsightsApplication): string {
    return app.domain;
  }

  /** TrackBy function for cipher items */
  protected trackByCipherId(_index: number, item: RiskInsightsItem): string {
    return item.cipherId;
  }
}
