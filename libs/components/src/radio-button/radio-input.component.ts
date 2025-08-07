import { booleanAttribute, Component, HostBinding, input, Optional, Self } from "@angular/core";
import { NgControl, Validators } from "@angular/forms";

import { BitFormControlAbstraction } from "../form-control";

let nextId = 0;

@Component({
  selector: "input[type=radio][bitRadio]",
  template: "",
  providers: [{ provide: BitFormControlAbstraction, useExisting: RadioInputComponent }],
  host: {
    "[id]": "this.id()",
    "[attr.disabled]": "disabled",
  },
})
export class RadioInputComponent implements BitFormControlAbstraction {
  readonly id = input(`bit-radio-input-${nextId++}`);

  @HostBinding("class")
  protected inputClasses = [
    "tw-appearance-none",
    "tw-outline-none",
    "tw-relative",
    "tw-transition",
    "tw-cursor-pointer",
    "tw-inline-block",
    "tw-rounded-full",
    "tw-border",
    "tw-border-solid",
    "tw-border-secondary-600",
    "tw-w-[1.12rem]",
    "tw-h-[1.12rem]",
    "!tw-p-[.125rem]",
    "tw-flex-none", // Flexbox fix for bit-form-control

    "hover:tw-border-2",
    "[&>label:hover]:tw-border-2",

    // if it exists, the parent form control handles focus
    "[&:not(bit-form-control_*)]:focus-visible:tw-ring-2",
    "[&:not(bit-form-control_*)]:focus-visible:tw-ring-offset-2",
    "[&:not(bit-form-control_*)]:focus-visible:tw-ring-primary-600",

    "before:tw-content-['']",
    "before:tw-transition",
    "before:tw-block",
    "before:tw-rounded-full",
    "before:tw-size-full",

    "disabled:tw-cursor-auto",
    "disabled:tw-bg-secondary-100",
    "disabled:hover:tw-border",

    "checked:tw-bg-text-contrast",
    "checked:tw-border-primary-600",
    "checked:tw-border-2",

    "checked:hover:tw-border-2",
    "checked:hover:tw-border-primary-700",
    "checked:hover:before:tw-bg-primary-700",
    "[&>label:hover]:checked:tw-bg-primary-700",
    "[&>label:hover]:checked:tw-border-primary-700",

    "checked:before:tw-bg-primary-600",

    "checked:disabled:tw-border-secondary-600",
    "checked:disabled:hover:tw-border-secondary-600",
    "checked:disabled:hover:tw-border-2",
    "checked:disabled:tw-bg-background",

    "checked:disabled:hover:before:tw-bg-secondary-600",
    "checked:disabled:before:tw-bg-secondary-600",
  ];

  constructor(@Optional() @Self() private ngControl?: NgControl) {}

  readonly disabledInput = input(false, { transform: booleanAttribute, alias: "disabled" });

  get disabled() {
    return this.disabledInput() || this.ngControl?.disabled || null;
  }

  get required() {
    return this.ngControl?.control?.hasValidator(Validators.requiredTrue) ?? false;
  }

  get hasError() {
    return !!(this.ngControl?.status === "INVALID" && this.ngControl?.touched);
  }

  get error(): [string, any] {
    const errors = this.ngControl?.errors ?? {};
    const key = Object.keys(errors)[0];
    return [key, errors[key]];
  }
}
