import { CommonModule } from "@angular/common";
import { Component, DestroyRef, inject, OnInit, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  ReportProgress,
  RiskInsightsDataService,
} from "@bitwarden/bit-common/dirt/reports/risk-insights";
import { ProgressModule } from "@bitwarden/components";

const PROGRESS_STEPS = [
  { step: ReportProgress.FetchingMembers, message: "fetchingMemberData", progress: 20 },
  { step: ReportProgress.AnalyzingPasswords, message: "analyzingPasswordHealth", progress: 40 },
  { step: ReportProgress.CalculatingRisks, message: "calculatingRiskScores", progress: 60 },
  { step: ReportProgress.GeneratingReport, message: "generatingReportData", progress: 80 },
  { step: ReportProgress.Saving, message: "savingReport", progress: 95 },
  { step: ReportProgress.Complete, message: "compilingInsights", progress: 100 },
] as const;

type LoadingMessage = (typeof PROGRESS_STEPS)[number]["message"];

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "dirt-risk-insights-loading",
  imports: [CommonModule, JslibModule, ProgressModule],
  templateUrl: "./risk-insights-loading.component.html",
})
export class ApplicationsLoadingComponent implements OnInit {
  private dataService = inject(RiskInsightsDataService);
  private destroyRef = inject(DestroyRef);

  readonly currentMessage = signal<LoadingMessage>(PROGRESS_STEPS[0].message);
  readonly progress = signal<number>(PROGRESS_STEPS[0].progress);

  ngOnInit(): void {
    // Subscribe to actual progress events from the orchestrator
    this.dataService.reportProgress$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((progressStep) => {
        if (progressStep === null) {
          // Reset to initial state
          this.currentMessage.set(PROGRESS_STEPS[0].message);
          this.progress.set(PROGRESS_STEPS[0].progress);
          return;
        }

        // Find the matching step configuration
        const stepConfig = PROGRESS_STEPS.find((config) => config.step === progressStep);
        if (stepConfig) {
          this.currentMessage.set(stepConfig.message);
          this.progress.set(stepConfig.progress);
        }
      });
  }
}
