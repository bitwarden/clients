// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { NgTemplateOutlet } from "@angular/common";
import { Component, ContentChild, HostBinding, Optional, Input, Self, input } from "@angular/core";
import { ControlValueAccessor, NgControl, Validators } from "@angular/forms";

import { I18nPipe } from "@bitwarden/ui-common";

import { BitLabel } from "../form-control/label.component";

let nextId = 0;

@Component({
  selector: "bit-radio-group",
  templateUrl: "radio-group.component.html",
  imports: [NgTemplateOutlet, I18nPipe],
  host: {
    "[id]": "id()",
  },
})
export class RadioGroupComponent implements ControlValueAccessor {
  selected: unknown;
  disabled = false;

  // TODO: Skipped for signal migration because:
  //  Accessor inputs cannot be migrated as they are too complex.
  private _name?: string;
  @Input() get name() {
    return this._name ?? this.ngControl?.name?.toString();
  }
  set name(value: string) {
    this._name = value;
  }

  readonly block = input(false);

  @HostBinding("attr.role") role = "radiogroup";
  readonly id = input(`bit-radio-group-${nextId++}`);
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
