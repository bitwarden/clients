import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ProgressModule, TypographyModule } from "@bitwarden/components";

@Component({
  selector: "dirt-password-change-metric",
  imports: [CommonModule, TypographyModule, JslibModule, ProgressModule],
  templateUrl: "./password-change-metric.component.html",
  host: {
    class:
      "tw-box-border tw-bg-background tw-text-main tw-border-solid tw-border tw-border-secondary-300 tw-border [&:not(bit-layout_*)]:tw-rounded-lg tw-rounded-lg tw-p-6",
  },
})
export class PasswordChangeMetricComponent {
  get completedPercent(): number {
    return (this.completedTasks / this.totalTasks) * 100;
  }
  totalTasks: number = 200;
  completedTasks: number = 100;
}
