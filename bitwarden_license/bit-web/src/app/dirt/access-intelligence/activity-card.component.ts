import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, Output } from "@angular/core";
import { Router } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ButtonModule, ButtonType, LinkModule, TypographyModule } from "@bitwarden/components";

@Component({
  selector: "dirt-activity-card",
  templateUrl: "./activity-card.component.html",
  imports: [CommonModule, TypographyModule, JslibModule, LinkModule, ButtonModule],
  host: {
    class:
      "tw-box-border tw-bg-background tw-block tw-text-main tw-border-solid tw-border tw-border-secondary-300 tw-border [&:not(bit-layout_*)]:tw-rounded-lg tw-rounded-lg tw-p-6 tw-h-56 tw-max-h-56",
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

  /**
   * Icon class to display next to metrics (e.g., "bwi-exclamation-triangle").
   * If null, no icon is displayed.
   */
  @Input() iconClass: string | null = null;

  /**
   * Button text. If provided, a button will be displayed instead of a navigation link.
   */
  @Input() buttonText: string = "";

  /**
   * Button type (e.g., "primary", "secondary")
   */
  @Input() buttonType: ButtonType = "primary";

  /**
   * Event emitted when button is clicked
   */
  @Output() buttonClick = new EventEmitter<void>();

  constructor(private router: Router) {}

  navigateToLink = async (navigationLink: string) => {
    await this.router.navigateByUrl(navigationLink);
  };

  onButtonClick = () => {
    this.buttonClick.emit();
  };
}
