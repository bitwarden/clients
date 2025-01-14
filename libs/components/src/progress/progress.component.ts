import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";

type SizeTypes = "small" | "default" | "large";
type BackgroundTypes = "danger" | "primary" | "success" | "warning";

const SizeClasses: Record<SizeTypes, string[]> = {
  small: ["tw-h-1"],
  default: ["tw-h-4"],
  large: ["tw-h-6"],
};

const BackgroundClasses: Record<BackgroundTypes, string[]> = {
  danger: ["tw-bg-danger-600"],
  primary: ["tw-bg-primary-600"],
  success: ["tw-bg-success-600"],
  warning: ["tw-bg-warning-600"],
};

@Component({
  selector: "bit-progress",
  templateUrl: "./progress.component.html",
  standalone: true,
  imports: [CommonModule],
})
export class ProgressComponent {
  @Input() barWidth = 0;
  @Input() bgColor: BackgroundTypes = "primary";
  @Input() showText = true;
  @Input() size: SizeTypes = "default";
  @Input() text?: string;

  get displayText() {
    return this.showText && this.size !== "small";
  }

  get outerBarStyles() {
    return ["tw-overflow-hidden", "tw-rounded", "tw-bg-secondary-100"].concat(
      SizeClasses[this.size],
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
      .concat(SizeClasses[this.size])
      .concat(BackgroundClasses[this.bgColor]);
  }

  get textContent() {
    return this.text || this.barWidth + "%";
  }
}
