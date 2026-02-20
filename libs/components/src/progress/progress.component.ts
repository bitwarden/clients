import { CommonModule } from "@angular/common";
import { Component, input, ChangeDetectionStrategy, computed } from "@angular/core";

export type BackgroundType = "primary" | "subtle" | "success" | "warning" | "danger";

const BackgroundClasses: Record<BackgroundType, string[]> = {
  primary: ["tw-bg-primary-600"],
  subtle: ["tw-bg-bg-contrast"],
  success: ["tw-bg-success-600"],
  warning: ["tw-bg-warning-600"],
  danger: ["tw-bg-danger-600"],
};

/**
 * The progress bar component represents a determinate progress state, visually indicating how much of an action or load has been completed and how much remains.
 * By showing measurable progress, it helps users understand timing and sets clear expectations for more static progress indications.
 *
 * Progress bars can be used on their own, as in full-page loading or multi-step processes, or embedded within components like cards, panels,
 * or dialogs when progress is tied to a specific task.
 */
@Component({
  selector: "bit-progress",
  templateUrl: "./progress.component.html",
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgressBarComponent {
  readonly variant = input<BackgroundType>("primary");
  readonly label = input<string>();
  readonly barWidth = input<number>(0);
  readonly showStartText = input<boolean>(true);
  readonly startText = input<string>();
  readonly endText = input<string>();

  protected readonly startTextContent = computed(() => {
    if (!this.showStartText()) {
      return undefined;
    }

    return this.startText() || `${this.barWidth()}% complete`;
  });

  get outerBarStyles() {
    return ["tw-overflow-hidden", "tw-rounded", "tw-bg-secondary-100", "tw-h-2"];
  }

  get innerBarStyles() {
    return [
      "tw-flex",
      "tw-justify-center",
      "tw-items-center",
      "tw-whitespace-nowrap",
      "tw-text-xs",
      "tw-font-medium",
      "tw-text-contrast",
      "tw-transition-all",
      "tw-h-2",
    ].concat(BackgroundClasses[this.variant()]);
  }
}
