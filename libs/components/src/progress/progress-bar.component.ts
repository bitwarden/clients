import { CommonModule } from "@angular/common";
import { Component, input, ChangeDetectionStrategy, computed, inject } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { FormFieldModule } from "../form-field";
import { TypographyModule } from "../typography";

export type ProgressBarVariant = "primary" | "subtle" | "success" | "warning" | "danger";

const VariantClasses: Record<ProgressBarVariant, string[]> = {
  primary: ["tw-bg-primary-600"],
  subtle: ["tw-bg-bg-contrast"],
  success: ["tw-bg-success-600"],
  warning: ["tw-bg-warning-600"],
  danger: ["tw-bg-danger-600"],
};

// Increments for each instance of this component
let nextId = 0;

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
  imports: [CommonModule, TypographyModule, FormFieldModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgressBarComponent {
  private readonly id = nextId++;

  /** Hides the default start hint text. Defaults to false. */
  readonly hideStartHint = input<boolean>(false);
  /** Determines the color of the progress bar */
  readonly variant = input<ProgressBarVariant>("primary");
  /** The progress amount, represented as a percentage of the progress bar that is filled */
  readonly value = input<number>(0);
  /** The ARIA value text for the progress bar. Overrides default accessible text. */
  readonly ariaValueText = input<string>();
  /** The ID of the progress bar element, used for attaching `aria-describedby` attributes. */
  readonly progressBarId = input<string>(`bit-progress-bar-${this.id}`);

  private readonly i18nService = inject(I18nService);

  // Necessary for `aria-labelledby` to point to the label element
  protected readonly labelId = `bit-progress-bar-label-${this.id}`;

  protected readonly defaultStartText = computed(() => {
    if (this.value() === 0) {
      return undefined;
    }

    return this.i18nService.t("percentageCompleted", this.value().toString());
  });

  protected readonly outerBarStyles = [
    "tw-overflow-hidden",
    "tw-rounded",
    "tw-bg-secondary-100",
    "tw-h-2",
    "tw-my-1",
  ];

  protected readonly innerBarStyles = computed(() => {
    return ["tw-transition-all", "tw-h-2", "tw-rounded"].concat(VariantClasses[this.variant()]);
  });
}
