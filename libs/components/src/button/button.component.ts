// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { NgClass } from "@angular/common";
import { Input, HostBinding, Component } from "@angular/core";

import { ButtonLikeAbstraction, ButtonType } from "../shared/button-like.abstraction";

const focusRing = [
  "focus-visible:tw-ring-2",
  "focus-visible:tw-ring-offset-2",
  "focus-visible:tw-ring-primary-600",
  "focus-visible:tw-z-10",
];

const buttonStyles: Record<ButtonType, string[]> = {
  primary: [
    "tw-border-primary-600",
    "tw-bg-primary-600",
    "!tw-text-contrast",
    "hover:tw-bg-primary-700",
    "hover:tw-border-primary-700",
    ...focusRing,
  ],
  secondary: [
    "tw-bg-transparent",
    "tw-border-primary-600",
    "!tw-text-primary-600",
    "hover:tw-bg-primary-600",
    "hover:tw-border-primary-600",
    "hover:!tw-text-contrast",
    ...focusRing,
  ],
  danger: [
    "tw-bg-transparent",
    "tw-border-danger-600",
    "!tw-text-danger",
    "hover:tw-bg-danger-600",
    "hover:tw-border-danger-600",
    "hover:!tw-text-contrast",
    ...focusRing,
  ],
  unstyled: [],
};

@Component({
  selector: "button[bitButton], a[bitButton]",
  templateUrl: "button.component.html",
  providers: [{ provide: ButtonLikeAbstraction, useExisting: ButtonComponent }],
  standalone: true,
  imports: [NgClass],
})
export class ButtonComponent implements ButtonLikeAbstraction {
  @HostBinding("class") get classList() {
    return [
      "tw-font-semibold",
      "tw-py-1.5",
      "tw-px-3",
      "tw-rounded-full",
      "tw-transition",
      "tw-border-2",
      "tw-border-solid",
      "tw-text-center",
      "tw-no-underline",
      "hover:tw-no-underline",
      "focus:tw-outline-none",
      "disabled:tw-bg-secondary-300",
      "disabled:hover:tw-bg-secondary-300",
      "disabled:tw-border-secondary-300",
      "disabled:hover:tw-border-secondary-300",
      "disabled:!tw-text-muted",
      "disabled:hover:!tw-text-muted",
      "disabled:tw-cursor-not-allowed",
      "disabled:hover:tw-no-underline",
    ]
      .concat(this.block ? ["tw-w-full", "tw-block"] : ["tw-inline-block"])
      .concat(buttonStyles[this.buttonType ?? "secondary"]);
  }

  @HostBinding("attr.disabled")
  get disabledAttr() {
    const disabled = this.disabled != null && this.disabled !== false;
    return disabled || this.loading ? true : null;
  }

  @Input() buttonType: ButtonType;

  private _block = false;

  @Input()
  get block(): boolean {
    return this._block;
  }

  set block(value: boolean | "") {
    this._block = coerceBooleanProperty(value);
  }

  @Input() loading = false;

  @Input() disabled = false;
}
