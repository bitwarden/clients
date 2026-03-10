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
    "tw-rounded-lg",
    // negative margin to negate the positioning added by the sizing
    "!-tw-mt-[1px]",
    "!-tw-mb-[1px]",
    "!-tw-ms-[1px]",
    "hover:tw-bg-bg-hover",
    "focus-visible:tw-bg-bg-hover",

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
    "[&:not(bit-form-control_*, bit-form-control-card)]:focus-visible:before:tw-ring-2",
    "[&:not(bit-form-control_*, bit-form-control-card)]:focus-visible:before:tw-ring-offset-2",
    "[&:not(bit-form-control_*, bit-form-control-card)]:focus-visible:before:tw-ring-border-focus",

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

    "[&:not(:indeterminate)]:checked:after:tw-mask-image-[var(--check-mask)]",
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

  @HostBinding("style.--check-mask")
  protected checkMask =
    `url("data:image/svg+xml,%3Csvg width='16' height='16' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M9.54972 15.15L18.0247 6.675C18.2247 6.475 18.4581 6.375 18.7247 6.375C18.9914 6.375 19.2247 6.475 19.4247 6.675C19.6247 6.875 19.7247 7.1125 19.7247 7.3875C19.7247 7.6625 19.6247 7.9 19.4247 8.1L10.2497 17.3C10.0497 17.5 9.81639 17.6 9.54972 17.6C9.28305 17.6 9.04972 17.5 8.84972 17.3L4.54972 13C4.34972 12.8 4.25389 12.5625 4.26222 12.2875C4.27055 12.0125 4.37472 11.775 4.57472 11.575C4.77472 11.375 5.01222 11.275 5.28722 11.275C5.56222 11.275 5.79972 11.375 5.99972 11.575L9.54972 15.15Z' fill='currentColor'/%3E%3C/svg%3E")`;

  @HostBinding("style.--indeterminate-mask-image")
  protected indeterminateImage =
    `url("data:image/svg+xml,%3Csvg width='16' height='16' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M6 13C5.71667 13 5.47917 12.9042 5.2875 12.7125C5.09583 12.5208 5 12.2833 5 12C5 11.7167 5.09583 11.4792 5.2875 11.2875C5.47917 11.0958 5.71667 11 6 11H18C18.2833 11 18.5208 11.0958 18.7125 11.2875C18.9042 11.4792 19 11.7167 19 12C19 12.2833 18.9042 12.5208 18.7125 12.7125C18.5208 12.9042 18.2833 13 18 13H6Z' fill='currentColor'/%3E%3C/svg%3E")`;

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
