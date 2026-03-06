import { booleanAttribute, Directive, inject, input } from "@angular/core";

import { RadioGroupComponent } from "./radio-group.component";

let nextId = 0;

@Directive()
export class RadioButtonBaseDirective {
  private groupComponent = inject(RadioGroupComponent);

  readonly id = input(`bit-radio-button-${nextId++}`);
  readonly value = input<unknown>();
  readonly disabled = input(false, { transform: booleanAttribute });

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

  onInputChange() {
    this.groupComponent.onInputChange(this.value());
  }

  onBlur() {
    this.groupComponent.onBlur();
  }
}
