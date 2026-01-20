/* eslint-disable no-restricted-imports -- Prototype feature using licensed services */
import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, effect, inject } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { RiskInsightsPrototypeOrchestrationService } from "@bitwarden/bit-common/dirt/reports/risk-insights/services";
import {
  ProcessingPhase,
  RiskInsightsItem,
  RiskInsightsItemStatus,
} from "@bitwarden/common/dirt/reports/risk-insights";
import { BadgeModule, TableDataSource, TableModule } from "@bitwarden/components";
/* eslint-enable no-restricted-imports */

/**
 * Items tab component for the Risk Insights Prototype.
 *
 * Displays a table of cipher items with health status and member counts.
 * The orchestrator is provided by the parent component and shared across tabs.
 */
@Component({
  selector: "app-risk-insights-prototype-items",
  templateUrl: "./risk-insights-prototype-items.component.html",
  standalone: true,
  imports: [CommonModule, JslibModule, TableModule, BadgeModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RiskInsightsPrototypeItemsComponent {
  // ============================================================================
  // Injected Dependencies
  // ============================================================================
  private readonly orchestrator = inject(RiskInsightsPrototypeOrchestrationService);

  // ============================================================================
  // Expose Orchestrator Signals to Template
  // ============================================================================

  // Configuration flags (for conditional rendering in template)
  readonly enableWeakPassword = this.orchestrator.enableWeakPassword;
  readonly enableHibp = this.orchestrator.enableHibp;
  readonly enableReusedPassword = this.orchestrator.enableReusedPassword;

  // Processing state
  readonly processingPhase = this.orchestrator.processingPhase;
  readonly error = this.orchestrator.error;

  // Results
  readonly items = this.orchestrator.items;

  // Expose constants for template access
  readonly ProcessingPhase = ProcessingPhase;
  readonly RiskInsightsItemStatus = RiskInsightsItemStatus;

  // ============================================================================
  // Component State
  // ============================================================================

  /** Table data source for virtual scrolling */
  protected readonly dataSource = new TableDataSource<RiskInsightsItem>();

  /** Row size for virtual scrolling (in pixels) */
  protected readonly ROW_SIZE = 52;

  // ============================================================================
  // Lifecycle
  // ============================================================================

  constructor() {
    // Effect to sync items signal to table data source
    effect(() => {
      const items = this.items();
      this.dataSource.data = items;
    });
  }

  // ============================================================================
  // TrackBy Functions
  // ============================================================================

  /** TrackBy function for items */
  protected trackByItemId(_index: number, item: RiskInsightsItem): string {
    return item.cipherId;
  }
}
