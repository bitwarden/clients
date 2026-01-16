/* eslint-disable no-restricted-imports -- Prototype feature using licensed services */
import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  OnInit,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  CipherAccessMappingService,
  PasswordHealthService,
  RiskInsightsPrototypeOrchestrationService,
  RiskInsightsPrototypeService,
} from "@bitwarden/bit-common/dirt/reports/risk-insights/services";
import {
  ProcessingPhase,
  RiskInsightsItem,
  RiskInsightsItemStatus,
} from "@bitwarden/common/dirt/reports/risk-insights";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  BadgeModule,
  ButtonModule,
  CheckboxModule,
  ProgressModule,
  TableDataSource,
  TableModule,
} from "@bitwarden/components";

/* eslint-enable no-restricted-imports */

/**
 * Items tab component for the Risk Insights Prototype.
 *
 * Displays a table of cipher items with health status and member counts.
 * Features:
 * - Progressive loading with status indicators
 * - Virtual scrolling table for large datasets
 * - Configurable health checks (weak, reused, exposed passwords)
 */
@Component({
  selector: "app-risk-insights-prototype-items",
  templateUrl: "./risk-insights-prototype-items.component.html",
  standalone: true,
  imports: [
    CommonModule,
    JslibModule,
    TableModule,
    ProgressModule,
    CheckboxModule,
    ButtonModule,
    BadgeModule,
  ],
  providers: [
    RiskInsightsPrototypeOrchestrationService,
    RiskInsightsPrototypeService,
    CipherAccessMappingService,
    PasswordHealthService,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RiskInsightsPrototypeItemsComponent implements OnInit {
  // ============================================================================
  // Injected Dependencies
  // ============================================================================
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly orchestrator = inject(RiskInsightsPrototypeOrchestrationService);

  // ============================================================================
  // Expose Orchestrator Signals to Template
  // ============================================================================

  // Configuration flags
  readonly enableWeakPassword = this.orchestrator.enableWeakPassword;
  readonly enableHibp = this.orchestrator.enableHibp;
  readonly enableReusedPassword = this.orchestrator.enableReusedPassword;

  // Processing state
  readonly processingPhase = this.orchestrator.processingPhase;
  readonly progressMessage = this.orchestrator.progressMessage;

  // Progress tracking
  readonly cipherProgress = this.orchestrator.cipherProgress;
  readonly healthProgress = this.orchestrator.healthProgress;
  readonly memberProgress = this.orchestrator.memberProgress;
  readonly hibpProgress = this.orchestrator.hibpProgress;

  // Results
  readonly items = this.orchestrator.items;

  // Error state
  readonly error = this.orchestrator.error;

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

  /** Whether the component has been initialized */
  protected readonly initialized = signal(false);

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

  ngOnInit(): void {
    // Get organization ID from route and initialize orchestrator
    this.route.params.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const organizationId = params["organizationId"] as OrganizationId;
      if (organizationId) {
        this.orchestrator.initializeForOrganization(organizationId);
        this.initialized.set(true);
      }
    });
  }

  // ============================================================================
  // UI Actions
  // ============================================================================

  /** Start processing - run the report */
  protected runReport(): void {
    this.orchestrator.startProcessing();
  }

  /** Toggle weak password check */
  protected toggleWeakPassword(): void {
    this.orchestrator.toggleEnableWeakPassword();
  }

  /** Toggle HIBP check */
  protected toggleHibp(): void {
    this.orchestrator.toggleEnableHibp();
  }

  /** Toggle reused password check */
  protected toggleReusedPassword(): void {
    this.orchestrator.toggleEnableReusedPassword();
  }

  // ============================================================================
  // Computed Properties
  // ============================================================================

  /** Check if processing is currently running */
  protected isProcessing(): boolean {
    const phase = this.processingPhase();
    return (
      phase !== ProcessingPhase.Idle &&
      phase !== ProcessingPhase.Complete &&
      phase !== ProcessingPhase.Error
    );
  }

  /** Check if progress section should be shown */
  protected showProgress(): boolean {
    return this.isProcessing() || this.processingPhase() === ProcessingPhase.Complete;
  }

  /** Calculate overall progress percentage */
  protected getOverallProgress(): number {
    const phase = this.processingPhase();

    switch (phase) {
      case ProcessingPhase.Idle:
        return 0;
      case ProcessingPhase.LoadingCiphers:
        return this.cipherProgress().percent * 0.2; // 0-20%
      case ProcessingPhase.RunningHealthChecks:
        return 20 + this.healthProgress().percent * 0.2; // 20-40%
      case ProcessingPhase.LoadingMembers:
        return 40 + this.memberProgress().percent * 0.4; // 40-80%
      case ProcessingPhase.RunningHibp:
        return 80 + this.hibpProgress().percent * 0.2; // 80-100%
      case ProcessingPhase.Complete:
        return 100;
      default:
        return 0;
    }
  }

  // ============================================================================
  // TrackBy Functions
  // ============================================================================

  /** TrackBy function for items */
  protected trackByItemId(_index: number, item: RiskInsightsItem): string {
    return item.cipherId;
  }
}
