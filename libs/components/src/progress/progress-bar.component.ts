import { CommonModule } from "@angular/common";
import { Component, input, ChangeDetectionStrategy, computed } from "@angular/core";

import { TypographyModule } from "../typography";

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
  selector: "bit-progress-bar",
  templateUrl: "./progress-bar.component.html",
  imports: [CommonModule, TypographyModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgressBarComponent {
  /* Determines the color of the progress bar */
  readonly variant = input<BackgroundType>("primary");
  /* The label displayed above the progress bar */
  readonly label = input<string>();
  /* The progress amount, represented as a percentage of the progress bar that is filled */
  readonly barWidth = input<number>(0);
  /* Whether to show the starting helper text below the progress bar. Defaults to true */
  readonly showStartText = input<boolean>(true);
  /* The starting helper text displayed below the progress bar. Defaults to "<barWidth>% complete" */
  readonly startText = input<string>();
  /* The ending helper text displayed below the progress bar. If nothing is passed, no text is displayed in the end slot */
  readonly endText = input<string>();

  protected readonly startTextContent = computed(() => {
    if (!this.showStartText()) {
      return undefined;
    }

    return this.startText() || `${this.barWidth()}% complete`;
  });

  get outerBarStyles() {
    return ["tw-overflow-hidden", "tw-rounded", "tw-bg-secondary-100", "tw-h-2", "tw-my-1"];
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
