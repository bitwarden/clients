import { Component, input } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ReportProgress } from "@bitwarden/bit-common/dirt/reports/risk-insights";
import { ProgressModule } from "@bitwarden/components";

// Map of progress step to display config
const ProgressStepConfig = Object.freeze({
  [ReportProgress.FetchingMembers]: { message: "fetchingMemberData", progress: 20 },
  [ReportProgress.AnalyzingPasswords]: { message: "analyzingPasswordHealth", progress: 40 },
  [ReportProgress.CalculatingRisks]: { message: "calculatingRiskScores", progress: 60 },
  [ReportProgress.GeneratingReport]: { message: "generatingReportData", progress: 80 },
  [ReportProgress.Saving]: { message: "savingReport", progress: 95 },
  [ReportProgress.Complete]: { message: "compilingInsights", progress: 100 },
} as const);

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "dirt-report-loading",
  imports: [JslibModule, ProgressModule],
  templateUrl: "./report-loading.component.html",
})
export class ReportLoadingComponent {
  // Progress step input from parent component.
  // Recommended: delay emissions to this input to ensure each step displays for a minimum time.
  // Refer to risk-insights.component for implementation example.
  readonly progressStep = input<ReportProgress>(ReportProgress.FetchingMembers);

  // Expose config map to template for direct lookup
  protected readonly stepConfig = ProgressStepConfig;
}
