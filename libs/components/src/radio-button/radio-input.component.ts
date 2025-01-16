// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, HostBinding, Input, Optional, Self } from "@angular/core";
import { NgControl, Validators } from "@angular/forms";

import { BitFormControlAbstraction } from "../form-control";

let nextId = 0;

@Component({
  selector: "input[type=radio][bitRadio]",
  template: "",
  providers: [{ provide: BitFormControlAbstraction, useExisting: RadioInputComponent }],
  standalone: true,
})
export class RadioInputComponent implements BitFormControlAbstraction {
  @HostBinding("attr.id") @Input() id = `bit-radio-input-${nextId++}`;

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
    "tw-mr-1.5",
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
    "before:tw-absolute",
    "before:tw-rounded-full",
    "before:tw-inset-[2px]",

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

  @HostBinding()
  @Input()
  get disabled() {
    return this._disabled ?? this.ngControl?.disabled ?? false;
  }
  set disabled(value: any) {
    this._disabled = value != null && value !== false;
  }
  private _disabled: boolean;

  @Input()
  get required() {
    return (
      this._required ?? this.ngControl?.control?.hasValidator(Validators.requiredTrue) ?? false
    );
  }
  set required(value: any) {
    this._required = value != null && value !== false;
  }
  private _required: boolean;

  get hasError() {
    return this.ngControl?.status === "INVALID" && this.ngControl?.touched;
  }

  get error(): [string, any] {
    const key = Object.keys(this.ngControl.errors)[0];
    return [key, this.ngControl.errors[key]];
  }
}
