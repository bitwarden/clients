import { DialogRef, DIALOG_DATA } from "@angular/cdk/dialog";
import { Component, Inject } from "@angular/core";

import { ButtonModule } from "@bitwarden/components";

@Component({
  selector: "tools-no-data-modal",
  templateUrl: "./no-data-modal.component.html",
  standalone: true,
  imports: [ButtonModule],
})
export class NoDataModalComponent {
  constructor(
    public dialogRef: DialogRef<boolean>,
    @Inject(DIALOG_DATA) public data: any,
  ) {}

  async runReport(): Promise<void> {
    // Close the modal first
    this.dialogRef.close(true);

    // Add a small delay to ensure modal closes before triggering the report
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Trigger the report generation
    if (this.data.riskInsightsDataService) {
      this.data.riskInsightsDataService.triggerReport();
    }
  }
}
