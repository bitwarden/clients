// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, HostBinding, Input, Optional, Self } from "@angular/core";
import { NgControl, Validators } from "@angular/forms";

import { BitFormControlAbstraction } from "../form-control";

@Component({
  selector: "input[type=checkbox][bitCheckbox]",
  template: "",
  providers: [{ provide: BitFormControlAbstraction, useExisting: CheckboxComponent }],
  standalone: true,
})
export class CheckboxComponent implements BitFormControlAbstraction {
  @HostBinding("class")
  protected inputClasses = [
    "tw-appearance-none",
    "tw-outline-none",
    "tw-relative",
    "tw-transition",
    "tw-cursor-pointer",
    "tw-inline-block",
    "tw-align-sub",
    "tw-rounded",
    "tw-border",
    "tw-border-solid",
    "tw-border-secondary-500",
    "tw-h-[1.12rem]",
    "tw-w-[1.12rem]",
    "tw-mr-1.5",
    "tw-flex-none", // Flexbox fix for bit-form-control

    "before:tw-content-['']",
    "before:tw-block",
    "before:tw-absolute",
    "before:tw-inset-0",

    "hover:tw-border-2",
    "[&>label]:tw-border-2",

    // if it exists, the parent form control handles focus
    "[&:not(bit-form-control_*)]:focus-visible:tw-ring-2",
    "[&:not(bit-form-control_*)]:focus-visible:tw-ring-offset-2",
    "[&:not(bit-form-control_*)]:focus-visible:tw-ring-primary-600",

    "disabled:tw-cursor-auto",
    "disabled:tw-border",
    "disabled:hover:tw-border",
    "disabled:tw-bg-secondary-100",
    "disabled:hover:tw-bg-secondary-100",

    "checked:tw-bg-primary-600",
    "checked:tw-border-primary-600",
    "checked:hover:tw-bg-primary-700",
    "checked:hover:tw-border-primary-700",
    "[&>label:hover]:checked:tw-bg-primary-700",
    "[&>label:hover]:checked:tw-border-primary-700",
    "checked:before:tw-bg-text-contrast",
    "checked:before:tw-mask-position-[center]",
    "checked:before:tw-mask-repeat-[no-repeat]",
    "checked:disabled:tw-border-secondary-100",
    "checked:disabled:hover:tw-border-secondary-100",
    "checked:disabled:tw-bg-secondary-100",
    "checked:disabled:before:tw-bg-text-muted",

    "[&:not(:indeterminate)]:checked:before:tw-mask-image-[var(--mask-image)]",
    "indeterminate:before:tw-mask-image-[var(--indeterminate-mask-image)]",

    "indeterminate:tw-bg-primary-600",
    "indeterminate:tw-border-primary-600",
    "indeterminate:hover:tw-bg-primary-700",
    "indeterminate:hover:tw-border-primary-700",
    "[&>label:hover]:indeterminate:tw-bg-primary-700",
    "[&>label:hover]:indeterminate:tw-border-primary-700",
    "indeterminate:before:tw-bg-text-contrast",
    "indeterminate:before:tw-mask-position-[center]",
    "indeterminate:before:tw-mask-repeat-[no-repeat]",
    "indeterminate:before:tw-mask-image-[var(--indeterminate-mask-image)]",
    "indeterminate:disabled:tw-border-secondary-100",
    "indeterminate:disabled:tw-bg-secondary-100",
    "indeterminate:disabled:before:tw-bg-text-muted",
  ];

  constructor(@Optional() @Self() private ngControl?: NgControl) {}

  @HostBinding("style.--mask-image")
  protected maskImage =
    `url('data:image/svg+xml,%3Csvg class="svg" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="10" height="10" viewBox="0 0 10 10"%3E%3Cpath d="M0.5 6.2L2.9 8.6L9.5 1.4" fill="none" stroke="white" stroke-width="2"%3E%3C/path%3E%3C/svg%3E')`;

  @HostBinding("style.--indeterminate-mask-image")
  protected indeterminateImage =
    `url('data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 13 13"%3E%3Cpath stroke="%23fff" stroke-width="2" d="M2.5 6.5h8"/%3E%3C/svg%3E%0A')`;

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
