import { booleanAttribute, Directive, inject, input } from "@angular/core";

import { FormControlGroupComponent } from "../form-control/form-control-group.component";

let nextId = 0;

@Directive()
export class RadioButtonBaseDirective {
  private groupComponent = inject(FormControlGroupComponent);

  readonly id = input(`bit-radio-button-${nextId++}`);
  readonly value = input<unknown>();
  readonly disabled = input(false, { transform: booleanAttribute });

  constructor() {
    this.groupComponent.registerRadioChild();
  }

  get inputId() {
    return `${this.id()}-input`;
  }

  get name() {
    return this.groupComponent.name;
  }

  get selected() {
    return this.groupComponent.selectedValues().includes(this.value());
  }

  get groupDisabled() {
    return this.groupComponent.groupDisabled();
  }

  get block() {
    return this.groupComponent.block();
  }

  onInputChange() {
    this.groupComponent.onItemChange(this.value());
  }

  onBlur() {
    this.groupComponent.onBlur();
  }
}
