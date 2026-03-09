import { booleanAttribute, Component, HostBinding, input, Optional, Self } from "@angular/core";
import { NgControl, Validators } from "@angular/forms";

import { BitFormControlAbstraction } from "../form-control";

let nextId = 0;

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "input[type=radio][bitRadio]",
  template: "",
  providers: [{ provide: BitFormControlAbstraction, useExisting: RadioInputComponent }],
  host: {
    "[id]": "this.id()",
    "[disabled]": "disabled",
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
    "tw-w-6",
    "tw-h-6",
    "tw-rounded-full",
    "tw-flex-none", // Flexbox fix for bit-form-control
    "hover:tw-bg-bg-hover",
    "[&>label:hover]:tw-bg-bg-hover",
    "disabled:hover:tw-bg-bg-inactive",
    "disabled:[&>label:hover]:tw-bg-bg-inactive",

    "hover:before:tw-border-2",
    "[&>label:hover]:before:tw-border-2",

    // if it exists, the parent form control handles focus
    "[&:not(bit-form-control_*, bit-form-control-card)]:focus-visible:before:tw-ring-2",
    "[&:not(bit-form-control_*, bit-form-control-card)]:focus-visible:before:tw-ring-offset-2",
    "[&:not(bit-form-control_*, bit-form-control-card)]:focus-visible:before:tw-ring-border-focus",

    "tw-transition-colors",
    "before:tw-content-['']",
    "before:tw-block",
    "before:tw-inset-1",
    "before:tw-absolute",
    "before:tw-size-4",
    "before:tw-rounded-full",
    "before:tw-border",
    "before:tw-border-solid",
    "before:tw-border-border-strong",
    "before:tw-box-border",
    "before:tw-bg-bg-tertiary",

    "after:tw-content-['']",
    "after:tw-block",
    "after:tw-absolute",
    "after:tw-inset-2",
    "after:tw-size-2",
    "after:tw-box-border",
    "after:tw-rounded-full",

    "disabled:tw-cursor-auto",
    "disabled:tw-pointer-events-none",
    "disabled:tw-bg-transparent",
    "disabled:before:tw-bg-bg-inactive",
    "disabled:before:tw-border-border-base",

    "checked:hover:tw-bg-transparent",

    "checked:after:tw-bg-bg-brand",

    "checked:before:tw-border-2",
    "checked:before:tw-border-border-brand",

    "checked:disabled:after:tw-bg-fg-inactive",
    "checked:disabled:hover:before:tw-border-border-base",
  ];

  constructor(@Optional() @Self() private ngControl?: NgControl) {}

  readonly disabledInput = input(false, { transform: booleanAttribute, alias: "disabled" });

  // TODO migrate to computed signal when Angular adds signal support to reactive forms
  // https://bitwarden.atlassian.net/browse/CL-819
  get disabled() {
    return this.disabledInput() || this.ngControl?.disabled || false;
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
