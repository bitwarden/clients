import { CommonModule } from "@angular/common";
import { Component, computed, input } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ReportProgress } from "@bitwarden/bit-common/dirt/reports/risk-insights";
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
export class ApplicationsLoadingComponent {
  // Progress step input from parent component (already delayed via concatMap)
  readonly progressStep = input<ReportProgress | null>(null);

  // Helper to find step config, defaults to first step
  private getStepConfig(step: ReportProgress | null) {
    if (step === null) {
      return PROGRESS_STEPS[0];
    }
    return PROGRESS_STEPS.find((config) => config.step === step) ?? PROGRESS_STEPS[0];
  }

  // Computed signals: derive display values from progress step
  protected readonly currentMessage = computed<LoadingMessage>(
    () => this.getStepConfig(this.progressStep()).message,
  );

  protected readonly progress = computed<number>(
    () => this.getStepConfig(this.progressStep()).progress,
  );
}
