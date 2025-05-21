// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Input, booleanAttribute } from "@angular/core";

import { Option } from "./option";

@Component({
  selector: "bit-option",
  template: `<ng-template><ng-content></ng-content></ng-template>`,
  standalone: true,
})
export class OptionComponent<T = unknown> implements Option<T> {
  @Input()
  icon?: string;

  @Input({ required: true })
  value: T;

  @Input({ required: true })
  label: string;

  @Input({ transform: booleanAttribute })
  disabled: boolean;
}
