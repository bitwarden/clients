import { Component, HostBinding, Input, input } from "@angular/core";

import { FormControlModule } from "../form-control/form-control.module";

import { RadioGroupComponent } from "./radio-group.component";
import { RadioInputComponent } from "./radio-input.component";

let nextId = 0;

@Component({
  selector: "bit-radio-button",
  templateUrl: "radio-button.component.html",
  imports: [FormControlModule, RadioInputComponent],
})
export class RadioButtonComponent {
  // TODO: Skipped for migration because:
  //  This input is used in combination with `@HostBinding` and migrating would
  //  break.
  @HostBinding("attr.id") @Input() id = `bit-radio-button-${nextId++}`;
  @HostBinding("class") get classList() {
    return [this.block ? "tw-block" : "tw-inline-block", "tw-mb-1", "[&_bit-hint]:tw-mt-0"];
  }

  readonly value = input<unknown>(undefined);
  readonly disabled = input(false);

  constructor(private groupComponent: RadioGroupComponent) {}

  get inputId() {
    return `${this.id}-input`;
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
