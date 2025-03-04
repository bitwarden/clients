// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { NgTemplateOutlet } from "@angular/common";
import { Component, ContentChild, HostBinding, Input, Optional, Self } from "@angular/core";
import { ControlValueAccessor, NgControl, Validators } from "@angular/forms";

import { I18nPipe } from "@bitwarden/ui-common";

import { BitLabel } from "../form-control/label.component";

let nextId = 0;

@Component({
  selector: "bit-radio-group",
  templateUrl: "radio-group.component.html",
  standalone: true,
  imports: [NgTemplateOutlet, I18nPipe],
})
export class RadioGroupComponent implements ControlValueAccessor {
  selected: unknown;
  disabled = false;

  private _name?: string;
  @Input() get name() {
    return this._name ?? this.ngControl?.name?.toString();
  }
  set name(value: string) {
    this._name = value;
  }

  @Input() block = false;

  @HostBinding("attr.role") role = "radiogroup";
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
