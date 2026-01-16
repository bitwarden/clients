/* eslint-disable no-restricted-imports -- Prototype feature using licensed services */
import { CommonModule } from "@angular/common";
import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  CipherAccessMappingService,
  PasswordHealthService,
  RiskInsightsPrototypeOrchestrationService,
  RiskInsightsPrototypeService,
} from "@bitwarden/bit-common/dirt/reports/risk-insights/services";
import { ProcessingPhase } from "@bitwarden/common/dirt/reports/risk-insights";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { ButtonModule, CheckboxModule, ProgressModule, TabsModule } from "@bitwarden/components";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";

import { RiskInsightsPrototypeApplicationsComponent } from "./applications/risk-insights-prototype-applications.component";
import { RiskInsightsPrototypeItemsComponent } from "./items/risk-insights-prototype-items.component";
import { RiskInsightsPrototypeMembersComponent } from "./members/risk-insights-prototype-members.component";
/* eslint-enable no-restricted-imports */

@Component({
  selector: "app-risk-insights-prototype",
  templateUrl: "./risk-insights-prototype.component.html",
  standalone: true,
  imports: [
    CommonModule,
    JslibModule,
    TabsModule,
    HeaderModule,
    ButtonModule,
    CheckboxModule,
    ProgressModule,
    RiskInsightsPrototypeItemsComponent,
    RiskInsightsPrototypeApplicationsComponent,
    RiskInsightsPrototypeMembersComponent,
  ],
  providers: [
    RiskInsightsPrototypeOrchestrationService,
    RiskInsightsPrototypeService,
    CipherAccessMappingService,
    PasswordHealthService,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RiskInsightsPrototypeComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  protected readonly orchestrator = inject(RiskInsightsPrototypeOrchestrationService);

  tabIndex = 0;

  // Expose orchestrator signals to template
  readonly enableWeakPassword = this.orchestrator.enableWeakPassword;
  readonly enableHibp = this.orchestrator.enableHibp;
  readonly enableReusedPassword = this.orchestrator.enableReusedPassword;
  readonly processingPhase = this.orchestrator.processingPhase;
  readonly progressMessage = this.orchestrator.progressMessage;
  readonly cipherProgress = this.orchestrator.cipherProgress;
  readonly healthProgress = this.orchestrator.healthProgress;
  readonly memberProgress = this.orchestrator.memberProgress;
  readonly hibpProgress = this.orchestrator.hibpProgress;
  readonly error = this.orchestrator.error;

  // Expose constants for template access
  readonly ProcessingPhase = ProcessingPhase;

  // Component initialization state
  protected readonly initialized = signal(false);

  constructor() {
    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ tabIndex }) => {
      this.tabIndex = !isNaN(Number(tabIndex)) ? Number(tabIndex) : 0;
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

  async onTabChange(newIndex: number): Promise<void> {
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tabIndex: newIndex },
      queryParamsHandling: "merge",
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
}
