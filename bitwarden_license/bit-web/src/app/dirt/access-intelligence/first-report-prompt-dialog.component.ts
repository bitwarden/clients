import { Component, inject } from "@angular/core";

import { RiskInsightsDataService } from "@bitwarden/bit-common/dirt/reports/risk-insights";
import { ButtonModule, DialogModule, DialogRef, DialogService } from "@bitwarden/components";

@Component({
  templateUrl: "./first-report-prompt-dialog.component.html",
  imports: [ButtonModule, DialogModule],
})
export class FirstReportPromptDialogComponent {
  private dialogRef = inject(DialogRef);
  private dataService = inject(RiskInsightsDataService);

  static open(dialogService: DialogService) {
    return dialogService.open<boolean>(FirstReportPromptDialogComponent);
  }

  async runReport(): Promise<void> {
    // Close the dialog first
    this.dialogRef.close(true);

    // Add a small delay to ensure dialog closes before triggering the report
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Trigger the report generation
    if (this.dataService) {
      this.dataService.triggerReport();
    }
  }
}
