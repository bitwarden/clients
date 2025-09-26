import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { TypographyModule } from "@bitwarden/components";

@Component({
  selector: "dirt-activity-card",
  templateUrl: "./activity-card.component.html",
  imports: [CommonModule, TypographyModule, JslibModule],
  host: {
    class:
      "tw-box-border tw-bg-background tw-block tw-text-main tw-border-solid tw-border tw-border-secondary-300 tw-border [&:not(bit-layout_*)]:tw-rounded-lg tw-rounded-lg tw-p-6",
  },
})
export class ActivityCardComponent {
  /**
   * The title of the card goes here
   */
  @Input() title: string = "";
  /**
   * The current value of the card as emphasized text
   */
  @Input() value: number | null = null;
  /**
   * The card metrics text to display next to the value
   */
  @Input() cardMetrics: string = "";
  /**
   * The description text to display below the value and metrics
   */
  @Input() metricDescription: string = "";
}
