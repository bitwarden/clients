import { Component, HostBinding, Input, Optional, Self } from "@angular/core";
import { NgControl, Validators } from "@angular/forms";

import { BitFormControlAbstraction } from "../form-control";

@Component({
  selector: "input[type=checkbox][bitCheckbox]",
  template: "",
  providers: [{ provide: BitFormControlAbstraction, useExisting: CheckboxComponent }],
})
export class CheckboxComponent implements BitFormControlAbstraction {
  @HostBinding("class")
  protected inputClasses = [
    "tw-appearance-none",
    "tw-outline-none",
    "tw-box-border",
    "tw-relative",
    "tw-transition",
    "tw-cursor-pointer",
    "tw-inline-block",
    "tw-align-sub",
    "tw-flex-none", // Flexbox fix for bit-form-control
    "!tw-p-1",
    // Give checkbox explicit height and width to fix iOS rendering bug
    "tw-h-[calc(1.12rem_+_theme(spacing.2))]",
    "tw-w-[calc(1.12rem_+_theme(spacing.2))]",
    "after:tw-inset-1",
    // negative margin to negate the positioning added by the padding
    "!-tw-mt-1",
    "!-tw-mb-1",
    "!-tw-ms-1",

    "before:tw-content-['']",
    "before:tw-block",
    "before:tw-inset-0",
    "before:tw-h-[1.12rem]",
    "before:tw-w-[1.12rem]",
    "before:tw-rounded",
    "before:tw-border",
    "before:tw-border-solid",
    "before:tw-border-secondary-500",
    "before:tw-box-border",

    "after:tw-content-['']",
    "after:tw-block",
    "after:tw-absolute",
    "after:tw-inset-0",
    "after:tw-h-[1.12rem]",
    "after:tw-w-[1.12rem]",
    "after:tw-box-border",

    "hover:before:tw-border-2",
    "[&>label]:before:tw-border-2",

    // if it exists, the parent form control handles focus
    "[&:not(bit-form-control_*)]:focus-visible:before:tw-ring-2",
    "[&:not(bit-form-control_*)]:focus-visible:before:tw-ring-offset-2",
    "[&:not(bit-form-control_*)]:focus-visible:before:tw-ring-primary-600",

    "disabled:before:tw-cursor-auto",
    "disabled:before:tw-border",
    "disabled:before:hover:tw-border",
    "disabled:before:tw-bg-secondary-100",
    "disabled:hover:before:tw-bg-secondary-100",

    "checked:before:tw-bg-primary-600",
    "checked:before:tw-border-primary-600",
    "checked:before:hover:tw-bg-primary-700",
    "checked:before:hover:tw-border-primary-700",
    "[&>label:hover]:checked:before:tw-bg-primary-700",
    "[&>label:hover]:checked:before:tw-border-primary-700",
    "checked:after:tw-bg-text-contrast",
    "checked:after:tw-mask-position-[center]",
    "checked:after:tw-mask-repeat-[no-repeat]",
    "checked:disabled:before:tw-border-secondary-100",
    "checked:disabled:hover:before:tw-border-secondary-100",
    "checked:disabled:before:tw-bg-secondary-100",
    "checked:disabled:after:tw-bg-text-muted",

    "[&:not(:indeterminate)]:checked:after:tw-mask-image-[var(--mask-image)]",
    "indeterminate:after:tw-mask-image-[var(--indeterminate-mask-image)]",

    "indeterminate:before:tw-bg-primary-600",
    "indeterminate:before:tw-border-primary-600",
    "indeterminate:hover:before:tw-bg-primary-700",
    "indeterminate:hover:before:tw-border-primary-700",
    "[&>label:hover]:indeterminate:before:tw-bg-primary-700",
    "[&>label:hover]:indeterminate:before:tw-border-primary-700",
    "indeterminate:after:tw-bg-text-contrast",
    "indeterminate:after:tw-mask-position-[center]",
    "indeterminate:after:tw-mask-repeat-[no-repeat]",
    "indeterminate:after:tw-mask-image-[var(--indeterminate-mask-image)]",
    "indeterminate:disabled:tw-border-secondary-100",
    "indeterminate:disabled:tw-bg-secondary-100",
    "indeterminate:disabled:after:tw-bg-text-muted",
  ];

  constructor(@Optional() @Self() private ngControl?: NgControl) {}

  @HostBinding("style.--mask-image")
  protected maskImage =
    `url('data:image/svg+xml,%3Csvg class="svg" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="10" height="10" viewBox="0 0 10 10"%3E%3Cpath d="M0.5 6.2L2.9 8.6L9.5 1.4" fill="none" stroke="white" stroke-width="2"%3E%3C/path%3E%3C/svg%3E')`;

  @HostBinding("style.--indeterminate-mask-image")
  protected indeterminateImage =
    `url('data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 13 13"%3E%3Cpath stroke="%23fff" stroke-width="2" d="M2.5 6.5h8"/%3E%3C/svg%3E%0A')`;

  // TODO: Skipped for signal migration because:
  //  Accessor inputs cannot be migrated as they are too complex.
  @HostBinding()
  @Input()
  get disabled() {
    return this._disabled ?? this.ngControl?.disabled ?? false;
  }
  set disabled(value: any) {
    this._disabled = value != null && value !== false;
  }
  private _disabled?: boolean;

  // TODO: Skipped for signal migration because:
  //  Accessor inputs cannot be migrated as they are too complex.
  @Input()
  get required() {
    return (
      this._required ?? this.ngControl?.control?.hasValidator(Validators.requiredTrue) ?? false
    );
  }
  set required(value: any) {
    this._required = value != null && value !== false;
  }
  private _required?: boolean;

  get hasError() {
    return !!(this.ngControl?.status === "INVALID" && this.ngControl?.touched);
  }

  get error(): [string, any] {
    const errors = this.ngControl?.errors ?? {};
    const key = Object.keys(errors)[0];
    return [key, errors[key]];
  }
}
