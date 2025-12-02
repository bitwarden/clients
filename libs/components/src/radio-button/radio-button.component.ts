import { Component, HostBinding, input } from "@angular/core";

import { FormControlModule } from "../form-control/form-control.module";

import { RadioGroupComponent } from "./radio-group.component";
import { RadioInputComponent } from "./radio-input.component";

let nextId = 0;

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-radio-button",
  templateUrl: "radio-button.component.html",
  imports: [FormControlModule, RadioInputComponent],
  host: {
    "[id]": "this.id()",
  },
})
export class RadioButtonComponent {
  readonly id = input(`bit-radio-button-${nextId++}`);
  @HostBinding("class") get classList() {
    return [this.block ? "tw-block" : "tw-inline-block", "tw-mb-1", "[&_bit-hint]:tw-mt-0"];
  }

  readonly value = input<unknown>();
  readonly disabled = input(false);

  constructor(private groupComponent: RadioGroupComponent) {}

  get inputId() {
    return `${this.id()}-input`;
  }

  get name() {
    return this.groupComponent.name;
  }

  get selected() {
    return this.groupComponent.selected === this.value();
  }

  get groupDisabled() {
    return this.groupComponent.disabled;
  }

  get block() {
    return this.groupComponent.block();
  }

  protected onInputChange() {
    this.groupComponent.onInputChange(this.value());
  }

  protected onBlur() {
    this.groupComponent.onBlur();
  }
}
