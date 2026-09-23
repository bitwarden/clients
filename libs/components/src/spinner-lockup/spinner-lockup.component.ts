import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

import { SpinnerSize, SpinnerVariant, SpinnerComponent } from "../spinner/spinner.component";

type SpinnerLockupOrientation = "horizontal" | "vertical";

const spinnerLockupTextStyles: Record<SpinnerSize, { fontSize: string; lineHeight: string }> = {
  sm: { fontSize: "tw-text-xs", lineHeight: "tw-leading-4" },
  md: { fontSize: "tw-text-sm", lineHeight: "tw-leading-5" },
  base: { fontSize: "tw-text-base", lineHeight: "tw-leading-6" },
  lg: { fontSize: "tw-text-xl", lineHeight: "tw-leading-7" },
};

const spinnerLockupOrientationStyles: Record<
  SpinnerLockupOrientation,
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

/**
 * Combines a spinner with a title and body text lockup.
 * Title and body content are projected via named slots: `[slot=title]` and `[slot=description]`.
 * Supports horizontal and vertical orientations, all spinner size variants, and all color variants.
 */
@Component({
  selector: "bit-spinner-lockup",
  templateUrl: "spinner-lockup.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SpinnerComponent],
})
export class SpinnerLockupComponent {
  /** Size of the spinner and corresponding text scale. Defaults to `"base"`. */
  readonly size = input<SpinnerSize>("base");

  /** Color variant of the spinner. Defaults to `"primary"`. */
  readonly variant = input<SpinnerVariant>("primary");

  /** Orientation of the spinner relative to the text. Defaults to `"horizontal"`. */
  readonly orientation = input<SpinnerLockupOrientation>("horizontal");

  protected readonly textClasses = computed(() => {
    const sizeStyles = spinnerLockupTextStyles[this.size()];
    return {
      title: [sizeStyles.fontSize, sizeStyles.lineHeight, "tw-font-medium", "tw-text-fg-heading"],
      body: [sizeStyles.fontSize, sizeStyles.lineHeight, "tw-font-normal", "tw-text-fg-body"],
    };
  });

  protected readonly orientationClasses = computed(() => {
    const orientationStyles = spinnerLockupOrientationStyles[this.orientation()];
    return {
      container: [...orientationStyles.container, "tw-flex", "tw-items-center"],
      textContainer: [...orientationStyles.textContainer, "tw-flex", "tw-flex-col"],
    };
  });
}
