import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

import {
  SpinnerSize,
  spinnerSizeStyles,
  SpinnerVariant,
  SpinnerComponent,
} from "../spinner/spinner.component";

type SpinnerLockupLayout = "horizontal" | "vertical";

const spinnerLockupTextStyles: Record<SpinnerSize, { fontSize: string; lineHeight: string }> = {
  sm: { fontSize: "tw-text-xs", lineHeight: "tw-leading-4" },
  md: { fontSize: "tw-text-sm", lineHeight: "tw-leading-5" },
  base: { fontSize: "tw-text-base", lineHeight: "tw-leading-6" },
  lg: { fontSize: "tw-text-xl", lineHeight: "tw-leading-7" },
};

const spinnerLockupLayoutStyles: Record<
  SpinnerLockupLayout,
  {
    container: string[];
    textContainer: string[];
  }
> = {
  horizontal: {
    container: ["tw-flex-row", "tw-gap-3"],
    textContainer: [],
  },
  vertical: {
    container: ["tw-flex-col", "tw-gap-2"],
    textContainer: ["tw-items-center"],
  },
};

@Component({
  selector: "bit-spinner-lockup",
  templateUrl: "spinner-lockup.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SpinnerComponent],
})
export class SpinnerLockupComponent {
  readonly size = input<SpinnerSize>("base");
  readonly variant = input<SpinnerVariant>("primary");
  readonly layout = input<SpinnerLockupLayout>("horizontal");

  readonly sizeClasses = computed(() => spinnerSizeStyles[this.size()]);

  readonly textClasses = computed(() => {
    const sizeStyles = spinnerLockupTextStyles[this.size()];
    return {
      title: [sizeStyles.fontSize, sizeStyles.lineHeight, "tw-font-medium", "tw-text-fg-heading"],
      body: [sizeStyles.fontSize, sizeStyles.lineHeight, "tw-font-normal", "tw-text-fg-body"],
    };
  });

  readonly layoutClasses = computed(() => {
    const layoutStyles = spinnerLockupLayoutStyles[this.layout()];
    return {
      container: [...layoutStyles.container, "tw-flex", "tw-items-center"],
      textContainer: [...layoutStyles.textContainer, "tw-flex", "tw-flex-col"],
    };
  });
}
