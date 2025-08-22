import { Component, booleanAttribute, input } from "@angular/core";

import { MappedOptionComponent } from "./option";

@Component({
  selector: "bit-option",
  template: `<ng-template><ng-content></ng-content></ng-template>`,
})
export class OptionComponent<T = unknown> implements MappedOptionComponent<T> {
  readonly icon = input<string>();

  readonly value = input.required<T>();

  readonly label = input.required<string>();

  readonly disabled = input(undefined, { transform: booleanAttribute });
}
