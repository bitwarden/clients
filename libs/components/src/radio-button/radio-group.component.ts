import { NgTemplateOutlet } from "@angular/common";
import { Component, HostBinding, Optional, Self, input, contentChild } from "@angular/core";
import { ControlValueAccessor, NgControl, Validators } from "@angular/forms";

import { I18nPipe } from "@bitwarden/ui-common";

import { BitLabelComponent } from "../form-control/label.component";

let nextId = 0;

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
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

  get name() {
    return this.ngControl?.name?.toString();
  }

  readonly block = input(false);

  @HostBinding("attr.role") role = "radiogroup";
  readonly id = input(`bit-radio-group-${nextId++}`);
  @HostBinding("class") classList = ["tw-block", "tw-mb-4"];

  protected readonly label = contentChild(BitLabelComponent);

  constructor(@Optional() @Self() private ngControl?: NgControl) {
    if (ngControl != null) {
      ngControl.valueAccessor = this;
    }
  }

  get required() {
    return this.ngControl?.control?.hasValidator(Validators.required) ?? false;
  }

  // ControlValueAccessor
  onChange?: (value: unknown) => void;
  onTouched?: () => void;

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
    this.onChange?.(this.selected);
  }

  onBlur() {
    this.onTouched?.();
  }
}
