import { booleanAttribute, Component, computed, inject, input, model } from "@angular/core";
import { ControlValueAccessor, NgControl, NG_VALUE_ACCESSOR, Validators } from "@angular/forms";

import { AriaDisableDirective } from "../a11y";
import { BitFormControlAbstraction } from "../form-control";

let nextId = 0;

/**
 * Switch component for toggling between two states. Switch actions are meant to take place immediately and are not to be used in a form where saving/submiting actions are required.
 */
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-switch",
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: SwitchComponent,
      multi: true,
    },
    { provide: BitFormControlAbstraction, useExisting: SwitchComponent },
  ],
  templateUrl: "switch.component.html",
  host: {
    "[id]": "this.id()",
    "[attr.aria-disabled]": "this.disabled",
  },
  hostDirectives: [AriaDisableDirective],
})
export class SwitchComponent implements ControlValueAccessor, BitFormControlAbstraction {
  private readonly ngControl = inject(NgControl, { optional: true, self: true });

  protected readonly size = input<"base" | "lg">("base");

  /**
   * Model signal for selected state binding when used outside of a form
   */
  protected readonly selected = model(false);

  readonly disabledInput = input(false, { transform: booleanAttribute, alias: "disabled" });

  protected readonly trackClasses = computed(() =>
    [
      "tw-flex",
      "tw-relative",
      "!tw-w-8",
      "tw-shrink-0",
      "tw-h-[1.125rem]",
      "tw-rounded-full",
      "after:tw-transition-[background-color]",
      "after:tw-absolute",
      "after:tw-inset-0",
      "after:tw-rounded-full",
      "after:tw-size-full",
      ...(this.disabled
        ? ["tw-bg-secondary-100"]
        : this.selected()
          ? [
              "tw-bg-primary-600",
              "[&:has(input:focus-visible)]:after:tw-bg-primary-700",
              "group-hover/switch-label:after:tw-bg-primary-700",
            ]
          : [
              "tw-bg-secondary-300",
              "[&:has(input:focus-visible)]:after:tw-bg-hover-default",
              "group-hover/switch-label:after:tw-bg-hover-default",
            ]),
    ].join(" "),
  );

  protected readonly thumbClasses = computed(() =>
    [
      "tw-absolute",
      "tw-z-10",
      "tw-block",
      "tw-size-3.5",
      "tw-top-[2px]",
      "tw-start-[2px]",
      "tw-bg-text-alt2",
      "tw-rounded-full",
      "tw-shadow-md",
      "tw-transform",
      "tw-transition-transform",
      ...(this.selected()
        ? [
            "tw-translate-x-[calc(theme(spacing.9)_-_(1.125rem_+_4px))]",
            "rtl:-tw-translate-x-[calc(theme(spacing.9)_-_(1.125rem_+_4px))]",
          ]
        : []),
    ].join(" "),
  );

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

  // ControlValueAccessor functions
  private notifyOnChange: (value: boolean) => void = () => {};
  private notifyOnTouch: () => void = () => {};

  writeValue(value: boolean): void {
    this.selected.set(value);
  }

  onChange(value: boolean): void {
    this.selected.set(value);

    if (this.notifyOnChange != undefined) {
      this.notifyOnChange(value);
    }
  }

  onTouch() {
    if (this.notifyOnTouch != undefined) {
      this.notifyOnTouch();
    }
  }

  registerOnChange(fn: (value: boolean) => void): void {
    this.notifyOnChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.notifyOnTouch = fn;
  }

  setDisabledState(_isDisabled: boolean) {
    // disabled state is read from ngControl directly via computed signal
  }
  // end ControlValueAccessor functions

  readonly id = input(`bit-switch-${nextId++}`);

  protected onInputChange(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.onChange(checked);
    this.onTouch();
  }

  get inputId() {
    return `${this.id()}-input`;
  }
}
