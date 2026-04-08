import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";

import { ButtonModule, ButtonType, LinkModule, TypographyModule } from "@bitwarden/components";

@Component({
  selector: "dirt-activity-card",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./activity-card.component.html",
  imports: [TypographyModule, LinkModule, ButtonModule],
  host: {
    class:
      "tw-box-border tw-bg-background tw-block tw-text-main tw-border-solid tw-border-secondary-100 tw-border [&:not(bit-layout_*)]:tw-rounded-lg tw-rounded-lg tw-p-6 tw-min-h-56 tw-overflow-hidden",
  },
})
export class ActivityCardComponent {
  /**
   * The title of the card goes here
   */
  readonly title = input.required<string>();
  /**
   * The card metrics text to display next to the value
   */
  readonly cardMetrics = input.required<string>();
  /**
   * The description text to display below the value and metrics
   */
  readonly metricDescription = input.required<string>();

  /**
   * The text to display for the action link
   */
  readonly actionText = input<string>("");

  /**
   * Show action link
   */
  readonly showActionLink = input<boolean>(false);

  /**
   * Icon class to display next to metrics (e.g., "bwi-exclamation-triangle").
   * If null, no icon is displayed.
   */
  readonly iconClass = input<string | null>(null);

  /**
   * CSS class for icon color (e.g., "tw-text-success", "tw-text-muted").
   * Defaults to "tw-text-muted" if not provided.
   */
  readonly iconColorClass = input<string>("tw-text-muted");

  /**
   * Button text. If provided, a button will be displayed instead of a navigation link.
   */
  readonly buttonText = input<string>("");

  /**
   * Button type (e.g., "primary", "secondary")
   */
  readonly buttonType = input<ButtonType>("primary");

  /**
   * Event emitted when button is clicked
   */
  readonly buttonClick = output<void>();

  /*
   * To facilitate automated testing, provide a testId that will be
   * added as a data attribute to the root element of the card
   * (e.g., <dirt-activity-card [testId]="'my-card'">).
   * This allows tests to easily select the card using
   * the data attribute (e.g., [data-test-id="my-card"].
   */
  readonly testId = input.required<string>();

  /**
   * Event emitted when action link is clicked
   */
  readonly actionClick = output<void>();

  readonly onButtonClick = () => {
    this.buttonClick.emit();
  };

  readonly onActionClick = () => {
    this.actionClick.emit();
  };
}
