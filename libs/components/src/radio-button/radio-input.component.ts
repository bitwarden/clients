import {
  booleanAttribute,
  Component,
  computed,
  HostBinding,
  inject,
  input,
  Optional,
  Self,
} from "@angular/core";
import { NgControl, Validators } from "@angular/forms";

import { BitFormControlAbstraction } from "../form-control";
import { FormControlCardComponent } from "../form-control/form-control-card.component";
import { FormControlGroupComponent } from "../form-control/form-control-group.component";

let nextId = 0;

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "input[type=radio][bitRadio]",
  template: "",
  providers: [{ provide: BitFormControlAbstraction, useExisting: RadioInputComponent }],
  host: {
    "[id]": "this.id()",
    "[checked]": "isGroupChecked()",
    "[disabled]": "disabled",
    "[attr.name]": "groupName",
    "[attr.aria-labelledby]": "cardLabelledBy()",
    "[attr.aria-describedby]": "cardDescribedBy()",
    "(change)": "onGroupChange()",
    "(blur)": "onGroupBlur()",
  },
})
export class RadioInputComponent implements BitFormControlAbstraction {
  protected readonly group = inject(FormControlGroupComponent, { optional: true });
  private readonly card = inject(FormControlCardComponent, { optional: true });

  protected readonly isGroupChecked = computed(
    () => this.group?.selectedValues().includes(this.value()) ?? false,
  );

  protected readonly cardLabelledBy = computed(() => this.card?.labelId ?? null);
  protected readonly cardDescribedBy = computed(() => {
    if (!this.card) {
      return null;
    }
    return (
      [this.card.effectiveErrorId, this.card.effectiveHintId()].filter(Boolean).join(" ") || null
    );
  });

  readonly id = input(`bit-radio-input-${nextId++}`);
  readonly value = input<unknown>();

  @HostBinding("class")
  protected inputClasses = [
    "tw-appearance-none",
    /**
     * tailwind's outline-none does not fully remove it because it supports forced colors mode, so
     * we need to do it manually
     */
    "focus-visible:[outline:none]",
    "tw-relative",
    "tw-transition",
    "tw-cursor-pointer",
    "tw-inline-block",
    "tw-w-6",
    "tw-h-6",
    "tw-rounded-full",
    "tw-flex-none", // Flexbox fix for bit-form-control
    "hover:tw-bg-bg-hover",
    "focus-visible:tw-bg-bg-hover",
    "[&>label:hover]:tw-bg-bg-hover",
    "disabled:hover:tw-bg-transparent",
    "disabled:[&>label:hover]:!tw-bg-transparent",

    "hover:before:tw-border-2",
    "[&>label:hover]:before:tw-border-2",
    "focus-visible:before:tw-border-2",
    "[&>label:focus-visible]:before:tw-border-2",

    // if it exists, the parent form control handles focus
    "[&:not(bit-form-control_*,bit-form-control-card_*)]:focus-visible:before:tw-ring-2",
    "[&:not(bit-form-control_*,bit-form-control-card_*)]:focus-visible:before:tw-ring-offset-2",
    "[&:not(bit-form-control_*,bit-form-control-card_*)]:focus-visible:before:tw-ring-border-focus",
    // use outline instead of unsupported ring for forced colors mode
    "[&:not(bit-form-control_*,bit-form-control-card_*)]:focus-visible:forced-colors:tw-outline-none",

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
    "checked:focus-visible:tw-bg-transparent",

    "checked:after:tw-bg-bg-brand",
    // forced-colors strips the background; use CanvasText so the svg stays visible
    "forced-colors:checked:after:tw-bg-[CanvasText]",

    "checked:before:tw-border-2",
    "checked:before:tw-border-border-brand",

    "checked:disabled:after:tw-bg-fg-inactive",
    "checked:disabled:hover:before:tw-border-border-base",
  ];

  constructor(@Optional() @Self() private ngControl?: NgControl) {
    this.group?.registerRadioChild();
  }

  get groupName(): string | null {
    return this.group?.name ?? null;
  }

  protected onGroupChange() {
    if (this.group) {
      this.group.onItemChange(this.value());
    }
  }

  protected onGroupBlur() {
    this.group?.onBlur();
  }

  readonly disabledInput = input(false, { transform: booleanAttribute, alias: "disabled" });

  // TODO migrate to computed signal when Angular adds signal support to reactive forms
  // https://bitwarden.atlassian.net/browse/CL-819
  get disabled() {
    return this.disabledInput() || this.ngControl?.disabled || this.group?.groupDisabled() || false;
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

  get inputId(): string {
    return this.id();
  }
}
