import { NgClass } from "@angular/common";
import {
  input,
  HostBinding,
  Component,
  model,
  computed,
  booleanAttribute,
  inject,
  ElementRef,
} from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { debounce, interval } from "rxjs";

import { AriaDisableDirective } from "../a11y";
import { ButtonLikeAbstraction, ButtonType, ButtonSize } from "../shared/button-like.abstraction";
import { SpinnerComponent } from "../spinner";
import { ariaDisableElement } from "../utils";

const focusRing = [
  "focus-visible:tw-ring-2",
  "focus-visible:tw-ring-offset-1",
  "focus-visible:tw-ring-border-focus",
  "focus-visible:tw-z-10",
];

const getButtonSizeStyles = (size: ButtonSize): string[] => {
  const buttonSizeStyles: Record<ButtonSize, string[]> = {
    small: ["tw-py-1", "tw-px-3", "tw-text-xs"],
    default: ["tw-py-2.5", "tw-px-4", "tw-text-sm/5"],
    large: ["tw-py-3", "tw-px-4", "tw-text-base/6"],
  };

  return buttonSizeStyles[size];
};

const getButtonStyles = (buttonType: ButtonType, size: ButtonSize): string[] => {
  const normalizedType = buttonType.toLowerCase();

  const buttonStyles: Record<ButtonType, string[]> = {
    primary: [
      "tw-border-border-brand",
      "tw-bg-bg-brand",
      "hover:tw-bg-bg-brand-strong",
      "hover:tw-border-bg-brand-strong",
    ],
    primaryOutline: [
      "tw-border-border-brand",
      "tw-text-fg-brand",
      "hover:tw-border-bg-brand-strong",
      "hover:tw-text-fg-brand-strong",
    ],
    primaryGhost: ["tw-text-fg-heading", "hover:tw-text-fg-brand"],
    secondary: [
      "tw-bg-bg-secondary",
      "tw-border-border-base",
      "tw-text-fg-heading",
      "hover:tw-bg-bg-quaternary",
      "hover:tw-text-fg-brand",
    ],
    subtle: [
      "tw-border-border-contrast",
      "tw-bg-bg-contrast",
      "hover:tw-bg-bg-contrast-strong",
      "hover:tw-border-border-contrast-strong",
    ],
    subtleOutline: [
      "tw-border-border-contrast",
      "tw-text-fg-heading",
      "hover:tw-border-border-contrast-strong",
      "hover:tw-text-fg-heading",
    ],
    subtleGhost: ["tw-text-fg-heading", "hover:tw-text-fg-heading"],
    danger: [
      "tw-bg-bg-danger",
      "tw-border-border-danger",
      "hover:tw-bg-bg-danger-strong",
      "hover:tw-border-border-danger-strong",
      "hover:tw-text-fg-contrast",
    ],
    dangerOutline: [
      "tw-border-border-danger",
      "tw-text-fg-danger",
      "hover:tw-border-bg-danger-strong",
      "hover:!tw-text-fg-danger-strong",
    ],
    dangerGhost: ["tw-text-fg-danger", "hover:tw-text-fg-danger"],
    warning: [
      "tw-bg-bg-warning",
      "tw-border-border-warning",
      "hover:tw-bg-bg-warning-strong",
      "hover:tw-border-border-warning-strong",
    ],
    warningOutline: [
      "tw-border-border-warning",
      "tw-text-fg-warning",
      "hover:tw-border-border-warning-strong",
      "hover:!tw-text-fg-warning-strong",
    ],
    warningGhost: ["tw-text-fg-warning", "hover:tw-text-fg-warning"],
    success: [
      "tw-bg-bg-success",
      "tw-border-border-success",
      "hover:tw-bg-bg-success-strong",
      "hover:tw-border-border-success-strong",
    ],
    successOutline: [
      "tw-border-border-success",
      "tw-text-fg-success",
      "hover:tw-border-border-success-strong",
      "hover:tw-text-fg-success-strong",
    ],
    successGhost: ["tw-text-fg-success", "hover:tw-text-fg-success"],
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
  const isSolid = !isOutline && !isGhost;

  if (isOutline || isGhost) {
    baseStyles.push("tw-bg-transparent", "hover:tw-bg-bg-hover");
  }

  if (isSolid && !isSecondary) {
    baseStyles.push("tw-text-fg-contrast", "hover:tw-text-fg-contrast");
  }

  if (isGhost) {
    baseStyles.push("tw-border-transparent", "tw-bg-clip-padding", "hover:tw-border-bg-hover");
  }

  return [...baseStyles, ...buttonStyles[buttonType], ...getButtonSizeStyles(size)];
};

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "button[bitButton], a[bitButton]",
  templateUrl: "button.component.html",
  providers: [{ provide: ButtonLikeAbstraction, useExisting: ButtonComponent }],
  imports: [NgClass, SpinnerComponent],
  hostDirectives: [AriaDisableDirective],
})
export class ButtonComponent implements ButtonLikeAbstraction {
  @HostBinding("class") get classList() {
    return []
      .concat(this.block() ? ["tw-w-full", "tw-block"] : ["tw-inline-block"])
      .concat(
        this.showDisabledStyles() || this.disabled()
          ? [
              "aria-disabled:!tw-bg-secondary-300",
              "hover:tw-bg-secondary-300",
              "aria-disabled:tw-border-secondary-300",
              "hover:tw-border-secondary-300",
              "aria-disabled:!tw-text-muted",
              "hover:!tw-text-muted",
              "aria-disabled:tw-cursor-not-allowed",
              "hover:tw-no-underline",
            ]
          : [],
      )
      .concat(getButtonStyles(this.buttonType() || "secondary", this.size() || "default"));
  }

  protected readonly disabledAttr = computed(() => {
    const disabled = this.disabled() != null && this.disabled() !== false;
    return disabled || this.loading();
  });

  /**
   * Determine whether it is appropriate to display the disabled styles. We only want to show
   * the disabled styles if the button is truly disabled, or if the loading styles are also
   * visible.
   *
   * We can't use `disabledAttr` for this, because it returns `true` when `loading` is `true`.
   * We only want to show disabled styles during loading if `showLoadingStyles` is `true`.
   */
  protected readonly showDisabledStyles = computed(() => {
    return this.showLoadingStyle() || (this.disabledAttr() && this.loading() === false);
  });

  readonly buttonType = input<ButtonType>("secondary");

  readonly size = input<ButtonSize>("default");

  readonly block = input(false, { transform: booleanAttribute });

  readonly loading = model<boolean>(false);

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
  protected readonly showLoadingStyle = toSignal(
    toObservable(this.loading).pipe(debounce((isLoading) => interval(isLoading ? 75 : 0))),
  );

  readonly disabled = model<boolean>(false);
  private el = inject(ElementRef<HTMLButtonElement>);

  constructor() {
    ariaDisableElement(this.el.nativeElement, this.disabledAttr);
  }
}
