import { booleanAttribute, Component, HostBinding, input, Optional, Self } from "@angular/core";
import { NgControl, Validators } from "@angular/forms";

import { BitFormControlAbstraction } from "../form-control";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "input[type=checkbox][bitCheckbox]",
  template: "",
  providers: [{ provide: BitFormControlAbstraction, useExisting: CheckboxComponent }],
  host: {
    "[disabled]": "disabled",
  },
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
    "disabled:tw-cursor-default",
    "tw-inline-block",
    "tw-align-sub",
    "tw-flex-none", // Flexbox fix for bit-form-control
    "tw-h-6",
    "tw-w-6",
    "tw-rounded",
    // negative margin to negate the positioning added by the sizing
    "!-tw-mt-[1px]",
    "!-tw-mb-[1px]",
    "!-tw-ms-[1px]",
    "hover:tw-bg-bg-hover",

    "before:tw-content-['']",
    "before:tw-block",
    "before:tw-inset-1",
    "before:tw-absolute",
    "before:tw-bg-bg-tertiary",
    "before:tw-h-4",
    "before:tw-w-4",
    "before:tw-rounded",
    "before:tw-border",
    "before:tw-border-solid",
    "before:tw-border-border-strong",
    "before:tw-box-border",

    "after:tw-content-['']",
    "after:tw-block",
    "after:tw-absolute",
    "after:tw-inset-1",
    "after:tw-h-4",
    "after:tw-w-4",
    "after:tw-box-border",

    // if it exists, the parent form control handles focus
    "[&:not(bit-form-control_*)]:focus-visible:before:tw-ring-2",
    "[&:not(bit-form-control_*)]:focus-visible:before:tw-ring-offset-2",
    "[&:not(bit-form-control_*)]:focus-visible:before:tw-ring-border-focus",

    "disabled:hover:tw-bg-transparent",
    "disabled:before:tw-cursor-default",
    "disabled:before:tw-border-border-base",
    "disabled:before:hover:tw-border-border-base",
    "disabled:before:tw-bg-bg-inactive",
    "disabled:hover:before:tw-bg-bg-inactive",

    "checked:before:tw-bg-bg-brand",
    "checked:before:tw-border-border-brand",
    "checked:before:hover:tw-bg-bg-brand",
    "checked:before:hover:tw-border-border-brand",
    "[&>label:hover]:checked:before:tw-bg-bg-brand",
    "[&>label:hover]:checked:before:tw-border-border-brand",
    "checked:after:tw-bg-fg-contrast",
    "checked:after:tw-mask-position-[center]",
    "checked:after:tw-mask-repeat-[no-repeat]",

    "checked:disabled:before:tw-border-border-base",
    "checked:disabled:hover:before:tw-border-border-base",
    "checked:disabled:before:tw-bg-bg-inactive",
    "checked:disabled:after:tw-bg-fg-inactive",

    "[&:not(:indeterminate)]:checked:after:tw-mask-image-[var(--mask-image)]",
    "indeterminate:after:tw-mask-image-[var(--indeterminate-mask-image)]",

    "indeterminate:before:tw-bg-bg-brand",
    "indeterminate:before:tw-border-border-brand",
    "indeterminate:hover:before:tw-bg-bg-brand",
    "indeterminate:hover:before:tw-border-border-brand",
    "[&>label:hover]:indeterminate:before:tw-bg-bg-brand",
    "[&>label:hover]:indeterminate:before:tw-border-border-brand",
    "indeterminate:after:tw-bg-fg-contrast",
    "indeterminate:after:tw-mask-position-[center]",
    "indeterminate:after:tw-mask-repeat-[no-repeat]",
    "indeterminate:after:tw-mask-image-[var(--indeterminate-mask-image)]",
    "indeterminate:disabled:before:tw-border-border-base",
    "indeterminate:disabled:hover:before:tw-border-border-base",
    "indeterminate:disabled:before:tw-bg-bg-inactive",
    "indeterminate:disabled:after:tw-bg-fg-inactive",
  ];

  constructor(@Optional() @Self() private ngControl?: NgControl) {}

  @HostBinding("style.--mask-image")
  protected maskImage =
    `url('data:image/svg+xml,%3Csvg class="svg" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="10" height="10" viewBox="0 0 10 10"%3E%3Cpath d="M0.5 6.2L2.9 8.6L9.5 1.4" fill="none" stroke="white" stroke-width="2"%3E%3C/path%3E%3C/svg%3E')`;

  @HostBinding("style.--indeterminate-mask-image")
  protected indeterminateImage =
    `url('data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 13 13"%3E%3Cpath stroke="%23fff" stroke-width="2" d="M2.5 6.5h8"/%3E%3C/svg%3E%0A')`;

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
