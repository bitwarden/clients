// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { NgTemplateOutlet } from "@angular/common";
import { Component, ContentChild, HostBinding, Input, Optional, Self, input } from "@angular/core";
import { ControlValueAccessor, NgControl, Validators } from "@angular/forms";

import { I18nPipe } from "@bitwarden/ui-common";

import { BitLabel } from "../form-control/label.component";

let nextId = 0;

@Component({
  selector: "bit-radio-group",
  templateUrl: "radio-group.component.html",
  imports: [NgTemplateOutlet, I18nPipe],
})
export class RadioGroupComponent implements ControlValueAccessor {
  selected: unknown;
  disabled = false;

  readonly name = input(undefined, {
    transform: (value: string | undefined) => value ?? this.ngControl?.name?.toString(),
  });

  readonly block = input(false);

  @HostBinding("attr.role") role = "radiogroup";
  // TODO: Skipped for migration because:
  //  This input is used in combination with `@HostBinding` and migrating would
  //  break.
  @HostBinding("attr.id") @Input() id = `bit-radio-group-${nextId++}`;
  @HostBinding("class") classList = ["tw-block", "tw-mb-4"];

  @ContentChild(BitLabel) protected label: BitLabel;

  constructor(@Optional() @Self() private ngControl?: NgControl) {
    if (ngControl != null) {
      ngControl.valueAccessor = this;
    }
  }

  get required() {
    return this.ngControl?.control?.hasValidator(Validators.required) ?? false;
  }

  // ControlValueAccessor
  onChange: (value: unknown) => void;
  onTouched: () => void;

  writeValue(value: boolean): void {
    this.selected = value;
  }

  registerOnChange(fn: (value: unknown) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  onInputChange(value: unknown) {
    this.selected = value;
    this.onChange(this.selected);
  }

  onBlur() {
    this.onTouched();
  }
}
