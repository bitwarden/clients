import { booleanAttribute, computed, Directive, input, model } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { debounce, interval } from "rxjs";

import { ButtonSize, ButtonType } from "./button-like.abstraction";

export const focusRing = [
  "focus-visible:tw-ring-2",
  "focus-visible:tw-ring-offset-1",
  "focus-visible:tw-ring-border-focus",
  "focus-visible:tw-z-10",
];

export const getButtonSizeStyles = (size: ButtonSize): string[] => {
  const buttonSizeStyles: Record<ButtonSize, string[]> = {
    small: ["tw-py-1", "tw-px-3", "tw-text-xs"],
    default: ["tw-py-2.5", "tw-px-4", "tw-text-sm/5"],
    large: ["tw-py-3", "tw-px-4", "tw-text-base/6"],
  };

  return buttonSizeStyles[size] || buttonSizeStyles.default;
};

export const getButtonColorStyles = (buttonType: ButtonType): string[] => {
  const normalizedType = (buttonType || "secondary").toLowerCase();

  const buttonStyles: Record<ButtonType, string[]> = {
    primary: [
      "tw-border-border-brand",
      "tw-bg-bg-brand",
      "hover:tw-bg-bg-brand-strong",
      "hover:tw-border-bg-brand-strong",
      "focus:tw-bg-bg-brand-strong",
      "focus:tw-border-bg-brand-strong",
      "focus-visible:tw-bg-bg-brand-strong",
      "focus-visible:tw-border-bg-brand-strong",
    ],
    primaryOutline: [
      "tw-border-border-brand",
      "tw-text-fg-brand",
      "hover:tw-border-bg-brand-strong",
      "hover:tw-text-fg-brand-strong",
      "focus:tw-border-bg-brand-strong",
      "focus:tw-text-fg-brand-strong",
      "focus-visible:tw-border-bg-brand-strong",
      "focus-visible:tw-text-fg-brand-strong",
    ],
    primaryGhost: [
      "tw-text-fg-heading",
      "hover:tw-text-fg-brand",
      "focus:tw-text-fg-brand",
      "focus-visible:tw-text-fg-brand",
    ],
    secondary: [
      "tw-bg-bg-secondary",
      "tw-border-border-base",
      "tw-text-fg-heading",
      "hover:tw-bg-bg-quaternary",
      "hover:tw-text-fg-brand-strong",
      "focus:tw-bg-bg-quaternary",
      "focus:tw-text-fg-brand-strong",
      "focus-visible:tw-text-fg-brand-strong",
      "focus-visible:tw-bg-bg-quaternary",
    ],
    subtle: [
      "tw-border-border-contrast",
      "tw-bg-bg-contrast",
      "hover:tw-bg-bg-contrast-strong",
      "hover:tw-border-border-contrast-strong",
      "focus:tw-bg-bg-contrast-strong",
      "focus:tw-border-border-contrast-strong",
      "focus-visible:tw-border-border-contrast-strong",
      "focus-visible:tw-bg-bg-contrast-strong",
    ],
    subtleOutline: [
      "tw-border-border-contrast",
      "tw-text-fg-heading",
      "hover:tw-border-border-contrast-strong",
      "hover:tw-text-fg-heading",
      "focus:tw-border-border-contrast-strong",
      "focus:tw-text-fg-heading",
      "focus-visible:tw-border-border-contrast-strong",
      "focus-visible:tw-text-fg-heading",
    ],
    subtleGhost: [
      "tw-text-fg-heading",
      "hover:tw-text-fg-heading",
      "focus:tw-text-fg-heading",
      "focus-visible:tw-text-fg-heading",
    ],
    danger: [
      "tw-bg-bg-danger",
      "tw-border-border-danger",
      "hover:tw-bg-bg-danger-strong",
      "hover:tw-border-border-danger-strong",
      "hover:tw-text-fg-contrast",
      "focus:tw-border-border-danger-strong",
      "focus:tw-bg-bg-danger-strong",
      "focus:tw-text-fg-contrast",
      "focus-visible:tw-border-border-danger-strong",
      "focus-visible:tw-text-fg-contrast",
      "focus-visible:tw-bg-bg-danger-strong",
    ],
    dangerOutline: [
      "tw-border-border-danger",
      "tw-text-fg-danger",
      "hover:tw-border-bg-danger-strong",
      "hover:!tw-text-fg-danger-strong",
      "focus:tw-border-bg-danger-strong",
      "focus:!tw-text-fg-danger-strong",
      "focus-visible:tw-border-bg-danger-strong",
      "focus-visible:!tw-text-fg-danger-strong",
    ],
    dangerGhost: [
      "tw-text-fg-danger",
      "hover:tw-text-fg-danger",
      "focus:tw-text-fg-danger",
      "focus-visible:tw-text-fg-danger",
    ],
    warning: [
      "tw-bg-bg-warning",
      "tw-border-border-warning",
      "hover:tw-bg-bg-warning-strong",
      "hover:tw-border-border-warning-strong",
      "focus:tw-bg-bg-warning-strong",
      "focus:tw-border-border-warning-strong",
      "focus-visible:tw-bg-bg-warning-strong",
      "focus-visible:tw-border-border-warning-strong",
    ],
    warningOutline: [
      "tw-border-border-warning",
      "tw-text-fg-warning",
      "hover:tw-border-border-warning-strong",
      "hover:!tw-text-fg-warning-strong",
      "focus:tw-border-border-warning-strong",
      "focus:!tw-text-fg-warning-strong",
      "focus-visible:tw-border-border-warning-strong",
      "focus-visible:!tw-text-fg-warning-strong",
    ],
    warningGhost: [
      "tw-text-fg-warning",
      "hover:tw-text-fg-warning-strong",
      "focus:tw-text-fg-warning-strong",
      "focus-visible:tw-text-fg-warning-strong",
    ],
    success: [
      "tw-bg-bg-success",
      "tw-border-border-success",
      "hover:tw-bg-bg-success-strong",
      "hover:tw-border-border-success-strong",
      "focus:tw-bg-bg-success-strong",
      "focus:tw-border-border-success-strong",
      "focus-visible:tw-bg-bg-success-strong",
      "focus-visible:tw-border-border-success-strong",
    ],
    successOutline: [
      "tw-border-border-success",
      "tw-text-fg-success",
      "hover:tw-border-border-success-strong",
      "hover:tw-text-fg-success-strong",
      "focus:tw-border-border-success-strong",
      "focus:tw-text-fg-success-strong",
      "focus-visible:tw-border-border-success-strong",
      "focus-visible:tw-text-fg-success-strong",
    ],
    successGhost: [
      "tw-text-fg-success",
      "hover:tw-text-fg-success-strong",
      "focus:tw-text-fg-success-strong",
      "focus-visible:tw-text-fg-success-strong",
    ],
    unstyled: [],
  };

  const baseStyles = [
    "tw-font-medium",
    "tw-tracking-wide",
    "tw-rounded-xl",
    "tw-transition",
    "tw-border",
    "tw-border-solid",
    "tw-text-center",
    "tw-no-underline",
    "hover:tw-no-underline",
    "focus:tw-outline-none",
    ...focusRing,
  ];

  const isOutline = normalizedType.includes("outline");
  const isGhost = normalizedType.includes("ghost");
  const isSecondary = normalizedType === "secondary";
  const isUnstyled = normalizedType === "unstyled";
  const isSolid = !isOutline && !isGhost && !isUnstyled;

  if (isOutline || isGhost) {
    baseStyles.push(
      "tw-bg-transparent",
      "hover:tw-bg-bg-hover",
      "focus:tw-bg-bg-hover",
      "focus-visible:tw-bg-bg-hover",
    );
  }

  if (isSolid && !isSecondary) {
    baseStyles.push("tw-text-fg-contrast", "hover:tw-text-fg-contrast");
  }

  if (isGhost) {
    baseStyles.push(
      "tw-border-transparent",
      "tw-bg-clip-padding",
      "hover:tw-border-bg-hover",
      "focus:tw-border-bg-hover",
      "focus-visible:tw-border-bg-hover",
    );
  }

  if (isUnstyled) {
    baseStyles.push("tw-text-current");
  }

  return [...baseStyles, ...(buttonStyles[buttonType] || buttonStyles.secondary)];
};

