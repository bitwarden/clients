import { Component, ElementRef, HostBinding, Input } from "@angular/core";

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
  "before:-tw-inset-[3px]",
  "before:tw-rounded-md",
  "before:tw-transition",
  "before:tw-ring",
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
    "disabled:tw-opacity-60",
    "disabled:hover:tw-border-transparent",
    "disabled:hover:tw-bg-transparent",
    ...focusRing,
  ],
  main: [
    "tw-bg-transparent",
    "!tw-text-main",
    "tw-border-transparent",
    "hover:tw-bg-transparent-hover",
    "hover:tw-border-text-main",
    "focus-visible:before:tw-ring-text-main",
    "disabled:tw-opacity-60",
    "disabled:hover:tw-border-transparent",
    "disabled:hover:tw-bg-transparent",
    ...focusRing,
  ],
  muted: [
    "tw-bg-transparent",
    "!tw-text-muted",
    "tw-border-transparent",
    "hover:tw-bg-transparent-hover",
    "hover:tw-border-primary-700",
    "focus-visible:before:tw-ring-primary-700",
    "disabled:tw-opacity-60",
    "disabled:hover:tw-border-transparent",
    "disabled:hover:tw-bg-transparent",
    ...focusRing,
  ],
  primary: [
    "tw-bg-primary-600",
    "!tw-text-contrast",
    "tw-border-primary-600",
    "hover:tw-bg-primary-700",
    "hover:tw-border-primary-700",
    "focus-visible:before:tw-ring-primary-700",
    "disabled:tw-opacity-60",
    "disabled:hover:tw-border-primary-600",
    "disabled:hover:tw-bg-primary-600",
    ...focusRing,
  ],
  secondary: [
    "tw-bg-transparent",
    "!tw-text-muted",
    "tw-border-text-muted",
    "hover:!tw-text-contrast",
    "hover:tw-bg-text-muted",
    "focus-visible:before:tw-ring-primary-700",
    "disabled:tw-opacity-60",
    "disabled:hover:tw-border-text-muted",
    "disabled:hover:tw-bg-transparent",
    "disabled:hover:!tw-text-muted",
    "disabled:hover:tw-border-text-muted",
    ...focusRing,
  ],
  danger: [
    "tw-bg-transparent",
    "!tw-text-danger",
    "tw-border-danger-600",
    "hover:!tw-text-contrast",
    "hover:tw-bg-danger-600",
    "focus-visible:before:tw-ring-primary-700",
    "disabled:tw-opacity-60",
    "disabled:hover:tw-border-danger-600",
    "disabled:hover:tw-bg-transparent",
    "disabled:hover:!tw-text-danger",
    "disabled:hover:tw-border-danger-600",
    ...focusRing,
  ],
  light: [
    "tw-bg-transparent",
    "!tw-text-alt2",
    "tw-border-transparent",
    "hover:tw-bg-transparent-hover",
    "hover:tw-border-text-alt2",
    "focus-visible:before:tw-ring-text-alt2",
    "disabled:hover:tw-border-transparent",
    "disabled:hover:tw-bg-transparent",
    ...focusRing,
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
})
export class BitIconButtonComponent implements ButtonLikeAbstraction, FocusableElement {
  @Input("bitIconButton") icon: string;

  @Input() buttonType: IconButtonType;

  @Input() size: IconButtonSize = "default";

  @HostBinding("class") get classList() {
    return [
      "tw-font-semibold",
      "tw-border",
      "tw-border-solid",
      "tw-rounded",
      "tw-transition",
      "hover:tw-no-underline",
      "focus:tw-outline-none",
    ]
      .concat(styles[this.buttonType ?? "main"])
      .concat(sizes[this.size]);
  }

  get iconClass() {
    return [this.icon, "!tw-m-0"];
  }

  @HostBinding("attr.disabled")
  get disabledAttr() {
    const disabled = this.disabled != null && this.disabled !== false;
    return disabled || this.loading ? true : null;
  }

  @Input() loading = false;
  @Input() disabled = false;

  getFocusTarget() {
    return this.elementRef.nativeElement;
  }

  constructor(private elementRef: ElementRef) {}
}
