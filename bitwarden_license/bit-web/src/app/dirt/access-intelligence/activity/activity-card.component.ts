import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, Output } from "@angular/core";
import { Router } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ButtonModule, ButtonType, LinkModule, TypographyModule } from "@bitwarden/components";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
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
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() title: string = "";
  /**
   * The card metrics text to display next to the value
   */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() cardMetrics: string = "";
  /**
   * The description text to display below the value and metrics
   */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() metricDescription: string = "";

  /**
   * The text to display for the action link
   */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() actionText: string = "";

  /**
   * Show action link
   */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() showActionLink: boolean = false;

  /**
   * Icon class to display next to metrics (e.g., "bwi-exclamation-triangle").
   * If null, no icon is displayed.
   */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() iconClass: string | null = null;

  /**
   * CSS class for icon color (e.g., "tw-text-success", "tw-text-muted").
   * Defaults to "tw-text-muted" if not provided.
   */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() iconColorClass: string = "tw-text-muted";

  /**
   * Button text. If provided, a button will be displayed instead of a navigation link.
   */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() buttonText: string = "";

  /**
   * Button type (e.g., "primary", "secondary")
   */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() buttonType: ButtonType = "primary";

  /**
   * Event emitted when button is clicked
   */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() buttonClick = new EventEmitter<void>();

  /**
   * Event emitted when action link is clicked
   */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() actionClick = new EventEmitter<void>();

  constructor(private router: Router) {}

  onButtonClick = () => {
    this.buttonClick.emit();
  };

  onActionClick = () => {
    this.actionClick.emit();
  };
}