/**
 * Base directive that provides shared color/type styling and state management for button-like components.
 * This directive handles:
 * - Loading and disabled state logic with debounced spinner visibility
 * - Color and type styling (primary, danger, etc.) that is shared across all button variants
 *
 * Layout-specific styles (padding, sizing, borders) are handled by individual components.
 *
 * Designed to be used as a host directive on button and icon-button components.
 */
@Directive({
  standalone: true,
  host: {
    "[class]": "colorClassList()",
  },
})
export class BaseButtonDirective {
  readonly buttonType = input<ButtonType>("secondary");

  readonly size = input<string>("default");

  readonly block = input(false, { transform: booleanAttribute });

  readonly loading = model<boolean>(false);

  readonly disabled = model<boolean>(false);

  readonly disabledAttr = computed(() => {
    const disabled = this.disabled() != null && this.disabled() !== false;
    return disabled || this.loading();
  });

  /**
   * Determine whether it is appropriate to display a loading spinner. We only want to show
   * a spinner if it's been more than 75 ms since the `loading` state began. This prevents
   * a spinner "flash" for actions that are synchronous/nearly synchronous.
   *
   * We can't use `loading` for this, because we still need to disable the button during
   * the full `loading` state. I.e. we only want the spinner to be debounced, not the
   * loading state.
   *
   * This pattern of converting a signal to an observable and back to a signal is not
   * recommended. TODO -- find better way to use debounce with signals (CL-596)
   */
  readonly showLoadingStyle = toSignal(
    toObservable(this.loading).pipe(debounce((isLoading) => interval(isLoading ? 75 : 0))),
  );

  /**
   * Computed signal that applies shared color/type styles to the host element.
   * These styles are automatically applied via the host binding and merged with
   * component-specific layout styles.
   */
  protected readonly colorClassList = computed(() => {
    const classes = getButtonColorStyles(this.buttonType() || "secondary");

    // Add disabled styles when button is disabled or loading
    if (this.showLoadingStyle() || this.disabled()) {
      classes.push(
        "aria-disabled:!tw-bg-bg-disabled",
        "hover:tw-bg-bg-hover",
        "aria-disabled:tw-border-border-base",
        "aria-disabled:hover:tw-border-border-base",
        "hover:tw-border-border-disabled",
        "aria-disabled:!tw-text-fg-disabled",
        "hover:!tw-text-fg-disabled",
        "aria-disabled:tw-cursor-not-allowed",
        "hover:tw-no-underline",
      );
    }

    return classes.join(" ");
  });
}
