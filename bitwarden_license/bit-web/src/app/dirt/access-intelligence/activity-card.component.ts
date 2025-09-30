import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";
import { Router } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ButtonModule, LinkModule, TypographyModule } from "@bitwarden/components";

@Component({
  selector: "dirt-activity-card",
  templateUrl: "./activity-card.component.html",
  imports: [CommonModule, TypographyModule, JslibModule, LinkModule, ButtonModule],
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
   * The card metrics text to display next to the value
   */
  @Input() cardMetrics: string = "";
  /**
   * The description text to display below the value and metrics
   */
  @Input() metricDescription: string = "";

  /**
   * The link to navigate to for more information
   */
  @Input() navigationLink: string = "";

  /**
   * The text to display for the navigation link
   */
  @Input() navigationText: string = "";

  /**
   * Show Navigation link
   */
  @Input() showNavigationLink: boolean = false;

  constructor(private router: Router) {}

  navigateToLink = async (navigationLink: string) => {
    await this.router.navigateByUrl(navigationLink);
  };
}
