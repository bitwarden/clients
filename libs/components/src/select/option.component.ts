// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Input, booleanAttribute } from "@angular/core";

import { Option } from "./option";

@Component({
  selector: "bit-option",
  template: `<ng-template><ng-content></ng-content></ng-template>`,
})
export class OptionComponent<T = unknown> implements Option<T> {
  // TODO: Skipped for migration because:
  //  This input overrides a field from a superclass, while the superclass field
  //  is not migrated.
  @Input()
  icon?: string;

  // TODO: Skipped for migration because:
  //  This input overrides a field from a superclass, while the superclass field
  //  is not migrated.
  @Input({ required: true })
  value: T;

  // TODO: Skipped for migration because:
  //  This input overrides a field from a superclass, while the superclass field
  //  is not migrated.
  @Input({ required: true })
  label: string;

  // TODO: Skipped for migration because:
  //  This input overrides a field from a superclass, while the superclass field
  //  is not migrated.
  @Input({ transform: booleanAttribute })
  disabled: boolean;
}
