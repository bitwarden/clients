import {
  booleanAttribute,
  Component,
  computed,
  inject,
  Injector,
  input,
  model,
  signal,
} from "@angular/core";
import { ControlValueAccessor, NgControl, NG_VALUE_ACCESSOR, Validators } from "@angular/forms";

import { AriaDisableDirective } from "../a11y";
import { BitFormControlAbstraction } from "../form-control";
import { IconComponent } from "../icon";

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
  imports: [IconComponent],
})
export class SwitchComponent implements ControlValueAccessor, BitFormControlAbstraction {
  private readonly injector = inject(Injector);
  private get ngControl(): NgControl | null {
    return this.injector.get(NgControl, null, { self: true, optional: true });
  }

  readonly size = signal<"base" | "large">("base");

  readonly ariaLabelledBy = signal<string | undefined>(undefined);
  readonly ariaDescribedBy = signal<string | undefined>(undefined);

  /**
   * Model signal for selected state binding when used outside of a form
   */
  protected readonly selected = model(false);

  readonly disabledInput = input(false, { transform: booleanAttribute, alias: "disabled" });
  private readonly _formsDisabled = signal(false);

  protected readonly checkIndicatorClasses = computed(() =>
    [
      "tw-transition-opacity",
      ...(this.selected() ? ["tw-opacity-100"] : ["tw-opacity-0"]),
      ...(this.size() === "large" ? ["tw-text-[.625rem]"] : ["tw-text-[.5rem]"]),
    ].join(" "),
  );

  protected readonly trackClasses = computed(() =>
    [
      "tw-flex",
      "tw-relative",
      "tw-shrink-0",
      "tw-rounded-full",
      "tw-text-fg-brand",
      "after:tw-transition-[background-color]",
      "after:tw-absolute",
      "after:tw-inset-0",
      "after:tw-rounded-full",
      "after:tw-size-full",
      ...(this.size() === "large" ? ["!tw-w-11", "!tw-h-6"] : ["!tw-w-8", "tw-h-[1.125rem]"]),
      ...(this.disabled
        ? // design calls for using a bg color as a text color which the config does not allow
          ["tw-bg-bg-inactive", "tw-text-[var(--color-bg-inactive)]"]
        : this.selected()
          ? [
              "tw-bg-bg-brand",
              "[&:has(input:focus-visible)]:after:tw-bg-bg-brand-strong",
              "[&:has(input:focus-visible)]:tw-text-fg-brand-strong",
              "[label:hover_&]:after:tw-bg-bg-brand-strong",
              "[label:hover_&]:tw-text-fg-brand-strong",
            ]
          : [
              "tw-bg-bg-gray",
              "[&:has(input:focus-visible)]:after:tw-bg-bg-gray-strong",
              "[label:hover_&]:after:tw-bg-bg-gray-strong",
            ]),
    ].join(" "),
  );

  protected readonly thumbClasses = computed(() =>
    [
      "tw-flex",
      "tw-items-center",
      "tw-justify-center",
      "tw-absolute",
      "tw-z-10",
      "tw-block",
      "tw-bg-text-alt2",
      "tw-rounded-full",
      "tw-shadow-md",
      "tw-transform",
      "tw-transition-transform",
      ...(this.size() === "large"
        ? ["tw-size-[1.125rem]", "tw-top-[3px]", "tw-start-[3px]"]
        : ["tw-size-3.5", "tw-top-[2px]", "tw-start-[2px]"]),

      ...(this.size() === "large" && this.selected()
        ? [
            "tw-translate-x-[calc(theme(spacing.11)_-_(1.125rem_+_6px))]",
            "rtl:-tw-translate-x-[calc(theme(spacing.11)_-_(1.125rem_+_6px))]",
          ]
        : []),

      ...(this.size() === "base" && this.selected()
        ? [
            "tw-translate-x-[calc(theme(spacing.8)_-_(.875rem_+_4px))]",
            "rtl:-tw-translate-x-[calc(theme(spacing.8)_-_(.875rem_+_4px))]",
          ]
        : []),

      // design calls for using a fg color as a bg color which the config does not allow
      ...(this.disabled && this.selected() ? ["tw-bg-[var(--color-fg-inactive)]"] : []),
    ].join(" "),
  );

  // TODO migrate to computed signal when Angular adds signal support to reactive forms
  // https://bitwarden.atlassian.net/browse/CL-819
  get disabled() {
    return this.disabledInput() || this._formsDisabled() || false;
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

  setDisabledState(isDisabled: boolean) {
    this._formsDisabled.set(isDisabled);
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
