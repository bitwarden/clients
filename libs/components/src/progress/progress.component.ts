import { CommonModule } from "@angular/common";
import { Component, input } from "@angular/core";

type ProgressSizeType = "small" | "default" | "large";
type BackgroundType = "danger" | "primary" | "success" | "warning";

const SizeClasses: Record<ProgressSizeType, string[]> = {
  small: ["tw-h-1"],
  default: ["tw-h-4"],
  large: ["tw-h-6"],
};

const BackgroundClasses: Record<BackgroundType, string[]> = {
  danger: ["tw-bg-danger-600"],
  primary: ["tw-bg-primary-600"],
  success: ["tw-bg-success-600"],
  warning: ["tw-bg-warning-600"],
};

/**
 * Progress indicators may be used to visually indicate progress or to visually measure some other value, such as a password strength indicator.
 */
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-progress",
  templateUrl: "./progress.component.html",
  imports: [CommonModule],
})
export class ProgressComponent {
  readonly barWidth = input(0);
  readonly bgColor = input<BackgroundType>("primary");
  readonly showText = input(true);
  readonly size = input<ProgressSizeType>("default");
  readonly text = input<string>();

  get displayText() {
    return this.showText() && this.size() !== "small";
  }

  get outerBarStyles() {
    return ["tw-overflow-hidden", "tw-rounded", "tw-bg-secondary-100"].concat(
      SizeClasses[this.size()],
    );
  }

  get innerBarStyles() {
    return [
      "tw-flex",
      "tw-justify-center",
      "tw-items-center",
      "tw-whitespace-nowrap",
      "tw-text-xs",
      "tw-font-semibold",
      "tw-text-contrast",
      "tw-transition-all",
    ]
      .concat(SizeClasses[this.size()])
      .concat(BackgroundClasses[this.bgColor()]);
  }

  get textContent() {
    return this.text() || this.barWidth() + "%";
  }
}
