// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, booleanAttribute, input } from "@angular/core";

import { MappedOptionComponent } from "./option";

@Component({
  selector: "bit-option",
  template: `<ng-template><ng-content></ng-content></ng-template>`,
})
export class OptionComponent<T = unknown> implements MappedOptionComponent<T> {
  icon = input<string>();

  value = input.required<T>();

  label = input.required<string>();

  disabled = input(undefined, { transform: booleanAttribute });
}
