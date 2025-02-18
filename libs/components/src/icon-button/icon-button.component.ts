// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { NgClass } from "@angular/common";
import { Component, computed, ElementRef, HostBinding, Input, model } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { debounce, interval } from "rxjs";

import { ButtonLikeAbstraction, ButtonType } from "../shared/button-like.abstraction";
import { FocusableElement } from "../shared/focusable-element";

export type IconButtonType = ButtonType | "contrast" | "main" | "muted" | "light";

const focusRing = [
  // Workaround for box-shadow with transparent offset issue:
  // https://github.com/tailwindlabs/tailwindcss/issues/3595
  // Remove `before:` and use regular `tw-ring` when browser no longer has bug, or better:
  // switch to `outline` with `outline-offset` when Safari supports border radius on outline.
  // Using `box-shadow` to create outlines is a hack and as such `outline` should be preferred.
  "tw-relative",
  "before:tw-content-['']",
  "before:tw-block",
  "before:tw-absolute",
  "before:-tw-inset-[2px]",
  "before:tw-rounded-lg",
  "before:tw-transition",
  "before:tw-ring-2",
  "before:tw-ring-transparent",
  "focus-visible:tw-z-10",
];

const styles: Record<IconButtonType, string[]> = {
  contrast: [
    "tw-bg-transparent",
    "!tw-text-contrast",
    "tw-border-transparent",
    "hover:tw-bg-transparent-hover",
    "hover:tw-border-text-contrast",
    "focus-visible:before:tw-ring-text-contrast",
    ...focusRing,
  ],
  main: [
    "tw-bg-transparent",
    "!tw-text-main",
    "tw-border-transparent",
    "hover:tw-bg-transparent-hover",
    "hover:tw-border-primary-600",
    "focus-visible:before:tw-ring-primary-600",
    ...focusRing,
  ],
  muted: [
    "tw-bg-transparent",
    "!tw-text-muted",
    "tw-border-transparent",
    "aria-expanded:tw-bg-text-muted",
    "aria-expanded:!tw-text-contrast",
    "hover:tw-bg-transparent-hover",
    "hover:tw-border-primary-600",
    "focus-visible:before:tw-ring-primary-600",
    "aria-expanded:hover:tw-bg-secondary-700",
    "aria-expanded:hover:tw-border-secondary-700",
    ...focusRing,
  ],
  primary: [
    "tw-bg-primary-600",
    "!tw-text-contrast",
    "tw-border-primary-600",
    "hover:tw-bg-primary-600",
    "hover:tw-border-primary-600",
    "focus-visible:before:tw-ring-primary-600",
    ...focusRing,
  ],
  secondary: [
    "tw-bg-transparent",
    "!tw-text-muted",
    "tw-border-text-muted",
    "hover:!tw-text-contrast",
    "hover:tw-bg-text-muted",
    "focus-visible:before:tw-ring-primary-600",
    ...focusRing,
  ],
  danger: [
    "tw-bg-transparent",
    "!tw-text-danger-600",
    "tw-border-transparent",
    "hover:!tw-text-danger-600",
    "hover:tw-bg-transparent",
    "hover:tw-border-primary-600",
    "focus-visible:before:tw-ring-primary-600",
    ...focusRing,
  ],
  light: [
    "tw-bg-transparent",
    "!tw-text-alt2",
    "tw-border-transparent",
    "hover:tw-bg-transparent-hover",
    "hover:tw-border-text-alt2",
    "focus-visible:before:tw-ring-text-alt2",
    ...focusRing,
  ],
  unstyled: [],
};

const disabledStyles: Record<IconButtonType, string[]> = {
  contrast: [
    "disabled:tw-opacity-60",
    "disabled:hover:tw-border-transparent",
    "disabled:hover:tw-bg-transparent",
  ],
  main: [
    "disabled:!tw-text-secondary-300",
    "disabled:hover:tw-border-transparent",
    "disabled:hover:tw-bg-transparent",
  ],
  muted: [
    "disabled:!tw-text-secondary-300",
    "disabled:hover:tw-border-transparent",
    "disabled:hover:tw-bg-transparent",
  ],
  primary: [
    "disabled:tw-opacity-60",
    "disabled:hover:tw-border-primary-600",
    "disabled:hover:tw-bg-primary-600",
  ],
  secondary: [
    "disabled:tw-opacity-60",
    "disabled:hover:tw-border-text-muted",
    "disabled:hover:tw-bg-transparent",
    "disabled:hover:!tw-text-muted",
  ],
  danger: [
    "disabled:!tw-text-secondary-300",
    "disabled:hover:tw-border-transparent",
    "disabled:hover:tw-bg-transparent",
    "disabled:hover:!tw-text-secondary-300",
  ],
  light: [
    "disabled:tw-opacity-60",
    "disabled:hover:tw-border-transparent",
    "disabled:hover:tw-bg-transparent",
  ],
  unstyled: [],
};

export type IconButtonSize = "default" | "small";

const sizes: Record<IconButtonSize, string[]> = {
  default: ["tw-px-2.5", "tw-py-1.5"],
  small: ["tw-leading-none", "tw-text-base", "tw-p-1"],
};

@Component({
  selector: "button[bitIconButton]:not(button[bitButton])",
  templateUrl: "icon-button.component.html",
  providers: [
    { provide: ButtonLikeAbstraction, useExisting: BitIconButtonComponent },
    { provide: FocusableElement, useExisting: BitIconButtonComponent },
  ],
  standalone: true,
  imports: [NgClass],
  host: {
    "[attr.disabled]": "disabledAttr()",
  },
})
export class BitIconButtonComponent implements ButtonLikeAbstraction, FocusableElement {
  @Input("bitIconButton") icon: string;

  @Input() buttonType: IconButtonType = "main";

  @Input() size: IconButtonSize = "default";

  @HostBinding("class") get classList() {
    return [
      "tw-font-semibold",
      "tw-border",
      "tw-border-solid",
      "tw-rounded-lg",
      "tw-transition",
      "hover:tw-no-underline",
      "focus:tw-outline-none",
    ]
      .concat(styles[this.buttonType])
      .concat(sizes[this.size])
      .concat(this.showDisabledStyles() || this.disabled() ? disabledStyles[this.buttonType] : []);
  }

  get iconClass() {
    return [this.icon, "!tw-m-0"];
  }

  protected disabledAttr = computed(() => {
    const disabled = this.disabled() != null && this.disabled() !== false;
    return disabled || this.loading() ? true : null;
  });

  /**
   * Determine whether it is appropriate to display the disabled styles. We only want to show
   * the disabled styles if the button is truly disabled, or if the loading styles are also
   * visible.
   *
   * We can't use `disabledAttr` for this, because it returns `true` when `loading` is `true`.
   * We only want to show disabled styles during loading if `showLoadingStyles` is `true`.
   */
  protected showDisabledStyles = computed(() => {
    return this.showLoadingStyle() || (this.disabledAttr() && this.loading() === false);
  });

  loading = model(false);

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
  protected showLoadingStyle = toSignal(
    toObservable(this.loading).pipe(debounce((isLoading) => interval(isLoading ? 75 : 0))),
  );

  disabled = model<boolean>(false);

  getFocusTarget() {
    return this.elementRef.nativeElement;
  }

  constructor(private elementRef: ElementRef) {}
}
